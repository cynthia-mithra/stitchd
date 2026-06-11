-- Phase 10d — seller tools (vacation mode + Promote "notify me").
--
-- 1. vacation_mode flag on profiles. When true, the seller's listings are
--    filtered out of the shop/search grid (see `visible` in src/App.js, fed by
--    db.getVacationSellers) and a banner shows on their public profile. Defaults
--    to false so every existing seller stays visible until they opt in.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vacation_mode boolean DEFAULT false;

-- Backfill any pre-existing NULLs so the shop filter treats them as visible.
UPDATE profiles SET vacation_mode = false WHERE vacation_mode IS NULL;

-- 2. feature_interest — records sellers who tapped "NOTIFY ME" on the coming-soon
--    Promote feature (db.insertFeatureInterest). Generic feature column so the
--    same table can capture interest for future features.
CREATE TABLE IF NOT EXISTS feature_interest (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  feature text,
  created_at timestamp with time zone DEFAULT now()
);
