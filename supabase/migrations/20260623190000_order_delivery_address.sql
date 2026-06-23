-- Buyer delivery address on orders.
--
-- Stripe collects the buyer's shipping address at checkout; the webhook stores it
-- here as JSON so the seller has somewhere to post to (and can buy a label).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address jsonb;
