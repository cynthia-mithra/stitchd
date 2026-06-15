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
