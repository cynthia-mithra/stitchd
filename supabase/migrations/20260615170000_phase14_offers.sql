-- Phase 14 — Make an offer (buyer side).
--
-- A buyer proposes a price below the asking price; the seller has 48 hours to
-- respond (the seller-response flow lands in a later issue — this migration and
-- the feature it backs are buyer-side only). One row per offer.
--
-- `status` walks pending → accepted / declined / expired / withdrawn. Amounts are
-- stored in pence (integer) to match the rest of the money handling. `expires_at`
-- defaults to 48 hours out so a freshly inserted offer carries its own deadline.
--
-- Matches the project's other Phase 10–14 migrations: plain idempotent DDL, no
-- RLS (PostgREST access is governed the same way as wishlists / comments — the
-- anon key inserts the buyer's own offer, exactly what the buyer flow needs).
-- `offers_enabled` lets a seller turn offers off per-listing (default ON);
-- `minimum_offer_pence` is an optional floor below which buyers cannot offer.

CREATE TABLE IF NOT EXISTS offers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id),
  buyer_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  amount_pence integer NOT NULL,
  status text DEFAULT 'pending',
  -- values: pending, accepted, declined, expired, withdrawn
  message text,
  expires_at timestamp with time zone DEFAULT now() + interval '48 hours',
  created_at timestamp with time zone DEFAULT now()
);

-- Per-listing offer settings.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS offers_enabled boolean DEFAULT true;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS minimum_offer_pence integer;

-- Hot paths: a buyer's pending offer on a listing (toggles the MAKE AN OFFER
-- button to OFFER PENDING), and the seller's incoming offers (for the later
-- seller-response screen).
CREATE INDEX IF NOT EXISTS offers_listing_buyer_idx ON offers (listing_id, buyer_id);
CREATE INDEX IF NOT EXISTS offers_seller_idx ON offers (seller_id);
