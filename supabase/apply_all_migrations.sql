-- ════════════════════════════════════════════════════════════════════════════
-- STITCH'D — FULL DATABASE CATCH-UP SCRIPT
-- ════════════════════════════════════════════════════════════════════════════
-- Brings a live database fully in sync with the code by running every
-- migration (Phase 1 → 15) in order. Everything is idempotent (IF NOT EXISTS /
-- ON CONFLICT / DROP POLICY IF EXISTS), so it only fills in what's missing and
-- is safe to run more than once.
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. (Cron blocks skip automatically if pg_cron/pg_net aren't enabled.)
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260610211900_add_status_to_listings.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Add a `status` column to the listings table.
--
-- The stripe-checkout Edge Function selects `status` to refuse pieces that are
-- already sold, and the stripe-webhook Edge Function sets `status = 'sold'`
-- after a successful purchase. Without this column the checkout query fails with
-- "column listings.status does not exist".
--
-- Existing rows default to 'active' so nothing already listed is affected.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Backfill any rows that predate the default (NULL) so the frontend and the
-- checkout availability check treat them as active.
UPDATE listings SET status = 'active' WHERE status IS NULL;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260610214300_add_reviews_table.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260610214301_add_prev_price_to_listings.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260610214302_add_wishlists_table.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260611134200_phase10d_seller_tools.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260611140000_phase10e_shop_the_look.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 10e — Shop the Look.
--
-- Curated outfit collections ("looks") made of multiple listings from any
-- seller. A look can be created by a seller or by the Stitch'd admin. Each item
-- in a look links back to its listing detail page and is individually shoppable.
--
-- Tables follow the same plain-CREATE convention as the other Phase 10 tables
-- (wishlists, bundles, feature_interest): no RLS policies are declared here, so
-- the tables inherit the project's existing access model (the same one the app
-- already relies on for inserts via the user / anon token).

-- 1. looks — one row per curated outfit.
CREATE TABLE IF NOT EXISTS looks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_by_type text CHECK (created_by_type IN ('seller', 'admin')),
  cover_image_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. look_items — the listings that make up a look, in display order. Cascades
