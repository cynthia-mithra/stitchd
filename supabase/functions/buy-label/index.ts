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
const SHIPPING_API_KEY = Deno.env.get("SHIPPING_API_KEY") ?? "";       // veeqo (x-api-key)
const P2G_CLIENT_ID = Deno.env.get("P2G_CLIENT_ID") ?? "";            // parcel2go (OAuth2)
const P2G_CLIENT_SECRET = Deno.env.get("P2G_CLIENT_SECRET") ?? "";

// Whether the configured provider has the credentials it needs.
function providerConfigured(): boolean {
  if (SHIPPING_PROVIDER === "parcel2go") return !!(P2G_CLIENT_ID && P2G_CLIENT_SECRET);
  if (SHIPPING_PROVIDER === "veeqo") return !!SHIPPING_API_KEY;
  return false;
}

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

type LabelPayload = {
  provider: string;
  service: string;
  weight_grams: number;
  from: Record<string, string>;
  to: Record<string, string>;
};

// The one place to implement per courier. Returns { tracking_number, label_url }
// or throws. Add a branch per provider as accounts are connected.
async function callProvider(p: LabelPayload): Promise<{ tracking_number: string; label_url?: string }> {
  if (SHIPPING_PROVIDER === "parcel2go") return buyParcel2GoLabel(p);
  if (SHIPPING_PROVIDER === "veeqo") return buyVeeqoLabel(p);
  throw new Error(`Shipping provider "${SHIPPING_PROVIDER}" is not implemented yet.`);
}

// ── Parcel2Go (UK broker) — https://api-docs.parcel2go.com ──────────────────────
// OAuth2 client-credentials: POST the client id/secret to the token endpoint, then
// call the API with the bearer token. Buying a label is a quote → order → label
// sequence. The shapes below follow the documented API but MUST be verified
// against api-docs.parcel2go.com and TESTED with real credentials before enabling
// SHIPPING_LABELS_ENABLED — every call throws a clear error rather than guessing.
async function p2gToken(): Promise<string> {
  const res = await fetch("https://www.parcel2go.com/auth/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: P2G_CLIENT_ID,
      client_secret: P2G_CLIENT_SECRET,
      scope: "public-api payment",
    }),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Parcel2Go auth failed (${res.status}): ${text.slice(0, 200)}`);
  const tok = JSON.parse(text)?.access_token;
  if (!tok) throw new Error("Parcel2Go auth returned no access_token.");
  return tok as string;
}

async function buyParcel2GoLabel(p: LabelPayload): Promise<{ tracking_number: string; label_url?: string }> {
  const token = await p2gToken();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };
  const weightKg = Math.max(0.1, (p.weight_grams || 1000) / 1000);

  // Parcel2Go addresses: ContactName/Property/Street/Town/Postcode/CountryIsoCode.
  const collectionAddress = {
    ContactName: p.from.ship_from_name || "Seller", Property: p.from.ship_from_line1 || "",
    Street: p.from.ship_from_line2 || "", Town: p.from.ship_from_city || "",
    Postcode: p.from.ship_from_postcode || "", CountryIsoCode: "GBR",
  };
  const deliveryAddress = {
    ContactName: p.to.name || "Customer", Property: p.to.line1 || "",
    Street: p.to.line2 || "", Town: p.to.city || "",
    Postcode: p.to.postcode || "", CountryIsoCode: "GBR",
  };

  // 1) Quote → pick a service (matching the buyer's chosen carrier, else cheapest).
  const qRes = await fetch("https://www.parcel2go.com/api/quotes", {
    method: "POST", headers: auth,
    body: JSON.stringify({
      CollectionAddress: { Postcode: collectionAddress.Postcode, Country: "GBR" },
      DeliveryAddress: { Postcode: deliveryAddress.Postcode, Country: "GBR" },
      Parcels: [{ Weight: weightKg, Length: 30, Width: 25, Height: 5, Value: 20 }],
    }),
  });
  const qText = await qRes.text().catch(() => "");
  if (!qRes.ok) throw new Error(`Parcel2Go quote failed (${qRes.status}): ${qText.slice(0, 200)}`);
  const quotes = (JSON.parse(qText)?.Quotes || JSON.parse(qText)?.quotes || []) as Array<Record<string, unknown>>;
  if (!quotes.length) throw new Error("Parcel2Go returned no services for this route.");
  const wantCarrier = (p.service || "").split("·")[0].trim().toLowerCase();
  const chosen = quotes.find((q) => String(q.CourierName || q.Service || "").toLowerCase().includes(wantCarrier)) || quotes[0];
  const serviceSlug = chosen.Slug || chosen.Service || chosen.ServiceSlug;
  if (!serviceSlug) throw new Error("Parcel2Go quote returned no service slug.");

  // 2) Create the order. Note: Id is a real UUID, CollectionDate is required, and
  //    DeliveryAddress sits INSIDE each Parcel (not on the item).
  const nameParts = (collectionAddress.ContactName || "Stitchd Seller").split(" ");
  const orderBody = {
    Items: [{
      Id: crypto.randomUUID(),
      CollectionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      Service: serviceSlug,
      CollectionAddress: collectionAddress,
      Parcels: [{
        Height: 5, Length: 30, Width: 25, Weight: weightKg, Value: 20,
        ContentsSummary: "Pre-loved clothing",
        DeliveryAddress: deliveryAddress,
      }],
    }],
    CustomerDetails: {
      Email: "orders@stitchd.fit",
      Forename: nameParts[0] || "Stitchd",
      Surname: nameParts.slice(1).join(" ") || "Seller",
    },
  };
  const oRes = await fetch("https://www.parcel2go.com/api/orders", { method: "POST", headers: auth, body: JSON.stringify(orderBody) });
  const oText = await oRes.text().catch(() => "");
  if (!oRes.ok) throw new Error(`Parcel2Go order failed (${oRes.status}): ${oText.slice(0, 300)}`);
  const order = JSON.parse(oText) || {};
  const hash = order.Hash || order.hash || order.OrderId || order.orderId;
  if (!hash) throw new Error(`Parcel2Go order created but no hash returned: ${oText.slice(0, 200)}`);

  // 3) Pay from the account's PrePay balance.
  const payRes = await fetch(`https://www.parcel2go.com/api/orders/${hash}/payment`, {
    method: "POST", headers: auth, body: JSON.stringify({ PaymentMethod: "PrePay" }),
  });
  const payText = await payRes.text().catch(() => "");
  if (!payRes.ok) throw new Error(`Parcel2Go payment failed (${payRes.status}): ${payText.slice(0, 300)}`);

  // 4) Fetch the label(s) + tracking for the paid order.
  let labelUrl: string | undefined;
  let tracking: string | undefined;
  const lblRes = await fetch(`https://www.parcel2go.com/api/orders/${hash}/labels`, { headers: auth });
  const lblText = await lblRes.text().catch(() => "");
  try {
    const lbl = JSON.parse(lblText);
    const links = lbl?.Links || lbl?.links || [];
    labelUrl = Array.isArray(links) ? (links[0]?.Link || links[0]?.link) : (lbl?.LabelUrl || lbl?.Url);
    tracking = lbl?.TrackingNumber || lbl?.[0]?.TrackingNumber;
  } catch { /* fall through to order lookup */ }
  if (!tracking) {
    const ordRes = await fetch(`https://www.parcel2go.com/api/orders/${hash}`, { headers: auth });
    const ord = await ordRes.json().catch(() => ({}));
    tracking = ord?.Items?.[0]?.TrackingNumber || ord?.TrackingNumber || ord?.Items?.[0]?.Parcels?.[0]?.TrackingNumber;
    labelUrl = labelUrl || ord?.Links?.Label || ord?.LabelUrl;
  }
  if (!tracking) throw new Error(`Parcel2Go: order ${hash} paid, but no tracking number found yet. Labels response: ${lblText.slice(0, 200)}`);
  return { tracking_number: String(tracking), label_url: labelUrl ? String(labelUrl) : undefined };
}

