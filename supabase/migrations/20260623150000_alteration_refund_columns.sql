-- Alteration refund tracking.
--
-- The refund-order Edge Function records a Stripe refund on the alteration when
-- an admin resolves a tailoring dispute as "refunded", so it's auditable and
-- idempotent (the same booking is never refunded twice).

ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone;
