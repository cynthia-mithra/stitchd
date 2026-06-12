-- Phase 12 — Discovery: occasion + colour tagging on listings.
--
-- Two array columns let buyers filter the shop (and the new /new-arrivals page)
-- by occasion and colour, and let sellers tag a listing with one or more of
-- each in the create/edit form.
--
-- `occasions` already exists from an earlier phase (the form, card chips and
-- detail "OCCASIONS" block all read it) — the ADD ... IF NOT EXISTS below is a
-- safe no-op where it's present and back-fills it on any deployment that never
-- got it. `colour` is brand new.
--
-- Both are nullable with no default: existing listings come back with NULL,
-- which the client treats as "untagged" — those listings stay visible under
-- every occasion/colour filter so nothing already listed gets buried.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS occasions text[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS colours  text[];

-- GIN indexes so the array "overlaps" (&&) lookups a colour/occasion filter does
-- stay fast as the catalogue grows. IF NOT EXISTS keeps re-runs idempotent.
CREATE INDEX IF NOT EXISTS listings_occasions_idx ON listings USING gin (occasions);
CREATE INDEX IF NOT EXISTS listings_colours_idx   ON listings USING gin (colours);
