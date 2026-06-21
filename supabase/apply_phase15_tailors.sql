-- ════════════════════════════════════════════════════════════════════════════
-- APPLY PHASE 15 — TAILORS  (one-shot setup script)
-- ════════════════════════════════════════════════════════════════════════════
-- The tailor feature (apply to become a tailor, alteration requests, payments,
-- reviews, availability, Stripe Connect) needs these tables/columns in the
-- database. If you saw "Could not find the table 'public.tailors' in the schema
-- cache" when submitting a tailor application, the Phase 15 migrations haven't
-- been applied to this project — run this whole file once.
--
-- HOW TO RUN:  Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run.  It is safe to run more than once (everything is IF NOT EXISTS /
-- ON CONFLICT, so it only fills in what's missing).
--
-- This concatenates, in order, the six phase15 migrations plus the bucket fix.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tailor profiles + portfolio + storage buckets ────────────────────────
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
  status            text DEFAULT 'pending',
  approved_at       timestamp with time zone,
  created_at        timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tailors_user_idx   ON tailors(user_id);
CREATE INDEX IF NOT EXISTS tailors_status_idx ON tailors(status);

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('tailor-profiles', 'tailor-profiles', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
    INSERT INTO storage.buckets (id, name, public) VALUES ('tailor-portfolio', 'tailor-portfolio', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;
END $$;

-- Storage WRITE policies so logged-in users can upload to the tailor buckets
-- (reads are public; uploads still need an RLS INSERT policy).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='objects') THEN
    DROP POLICY IF EXISTS "tailor images upload" ON storage.objects;
    CREATE POLICY "tailor images upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id IN ('tailor-profiles','tailor-portfolio'));
    DROP POLICY IF EXISTS "tailor images update" ON storage.objects;
    CREATE POLICY "tailor images update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id IN ('tailor-profiles','tailor-portfolio'))
      WITH CHECK (bucket_id IN ('tailor-profiles','tailor-portfolio'));
  END IF;
END $$;

-- ── 2. Alteration requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alteration_requests (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id         uuid REFERENCES listings(id),
  buyer_id           uuid REFERENCES auth.users(id),
  tailor_id          uuid REFERENCES tailors(id),
  description        text NOT NULL,
  garment_type       text,
  alterations_needed text[] DEFAULT '{}',
  additional_notes   text,
  budget_pence       integer,
  quote_pence        integer,
  quote_message      text,
  status             text DEFAULT 'pending',
  created_at         timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alteration_requests_buyer_idx   ON alteration_requests(buyer_id);
CREATE INDEX IF NOT EXISTS alteration_requests_tailor_idx  ON alteration_requests(tailor_id);
CREATE INDEX IF NOT EXISTS alteration_requests_listing_idx ON alteration_requests(listing_id);

-- ── 3. Tailor booking payments + commission ─────────────────────────────────
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS quote_amount_pence      integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS commission_amount_pence integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS tailor_payout_pence     integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS stripe_session_id       text;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS paid_at                 timestamp with time zone;

CREATE TABLE IF NOT EXISTS tailor_payouts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id             uuid REFERENCES tailors(id),
  alteration_request_id uuid REFERENCES alteration_requests(id),
  amount_pence          integer NOT NULL,
  commission_pence      integer NOT NULL,
  stripe_session_id     text,
  status                text DEFAULT 'pending',
  created_at            timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tailor_payouts_tailor_idx  ON tailor_payouts(tailor_id);
CREATE INDEX IF NOT EXISTS tailor_payouts_request_idx ON tailor_payouts(alteration_request_id);
CREATE INDEX IF NOT EXISTS tailor_payouts_status_idx  ON tailor_payouts(status);

-- ── 4. Tailor reviews & ratings ─────────────────────────────────────────────
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

ALTER TABLE tailors ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) DEFAULT 0;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS review_count   integer      DEFAULT 0;

-- ── 5. Tailor availability calendar ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tailor_availability (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id        uuid REFERENCES tailors(id) ON DELETE CASCADE,
  date             date NOT NULL,
  available        boolean DEFAULT true,
  slots_remaining  integer DEFAULT 3,
  note             text,
  created_at       timestamp with time zone DEFAULT now(),
  UNIQUE(tailor_id, date)
);
CREATE INDEX IF NOT EXISTS tailor_availability_tailor_idx ON tailor_availability(tailor_id);
CREATE INDEX IF NOT EXISTS tailor_availability_date_idx   ON tailor_availability(tailor_id, date);

ALTER TABLE tailors ADD COLUMN IF NOT EXISTS availability_enabled  boolean DEFAULT false;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS advance_booking_days  integer DEFAULT 30;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS default_slots_per_day integer DEFAULT 3;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS vacation_mode         boolean DEFAULT false;

ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS preferred_date date;

-- ── 6. Stripe Connect for tailor payouts ────────────────────────────────────
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS stripe_account_id          text;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS stripe_onboarding_url      text;

ALTER TABLE tailor_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id text;
ALTER TABLE tailor_payouts ADD COLUMN IF NOT EXISTS paid_at            timestamp with time zone;
ALTER TABLE tailor_payouts ADD COLUMN IF NOT EXISTS failure_reason     text;

-- ── 7. Reload PostgREST's schema cache so the API sees the new tables now ────
NOTIFY pgrst, 'reload schema';
