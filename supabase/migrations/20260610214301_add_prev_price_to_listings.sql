-- Phase 10b: price drops.
--
-- db.getPriceDrops in src/lib/db.js queries listings where prev_price is not
-- null, so the column has to exist for that "Price drops" rail to populate.
-- Add it (no-op if already present) and set prev_price on one existing test
-- listing so the rail has at least one entry to show.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS prev_price numeric;

-- Simulate a price drop on a single existing listing that doesn't already have
-- a prev_price. prev_price is the old (higher) price; the current `price` stays
-- as the new, lower one.
DO $$
DECLARE
  v_listing uuid;
  v_price   numeric;
BEGIN
  SELECT id, price INTO v_listing, v_price
  FROM listings
  WHERE prev_price IS NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_listing IS NULL THEN
    RAISE NOTICE 'prev_price seed skipped: no listing without a prev_price found';
    RETURN;
  END IF;

  -- ~35% above the current price (e.g. 55 -> 75), falling back to a flat 75
  -- when the listing has no usable price set.
  UPDATE listings
  SET prev_price = CASE
        WHEN v_price IS NOT NULL AND v_price > 0 THEN round(v_price * 1.35, 2)
        ELSE 75
      END
  WHERE id = v_listing;
END $$;
