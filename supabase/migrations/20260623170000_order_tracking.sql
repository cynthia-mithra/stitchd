-- Order tracking.
--
-- The seller adds a tracking number when they dispatch; the buyer gets a
-- "Track parcel" link to the carrier's tracking page. tracking_carrier mirrors
-- the chosen postage carrier so the right tracking URL can be built.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_carrier text;
