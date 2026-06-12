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
