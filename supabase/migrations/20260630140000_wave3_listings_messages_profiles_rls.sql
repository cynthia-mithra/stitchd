-- Wave 3 security hardening: lock everyday data (listings, messages, profiles).
-- ------------------------------------------------------------------------
-- Listings and profiles are PUBLICLY readable (the shop, seller names) so SELECT
-- stays open; the lockdown is on writes. Messages/conversations become private to
-- their participants. Closes:
--   * Listings: only the owner may insert/edit/delete their own items - no more
--     editing someone else's price or deleting their listing. View counts still
--     work via a SECURITY DEFINER function (the one allowed non-owner write).
--   * Messages/conversations: readable and writable only by the two participants -
--     private messages and who-talks-to-whom are no longer world-readable.
--   * Profiles: a user may edit only their own profile, and NOBODY (not even the
--     owner) can self-grant privileged columns - is_admin, verified,
--     identity_verified, the stripe_* Connect fields - via a guard trigger. This
--     closes self-promotion to admin and faking the verified badge. Admins (and
--     the service role) keep full access for approvals.
-- Also adds an orders idempotency index so a duplicate webhook can't double-create
-- an order.

-- ── listings ────────────────────────────────────────────────────────────────
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listings_select_public ON listings;
CREATE POLICY listings_select_public ON listings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS listings_insert_owner ON listings;
CREATE POLICY listings_insert_owner ON listings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS listings_update_owner ON listings;
CREATE POLICY listings_update_owner ON listings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS listings_delete_owner ON listings;
CREATE POLICY listings_delete_owner ON listings
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- View counter: the one legitimate non-owner write. SECURITY DEFINER so it runs
-- as the table owner (bypassing the owner-only UPDATE policy); callable by anyone.
CREATE OR REPLACE FUNCTION increment_listing_views(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE listings SET views = COALESCE(views, 0) + 1 WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION increment_listing_views(uuid) TO anon, authenticated;

-- ── conversations ───────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conv_party_all ON conversations;
CREATE POLICY conv_party_all ON conversations
  FOR ALL TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

-- ── messages ────────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msg_select_party ON messages;
CREATE POLICY msg_select_party ON messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  ));

DROP POLICY IF EXISTS msg_insert_sender ON messages;
CREATE POLICY msg_insert_sender ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Participants may update messages in their conversation (the read flag).
DROP POLICY IF EXISTS msg_update_party ON messages;
CREATE POLICY msg_update_party ON messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  ));

-- ── profiles ────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public read (seller names/avatars/ratings render across the app).
DROP POLICY IF EXISTS profiles_select_public ON profiles;
CREATE POLICY profiles_select_public ON profiles
  FOR SELECT TO anon, authenticated USING (true);

-- A user may create only their own profile row.
DROP POLICY IF EXISTS profiles_insert_self ON profiles;
CREATE POLICY profiles_insert_self ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- A user may update their own profile; admins may update any (approvals).
DROP POLICY IF EXISTS profiles_update_self_or_admin ON profiles;
CREATE POLICY profiles_update_self_or_admin ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- Guard trigger: privileged columns can only be set by the service role or an
-- admin. On a normal user's INSERT they're forced to safe defaults; on UPDATE any
-- attempt to change them is rejected. This is what stops a user POSTing
-- is_admin=true / verified=true to the REST API.
CREATE OR REPLACE FUNCTION protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT is_admin INTO caller_is_admin FROM profiles WHERE id = auth.uid();
  IF caller_is_admin IS TRUE THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    NEW.verified := false;
    NEW.verified_at := NULL;
    NEW.verification_status := NULL;
    NEW.identity_verified := false;
    NEW.identity_verified_at := NULL;
    NEW.identity_verification_status := NULL;
    NEW.stripe_account_id := NULL;
    NEW.stripe_onboarding_complete := false;
    NEW.stripe_onboarding_url := NULL;
    NEW.stripe_verification_session_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.identity_verified IS DISTINCT FROM OLD.identity_verified
     OR NEW.identity_verified_at IS DISTINCT FROM OLD.identity_verified_at
     OR NEW.identity_verification_status IS DISTINCT FROM OLD.identity_verification_status
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
     OR NEW.stripe_onboarding_url IS DISTINCT FROM OLD.stripe_onboarding_url
     OR NEW.stripe_verification_session_id IS DISTINCT FROM OLD.stripe_verification_session_id
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile columns';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON profiles;
CREATE TRIGGER trg_protect_profile_privileged
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_privileged_columns();

-- ── orders idempotency ──────────────────────────────────────────────────────
-- Stop a duplicate webhook delivery from creating a second order for the same
-- listing in the same checkout session. Wrapped so pre-existing duplicate rows
-- don't abort the whole migration (clean them, then re-run this block).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS orders_session_listing_unique
    ON orders (stripe_session_id, listing_id)
    WHERE stripe_session_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'orders_session_listing_unique not created (likely existing duplicate rows): %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
