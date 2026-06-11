-- Phase 11 — Verified seller badges.
--
-- Sellers apply for verification; the Stitch'd admin approves or rejects. A
-- verified seller gets a teal "VERIFIED SELLER" badge across the app.
--
-- Like the other Phase 10/11 tables (wishlists, bundles, looks, reports,
-- disputes) the new table is a plain CREATE with NO RLS policies, so it inherits
-- the project's existing access model — the same one the other db.* inserts rely on.

-- 1. profiles — verification state. `verified` drives the badge everywhere it
--    appears; `verification_status` (unverified | pending | verified | rejected)
--    drives the GET VERIFIED section in the seller dashboard; `verified_at` is the
--    "Verified since" date shown to a verified seller.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
UPDATE profiles SET verified = false WHERE verified IS NULL;
UPDATE profiles SET verification_status = 'unverified' WHERE verification_status IS NULL;

-- 2. verification_applications — one row per application. `status` moves
--    pending → approved/rejected from the admin panel; `reviewed_at` stamps the
--    decision (used for the buyer-facing "reapply after 30 days" rule).
CREATE TABLE IF NOT EXISTS verification_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  reason text NOT NULL,
  selling_experience text,
  instagram_handle text,
  status text DEFAULT 'pending',
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS verification_applications_status_idx  ON verification_applications(status);
CREATE INDEX IF NOT EXISTS verification_applications_user_id_idx ON verification_applications(user_id);
