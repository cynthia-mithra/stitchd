// Supabase Edge Function: wallet-release
// ---------------------------------------
// The single authorized path for moving escrowed sale earnings between states.
// Previously the browser PATCHed wallet_transactions directly (release on
// confirm-receipt, hold on dispute, settle by admin, 14-day auto-release) - which
// only worked because RLS was off, meaning anyone could flip anyone's earnings or
// even mint their own. Wave 1 turns RLS on (clients can no longer write the
// table) and routes every move through here, where the CALLER is authenticated
// from their JWT and authorized per action before the service role makes the
// change.
//
// Actions (POST { action, ... } with Authorization: Bearer <user JWT>):
//   confirm_receipt { order_id }  - caller must be the order's buyer. Marks the
//                                   order completed and releases that listing's
//                                   pending sale credit -> available.
//   dispute_hold    { order_id }  - caller must be the order's buyer. Holds the
//                                   listing's pending sale credit -> disputed.
//   dispute_settle  { listing_id, release } - caller must be an admin. Settles
//                                   pending/disputed credits -> available (release)
//                                   or failed (refunded to buyer).
//   auto_release    { }           - caller releases only their OWN sale credits
//                                   that are pending AND older than 14 days; the
//                                   cutoff is enforced here so nothing releases
//                                   early.
//
// Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Deploy: verify_jwt = false in config.toml (we authenticate the caller here).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AUTO_RELEASE_MS = 14 * 24 * 60 * 60 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const svc = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// Resolve the caller from their JWT (verifies the token via the auth server).
async function getCaller(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? { id: u.id } : null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  if (!r || !r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.is_admin === true;
}

async function getOrder(orderId: string) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=id,buyer_id,seller_id,listing_id,status&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  if (!r || !r.ok) return null;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function patchWalletByListing(listingId: string, fromStatuses: string, toStatus: string) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/wallet_transactions?listing_id=eq.${listingId}&type=eq.sale&status=${fromStatuses}`,
    { method: "PATCH", headers: svc, body: JSON.stringify({ status: toStatus }) },
  ).catch(() => {});
}

async function patchOrder(orderId: string, patch: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: "PATCH", headers: svc, body: JSON.stringify(patch),
  }).catch(() => {});
}

async function notify(userId: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST", headers: svc, body: JSON.stringify({ user_id: userId, read: false, ...body }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Not authenticated." }, 401);

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* empty body ok for auto_release */ }
  const action = String(payload.action || "");

  try {
    if (action === "confirm_receipt") {
      const orderId = String(payload.order_id || "");
      if (!orderId) return json({ error: "Missing order_id." }, 400);
      const order = await getOrder(orderId);
      if (!order) return json({ error: "Order not found." }, 404);
      if (order.buyer_id !== caller.id) return json({ error: "Not your order." }, 403);

      await patchOrder(orderId, { status: "completed" });
      if (order.listing_id) await patchWalletByListing(order.listing_id, "eq.pending", "available");
      if (order.seller_id) {
        await notify(order.seller_id, {
          type: "sale",
          title: "Payment released",
          body: "The buyer confirmed receipt - your earnings are now available to withdraw.",
          link_id: order.listing_id ?? null,
        });
      }
      return json({ ok: true, released: true });
    }

    if (action === "dispute_hold") {
      const orderId = String(payload.order_id || "");
      if (!orderId) return json({ error: "Missing order_id." }, 400);
      const order = await getOrder(orderId);
      if (!order) return json({ error: "Order not found." }, 404);
      if (order.buyer_id !== caller.id) return json({ error: "Not your order." }, 403);
      if (order.listing_id) await patchWalletByListing(order.listing_id, "eq.pending", "disputed");
      return json({ ok: true, held: true });
    }

    if (action === "dispute_settle") {
      if (!(await isAdmin(caller.id))) return json({ error: "Admins only." }, 403);
      const listingId = String(payload.listing_id || "");
      if (!listingId) return json({ error: "Missing listing_id." }, 400);
      const release = payload.release === true || payload.release === "true";
      await patchWalletByListing(listingId, "in.(pending,disputed)", release ? "available" : "failed");
      return json({ ok: true, settled: release ? "released" : "refunded" });
    }

    if (action === "auto_release") {
      // Release only the caller's OWN pending sale credits older than 14 days.
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/wallet_transactions?user_id=eq.${caller.id}&type=eq.sale&status=eq.pending&select=id,created_at`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      ).catch(() => null);
      const rows: Array<{ id: string; created_at?: string }> = r && r.ok ? await r.json().catch(() => []) : [];
      const cutoff = Date.now() - AUTO_RELEASE_MS;
      const dueIds = rows
        .filter((t) => t.created_at && new Date(t.created_at).getTime() < cutoff)
        .map((t) => t.id);
      if (dueIds.length) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/wallet_transactions?id=in.(${dueIds.join(",")})`,
          { method: "PATCH", headers: svc, body: JSON.stringify({ status: "available" }) },
        ).catch(() => {});
      }
      return json({ ok: true, released: dueIds.length });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Release failed." }, 500);
  }
});
