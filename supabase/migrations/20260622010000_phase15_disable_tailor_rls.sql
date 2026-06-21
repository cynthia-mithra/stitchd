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