--    on delete so removing a look (or a listing) tidies up its join rows.
CREATE TABLE IF NOT EXISTS look_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  look_id uuid REFERENCES looks(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  position integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Helpful indexes for the embedded look_items(...) reads the app makes.
CREATE INDEX IF NOT EXISTS look_items_look_id_idx ON look_items(look_id);
CREATE INDEX IF NOT EXISTS look_items_listing_id_idx ON look_items(listing_id);

-- 3. is_admin flag on profiles — identifies the Stitch'd admin account. Looks
--    created by an admin show "Curated by Stitch'd". Defaults false so every
--    existing account stays a normal seller until flagged.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE profiles SET is_admin = false WHERE is_admin IS NULL;

-- NOTE (manual step, see PR description):
--   1. Create a public Storage bucket named "looks" (cover images upload there).
--   2. Set is_admin = true for the Stitch'd admin account, e.g.
--        UPDATE profiles SET is_admin = true WHERE id = '<ADMIN_USER_ID>';


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260611213000_phase11_reports_disputes.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260611222200_phase11_verified_sellers.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260612090000_phase11_identity_verification.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260612093000_phase12_email_notifications.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 12 — Email infrastructure & transactional notifications.
--
-- Adds the three profile columns the send-email Edge Function relies on. Like the
-- other Phase 10/11 migrations these are plain ALTERs with IF NOT EXISTS, so they
-- inherit the project's existing access model and are safe to re-run.

-- Unsubscribe switch. Checked before EVERY email; the footer "Unsubscribe" link
-- flips it to false via the send-email function's GET endpoint. Default true so
-- existing users keep receiving transactional mail.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;
UPDATE profiles SET email_notifications = true WHERE email_notifications IS NULL;

-- Welcome-email idempotency. The welcome email is fired from the data layer on
-- every profile upsert (the only reliable new-user signal available client-side),
-- so the function dedupes on this flag: send once, set true, never send again.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false;

-- Presence proxy for the "don't email an active user" rule on new-message emails.
-- Touched by the data layer when a user sends/reads messages and on notification
-- polls; the new-message email is suppressed if this is within the last 10 min.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260612100000_phase12_occasion_colour.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 12 — Discovery: occasion + colour tagging on listings.
--
-- Two array columns let buyers filter the shop (and the new /new-arrivals page)
-- by occasion and colour, and let sellers tag a listing with one or more of
-- each in the create/edit form.
--
-- `occasions` already exists from an earlier phase (the form, card chips and
-- detail "OCCASIONS" block all read it) — the ADD ... IF NOT EXISTS below is a
-- safe no-op where it's present and back-fills it on any deployment that never
-- got it. `colour` is brand new.
--
-- Both are nullable with no default: existing listings come back with NULL,
-- which the client treats as "untagged" — those listings stay visible under
-- every occasion/colour filter so nothing already listed gets buried.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS occasions text[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS colours  text[];

-- GIN indexes so the array "overlaps" (&&) lookups a colour/occasion filter does
-- stay fast as the catalogue grows. IF NOT EXISTS keeps re-runs idempotent.
CREATE INDEX IF NOT EXISTS listings_occasions_idx ON listings USING gin (occasions);
CREATE INDEX IF NOT EXISTS listings_colours_idx   ON listings USING gin (colours);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260612110000_phase12_saved_searches.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 12 — Saved searches with email alerts.
--
-- Buyers save their current shop filters and get emailed when new listings
-- match. The `filters` jsonb mirrors the live shop filter state, e.g.
--   {"query":"lehenga","category":"Lehenga","size":"S","min_price":50,
--    "max_price":200,"occasion":["Wedding"],"colour":["Pink","Red"],
--    "verified_only":false}
--
-- An earlier phase shipped a query-only version of this table (db.saveSearch
-- stored {user_id, query, filters}). The CREATE … IF NOT EXISTS below is a no-op
-- where that table already exists; the ADD COLUMN … IF NOT EXISTS lines back-fill
-- the new columns (name, email_alerts, last_alerted_at) so both fresh and
-- upgraded deployments converge on the same shape. Matches the project's other
-- Phase 10/11 migrations: plain idempotent DDL, no RLS (PostgREST access is
-- governed the same way as wishlists/reviews; the alerts function uses the
-- service role).

CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_alerts boolean DEFAULT true,
  last_alerted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS filters jsonb;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS email_alerts boolean DEFAULT true;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_alerted_at timestamp with time zone;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- A row with no filters is meaningless for alerting; default the legacy NULLs to
-- an empty object so the alerts function can always read filters as jsonb.
UPDATE saved_searches SET filters = '{}'::jsonb WHERE filters IS NULL;
UPDATE saved_searches SET email_alerts = true WHERE email_alerts IS NULL;

-- One lookup per user for the saved-searches page; a partial index keeps the
-- every-6-hours alert sweep (email_alerts = true) fast as the table grows.
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_alerts_idx ON saved_searches (email_alerts) WHERE email_alerts = true;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260612120000_phase12_saved_search_cron.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 12 — schedule the saved-search alert sweep every 6 hours (issue PART 4).
--
-- Uses pg_cron + pg_net to POST the saved-search-alerts Edge Function. Both
-- extensions ship with Supabase but may not be enabled on a given project, so
-- the whole thing is wrapped in a DO block that degrades gracefully: if an
-- extension or a helper (supabase_url(), vault settings) is unavailable it
-- RAISE NOTICEs and moves on rather than failing the migration. The function is
-- also kicked immediately on every new listing from the client
-- (db.triggerSavedSearchAlerts), so buyers still get alerts even where cron is
-- off — this schedule is the every-6-hours safety net.
--
-- The service-role key is read from Vault (recommended) if present, else from
-- the `app.settings.service_role_key` GUC. Set one of:
--   select vault.create_secret('<service_role_key>', 'service_role_key');
--   -- or --
--   alter database postgres set app.settings.service_role_key = '<service_role_key>';

DO $$
DECLARE
  v_url        text;
  v_key        text;
BEGIN
  -- Need pg_cron to schedule and pg_net to make the HTTP call.
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'saved-search-alerts cron skipped: enable the pg_cron and pg_net extensions, then re-run this migration.';
    RETURN;
  END IF;

  -- Resolve the project URL. supabase_url() exists on hosted projects; fall back
  -- to a GUC if someone set one locally.
  BEGIN
    v_url := supabase_url();
  EXCEPTION WHEN undefined_function THEN
    v_url := current_setting('app.settings.supabase_url', true);
  END;
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://zhstooqgkyuzxseylsbk.supabase.co';
  END IF;

  -- Resolve the service-role key from Vault, then GUC.
  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings.service_role_key', true);
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'saved-search-alerts cron skipped: no service_role_key in Vault or app.settings.service_role_key.';
    RETURN;
  END IF;

  -- Idempotent: drop any prior schedule of the same name before recreating it.
  BEGIN
    PERFORM cron.unschedule('saved-search-alerts');
  EXCEPTION WHEN OTHERS THEN
    -- no existing job — fine
    NULL;
  END;

  PERFORM cron.schedule(
    'saved-search-alerts',
    '0 */6 * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      )$cmd$,
      v_url || '/functions/v1/saved-search-alerts',
      v_key
    )
  );

  RAISE NOTICE 'saved-search-alerts cron scheduled: every 6 hours.';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615120000_phase13_storefronts_follows.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 13 — Seller storefronts + follow a seller.
--
-- Two pieces of schema:
--   1. profiles — storefront customisation columns (banner, bio, tagline,
--      Instagram, location) edited from the dashboard TOOLS tab and rendered on
--      the public seller storefront.
--   2. follows — one row per (follower → following) relationship, backing the
--      FOLLOW button, follower counts, the FOLLOWING feed, and the MY FOLLOWING
--      list. The table is also read/written by the existing db.follow/unfollow/
--      getFollowing/getFollowers helpers (added in an earlier phase); this
--      migration makes the backing table explicit so a fresh database has it.
--
-- Like the other Phase 10/11/12 tables this is a plain CREATE with NO RLS
-- policies, so it inherits the project's existing access model — the same one
-- every other db.* insert relies on.

-- 1. profiles — storefront fields. All optional; an unset banner falls back to a
--    solid #FF1493 pink banner in the UI, an unset bio hides the ABOUT section.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_banner_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_bio        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_tagline    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_instagram  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storefront_location   text;

-- 2. follows — follower → following edges. UNIQUE(follower_id, following_id)
--    keeps a double-follow a harmless 409 and makes the FOLLOW button idempotent.
CREATE TABLE IF NOT EXISTS follows (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  uuid REFERENCES auth.users(id),
  following_id uuid REFERENCES auth.users(id),
  created_at   timestamp with time zone DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

-- 3. Storage bucket for storefront banner uploads (mirrors the listings/looks
--    buckets). Public so the banner renders without a signed URL. No-op if the
--    storage schema isn't present (e.g. a bare Postgres used only for the REST
--    tables above).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('storefront-banners', 'storefront-banners', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615130000_phase13_promoted_listings.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 13 — Promoted listings (paid boost via Stripe).
--
-- Three pieces of schema:
--   1. listings — promotion state columns (promoted flag, promoted_until expiry,
--      and the Stripe session id that paid for the active promotion). The shop
--      query sorts promoted + in-window listings to the top; the seller dashboard
--      shows a PROMOTED badge instead of the PROMOTE button while one is live.
--   2. promotions — one row per purchased promotion (pending → active → expired),
--      backing the dashboard ANALYTICS "PROMOTIONS" history. The create-promotion-
--      session Edge Function inserts the pending row; the stripe-webhook flips it
--      to active on payment; the expire-promotions Edge Function flips it to
--      expired when the 7 days are up.
--   3. an hourly pg_cron job that POSTs the expire-promotions Edge Function so the
--      flags clear AND the seller is notified — pure SQL can't send the in-app /
--      email notifications the issue (PART 6) asks for.
--
-- Like the other Phase 10/11/12/13 tables this is a plain CREATE with NO RLS
-- policies, so it inherits the project's existing access model — the same one
-- every other db.* insert relies on.

-- 1. listings — promotion columns. All default to "not promoted".
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted                    boolean DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_until              timestamp with time zone;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promotion_stripe_session_id text;

-- 2. promotions — purchase history. amount_pence is the GBP amount actually
--    charged (299). status: 'pending' (checkout created) → 'active' (paid, set by
--    the webhook) → 'expired' (set by the cron after expires_at).
CREATE TABLE IF NOT EXISTS promotions (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id        uuid REFERENCES listings(id),
  seller_id         uuid REFERENCES auth.users(id),
  stripe_session_id text,
  amount_pence      integer,
  started_at        timestamp with time zone,
  expires_at        timestamp with time zone,
  status            text DEFAULT 'pending',
  created_at        timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotions_seller_idx   ON promotions(seller_id);
CREATE INDEX IF NOT EXISTS promotions_listing_idx  ON promotions(listing_id);
CREATE INDEX IF NOT EXISTS promotions_session_idx  ON promotions(stripe_session_id);
-- The shop sort and the cron sweep both filter on (promoted, promoted_until).
CREATE INDEX IF NOT EXISTS listings_promoted_idx    ON listings(promoted, promoted_until);

-- 3. Hourly expire-promotions sweep (issue PART 6). Mirrors the Phase 12
--    saved-search-alerts cron exactly: pg_cron + pg_net POST the Edge Function,
--    wrapped in a DO block that degrades gracefully if an extension/helper is
--    unavailable so the migration never fails on a project where cron is off.
--
-- The Edge Function does the real work — un-promote expired listings, mark the
-- promotion rows 'expired', and notify the seller in-app + by email. Set the
-- service-role key once (Vault recommended), same as the saved-search cron:
--   select vault.create_secret('<service_role_key>', 'service_role_key');
--   -- or --
--   alter database postgres set app.settings.service_role_key = '<service_role_key>';
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'expire-promotions cron skipped: enable the pg_cron and pg_net extensions, then re-run this migration.';
    RETURN;
  END IF;

  BEGIN
    v_url := supabase_url();
  EXCEPTION WHEN undefined_function THEN
    v_url := current_setting('app.settings.supabase_url', true);
  END;
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://zhstooqgkyuzxseylsbk.supabase.co';
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings.service_role_key', true);
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'expire-promotions cron skipped: no service_role_key in Vault or app.settings.service_role_key.';
    RETURN;
  END IF;

  -- Idempotent: drop any prior schedule of the same name before recreating it.
  BEGIN
    PERFORM cron.unschedule('expire-promotions');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'expire-promotions',
    '0 * * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      )$cmd$,
      v_url || '/functions/v1/expire-promotions',
      v_key
    )
  );

  RAISE NOTICE 'expire-promotions cron scheduled: hourly.';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615140000_phase14_comments.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Comments on listings (basic, no replies).
--
-- A flat comments thread on the listing detail page: buyers ask questions,
-- sellers (and everyone) can read them. Replies come in a later phase, so there
-- is no parent_id here on purpose.
--
-- Like the other Phase 10/11/12/13 tables this is a plain CREATE with NO RLS
-- policies, so it inherits the project's existing access model — the same one
-- db.insertComment / db.getComments rely on. Deletes are soft (deleted=true);
-- the table is never hard-deleted from, so a removed question can still be
-- audited.

CREATE TABLE IF NOT EXISTS comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id),
  user_id    uuid REFERENCES auth.users(id),
  content    text NOT NULL,
  deleted    boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Detail page reads every non-deleted comment for one listing, newest first.
