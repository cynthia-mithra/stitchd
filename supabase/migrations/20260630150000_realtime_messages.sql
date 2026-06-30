-- Real-time chat: broadcast new messages over the Realtime websocket.
-- ------------------------------------------------------------------------
-- Add the messages table to Supabase's realtime publication so INSERTs are
-- streamed to subscribed clients. RLS (msg_select_party, added in Wave 3) still
-- applies to Realtime, so each subscriber only receives messages in their own
-- conversations - no extra policy needed. Idempotent.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already in the publication
  WHEN undefined_object THEN NULL;  -- publication missing (very unusual) - skip
END $$;
