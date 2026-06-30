-- Wave 2 security hardening: lock offers, disputes, alteration_requests and
-- tailor_payouts so the public REST API can't be used to forge state.
-- ------------------------------------------------------------------------
-- All of these are enforced purely with RLS - the legitimate client actions
-- (make/accept/decline/withdraw an offer, raise/resolve a dispute, request/
-- quote/complete an alteration, confirm a payout) all still pass, while the
-- abuse paths are blocked. The real money transfers were already server-side
-- (stripe-webhook, process-tailor-payout, wallet-withdraw, all service-role),
-- so nothing here needs a new function. Service-role callers bypass RLS.
--
-- Closes specifically:
--   * Offers: a buyer can no longer POST an already-'accepted' offer (or make
--     themselves the seller) to buy an item for 1p - inserts must be their own,
--     'pending', with seller_id = the listing's real owner; only the seller may
--     move an offer to accepted/declined, only the buyer may withdraw.
--   * Alterations: a buyer can no longer self-'quote' a request cheaply - only
--     the tailor may set quoted/declined/completed; the buyer may only
--     decline/cancel/dispute; 'accepted' is set by the webhook on payment.
--   * Tailor payouts: a tailor can no longer self-mark a payout 'paid' - only
--     the linked buyer (confirm completion) or an admin may.
--   * All four: rows are readable only by their parties (+ admins).

-- ── offers ──────────────────────────────────────────────────────────────────
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offers_select_party ON offers;
CREATE POLICY offers_select_party ON offers
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS offers_insert_buyer ON offers;
CREATE POLICY offers_insert_buyer ON offers
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND status = 'pending'
    AND seller_id <> auth.uid()
    AND seller_id = (SELECT l.user_id FROM listings l WHERE l.id = listing_id)
  );

DROP POLICY IF EXISTS offers_update_parties ON offers;
CREATE POLICY offers_update_parties ON offers
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (
    (seller_id = auth.uid() AND status IN ('accepted', 'declined'))
    OR (buyer_id = auth.uid() AND status = 'withdrawn')
  );

-- ── disputes ────────────────────────────────────────────────────────────────
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disputes_select ON disputes;
CREATE POLICY disputes_select ON disputes
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS disputes_insert_buyer ON disputes;
CREATE POLICY disputes_insert_buyer ON disputes
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS disputes_update_admin ON disputes;
CREATE POLICY disputes_update_admin ON disputes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- ── alteration_requests ─────────────────────────────────────────────────────
ALTER TABLE alteration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ar_select ON alteration_requests;
CREATE POLICY ar_select ON alteration_requests
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS ar_insert_buyer ON alteration_requests;
CREATE POLICY ar_insert_buyer ON alteration_requests
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid() AND status = 'pending' AND quote_pence IS NULL);

DROP POLICY IF EXISTS ar_update ON alteration_requests;
CREATE POLICY ar_update ON alteration_requests
  FOR UPDATE TO authenticated
  USING (
    buyer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    OR (EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid())
        AND status IN ('quoted', 'declined', 'completed'))
    OR (buyer_id = auth.uid() AND status IN ('declined', 'cancelled', 'disputed'))
  );

-- ── tailor_payouts ──────────────────────────────────────────────────────────
ALTER TABLE tailor_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_select ON tailor_payouts;
CREATE POLICY tp_select ON tailor_payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tailors t WHERE t.id = tailor_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM alteration_requests ar WHERE ar.id = alteration_request_id AND ar.buyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Only the linked buyer (confirming completion) or an admin may move a payout;
-- a tailor cannot mark their own payout paid. Inserts/deletes stay service-role
-- only (the webhook creates payouts; process-tailor-payout settles real ones).
DROP POLICY IF EXISTS tp_update_buyer_admin ON tailor_payouts;
CREATE POLICY tp_update_buyer_admin ON tailor_payouts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM alteration_requests ar WHERE ar.id = alteration_request_id AND ar.buyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    status = 'paid'
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

NOTIFY pgrst, 'reload schema';