CREATE INDEX IF NOT EXISTS comments_listing_idx ON comments(listing_id);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615150000_phase14_comment_replies.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Comment replies (seller can reply to questions).
--
-- Builds on 20260615140000_phase14_comments.sql. A reply is just another row in
-- the comments table that points back at the question it answers via
-- parent_comment_id. Top-level questions have parent_comment_id = null; replies
-- carry the id of the comment they belong to. This keeps the existing
-- db.getComments / db.insertComment paths working unchanged — replies come back
-- in the same listing query and are grouped under their parent client-side.
--
-- Like the rest of the comments table there are no RLS policies here; the column
-- inherits the project's existing access model.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS
  parent_comment_id uuid REFERENCES comments(id);

-- Grouping replies under their parent is a per-listing read, so an index on the
-- parent keeps that lookup cheap as threads grow.
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_comment_id);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615160000_phase14_shared_wishlists.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Shareable wishlists (create and share via link).
--
-- A user turns their saved pieces into a named, public list reachable at
-- /wishlist/<slug>. `shared_wishlists` holds one row per list; the selected
-- pieces live in `shared_wishlist_items` (one row per listing, with a `position`
-- so the public grid keeps the order they were added). Deleting a list cascades
-- to its items.
--
-- Matches the project's other Phase 10–13 migrations: plain idempotent DDL, no
-- RLS (PostgREST access is governed the same way as wishlists/reviews — the anon
-- key can read public lists, which is exactly what a no-login share link needs).
-- The existing `wishlists` table is left completely untouched (issue constraint).

