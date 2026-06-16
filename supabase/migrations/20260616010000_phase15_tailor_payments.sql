-- Phase 15 — Tailor booking payments + commission.
--
-- Builds on phase15 alteration_requests. When a buyer ACCEPTS a tailor's quote
-- they pay the full quote amount via Stripe; Stitch'd keeps a 15% commission and
-- the rest is owed to the tailor as a payout. Payment lands on the
-- create-alteration-checkout Edge Function (hosted Stripe Checkout) and the
-- result arrives async on stripe-webhook (metadata.type='alteration').
--
-- Like the other phase tables this is a plain ALTER/CREATE with NO RLS policies,
-- inheriting the project's existing access model. All amounts are in pence, GBP.

-- 1. Payment columns on the request. quote_pence (the tailor's quote) already
--    exists from the alteration_requests migration; quote_amount_pence mirrors it
--    at checkout time alongside the commission split so the dashboard/earnings
--    can read the booking financials straight off the row.
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS quote_amount_pence      integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS commission_amount_pence integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS tailor_payout_pence     integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS stripe_session_id       text;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS paid_at                 timestamp with time zone;

-- 2. One payout row per paid booking. amount_pence is the full booking value the
--    buyer paid; commission_pence is the 15% Stitch'd fee; the tailor is owed
--    (amount_pence - commission_pence). status: pending (paid into Stitch'd,
--    awaiting buyer's completion confirmation) | paid (released to the tailor) |
--    failed. Actual money movement to the tailor needs Stripe Connect — see the
--    PR description; for now this table is the source of truth for what's owed.
CREATE TABLE IF NOT EXISTS tailor_payouts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id             uuid REFERENCES tailors(id),
  alteration_request_id uuid REFERENCES alteration_requests(id),
  amount_pence          integer NOT NULL,
  commission_pence      integer NOT NULL,
  stripe_session_id     text,
  status                text DEFAULT 'pending', -- pending | paid | failed
  created_at            timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tailor_payouts_tailor_idx  ON tailor_payouts(tailor_id);
CREATE INDEX IF NOT EXISTS tailor_payouts_request_idx ON tailor_payouts(alteration_request_id);
CREATE INDEX IF NOT EXISTS tailor_payouts_status_idx  ON tailor_payouts(status);
