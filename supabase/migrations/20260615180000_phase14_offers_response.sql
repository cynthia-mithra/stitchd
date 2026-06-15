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
