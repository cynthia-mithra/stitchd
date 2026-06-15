-- Phase 14 — Comment replies (seller can reply to questions).
--
-- Builds on 20260615140000_phase14_comments.sql. A reply is just another row in
-- the comments table that points back at the question it answers via
-- parent_comment_id. Top-level questions have parent_comment_id = null; replies
-- carry the id of the comment they belong to. This keeps the existing
-- db.getComments / db.insertComment paths working unchanged — replies come back
-- in the same listing query and are grouped under their parent client-side.
--
-- Like the rest of the comments table there are no RLS policies here; the column
-- inherits the project's existing access model.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS
  parent_comment_id uuid REFERENCES comments(id);

-- Grouping replies under their parent is a per-listing read, so an index on the
-- parent keeps that lookup cheap as threads grow.
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_comment_id);
