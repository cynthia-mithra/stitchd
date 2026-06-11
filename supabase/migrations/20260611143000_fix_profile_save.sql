-- Bug #97 — "Failed to save profile" on every profile change.
--
-- ROOT CAUSE: db.upsertProfile (src/lib/db.js) POSTs a fixed payload of profile
-- columns. PostgREST rejects the ENTIRE upsert with PGRST204
--   "Could not find the 'X' column of 'profiles' in the schema cache"
-- if the table is missing ANY one of those columns. Because the payload always
-- includes the tailor / measurement / preference fields, a single absent column
-- silently failed every save — display name, avatar and all. (Listing saves were
-- unaffected because db.insert self-heals via sendHealing; upsertProfile didn't.
-- It now self-heals too, and this migration brings the schema fully in line so
-- nothing has to be dropped.)
--
-- The `profiles` table itself predates these migrations, so we only ensure every
-- column the app writes exists. All idempotent — safe to re-run.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name         text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url        text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio               text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS region            text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialises_in    text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bust              text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waist             text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hips              text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height            text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_size    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_tailor         boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tailor_services   text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tailor_price_from text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accepting_clients boolean DEFAULT true;

-- RLS policies (defensive). The other Phase 10 tables declare no policies and
-- inherit the project's existing access model; reads/writes to `profiles`
-- already work through that model, so RLS was NOT the cause here. These policies
-- are added idempotently so that IF row-level security is ever enabled on
-- `profiles`, the intended access (anyone can view; a user can create/update
-- only their own row) is already in place. They are inert while RLS is disabled,
-- and we deliberately do NOT call ENABLE ROW LEVEL SECURITY — turning it on with
-- incomplete policies would lock users out, the opposite of the fix.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles are viewable by everyone') THEN
    CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile') THEN
    -- WITH CHECK as well as USING: an upsert (INSERT … ON CONFLICT DO UPDATE)
    -- validates the post-update row against the UPDATE policy's WITH CHECK.
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- NOTE on profile pictures: avatars are uploaded via uploadImage() with the
-- DEFAULT bucket ("listings") — the same bucket listing photos use (see
-- src/lib/auth.js + saveProfile in src/App.js). There is NO separate "avatars"
-- bucket and none is required; the avatar upload already works. The save failed
-- only because the subsequent profile upsert was rejected over a missing column.
