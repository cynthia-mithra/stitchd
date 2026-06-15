-- Phase 14 — Offer checkout (pay an accepted offer via Stripe).
--
-- Builds on the two earlier offer migrations:
--   • 20260615170000_phase14_offers.sql          (buyer-side offers table)
--   • 20260615180000_phase14_offers_response.sql (seller accept/decline + cron)
--
-- This migration adds the bookkeeping the checkout + payment-expiry flow needs:
--
--   1. offers.accepted_at — stamped when a seller accepts. An accepted offer
--      gives the buyer a 24-hour window to pay; we time that window from the
--      acceptance, not the original offer (offers.created_at), so a late accept
--      doesn't hand the buyer a window that's already expired. The expire-offers
--      sweep and the /offers "pay within X hours" countdown both read this.
--
--   2. offers.payment_reminder_sent — the hourly expire-offers sweep emails the
--      buyer a "your offer expires soon" reminder once the 24h window is half
--      gone (12h left). This flag makes that send idempotent so the hourly cron
--      doesn't re-email every hour.
--
--   3. orders.offer_accepted — the webhook records offer purchases in the same
--      orders table as normal sales; this flag marks the rows that came from an
--      accepted offer (so order history / emails can note the saving). The
--      webhook insert self-heals around a missing column, but we add it here so
--      the data is captured wherever the migration has run.
--
-- Like the rest of Phase 10–14 this is plain idempotent DDL with NO RLS, so it
-- inherits the project's existing access model.

-- 1. When the seller accepted (drives the 24h payment window).
ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;

-- 2. Has the 12-hour "pay soon" reminder email already gone out?
ALTER TABLE offers ADD COLUMN IF NOT EXISTS payment_reminder_sent boolean DEFAULT false;

-- 3. Mark orders that came from an accepted offer (vs a normal sale).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_accepted boolean DEFAULT false;

-- The payment-expiry sweep filters accepted offers by accepted_at; index it
-- alongside the existing (status, expires_at) index from the response migration.
CREATE INDEX IF NOT EXISTS offers_status_accepted_idx ON offers (status, accepted_at);

-- ── Payment-expiry note ───────────────────────────────────────────────────────
-- The hourly `expire-offers` cron (scheduled in 20260615180000) already POSTs the
-- expire-offers Edge Function. That function is extended in this phase to ALSO
-- sweep accepted-but-unpaid offers (24h after accepted_at): mark them 'expired',
-- re-enable offers on the listing, notify both parties, and send the 12h reminder
-- email. No new schedule is needed — the same hourly job now drives both sweeps.
--
-- The issue's pure-SQL fallback (kept here for reference only — the Edge Function
-- is the live path because it also sends the notifications/email a bare UPDATE
-- can't):
--   UPDATE offers
--   SET status = 'expired'
--   WHERE status = 'accepted'
--     AND COALESCE(accepted_at, created_at) < now() - interval '24 hours';
