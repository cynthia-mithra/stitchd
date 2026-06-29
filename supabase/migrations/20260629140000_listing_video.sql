-- Listing video (optional).
--
-- A short clip a seller can add to a listing (shows fabric drape / sparkle).
-- Stored as a public URL in the same listings storage bucket as photos; null
-- when the seller doesn't add one.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS video_url text;
