-- Order refund tracking.
--
-- The refund-order Edge Function (issued when an admin resolves a dispute as
-- "refunded") records the Stripe refund id + timestamp on the order so a refund
-- is auditable and idempotent (we never refund the same order twice).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_refund_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone;
