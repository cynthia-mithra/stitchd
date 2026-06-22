-- Wallet — seller earnings balance, withdrawals, and Stripe Connect for sellers.
--
-- Sale payments are collected into the Stitch'd (platform) Stripe account. When a
-- sale completes the stripe-webhook credits the seller's wallet with the sale
-- price minus an 8% commission (a `wallet_transactions` 'sale' row). Sellers
-- withdraw their available balance to their bank via Stripe Connect (the
-- wallet-withdraw function creates a transfer to their connected account and
-- writes a 'withdrawal' row).
--
-- Balance is derived from the ledger (no denormalised column → no race): it's the
-- sum of every non-'failed' transaction's amount_pence (sale credits are
-- positive, withdrawals negative).
--
-- Like the other tables this is a plain CREATE/ALTER with NO RLS policies,
-- matching the project's existing access model.

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid REFERENCES auth.users(id),
  type               text NOT NULL,             -- 'sale' | 'withdrawal'
  amount_pence       integer NOT NULL,          -- +credit (sale) / -debit (withdrawal)
  status             text DEFAULT 'available',  -- available | pending | paid | failed
  order_id           uuid,
  listing_id         uuid,
  stripe_session_id  text,
  stripe_transfer_id text,
  failure_reason     text,
  description        text,
  created_at         timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_tx_user_idx   ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS wallet_tx_status_idx ON wallet_transactions(status);
-- One credit per sold listing per checkout session — makes the webhook credit
-- idempotent so a retried/duplicate webhook can't double-credit the seller, while
-- still allowing a relisted item to be sold (and credited) again in a new session.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_sale_unique
  ON wallet_transactions(listing_id, stripe_session_id)
  WHERE type = 'sale' AND stripe_session_id IS NOT NULL AND listing_id IS NOT NULL;

-- Stripe Connect onboarding state for sellers (mirrors the tailor columns, but on
-- the profile so any seller can withdraw — separate from the tailor payout flow).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_id          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_url      text;

-- Match the project's access model (app-layer control, RLS off) so the client can
-- read the ledger. Without this, RLS-enabled-by-default blocks every read and the
-- wallet shows empty even though credits exist.
ALTER TABLE wallet_transactions DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
