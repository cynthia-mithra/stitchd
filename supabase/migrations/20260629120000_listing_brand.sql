-- Listing brand (optional).
--
-- Vinted-style optional brand on a listing. Sellers pick a popular South Asian
-- label from a curated list, or type their own. Free-text so any brand is
-- allowed; null when the seller leaves it blank.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS brand text;
