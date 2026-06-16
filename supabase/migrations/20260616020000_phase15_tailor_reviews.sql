-- Phase 15 — Tailor reviews & ratings.
--
-- A buyer who has completed an alteration booking can leave the tailor a star
-- rating (1–5) and an optional comment. Ratings roll up onto the tailor row
-- (average_rating / review_count) so the public profile and the tailor-selection
-- cards can show a live rating without aggregating on every read.
--
-- This is SEPARATE from the Phase 10b `reviews` table (seller reviews on
-- listings) — that table is keyed by seller_id and is left untouched. Like the
-- other phase tables this is a plain CREATE/ALTER with NO RLS policies,
-- inheriting the project's existing access model.

-- 1. One review per alteration booking. The UNIQUE(alteration_request_id)
--    constraint enforces the "one review per booking" rule at the database level
--    (a partial unique index would also work, but every review carries a request
--    id so a plain UNIQUE is simplest). rating is constrained to 1–5.
CREATE TABLE IF NOT EXISTS tailor_reviews (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id             uuid REFERENCES tailors(id),
  buyer_id              uuid REFERENCES auth.users(id),
  alteration_request_id uuid REFERENCES alteration_requests(id) UNIQUE,
  rating                integer CHECK (rating >= 1 AND rating <= 5),
  comment               text,
  created_at            timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tailor_reviews_tailor_idx  ON tailor_reviews(tailor_id);
CREATE INDEX IF NOT EXISTS tailor_reviews_buyer_idx   ON tailor_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS tailor_reviews_request_idx ON tailor_reviews(alteration_request_id);

-- 2. Denormalised rating roll-up on the tailor row. Recalculated by the frontend
--    after each new review (UPDATE tailors SET average_rating = AVG(...),
--    review_count = COUNT(...)). Defaults mean an un-reviewed tailor reads as 0/0.
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) DEFAULT 0;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS review_count   integer      DEFAULT 0;
