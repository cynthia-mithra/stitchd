-- Phase 14 — Tailor profiles.
--
-- A NEW, self-contained feature: any user can apply to become a tailor and, once
-- approved by the Stitch'd admin, gets a public profile (specialisms, pricing,
-- location, portfolio) reachable at /tailors/<id>.
--
-- This is INTENTIONALLY separate from the existing `tailor_services` marketplace
-- (a per-service listing/booking flow) — that table is untouched. The two coexist.
--
-- Like the rest of Phase 10–14 this is plain idempotent DDL with NO RLS, so it
-- inherits the project's existing access model — the same one the other db.*
-- inserts rely on.

-- 1. tailors — one row per applicant/tailor. `status` moves
--    pending → approved/rejected/suspended from the admin panel. `user_id` is
--    UNIQUE so a user can only ever hold one tailor profile (they re-apply by
--    updating the same row). Prices are stored in pence (integers) like the rest
--    of the app's money columns.
CREATE TABLE IF NOT EXISTS tailors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) UNIQUE,
  display_name text NOT NULL,
  bio text,
  location text NOT NULL,
  specialisms text[] DEFAULT '{}',
  price_from_pence integer,
  price_to_pence integer,
  turnaround_days integer,
  instagram_handle text,
  website_url text,
  profile_image_url text,
  banner_image_url text,
  status text DEFAULT 'pending',
  -- values: pending, approved, rejected, suspended
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. tailor_portfolio — up to 8 portfolio images per tailor, ordered by
--    `position`. ON DELETE CASCADE so removing a tailor cleans up its portfolio.
CREATE TABLE IF NOT EXISTS tailor_portfolio (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id uuid REFERENCES tailors(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  garment_type text,
  position integer,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tailors_status_idx        ON tailors (status);
CREATE INDEX IF NOT EXISTS tailors_user_id_idx        ON tailors (user_id);
CREATE INDEX IF NOT EXISTS tailor_portfolio_tailor_idx ON tailor_portfolio (tailor_id, position);

-- 3. Storage buckets (public) for profile/banner images and portfolio images.
--    Idempotent inserts — safe to re-run. Mirrors how the other public buckets
--    (listings, looks, storefront-banners, style-posts) are provisioned.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tailor-profiles', 'tailor-profiles', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tailor-portfolio', 'tailor-portfolio', true)
ON CONFLICT (id) DO NOTHING;
