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
