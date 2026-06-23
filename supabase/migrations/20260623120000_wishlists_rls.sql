-- Wishlists RLS.
--
-- The wishlists table had RLS enabled with no policies, so every insert failed
-- with 42501 "new row violates row-level security policy". These policies let
-- anyone READ wishlist rows (the shop shows public wishlist counts per listing)
-- while restricting INSERT/DELETE to the owner of the row (auth.uid() = user_id).

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishlists_select ON wishlists;
DROP POLICY IF EXISTS wishlists_insert ON wishlists;
DROP POLICY IF EXISTS wishlists_delete ON wishlists;

-- Public read so wishlist counts render for everyone.
CREATE POLICY wishlists_select ON wishlists
  FOR SELECT USING (true);

-- A user can only add/remove their own saved items.
CREATE POLICY wishlists_insert ON wishlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wishlists_delete ON wishlists
  FOR DELETE USING (auth.uid() = user_id);
