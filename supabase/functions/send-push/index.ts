// Supabase Edge Function: send-push
// ----------------------------------
// Delivers a web push to all of a recipient's registered devices. Called
// best-effort from the app's notify() whenever an in-app notification is
// created (new message, offer, sale, follow, …). Looks the recipient's
// subscriptions up server-side (service role) and sends each via VAPID; dead
// subscriptions (404/410) are pruned.
//
// Required secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (generated as a pair)
//   VAPID_SUBJECT   (optional, defaults to mailto:hello@stitchd.fit)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto)
//
// Deploy: verify_jwt = true (only signed-in users can trigger a push), matching
// the app's existing notify() trust model.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@stitchd.fit";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

interface Sub { id: string; endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "Push not configured." }, 200);

  try {
    const { user_id, title, body, url, tag } = await req.json();
    if (!user_id || !title) return json({ error: "Missing user_id/title." }, 400);

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}&select=id,endpoint,p256dh,auth`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const subs: Sub[] = r && r.ok ? await r.json().catch(() => []) : [];
    if (!subs.length) return json({ ok: true, sent: 0 });

    const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || "stitchd" });
    let sent = 0;
    const dead: string[] = [];

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // gone - prune
      }
    }));

    if (dead.length) {
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${dead.join(",")})`, {
        method: "DELETE", headers: sb,
      }).catch(() => {});
    }

    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: (e as Error).message || "Push failed." }, 500);
  }
});