// ── Veeqo (Amazon, UK) — https://developers.veeqo.com ───────────────────────────
// Auth is the account API key in the `x-api-key` header; labels are purchased via
// POST https://api.veeqo.com/shipping/shipments (a shipment created with a chosen
// service_code returns the tracking number + label).
//
// ⚠️ PLAN GATE: Veeqo's *programmatic* Shipping API is Open Beta and only enabled
// on the ENTERPRISE plan (or Veeqo Appstore partners). On the free plan you buy &
// print labels in Veeqo's own dashboard and paste the tracking number into the
// order by hand (which already works) — this branch only does anything once your
// account has API access. Verify the exact request against developers.veeqo.com
// and TEST with a real key before enabling SHIPPING_LABELS_ENABLED.
async function buyVeeqoLabel(p: LabelPayload): Promise<{ tracking_number: string; label_url?: string }> {
  const headers = { "x-api-key": SHIPPING_API_KEY, "Content-Type": "application/json", "Accept": "application/json" };
  const body = {
    // service_code is the Veeqo shipping service chosen for this shipment; map
    // p.service (e.g. "Evri · Small parcel…") to one of your account's services.
    service_code: (p.service || "").split("·")[0].trim(),
    weight: p.weight_grams,            // grams
    weight_unit: "g",
    parcel: { weight: p.weight_grams, weight_unit: "g" },
    ship_from: {
      first_name: p.from.ship_from_name || "",
      address1: p.from.ship_from_line1 || "",
      address2: p.from.ship_from_line2 || "",
      city: p.from.ship_from_city || "",
      zip: p.from.ship_from_postcode || "",
      country: p.from.ship_from_country || "GB",
    },
    ship_to: {
      first_name: p.to.name || "",
      address1: p.to.line1 || "",
      address2: p.to.line2 || "",
      city: p.to.city || "",
      zip: p.to.postcode || "",
      country: p.to.country || "GB",
    },
  };
  const res = await fetch("https://api.veeqo.com/shipping/shipments", {
    method: "POST", headers, body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Veeqo error (${res.status}): ${text.slice(0, 300)}`);
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
  const tracking = (data.tracking_number || data.trackingNumber || (data.shipment as Record<string, unknown>)?.tracking_number) as string | undefined;
  const labelUrl = (data.label_url || data.labelUrl || (data.shipment as Record<string, unknown>)?.label_url) as string | undefined;
  if (!tracking) throw new Error("Veeqo returned no tracking number — check the request shape against your account's carriers.");
  return { tracking_number: String(tracking), label_url: labelUrl ? String(labelUrl) : undefined };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Not configured yet → tell the caller cleanly so the UI can hide the action.
  if (!SHIPPING_PROVIDER || !providerConfigured()) {
    return json({ configured: false, error: "Shipping labels aren't set up yet. Set SHIPPING_PROVIDER and the provider's credentials (parcel2go: P2G_CLIENT_ID + P2G_CLIENT_SECRET) to enable." }, 200);
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
