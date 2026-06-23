// Supabase Edge Function: buy-label
// ----------------------------------
// Provider-agnostic prepaid shipping-label groundwork. The seller (or admin)
// posts { order_id, user_id }; this function gathers everything a courier API
// needs — the buyer's delivery address (to), the seller's return address (from,
// from their profile), the parcel weight band and the chosen service — and, when
// a courier is configured, buys a label and writes the tracking number back onto
// the order (the same column the manual tracking flow already uses).
//
// It is deliberately courier-agnostic: set two env vars to go live —
//   SHIPPING_PROVIDER   one of: royal_mail | shippo | easypost
//   SHIPPING_API_KEY    that provider's API key
// Until those are set it returns { configured:false } so the UI can stay hidden
// and nothing breaks. The per-provider `callProvider` block is the only thing
// left to fill in when an account exists.
//
// Required env (always): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy buy-label --no-verify-jwt

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHIPPING_PROVIDER = Deno.env.get("SHIPPING_PROVIDER") ?? "";
const SHIPPING_API_KEY = Deno.env.get("SHIPPING_API_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

function weightGrams(label: string): number {
  const m = /up to\s*([\d.]+)\s*kg/i.exec(String(label || ""));
  return m ? Math.round(parseFloat(m[1]) * 1000) : 1000;
}

// The one place to implement per courier. Should return { tracking_number,
// label_url } or throw. Left unimplemented until an account/key exists.
async function callProvider(_payload: unknown): Promise<{ tracking_number: string; label_url?: string }> {
  throw new Error(`Shipping provider "${SHIPPING_PROVIDER}" is not implemented yet.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Not configured yet → tell the caller cleanly so the UI can hide the action.
  if (!SHIPPING_PROVIDER || !SHIPPING_API_KEY) {
    return json({ configured: false, error: "Shipping labels aren't set up yet. Add SHIPPING_PROVIDER + SHIPPING_API_KEY to enable." }, 200);
  }

  try {
    const { order_id, user_id } = await req.json();
    if (!order_id) return json({ error: "Missing order_id." }, 400);

    // Authoritative order.
    const or = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=id,buyer_id,seller_id,listing_id,delivery_address,postage_carrier,tracking_number&limit=1`,
      { headers: sb },
    ).catch(() => null);
    const order = or && or.ok ? (await or.json().catch(() => []))[0] : null;
    if (!order) return json({ error: "Order not found." }, 404);
    // Only the seller (or an admin) may buy a label for their order.
    if (user_id && order.seller_id && user_id !== order.seller_id) {
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&select=is_admin&limit=1`, { headers: sb }).catch(() => null);
      const me = pr && pr.ok ? (await pr.json().catch(() => []))[0] : null;
      if (!me?.is_admin) return json({ error: "Not authorised." }, 403);
    }
    if (order.tracking_number) return json({ already: true, tracking_number: order.tracking_number });

    // Seller return address (from) off their profile.
    const sr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${order.seller_id}&select=ship_from_name,ship_from_line1,ship_from_line2,ship_from_city,ship_from_postcode,ship_from_country&limit=1`,
      { headers: sb },
    ).catch(() => null);
    const from = sr && sr.ok ? (await sr.json().catch(() => []))[0] : null;
    if (!from?.ship_from_line1 || !from?.ship_from_postcode) {
      return json({ error: "Add your return address in your profile before buying a label." }, 400);
    }
    const to = order.delivery_address || null;
    if (!to?.line1 || !to?.postcode) {
      return json({ error: "This order has no delivery address to ship to." }, 400);
    }

    // Buy the label with the configured courier, then save the tracking number
    // back onto the order (same column the manual flow uses).
    const result = await callProvider({
      provider: SHIPPING_PROVIDER,
      service: order.postage_carrier || "",
      weight_grams: weightGrams(order.postage_carrier || ""),
      from, to,
    });

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
      method: "PATCH",
      headers: { ...sb, "Content-Type": "application/json" },
      body: JSON.stringify({ tracking_number: result.tracking_number, tracking_carrier: order.postage_carrier || null }),
    }).catch(() => {});

    return json({ configured: true, tracking_number: result.tracking_number, label_url: result.label_url ?? null });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not buy a label." }, 500);
  }
});