CREATE TABLE IF NOT EXISTS shared_wishlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shared_wishlist_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_wishlist_id uuid REFERENCES shared_wishlists(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id),
  position integer,
  created_at timestamp with time zone DEFAULT now()
);

-- One lookup per owner for the "MY SHARED LISTS" section, one by slug for the
-- public page (the UNIQUE on slug already indexes it, but the items lookup by
-- parent list is the hot path on the public page).
CREATE INDEX IF NOT EXISTS shared_wishlists_user_idx ON shared_wishlists (user_id);
CREATE INDEX IF NOT EXISTS shared_wishlist_items_list_idx ON shared_wishlist_items (shared_wishlist_id);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615170000_phase14_offers.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Make an offer (buyer side).
--
-- A buyer proposes a price below the asking price; the seller has 48 hours to
-- respond (the seller-response flow lands in a later issue — this migration and
-- the feature it backs are buyer-side only). One row per offer.
--
-- `status` walks pending → accepted / declined / expired / withdrawn. Amounts are
-- stored in pence (integer) to match the rest of the money handling. `expires_at`
-- defaults to 48 hours out so a freshly inserted offer carries its own deadline.
--
-- Matches the project's other Phase 10–14 migrations: plain idempotent DDL, no
-- RLS (PostgREST access is governed the same way as wishlists / comments — the
-- anon key inserts the buyer's own offer, exactly what the buyer flow needs).
-- `offers_enabled` lets a seller turn offers off per-listing (default ON);
-- `minimum_offer_pence` is an optional floor below which buyers cannot offer.

CREATE TABLE IF NOT EXISTS offers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id),
  buyer_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  amount_pence integer NOT NULL,
  status text DEFAULT 'pending',
  -- values: pending, accepted, declined, expired, withdrawn
  message text,
  expires_at timestamp with time zone DEFAULT now() + interval '48 hours',
  created_at timestamp with time zone DEFAULT now()
);

-- Per-listing offer settings.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS offers_enabled boolean DEFAULT true;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS minimum_offer_pence integer;

-- Hot paths: a buyer's pending offer on a listing (toggles the MAKE AN OFFER
-- button to OFFER PENDING), and the seller's incoming offers (for the later
-- seller-response screen).
CREATE INDEX IF NOT EXISTS offers_listing_buyer_idx ON offers (listing_id, buyer_id);
CREATE INDEX IF NOT EXISTS offers_seller_idx ON offers (seller_id);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615180000_phase14_offers_response.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Seller responds to offers (accept / decline / expire).
--
-- Builds on 20260615170000_phase14_offers.sql (the buyer-side offers table).
-- Two pieces of schema:
--   1. offers.counter_offer_pence — when a seller declines an offer they may
--      suggest a different price. We persist it on the offer so the decline
--      email (sent server-side from the offer id) and the buyer's in-app
--      notification can both reference it. NULL = a plain decline, no counter.
--   2. an hourly pg_cron job that POSTs the expire-offers Edge Function. Offers
--      expire 48 hours after they're made (offers.expires_at defaults to now()
--      + 48h); once past, the sweep flips status pending → expired AND notifies
--      both the buyer and the seller in-app. Pure SQL can't send those
--      notifications, so — exactly like the Phase 12/13 saved-search and
--      expire-promotions crons — the cron just calls the Edge Function.
--
-- Like the rest of Phase 10–14 this is plain idempotent DDL with NO RLS, so it
-- inherits the project's existing access model.

