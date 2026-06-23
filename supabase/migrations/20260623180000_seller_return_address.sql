-- Seller return address (ship-from).
--
-- Where a seller posts sold items from — needed for postage labels and returns.
-- Only ever shared with couriers, never shown publicly. Used by the buy-label
-- Edge Function as the label's "from" address.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_line1 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_line2 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_postcode text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ship_from_country text;
