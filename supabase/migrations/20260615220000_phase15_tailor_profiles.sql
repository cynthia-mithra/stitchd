-- Phase 15 — Tailor profiles.
--
-- Any user can apply to become a tailor. An application starts life as a
-- `tailors` row with status='pending'; an admin approves or rejects it. Once
-- approved the tailor gets a public profile at /tailors/<id> showing their
-- specialisms, pricing, location and portfolio.
--
-- This is a NEW, self-contained feature — it does NOT touch the pre-existing
-- "tailor marketplace" (tailor_services / tailor_bookings) or the seller
-- profile/storefront columns. Like the other phase tables this is a plain
-- CREATE with NO RLS policies, inheriting the project's existing access model.

-- 1. tailors — one row per applicant (UNIQUE(user_id) → one application per
--    user; reapply reuses the same row by flipping status back to 'pending').
CREATE TABLE IF NOT EXISTS tailors (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid REFERENCES auth.users(id) UNIQUE,
  display_name      text NOT NULL,
  bio               text,
  location          text NOT NULL,
  specialisms       text[] DEFAULT '{}',
  price_from_pence  integer,
  price_to_pence    integer,
  turnaround_days   integer,
  instagram_handle  text,
  website_url       text,
  profile_image_url text,
  banner_image_url  text,
  status            text DEFAULT 'pending', -- pending | approved | rejected | suspended
  approved_at       timestamp with time zone,
  created_at        timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tailors_user_idx   ON tailors(user_id);
CREATE INDEX IF NOT EXISTS tailors_status_idx ON tailors(status);

-- 2. tailor_portfolio — up to 8 images per tailor, ordered by `position`.
--    ON DELETE CASCADE so removing a tailor row drops their portfolio.
CREATE TABLE IF NOT EXISTS tailor_portfolio (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id    uuid REFERENCES tailors(id) ON DELETE CASCADE,
  image_url    text NOT NULL,
  caption      text,
  garment_type text,
  position     integer,
  created_at   timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tailor_portfolio_tailor_idx ON tailor_portfolio(tailor_id);

-- 3. Storage buckets for the profile/banner image and the portfolio images.
--    Both public so they render without a signed URL (mirrors listings/looks/
--    storefront-banners). No-op if the storage schema isn't present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('tailor-profiles', 'tailor-profiles', true)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('tailor-portfolio', 'tailor-portfolio', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