-- 1. Seller's optional counter price (in pence) recorded on decline.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS counter_offer_pence integer;

-- The expiry sweep filters pending offers by expires_at.
CREATE INDEX IF NOT EXISTS offers_status_expires_idx ON offers (status, expires_at);

-- 2. Hourly expire-offers sweep (issue PART 5). Mirrors the Phase 12/13 crons:
--    pg_cron + pg_net POST the Edge Function, wrapped in a DO block that
--    degrades gracefully if an extension/helper is unavailable so the migration
--    never fails on a project where cron is off.
--
-- The Edge Function does the real work — mark expired offers, notify the buyer
-- ("your offer expired") and the seller ("an offer expired without a
-- response"). Set the service-role key once (Vault recommended), same as the
-- other crons:
--   select vault.create_secret('<service_role_key>', 'service_role_key');
--   -- or --
--   alter database postgres set app.settings.service_role_key = '<service_role_key>';
--
-- The issue also gives a pure-SQL fallback; this Edge-Function schedule is the
-- richer version (it sends the notifications a bare UPDATE can't). If cron is
-- off the Edge Function can still be POSTed manually for a test.
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'expire-offers cron skipped: enable the pg_cron and pg_net extensions, then re-run this migration.';
    RETURN;
  END IF;

  BEGIN
    v_url := supabase_url();
  EXCEPTION WHEN undefined_function THEN
    v_url := current_setting('app.settings.supabase_url', true);
  END;
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://zhstooqgkyuzxseylsbk.supabase.co';
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings.service_role_key', true);
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'expire-offers cron skipped: no service_role_key in Vault or app.settings.service_role_key.';
    RETURN;
  END IF;

  -- Idempotent: drop any prior schedule of the same name before recreating it.
  BEGIN
    PERFORM cron.unschedule('expire-offers');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'expire-offers',
    '0 * * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      )$cmd$,
      v_url || '/functions/v1/expire-offers',
      v_key
    )
  );

  RAISE NOTICE 'expire-offers cron scheduled: hourly.';
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615190000_phase14_offer_checkout.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Offer checkout (pay an accepted offer via Stripe).
--
-- Builds on the two earlier offer migrations:
--   • 20260615170000_phase14_offers.sql          (buyer-side offers table)
--   • 20260615180000_phase14_offers_response.sql (seller accept/decline + cron)
--
-- This migration adds the bookkeeping the checkout + payment-expiry flow needs:
--
--   1. offers.accepted_at — stamped when a seller accepts. An accepted offer
--      gives the buyer a 24-hour window to pay; we time that window from the
--      acceptance, not the original offer (offers.created_at), so a late accept
--      doesn't hand the buyer a window that's already expired. The expire-offers
--      sweep and the /offers "pay within X hours" countdown both read this.
--
--   2. offers.payment_reminder_sent — the hourly expire-offers sweep emails the
--      buyer a "your offer expires soon" reminder once the 24h window is half
--      gone (12h left). This flag makes that send idempotent so the hourly cron
--      doesn't re-email every hour.
--
--   3. orders.offer_accepted — the webhook records offer purchases in the same
--      orders table as normal sales; this flag marks the rows that came from an
--      accepted offer (so order history / emails can note the saving). The
--      webhook insert self-heals around a missing column, but we add it here so
--      the data is captured wherever the migration has run.
--
-- Like the rest of Phase 10–14 this is plain idempotent DDL with NO RLS, so it
-- inherits the project's existing access model.

-- 1. When the seller accepted (drives the 24h payment window).
ALTER TABLE offers ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;

-- 2. Has the 12-hour "pay soon" reminder email already gone out?
ALTER TABLE offers ADD COLUMN IF NOT EXISTS payment_reminder_sent boolean DEFAULT false;

-- 3. Mark orders that came from an accepted offer (vs a normal sale).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_accepted boolean DEFAULT false;

-- The payment-expiry sweep filters accepted offers by accepted_at; index it
-- alongside the existing (status, expires_at) index from the response migration.
CREATE INDEX IF NOT EXISTS offers_status_accepted_idx ON offers (status, accepted_at);

