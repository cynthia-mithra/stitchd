-- Phase 13 — Seller storefronts + follow a seller.
--
-- Two pieces of schema:
--   1. profiles — storefront customisation columns (banner, bio, tagline,
--      Instagram, location) edited from the dashboard TOOLS tab and rendered on
--      the public seller storefront.
--   2. follows — one row per (follower → following) relationship, backing the
--      FOLLOW button, follower counts, the FOLLOWING feed, and the MY FOLLOWING
--      list. The table is also read/written by the existing db.follow/unfollow/
--      getFollowing/getFollowers helpers (added in an earlier phase); this
--      migration makes the backing table explicit so a fresh database has it.
--
-- Like the other Phase 10/11/12 tables this is a plain CREATE with NO RLS
-- policies, so it inherits the project's existing access model — the same one
-- every other db.* insert relies on.

-- 1. profiles — storefront fields. All optional; an unset banner falls back to a
--    solid #FF1493 pink banner in the UI, an unset bio hides the ABOUT section.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_banner_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_bio        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_tagline    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_instagram  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_location   text;

-- 2. follows — follower → following edges. UNIQUE(follower_id, following_id)
--    keeps a double-follow a harmless 409 and makes the FOLLOW button idempotent.
CREATE TABLE IF NOT EXISTS follows (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  uuid REFERENCES auth.users(id),
  following_id uuid REFERENCES auth.users(id),
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

-- 3. Storage bucket for storefront banner uploads (mirrors the listings/looks
--    buckets). Public so the banner renders without a signed URL. No-op if the
--    storage schema isn't present (e.g. a bare Postgres used only for the REST
--    tables above).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('storefront-banners', 'storefront-banners', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
