-- Phase 13 — Seller storefronts + follow a seller.
--
-- Two pieces of schema:
--   1. profiles gains the storefront columns a seller edits in the dashboard
--      TOOLS tab (banner, tagline, bio, location, instagram) and which the
--      public storefront page at /sellers/:id renders.
--   2. follows — one row per (follower → following) edge. The app already calls
--      db.follow / db.unfollow / db.getFollowing / db.getFollowers / the feed
--      query against this table; this migration is what actually creates it.
--
-- Like the other Phase 10/11/12 tables this is a plain CREATE with NO RLS
-- policies, so it inherits the project's existing access model (the same one the
-- other db.* inserts rely on). Every column/table uses IF NOT EXISTS so the
-- migration is safe to re-run.

-- 1. profiles — storefront fields. All optional free-text; an unset banner falls
--    back to a solid #FF1493 banner client-side.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_banner_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_bio        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_tagline    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_instagram  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_location   text;

-- 2. follows — the social graph. UNIQUE(follower_id, following_id) makes a
--    double-follow a harmless 409 (mirrors the wishlists table). Indexes back the
--    two hot reads: "who do I follow" (feed) and "who follows this seller"
--    (follower count + NEW_FOLLOWER notifications).
CREATE TABLE IF NOT EXISTS follows (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  uuid REFERENCES auth.users(id),
  following_id uuid REFERENCES auth.users(id),
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_id_idx  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON follows(following_id);

-- 3. Storage bucket for storefront banner uploads. Public so the banner's public
--    URL renders without a signed request (same model as the listings/looks
--    buckets). Safe to re-run — ON CONFLICT leaves an existing bucket untouched.
INSERT INTO storage.buckets (id, name, public)
VALUES ('storefront-banners', 'storefront-banners', true)
ON CONFLICT (id) DO NOTHING;
