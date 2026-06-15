-- Phase 14 — Style feed (share an outfit photo featuring Stitch'd listings).
--
-- Two tables + one public storage bucket:
--   1. style_posts      — one row per shared outfit photo. `listing_ids` is a
--      uuid[] of tagged listings (resolved client-side, like a look's items).
--      `likes_count` is a denormalised counter kept in sync by the like/unlike
--      helpers so a card can show the count without a per-post aggregate query.
--      Posts are never hard-deleted — `deleted=true` hides them everywhere.
--   2. style_post_likes — one row per (post, user) like. UNIQUE(post_id,user_id)
--      makes a double-like a harmless 409 and the heart toggle idempotent. The
--      post FK is ON DELETE CASCADE so likes vanish if a post is ever removed.
--
-- Like the other Phase 10–14 tables this is a plain CREATE with NO RLS policies,
-- so it inherits the project's existing access model (the same one every other
-- db.* insert relies on).

CREATE TABLE IF NOT EXISTS style_posts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id),
  caption     text,
  image_url   text NOT NULL,
  listing_ids uuid[] DEFAULT '{}',
  likes_count integer DEFAULT 0,
  deleted     boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS style_post_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES style_posts(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Feed reads order by created_at within the non-deleted set; the like lookups
-- filter by post_id / user_id. Index both hot paths.
CREATE INDEX IF NOT EXISTS style_posts_created_idx     ON style_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS style_posts_user_idx        ON style_posts(user_id);
CREATE INDEX IF NOT EXISTS style_post_likes_post_idx   ON style_post_likes(post_id);
CREATE INDEX IF NOT EXISTS style_post_likes_user_idx   ON style_post_likes(user_id);

-- Public storage bucket for post images (mirrors the listings / looks /
-- storefront-banners buckets). Public so an image renders without a signed URL.
-- No-op if the storage schema isn't present (e.g. a bare Postgres used only for
-- the REST tables above).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('style-posts', 'style-posts', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
