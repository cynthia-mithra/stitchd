-- Phase 10b: wishlists.
--
-- Backing store for the wishlist / save feature. Create the table and seed a
-- couple of entries against existing test listings so wishlist counts render
-- above 0. The UNIQUE(user_id, listing_id) constraint keeps a user from saving
-- the same listing twice and makes the seed inserts safely idempotent.

CREATE TABLE IF NOT EXISTS wishlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  listing_id uuid REFERENCES listings(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Seed 2 wishlist entries. Resolve a real user and two distinct listings at run
-- time. ON CONFLICT keeps re-runs from erroring on the unique constraint.
DO $$
DECLARE
  v_user uuid;
  v_l1   uuid;
  v_l2   uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'wishlists seed skipped: no users found';
    RETURN;
  END IF;

  SELECT id INTO v_l1 FROM listings ORDER BY created_at LIMIT 1;
  SELECT id INTO v_l2 FROM listings ORDER BY created_at OFFSET 1 LIMIT 1;

  IF v_l1 IS NOT NULL THEN
    INSERT INTO wishlists (user_id, listing_id)
    VALUES (v_user, v_l1)
    ON CONFLICT (user_id, listing_id) DO NOTHING;
  END IF;

  -- Second distinct listing, when the environment has more than one.
  IF v_l2 IS NOT NULL AND v_l2 <> v_l1 THEN
    INSERT INTO wishlists (user_id, listing_id)
    VALUES (v_user, v_l2)
    ON CONFLICT (user_id, listing_id) DO NOTHING;
  END IF;
END $$;
