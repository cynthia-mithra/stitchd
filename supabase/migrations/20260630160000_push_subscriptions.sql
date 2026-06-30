-- Web push subscriptions: one row per device a user has enabled push on.
-- The send-push edge function (service role) reads these to deliver pushes;
-- RLS limits the client to managing only its own rows.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_sub_user_idx ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_sub_select_own ON push_subscriptions;
CREATE POLICY push_sub_select_own ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_sub_insert_own ON push_subscriptions;
CREATE POLICY push_sub_insert_own ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_sub_delete_own ON push_subscriptions;
CREATE POLICY push_sub_delete_own ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
