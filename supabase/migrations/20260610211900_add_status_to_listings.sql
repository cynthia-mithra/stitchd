-- Add a `status` column to the listings table.
--
-- The stripe-checkout Edge Function selects `status` to refuse pieces that are
-- already sold, and the stripe-webhook Edge Function sets `status = 'sold'`
-- after a successful purchase. Without this column the checkout query fails with
-- "column listings.status does not exist".
--
-- Existing rows default to 'active' so nothing already listed is affected.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Backfill any rows that predate the default (NULL) so the frontend and the
-- checkout availability check treat them as active.
UPDATE listings SET status = 'active' WHERE status IS NULL;
