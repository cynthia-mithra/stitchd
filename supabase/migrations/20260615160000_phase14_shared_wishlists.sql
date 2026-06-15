-- Phase 14 — Shareable wishlists (create and share via link).
--
-- A user turns their saved pieces into a named, public list reachable at
-- /wishlist/<slug>. `shared_wishlists` holds one row per list; the selected
-- pieces live in `shared_wishlist_items` (one row per listing, with a `position`
-- so the public grid keeps the order they were added). Deleting a list cascades
-- to its items.
--
-- Matches the project's other Phase 10–13 migrations: plain idempotent DDL, no
-- RLS (PostgREST access is governed the same way as wishlists/reviews — the anon
-- key can read public lists, which is exactly what a no-login share link needs).
-- The existing `wishlists` table is left completely untouched (issue constraint).

CREATE TABLE IF NOT EXISTS shared_wishlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shared_wishlist_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_wishlist_id uuid REFERENCES shared_wishlists(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id),
  position integer,
  created_at timestamp with time zone DEFAULT now()
);

-- One lookup per owner for the "MY SHARED LISTS" section, one by slug for the
-- public page (the UNIQUE on slug already indexes it, but the items lookup by
-- parent list is the hot path on the public page).
CREATE INDEX IF NOT EXISTS shared_wishlists_user_idx ON shared_wishlists (user_id);
CREATE INDEX IF NOT EXISTS shared_wishlist_items_list_idx ON shared_wishlist_items (shared_wishlist_id);
