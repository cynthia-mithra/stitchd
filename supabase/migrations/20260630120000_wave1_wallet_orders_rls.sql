-- Wave 1 security hardening: lock the money tables.
-- ------------------------------------------------------------------------
-- Until now wallet_transactions and orders were exposed to the public REST
-- API with RLS off, so any logged-in user could read everyone's rows and -
-- worse - INSERT their own wallet credits and then withdraw real money. This
-- enables RLS with tight policies:
--   * wallet_transactions: a user may READ only their own rows, and NO client
--     may write at all. Every write now comes from a service-role edge function
--     (stripe-webhook credits, wallet-withdraw debits, wallet-release moves
--     escrow), which bypasses RLS.
--   * orders: the buyer, the seller, or an admin may READ an order; the buyer
--     or seller may UPDATE their own order (tracking / status); only the
--     service-role webhook INSERTs orders and nobody may DELETE them.
--
-- RLS only gates access - it never touches existing data, and service-role
-- callers (all the edge functions) bypass it entirely, so the sale, payout and
-- email flows are unaffected.

-- ── wallet_transactions ─────────────────────────────────────────────────────
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_select_own ON wallet_transactions;
CREATE POLICY wallet_select_own ON wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- No INSERT/UPDATE/DELETE policy => the anon/authenticated roles cannot write.
-- The service role (edge functions) bypasses RLS and remains the only writer.

-- ── orders ──────────────────────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_party ON orders;
CREATE POLICY orders_select_party ON orders
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Buyer or seller may update their own order (e.g. seller adds tracking). Money
-- release is NOT done here - it runs through the wallet-release function, which
-- re-checks who the caller is. No INSERT policy => only the service-role webhook
-- creates orders; no DELETE policy => orders can't be deleted from the client.
DROP POLICY IF EXISTS orders_update_party ON orders;
CREATE POLICY orders_update_party ON orders
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

NOTIFY pgrst, 'reload schema';
