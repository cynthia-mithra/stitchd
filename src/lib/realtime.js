import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

// Realtime websocket client. The rest of the app talks to PostgREST with plain
// fetch; this is used ONLY for live subscriptions (chat, unread badges), so the
// auth session is disabled - we pass the user's JWT to Realtime explicitly so
// RLS on the messages table scopes delivery to their own conversations.
let client = null;
function getClient() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Subscribe to INSERTs on messages the signed-in user can see. Returns an
// unsubscribe function. onInsert receives the new message row.
export function subscribeMessages(token, onInsert) {
  const c = getClient();
  try { c.realtime.setAuth(token); } catch (e) { /* ignore */ }
  const channel = c
    .channel("rt-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => { try { onInsert(payload.new); } catch (e) { /* ignore */ } },
    )
    .subscribe();
  return () => { try { c.removeChannel(channel); } catch (e) { /* ignore */ } };
}
