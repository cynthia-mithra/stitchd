-- Phase 11 — Report a listing + dispute resolution.
--
-- Two new tables (reports, disputes) plus a private "disputes" storage bucket for
-- the optional photo a buyer can attach when raising a problem with an order.
--
-- Like the other Phase 10 tables (wishlists, bundles, looks, feature_interest) the
-- tables are declared with a plain CREATE and NO RLS policies, so they inherit the
-- project's existing access model — the same one db.insertReport already relies on.

-- 1. reports — a buyer/visitor flagging a listing for review by the Stitch'd team.
--    `reason` is one of the fixed report reasons; `details` carries the free-text
--    when the reporter picks "Other". `status` moves pending → resolved from the
--    admin panel.
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id),
  reporter_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);
-- The app already shipped a basic report insert (reason only); make sure the
-- `details` column exists on deployments where the table predates this migration.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 2. disputes — a buyer reporting a problem with an order they've placed. Carries
--    the problem type, required details, an optional photo URL, and a status the
--    admin moves through open → under_review → resolved → refunded.
CREATE TABLE IF NOT EXISTS disputes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  buyer_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  problem_type text NOT NULL,
  details text NOT NULL,
  photo_url text,
  status text DEFAULT 'open',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx  ON reports(status);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes(status);

-- 3. is_admin flag — already added in Phase 10e, repeated here defensively so the
--    admin panel works on a database that skipped that migration.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE profiles SET is_admin = false WHERE is_admin IS NULL;

-- 4. disputes storage bucket — private, for the optional photo attached to a
--    dispute. Created here so the bucket is reproducible rather than a manual step.
--    public=false keeps the bucket from being browsable/listable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('disputes', 'disputes', false)
ON CONFLICT (id) DO NOTHING;

-- Upload policy — any authenticated user may add an object to the disputes bucket
-- (a buyer attaching evidence to their own dispute).
DROP POLICY IF EXISTS "disputes_authenticated_insert" ON storage.objects;
CREATE POLICY "disputes_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'disputes');

-- Read policy — authenticated users may read objects in the disputes bucket so the
-- Stitch'd admin can view the attached photo in the dispute panel.
DROP POLICY IF EXISTS "disputes_authenticated_select" ON storage.objects;
CREATE POLICY "disputes_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'disputes');

-- NOTE (manual step, see PR description):
--   Set is_admin = true for the Stitch'd admin account so the ADMIN tab appears
--   and dispute notifications are routed to it, e.g.
--     UPDATE profiles SET is_admin = true WHERE id = '<ADMIN_USER_ID>';
