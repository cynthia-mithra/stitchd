-- Phase 14 — Bundle discounts (seller sets up, bag applies it).
--
-- A seller can offer a percentage discount to buyers who purchase 2+ of their
-- items at once. The discount is configured per-seller on the profiles table and
-- applied automatically in the bag and at checkout (one seller's discount only
-- ever applies to that seller's own items).
--
-- 1. profiles.bundle_discount_enabled    — the seller's on/off switch (default off)
-- 2. profiles.bundle_discount_percentage — 5 / 10 / 15 / 20 (default 10)
-- 3. orders.bundle_discount_percentage   — the % applied to this order's seller
-- 4. orders.bundle_discount_amount_pence — the discount taken off this order, in
--                                          pence (this listing's share of the
--                                          seller's bundle discount)
--
-- Like the rest of Phase 10–14 this is plain idempotent DDL with NO RLS, so it
-- inherits the project's existing access model.

-- Seller configuration (issue PART 1).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bundle_discount_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bundle_discount_percentage integer DEFAULT 10;

-- Per-order record of an applied bundle discount (issue PART 6). Nullable — only
-- set on order rows whose seller's bundle discount was applied at checkout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_discount_percentage integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_discount_amount_pence integer;

-- The shop grid / storefront read the set of sellers with the discount enabled;
-- index the flag so that lookup stays cheap as the table grows.
CREATE INDEX IF NOT EXISTS profiles_bundle_discount_idx ON profiles (bundle_discount_enabled);
