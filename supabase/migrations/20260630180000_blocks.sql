-- Block users: a member can block another so they can't message them, and the
-- blocked member's listings disappear from the blocker's shop.
CREATE TABLE IF NOT EXISTS blocks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- A member sees rows where they're either side (the blocked side needs to read
-- their "I am blocked" rows so the message-insert policy below can check them);
-- only the blocker may create/remove a block.
DROP POLICY IF EXISTS blocks_select ON blocks;
CREATE POLICY blocks_select ON blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid() OR blocked_id = auth.uid());
DROP POLICY IF EXISTS blocks_insert ON blocks;
CREATE POLICY blocks_insert ON blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_delete ON blocks;
CREATE POLICY blocks_delete ON blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- Enforce the block on the messages table: a member can't send into a
-- conversation whose OTHER participant has blocked them. Extends the Wave 3
-- msg_insert_sender policy.
DROP POLICY IF EXISTS msg_insert_sender ON messages;
CREATE POLICY msg_insert_sender ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM conversations c
      JOIN blocks b
        ON b.blocked_id = auth.uid()
       AND b.blocker_id = (CASE WHEN c.buyer_id = auth.uid() THEN c.seller_id ELSE c.buyer_id END)
      WHERE c.id = conversation_id
    )
  );

NOTIFY pgrst, 'reload schema';
