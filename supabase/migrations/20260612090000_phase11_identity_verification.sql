-- Phase 11 — ID verification via Stripe Identity.
--
-- A seller can optionally verify their real-world identity through Stripe
-- Identity. This is SEPARATE from the verified-seller badge (Phase 11,
-- 20260611222200): a seller can have one, both, or neither. The identity badge
-- adds an extra trust layer and is required to list items over £200.
--
-- Like the other Phase 10/11 columns these are plain `ADD COLUMN IF NOT EXISTS`
-- with sensible defaults, so the app keeps working on a database that hasn't run
-- the migration yet (the db.js / webhook inserts self-heal around missing cols).

-- identity_verified            drives the ID VERIFIED badge everywhere it shows.
-- identity_verified_at         the "Verified since" date for a verified seller.
-- stripe_verification_session_id  links a Stripe VerificationSession back to the
--                              profile so the webhook can find who to update.
-- identity_verification_status unverified | pending | verified | failed — drives
--                              the IDENTITY VERIFICATION section in the dashboard.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_verified_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_verification_session_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_verification_status text DEFAULT 'unverified';

-- Backfill any pre-existing NULLs so the badge/section logic treats them as
-- "unverified" rather than undefined.
UPDATE profiles SET identity_verified = false WHERE identity_verified IS NULL;
UPDATE profiles SET identity_verification_status = 'unverified' WHERE identity_verification_status IS NULL;

-- The webhook looks a profile up by its Stripe verification session id; index it.
CREATE INDEX IF NOT EXISTS profiles_stripe_verification_session_id_idx
  ON profiles(stripe_verification_session_id);
