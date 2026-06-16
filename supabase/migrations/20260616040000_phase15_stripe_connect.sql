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
