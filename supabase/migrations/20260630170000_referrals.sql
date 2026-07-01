-- Referrals: invite a friend; both get a free listing bump on the friend's
-- first purchase.
-- ------------------------------------------------------------------------
--   referred_by        - who invited this member (set once, then locked)
--   free_bumps         - redeemable free 7-day Promote boosts (server-granted)
--   referral_rewarded  - has this member's first-purchase reward been paid out
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_bumps integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_rewarded boolean DEFAULT false;

-- Extend the privileged-column guard (from Wave 3) so a member can't hand
-- themselves free bumps or fake a reward. referred_by may be set ONCE (when it's
-- still null - at signup) but never changed afterwards; free_bumps and
-- referral_rewarded are entirely server-controlled (webhook grants, redeem-bump
-- spends). The service role and admins bypass all of this.
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
    NEW.free_bumps := 0;
    NEW.referral_rewarded := false;
    IF NEW.referred_by = NEW.id THEN NEW.referred_by := NULL; END IF; -- no self-referral
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
     OR NEW.free_bumps IS DISTINCT FROM OLD.free_bumps
     OR NEW.referral_rewarded IS DISTINCT FROM OLD.referral_rewarded
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile columns';
  END IF;

  -- referred_by: settable once (while null), then locked; never to self.
  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    IF OLD.referred_by IS NOT NULL THEN
      RAISE EXCEPTION 'referred_by cannot be changed';
    END IF;
    IF NEW.referred_by = NEW.id THEN NEW.referred_by := NULL; END IF;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
