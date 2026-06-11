-- Phase 10e — Shop the Look.
--
-- Curated outfit collections ("looks") made of multiple listings from any
-- seller. A look can be created by a seller or by the Stitch'd admin. Each item
-- in a look links back to its listing detail page and is individually shoppable.
--
-- Tables follow the same plain-CREATE convention as the other Phase 10 tables
-- (wishlists, bundles, feature_interest): no RLS policies are declared here, so
-- the tables inherit the project's existing access model (the same one the app
-- already relies on for inserts via the user / anon token).

-- 1. looks — one row per curated outfit.
CREATE TABLE IF NOT EXISTS looks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_by_type text CHECK (created_by_type IN ('seller', 'admin')),
  cover_image_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. look_items — the listings that make up a look, in display order. Cascades
--    on delete so removing a look (or a listing) tidies up its join rows.
CREATE TABLE IF NOT EXISTS look_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  look_id uuid REFERENCES looks(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  position integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Helpful indexes for the embedded look_items(...) reads the app makes.
CREATE INDEX IF NOT EXISTS look_items_look_id_idx ON look_items(look_id);
CREATE INDEX IF NOT EXISTS look_items_listing_id_idx ON look_items(listing_id);

-- 3. is_admin flag on profiles — identifies the Stitch'd admin account. Looks
--    created by an admin show "Curated by Stitch'd". Defaults false so every
--    existing account stays a normal seller until flagged.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE profiles SET is_admin = false WHERE is_admin IS NULL;

-- NOTE (manual step, see PR description):
--   1. Create a public Storage bucket named "looks" (cover images upload there).
--   2. Set is_admin = true for the Stitch'd admin account, e.g.
--        UPDATE profiles SET is_admin = true WHERE id = '<ADMIN_USER_ID>';
