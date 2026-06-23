-- Delivery (postage) on orders.
--
-- The bag checkout now lets the buyer pick a courier (Vinted-style); the chosen
-- option is added to the Stripe total and recorded on the order so Orders /
-- analytics can show how it shipped. Idempotent so it's safe on deployments
-- where these columns already exist.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS postage_carrier text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postage_amount numeric;
