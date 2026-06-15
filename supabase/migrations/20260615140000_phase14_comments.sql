-- Phase 14 — Comments on listings (basic, no replies).
--
-- A flat comments thread on the listing detail page: buyers ask questions,
-- sellers (and everyone) can read them. Replies come in a later phase, so there
-- is no parent_id here on purpose.
--
-- Like the other Phase 10/11/12/13 tables this is a plain CREATE with NO RLS
-- policies, so it inherits the project's existing access model — the same one
-- db.insertComment / db.getComments rely on. Deletes are soft (deleted=true);
-- the table is never hard-deleted from, so a removed question can still be
-- audited.

CREATE TABLE IF NOT EXISTS comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id),
  user_id    uuid REFERENCES auth.users(id),
  content    text NOT NULL,
  deleted    boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Detail page reads every non-deleted comment for one listing, newest first.
CREATE INDEX IF NOT EXISTS comments_listing_idx ON comments(listing_id);