-- ── Payment-expiry note ───────────────────────────────────────────────────────
-- The hourly `expire-offers` cron (scheduled in 20260615180000) already POSTs the
-- expire-offers Edge Function. That function is extended in this phase to ALSO
-- sweep accepted-but-unpaid offers (24h after accepted_at): mark them 'expired',
-- re-enable offers on the listing, notify both parties, and send the 12h reminder
-- email. No new schedule is needed — the same hourly job now drives both sweeps.
--
-- The issue's pure-SQL fallback (kept here for reference only — the Edge Function
-- is the live path because it also sends the notifications/email a bare UPDATE
-- can't):
--   UPDATE offers
--   SET status = 'expired'
--   WHERE status = 'accepted'
--     AND COALESCE(accepted_at, created_at) < now() - interval '24 hours';


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615200000_phase14_bundle_discounts.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Bundle discounts (seller sets up, bag applies it).
--
-- A seller can offer a percentage discount to buyers who purchase 2+ of their
-- items at once. The discount is configured per-seller on the profiles table and
-- applied automatically in the bag and at checkout (one seller's discount only
-- ever applies to that seller's own items).
--
-- 1. profiles.bundle_discount_enabled    — the seller's on/off switch (default off)
-- 2. profiles.bundle_discount_percentage — 5 / 10 / 15 / 20 (default 10)
-- 3. orders.bundle_discount_percentage   — the % applied to this order's seller
-- 4. orders.bundle_discount_amount_pence — the discount taken off this order, in
--                                          pence (this listing's share of the
--                                          seller's bundle discount)
--
-- Like the rest of Phase 10–14 this is plain idempotent DDL with NO RLS, so it
-- inherits the project's existing access model.

-- Seller configuration (issue PART 1).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bundle_discount_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bundle_discount_percentage integer DEFAULT 10;

-- Per-order record of an applied bundle discount (issue PART 6). Nullable — only
-- set on order rows whose seller's bundle discount was applied at checkout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_discount_percentage integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_discount_amount_pence integer;

-- The shop grid / storefront read the set of sellers with the discount enabled;
-- index the flag so that lookup stays cheap as the table grows.
CREATE INDEX IF NOT EXISTS profiles_bundle_discount_idx ON profiles (bundle_discount_enabled);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615210000_phase14_style_feed.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 14 — Style feed (share an outfit photo featuring Stitch'd listings).
--
-- Two tables + one public storage bucket:
--   1. style_posts      — one row per shared outfit photo. `listing_ids` is a
--      uuid[] of tagged listings (resolved client-side, like a look's items).
--      `likes_count` is a denormalised counter kept in sync by the like/unlike
--      helpers so a card can show the count without a per-post aggregate query.
--      Posts are never hard-deleted — `deleted=true` hides them everywhere.
--   2. style_post_likes — one row per (post, user) like. UNIQUE(post_id,user_id)
--      makes a double-like a harmless 409 and the heart toggle idempotent. The
--      post FK is ON DELETE CASCADE so likes vanish if a post is ever removed.
--
-- Like the other Phase 10–14 tables this is a plain CREATE with NO RLS policies,
-- so it inherits the project's existing access model (the same one every other
-- db.* insert relies on).

CREATE TABLE IF NOT EXISTS style_posts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id),
  caption     text,
  image_url   text NOT NULL,
  listing_ids uuid[] DEFAULT '{}',
  likes_count integer DEFAULT 0,
  deleted     boolean DEFAULT false,
  created_at  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS style_post_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES style_posts(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Feed reads order by created_at within the non-deleted set; the like lookups
-- filter by post_id / user_id. Index both hot paths.
CREATE INDEX IF NOT EXISTS style_posts_created_idx     ON style_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS style_posts_user_idx        ON style_posts(user_id);
CREATE INDEX IF NOT EXISTS style_post_likes_post_idx   ON style_post_likes(post_id);
CREATE INDEX IF NOT EXISTS style_post_likes_user_idx   ON style_post_likes(user_id);

-- Public storage bucket for post images (mirrors the listings / looks /
-- storefront-banners buckets). Public so an image renders without a signed URL.
-- No-op if the storage schema isn't present (e.g. a bare Postgres used only for
-- the REST tables above).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('style-posts', 'style-posts', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260615220000_phase15_tailor_profiles.sql
-- ╚══════════════════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260616000000_phase15_alteration_requests.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — Request alterations on a listing.
--
-- A buyer can request alterations on a listing (before or after buying) by
-- picking a Stitch'd tailor and describing what they need. This builds on the
-- phase15 `tailors` profiles table and the listing detail page.
--
-- One row per request. The tailor responds from their dashboard BOOKINGS tab:
-- SEND QUOTE (status -> quoted, fills quote_pence/quote_message) or DECLINE
-- (status -> declined). Payment for an accepted quote comes in a LATER issue —
-- this migration deliberately adds NO Stripe/payment columns.
--
-- Like the other phase tables this is a plain CREATE with NO RLS policies,
-- inheriting the project's existing access model.

CREATE TABLE IF NOT EXISTS alteration_requests (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id         uuid REFERENCES listings(id),
  buyer_id           uuid REFERENCES auth.users(id),
  tailor_id          uuid REFERENCES tailors(id),
  description        text NOT NULL,            -- the buyer's "what I need" notes (required)
  garment_type       text,                     -- derived from the listing (e.g. "Lehenga")
  alterations_needed text[] DEFAULT '{}',      -- the selected pill values
  additional_notes   text,                     -- mirror of description for display
  budget_pence       integer,                  -- optional buyer budget, in pence
  quote_pence        integer,                  -- tailor's quote, in pence (set on SEND QUOTE)
  quote_message      text,                     -- tailor's optional message with the quote
  status             text DEFAULT 'pending',   -- pending | quoted | accepted | declined | completed | cancelled
  created_at         timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alteration_requests_buyer_idx   ON alteration_requests(buyer_id);
CREATE INDEX IF NOT EXISTS alteration_requests_tailor_idx  ON alteration_requests(tailor_id);
CREATE INDEX IF NOT EXISTS alteration_requests_listing_idx ON alteration_requests(listing_id);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260616010000_phase15_tailor_payments.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — Tailor booking payments + commission.
--
-- Builds on phase15 alteration_requests. When a buyer ACCEPTS a tailor's quote
-- they pay the full quote amount via Stripe; Stitch'd keeps a 15% commission and
-- the rest is owed to the tailor as a payout. Payment lands on the
-- create-alteration-checkout Edge Function (hosted Stripe Checkout) and the
-- result arrives async on stripe-webhook (metadata.type='alteration').
--
-- Like the other phase tables this is a plain ALTER/CREATE with NO RLS policies,
-- inheriting the project's existing access model. All amounts are in pence, GBP.

-- 1. Payment columns on the request. quote_pence (the tailor's quote) already
--    exists from the alteration_requests migration; quote_amount_pence mirrors it
--    at checkout time alongside the commission split so the dashboard/earnings
--    can read the booking financials straight off the row.
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS quote_amount_pence      integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS commission_amount_pence integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS tailor_payout_pence     integer;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS stripe_session_id       text;
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS paid_at                 timestamp with time zone;

-- 2. One payout row per paid booking. amount_pence is the full booking value the
--    buyer paid; commission_pence is the 15% Stitch'd fee; the tailor is owed
--    (amount_pence - commission_pence). status: pending (paid into Stitch'd,
--    awaiting buyer's completion confirmation) | paid (released to the tailor) |
--    failed. Actual money movement to the tailor needs Stripe Connect — see the
--    PR description; for now this table is the source of truth for what's owed.
CREATE TABLE IF NOT EXISTS tailor_payouts (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tailor_id             uuid REFERENCES tailors(id),
  alteration_request_id uuid REFERENCES alteration_requests(id),
  amount_pence          integer NOT NULL,
  commission_pence      integer NOT NULL,
  stripe_session_id     text,
  status                text DEFAULT 'pending', -- pending | paid | failed
  created_at            timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tailor_payouts_tailor_idx  ON tailor_payouts(tailor_id);
CREATE INDEX IF NOT EXISTS tailor_payouts_request_idx ON tailor_payouts(alteration_request_id);
CREATE INDEX IF NOT EXISTS tailor_payouts_status_idx  ON tailor_payouts(status);


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260616020000_phase15_tailor_reviews.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — Tailor reviews & ratings.
--
-- A buyer who has completed an alteration booking can leave the tailor a star
-- rating (1–5) and an optional comment. Ratings roll up onto the tailor row
-- (average_rating / review_count) so the public profile and the tailor-selection
-- cards can show a live rating without aggregating on every read.
--
-- This is SEPARATE from the Phase 10b `reviews` table (seller reviews on
-- listings) — that table is keyed by seller_id and is left untouched. Like the
-- other phase tables this is a plain CREATE/ALTER with NO RLS policies,
-- inheriting the project's existing access model.

-- 1. One review per alteration booking. The UNIQUE(alteration_request_id)
--    constraint enforces the "one review per booking" rule at the database level
--    (a partial unique index would also work, but every review carries a request
--    id so a plain UNIQUE is simplest). rating is constrained to 1–5.
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

-- 2. Denormalised rating roll-up on the tailor row. Recalculated by the frontend
--    after each new review (UPDATE tailors SET average_rating = AVG(...),
--    review_count = COUNT(...)). Defaults mean an un-reviewed tailor reads as 0/0.
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) DEFAULT 0;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS review_count   integer      DEFAULT 0;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260616030000_phase15_tailor_availability.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — Tailor availability calendar.
--
-- Lets an approved tailor publish the dates they can take on work, so buyers can
-- see availability before sending an alteration request and (optionally) pick a
-- preferred start date. Builds on the phase15 `tailors` profiles + the
-- `alteration_requests` flow — it does NOT touch Stripe/payment code or the
-- pre-existing tailor_services / tailor_bookings marketplace.
--
-- Like the other phase tables this is a plain CREATE / ALTER with NO RLS
-- policies, inheriting the project's existing access model. Every column is
-- additive + defaulted so a deployment that hasn't run earlier migrations still
-- ends up consistent, and the app's self-healing db.js drops any column a given
-- schema is still missing rather than failing the whole write.

-- 1. tailor_availability — one row per (tailor, date) the tailor has touched.
--    A date with NO row is "available with the tailor's default slots"; a row
--    overrides that with an explicit available flag / slot count / note.
--    ON DELETE CASCADE so removing a tailor drops their calendar.
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

-- 2. Availability settings on the tailor row.
--    availability_enabled  — OFF by default; when ON the calendar shows on the
--                            public /tailors/<id> profile.
--    advance_booking_days  — how far ahead the tailor accepts bookings (the
--                            calendar/booking window). Default 30 (1 month).
--    default_slots_per_day — jobs the tailor can take in a day (1–10). Default 3.
--    vacation_mode         — when ON (kept in sync with the seller's profile
--                            vacation_mode) the public calendar shows every date
--                            as unavailable WITHOUT touching the per-day rows, so
--                            turning vacation off restores availability exactly.
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS availability_enabled  boolean DEFAULT false;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS advance_booking_days  integer DEFAULT 30;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS default_slots_per_day integer DEFAULT 3;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS vacation_mode         boolean DEFAULT false;

-- 3. Preferred start date on an alteration request (optional). Shown to the
--    tailor on their booking cards so they know when the buyer wants to start.
ALTER TABLE alteration_requests ADD COLUMN IF NOT EXISTS preferred_date date;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260616040000_phase15_stripe_connect.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — Stripe Connect for tailor payouts.
--
-- Until now tailor payouts have been tracked in the database only: a paid booking
-- writes a tailor_payouts row (status 'pending'), and the buyer confirming
-- completion flipped it to 'paid' WITHOUT any money actually moving. This
-- migration adds the columns Stripe Connect needs so the payout can become a real
-- Stripe transfer to the tailor's connected account.
--
-- Connect model: EXPRESS accounts (Stitch'd manages onboarding). The tailor
-- onboards via a Stripe-hosted account link (create-connect-account), Stripe
-- verifies their details, and on a completed booking Stitch'd transfers their cut
-- (85%) from the platform balance to their connected account, keeping the 15%
-- commission. See the PR description for the Stripe dashboard settings that must
-- be activated before this can be tested end to end.
--
-- Like the other phase tables this is a plain ALTER with NO RLS policies,
-- inheriting the project's existing access model. All amounts are in pence, GBP.

-- 1. Connect onboarding state on the tailor. stripe_account_id is the Express
--    account (acct_…); stripe_onboarding_complete mirrors Stripe's
--    details_submitted (set by verify-connect-account); stripe_onboarding_url is
--    the most recent account-link URL so a half-finished onboarding can be resumed.
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS stripe_account_id          text;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS stripe_onboarding_url      text;

-- 2. Transfer tracking on the payout. stripe_transfer_id is the tr_… id of the
--    Stripe transfer once released; paid_at stamps when it went out; failure_reason
--    records why a transfer failed so the admin PAYOUTS panel can flag it and offer
--    a retry. The existing status column gains a 'failed' meaning alongside
--    pending | paid.
ALTER TABLE tailor_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id text;
ALTER TABLE tailor_payouts ADD COLUMN IF NOT EXISTS paid_at            timestamp with time zone;
ALTER TABLE tailor_payouts ADD COLUMN IF NOT EXISTS failure_reason     text;


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260622000000_phase15_ensure_tailor_buckets.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — ensure the tailor storage buckets exist.
--
-- The original phase15 migration (20260615220000) creates the
-- 'tailor-profiles' and 'tailor-portfolio' buckets, but on projects where that
-- storage step didn't take effect the tailor application fails on submit: the
-- profile-image upload POSTs to a missing bucket and 404s ("Bucket not found")
-- before the tailors row is ever inserted.
--
-- This migration re-asserts both buckets (public, like listings/looks) so the
-- upload succeeds. Idempotent: ON CONFLICT keeps any existing bucket untouched.
-- No-op if the storage schema isn't present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('tailor-profiles', 'tailor-profiles', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('tailor-portfolio', 'tailor-portfolio', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;
END $$;

-- Storage WRITE policies for the tailor buckets. The buckets are public for
-- reads (served via the /object/public/ path without RLS), but storage.objects
-- RLS still governs uploads — without an INSERT policy the upload fails with
-- "new row violates row-level security policy". Allow any logged-in user to
-- upload/replace images in the two tailor buckets (mirrors the access the
-- listings/looks buckets already have). Idempotent via DROP ... IF EXISTS.
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


-- ╔══════════════════════════════════════════════════════════════════════════
-- ║ 20260622010000_phase15_disable_tailor_rls.sql
-- ╚══════════════════════════════════════════════════════════════════════════
-- Phase 15 — match the project's access model on the tailor tables.
--
-- The rest of the app's tables run with row-level security DISABLED (access is
-- controlled at the app layer via the anon/authenticated keys) — see the "NO RLS
-- policies, inheriting the project's existing access model" note on the phase
-- migrations. On some projects RLS ends up ENABLED on the freshly-created tailor
-- tables (e.g. toggled on from the dashboard's "RLS disabled" warning), which
-- then blocks every write with "new row violates row-level security policy for
-- table 'tailors'".
--
-- Disable RLS on the phase15 tailor tables so they behave like the rest of the
-- schema. Guarded so it's a no-op if a table doesn't exist yet. Idempotent.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tailors','tailor_portfolio','alteration_requests','tailor_payouts','tailor_reviews','tailor_availability']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- EXTRA: storage write access for ALL buckets
-- ════════════════════════════════════════════════════════════════════════════
-- Image uploads need an INSERT policy on storage.objects. The per-bucket
-- policies above cover disputes/tailor buckets; these broad policies cover the
-- rest (listings, looks, storefront-banners, style-posts, …) so every upload in
-- the app works. Reads are public.
DROP POLICY IF EXISTS "stitchd authenticated upload" ON storage.objects;
CREATE POLICY "stitchd authenticated upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stitchd authenticated update" ON storage.objects;
CREATE POLICY "stitchd authenticated update" ON storage.objects
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stitchd public read" ON storage.objects;
CREATE POLICY "stitchd public read" ON storage.objects
  FOR SELECT TO public USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- OPTIONAL: make your account the Stitch'd admin (unlocks the ADMIN dashboard).
-- Uncomment and set your login email, then re-run.
-- ════════════════════════════════════════════════════════════════════════════
-- UPDATE profiles SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');

-- Refresh the API so it sees every new table/column immediately.
NOTIFY pgrst, 'reload schema';
