-- Phase 10b: seller reviews.
--
-- The frontend (db.getReviews / db.getAllReviewStats in src/lib/db.js) already
-- reads from a `reviews` table keyed by seller_id, but the table never existed
-- in a migration. Create it so those queries resolve instead of 404-ing, and
-- seed a few reviews against an existing test listing + seller so the ratings
-- UI has something to render.

CREATE TABLE IF NOT EXISTS reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id),
  reviewer_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now()
);

-- Seed 3 test reviews. We don't know the real UUIDs in any given environment,
-- so resolve an existing listing and its seller at run time rather than
-- hardcoding ids. The whole block is skipped when there is no test data yet,
-- and guarded so re-running the migration never duplicates the seed rows.
DO $$
DECLARE
  v_listing  uuid;
  v_seller   uuid;
  v_reviewer uuid;
BEGIN
  -- Oldest listing + its owner (listings.user_id is the seller).
  SELECT id, user_id INTO v_listing, v_seller
  FROM listings
  WHERE user_id IS NOT NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_listing IS NULL OR v_seller IS NULL THEN
    RAISE NOTICE 'reviews seed skipped: no listing with a seller found';
    RETURN;
  END IF;

  -- Prefer a reviewer who isn't the seller; fall back to the seller if the
  -- environment only has the one test user.
  SELECT id INTO v_reviewer FROM auth.users WHERE id <> v_seller LIMIT 1;
  IF v_reviewer IS NULL THEN
    v_reviewer := v_seller;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM reviews WHERE seller_id = v_seller) THEN
    INSERT INTO reviews (listing_id, reviewer_id, seller_id, rating, comment) VALUES
      (v_listing, v_reviewer, v_seller, 5, 'Beautiful lehenga, exactly as described'),
      (v_listing, v_reviewer, v_seller, 4, 'Great seller, fast response'),
      (v_listing, v_reviewer, v_seller, 5, 'Stunning piece, would buy again');
  END IF;
END $$;
