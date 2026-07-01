// Supabase Edge Function: redeem-bump
// ------------------------------------
// Spend one of the caller's free listing bumps (earned via referrals) to promote
// one of THEIR OWN listings for 7 days - the same effect as the paid £2.99
// Promote, but no payment. Authenticates the caller from their JWT and does the
// balance check + decrement server-side so a member can't promote for free
// without actually holding a bump.
//
// POST { listing_id }  with Authorization: Bearer <user JWT>
// Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Deploy: verify_jwt = false (we authenticate the caller here).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PROMO_DAYS = 7;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
const svcGet = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller) return json({ error: "Not authenticated." }, 401);

  try {
    const { listing_id } = await req.json();
    if (!listing_id) return json({ error: "Missing listing_id." }, 400);

    // Balance.
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=free_bumps&limit=1`, { headers: svcGet }).catch(() => null);
    const profile = pr && pr.ok ? (await pr.json().catch(() => []))[0] : null;
    const bumps = Number(profile?.free_bumps) || 0;
    if (bumps < 1) return json({ error: "You don't have any free bumps." }, 400);

    // Ownership + not sold.
    const lr = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listing_id}&select=id,user_id,sold,status,name&limit=1`, { headers: svcGet }).catch(() => null);
    const listing = lr && lr.ok ? (await lr.json().catch(() => []))[0] : null;
    if (!listing) return json({ error: "Listing not found." }, 404);
    if (listing.user_id !== caller.id) return json({ error: "Not your listing." }, 403);
    if (listing.sold || listing.status === "sold") return json({ error: "That listing is already sold." }, 400);

    const now = new Date();
    const until = new Date(now.getTime() + PROMO_DAYS * 86400000).toISOString();

    // Promote the listing.
    await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listing_id}`, {
      method: "PATCH", headers: svc,
      body: JSON.stringify({ promoted: true, promoted_until: until }),
    }).catch(() => {});

    // Spend the bump (decrement; service role bypasses the guard trigger).
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}`, {
      method: "PATCH", headers: svc,
      body: JSON.stringify({ free_bumps: bumps - 1 }),
    }).catch(() => {});

    // Record it in promotions history (£0 - a free bump).
    await fetch(`${SUPABASE_URL}/rest/v1/promotions`, {
      method: "POST", headers: { ...svc, Prefer: "return=minimal" },
      body: JSON.stringify({
        listing_id, seller_id: caller.id, amount_pence: 0,
        started_at: now.toISOString(), expires_at: until, status: "active",
      }),
    }).catch(() => {});

    return json({ ok: true, promoted_until: until, free_bumps: bumps - 1 });
  } catch (e) {
    return json({ error: (e as Error).message || "Couldn't use your bump." }, 500);
  }
});
