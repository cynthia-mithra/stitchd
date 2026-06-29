// Supabase Edge Function: buy-label
// ----------------------------------
// Provider-agnostic prepaid shipping-label groundwork. The seller (or admin)
// posts { order_id, user_id }; this function gathers everything a courier API
// needs - the buyer's delivery address (to), the seller's return address (from,
// from their profile), the parcel weight band and the chosen service - and, when
// a courier is configured, buys a label and writes the tracking number back onto
// the order (the same column the manual tracking flow already uses).
//
// It is deliberately courier-agnostic: set two env vars to go live -
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

// Upload a label PDF to a public Storage bucket and return its public URL plus a
// diagnostic string. The bucket is created idempotently (ignore "already exists").
async function stashLabelPdf(orderId: string, bytes: Uint8Array): Promise<{ url?: string; diag: string }> {
  const bkt = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...sb, "Content-Type": "application/json" },
    body: JSON.stringify({ id: "labels", name: "labels", public: true }),
  }).catch(() => null);
  const path = `${orderId}.pdf`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/labels/${path}`, {
    method: "POST",
    headers: { ...sb, "Content-Type": "application/pdf", "x-upsert": "true" },
    body: bytes,
  }).catch(() => null);
  if (!up) return { diag: "upload threw" };
  if (!up.ok) return { diag: `upload http=${up.status} bkt=${bkt?.status ?? "x"}: ${(await up.text().catch(() => "")).slice(0, 120)}` };
  return { url: `${SUPABASE_URL}/storage/v1/object/public/labels/${path}`, diag: "ok" };
}

type LabelPayload = {
  provider: string;
  service: string;
  weight_grams: number;
  from: Record<string, string>;
  to: Record<string, string>;
};

// The one place to implement per courier. Returns { tracking_number, label_url,
// provider_order_id?, provider_hash? } or throws. Add a branch per provider as
// accounts are connected.
type ProviderResult = { tracking_number: string; label_url?: string; provider_order_id?: string; provider_hash?: string };
async function callProvider(p: LabelPayload): Promise<ProviderResult> {
  if (SHIPPING_PROVIDER === "parcel2go") return buyParcel2GoLabel(p);
  if (SHIPPING_PROVIDER === "veeqo") return buyVeeqoLabel(p);
  throw new Error(`Shipping provider "${SHIPPING_PROVIDER}" is not implemented yet.`);
}

// ── Parcel2Go (UK broker) - https://api-docs.parcel2go.com ──────────────────────
// OAuth2 client-credentials: POST the client id/secret to the token endpoint, then
// call the API with the bearer token. Buying a label is a quote → order → label
// sequence. The shapes below follow the documented API but MUST be verified
// against api-docs.parcel2go.com and TESTED with real credentials before enabling
// SHIPPING_LABELS_ENABLED - every call throws a clear error rather than guessing.
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
  // It validates that `Street` (the road) is non-empty. Our address lines usually
  // hold the whole street in line1 ("14 Windermere Close") with line2 blank, so
  // split a leading house number/name into Property and keep the road in Street -
  // appending line2 when present - so Street is never empty.
  const splitAddr = (line1: string, line2: string) => {
    const l1 = String(line1 || "").trim();
    const l2 = String(line2 || "").trim();
    const m = /^(\d+[a-zA-Z]?|flat\s*\d+\w*|unit\s*\d+\w*)\s+(.+)$/i.exec(l1);
    let property = "";
    let street = l1;
    if (m) { property = m[1]; street = m[2]; }
    if (l2) street = street ? `${street}, ${l2}` : l2;
    if (!street) street = l1 || l2 || "-";
    return { property, street };
  };
  const cFrom = splitAddr(p.from.ship_from_line1, p.from.ship_from_line2);
  const cTo = splitAddr(p.to.line1, p.to.line2);
  const collectionAddress = {
    ContactName: p.from.ship_from_name || "Seller", Email: "orders@stitchd.fit", Phone: "07000000000",
    Property: cFrom.property, Street: cFrom.street,
    Town: p.from.ship_from_city || "", Postcode: p.from.ship_from_postcode || "", CountryIsoCode: "GBR",
  };
  const deliveryAddress = {
    ContactName: p.to.name || "Customer", Email: "orders@stitchd.fit", Phone: "07000000000",
    Property: cTo.property, Street: cTo.street,
    Town: p.to.city || "", Postcode: p.to.postcode || "", CountryIsoCode: "GBR",
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
  const quotes = (JSON.parse(qText)?.Quotes || JSON.parse(qText)?.quotes || []) as Array<Record<string, any>>;
  if (!quotes.length) throw new Error("Parcel2Go returned no services for this route.");
  // Each quote's service details are NESTED under q.Service ({ Slug, Name,
  // CourierName }); the price is q.TotalPrice. (Reading q.Service directly as a
  // string put the whole object into the order's Service field → Parcel2Go's
  // "Badly formatted json".) Prefer the cheapest service matching the buyer's
  // chosen carrier, else the cheapest overall.
  const wantCarrier = (p.service || "").split("·")[0].trim().toLowerCase();
  const carrierName = (q: any) => String(q?.Service?.CourierName || q?.Service?.Name || "").toLowerCase();
  const sorted = [...quotes].sort((a, b) => Number(a?.TotalPrice ?? 1e9) - Number(b?.TotalPrice ?? 1e9));
  const chosen = (wantCarrier && sorted.find((q) => carrierName(q).includes(wantCarrier))) || sorted[0];
  const serviceSlug = chosen?.Service?.Slug || chosen?.Slug;
  if (!serviceSlug || typeof serviceSlug !== "string") throw new Error("Parcel2Go quote returned no service slug.");

  // 2) Create the order - Parcel2Go's exact shape (matches their production API):
  //    a UUID Id, CollectionDate, the service slug, CollectionAddress, and Parcels
  //    each with their own Id, EstimatedValue, Contents and a nested DeliveryAddress.
  const nameParts = String(collectionAddress.ContactName || "Stitchd Seller").trim().split(" ");
  const orderBody = {
    Items: [{
      Id: crypto.randomUUID(),
      CollectionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      Service: serviceSlug,
      CollectionAddress: collectionAddress,
      Parcels: [{
        Id: crypto.randomUUID(),
        Height: 5, Length: 30, Width: 25, Weight: weightKg,
        EstimatedValue: 20,
        // Parcel2Go's `Contents` is a string|null, NOT an array - sending an
        // array is what produced the "Badly formatted json" 400. The
        // human-readable summary is the field that matters.
        ContentsSummary: "Pre-loved clothing",
        Contents: null,
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
  const orderId = order.OrderId || order.orderId;
  // Hash: a top-level field, or parsed from the `payment` link's ?hash= param.
  let hash = order.Hash || order.hash || "";
  if (!hash && order.Links?.payment) { try { hash = new URL(order.Links.payment).searchParams.get("hash") || ""; } catch { /* ignore */ } }
  const orderLineId = order.OrderlineIdMap?.[0]?.OrderLineId || order.OrderLineIdMap?.[0]?.OrderLineId;
  if (!orderId || !hash) throw new Error(`Parcel2Go order made but missing OrderId/Hash: ${oText.slice(0, 250)}`);

  // 3) Pay from the account's PrePay balance (empty POST, hash-authenticated).
  const payRes = await fetch(`https://www.parcel2go.com/api/orders/${orderId}/paywithprepay?hash=${encodeURIComponent(hash)}`, { method: "POST", headers: auth });
  const payText = await payRes.text().catch(() => "");
  if (!payRes.ok) throw new Error(`Parcel2Go payment failed (${payRes.status}): ${payText.slice(0, 300)}`);

  // 4) Try to fetch the label PDF now, but Parcel2Go generates it ASYNCHRONOUSLY
  //    after payment - it's often not ready for 30s+ - so this frequently misses.
  //    We still persist the Parcel2Go OrderId + hash (returned below) so VIEW LABEL
  //    can re-fetch the PDF on demand later, by which point it's ready.
  const tracking = orderLineId || orderId;
  const stash = await fetchAndStashP2GLabel(token, String(orderId), String(hash), 4);
  return { tracking_number: String(tracking), label_url: stash.url, provider_order_id: String(orderId), provider_hash: String(hash) };
}

// Fetch a Parcel2Go label PDF (Bearer-authenticated) and stash it in public
// Storage. Returns { url, diag } - url present on success, diag always explains
// the outcome (HTTP status + body snippet of a non-PDF response, or the stash
// error) so callers can surface exactly where it failed. The labels endpoint
// needs the token (a plain browser open 404s) and the PDF is generated
// asynchronously after payment, so callers retry over time.
async function fetchAndStashP2GLabel(token: string, orderId: string, hash: string, attempts = 4): Promise<{ url?: string; diag: string }> {
  const labelApi = `https://www.parcel2go.com/api/labels/${orderId}?hash=${encodeURIComponent(hash)}&referenceType=OrderId&detailLevel=All&labelMedia=A4&labelFormat=PDF`;
  const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // "%PDF"
  const b64ToBytes = (b64: string) => { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  let diag = "no response";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const lr = await fetch(labelApi, { headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" } }).catch((e) => { diag = `fetch threw: ${e}`; return null; });
    if (lr) {
      const ct = lr.headers.get("content-type") || "";
      const buf = new Uint8Array(await lr.arrayBuffer().catch(() => new ArrayBuffer(0)));
      let pdf: Uint8Array | null = null;
      if (isPdf(buf)) {
        // Some calls return the raw PDF binary directly.
        pdf = buf;
      } else if (lr.ok) {
        // Parcel2Go's documented shape: a JSON wrapper with the PDF base64-encoded
        // in Base64EncodedLabels[]. SuccessfulLabels=0 means it isn't ready → retry.
        try {
          const j = JSON.parse(new TextDecoder().decode(buf));
          const b64 = j?.Base64EncodedLabels?.[0] || j?.base64EncodedLabels?.[0];
          if (b64) { const dec = b64ToBytes(String(b64)); if (isPdf(dec)) pdf = dec; }
        } catch { /* not JSON */ }
      }
      if (pdf) {
        const stash = await stashLabelPdf(orderId, pdf);
        if (stash.url) return { url: stash.url, diag: "ok" };
        diag = `stash: ${stash.diag}`;
      } else {
        const snippet = new TextDecoder().decode(buf.slice(0, 160)).replace(/\s+/g, " ").trim();
        diag = `label http=${lr.status} ct=${ct} body="${snippet}"`;
      }
    }
    if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
  }
  return { diag };
}

// ── Veeqo (Amazon, UK) - https://developers.veeqo.com ───────────────────────────
// Auth is the account API key in the `x-api-key` header; labels are purchased via
// POST https://api.veeqo.com/shipping/shipments (a shipment created with a chosen
// service_code returns the tracking number + label).
//
// ⚠️ PLAN GATE: Veeqo's *programmatic* Shipping API is Open Beta and only enabled
// on the ENTERPRISE plan (or Veeqo Appstore partners). On the free plan you buy &
// print labels in Veeqo's own dashboard and paste the tracking number into the
// order by hand (which already works) - this branch only does anything once your
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
  if (!tracking) throw new Error("Veeqo returned no tracking number - check the request shape against your account's carriers.");
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

    // Authoritative order. select=* so the optional label_url / p2g_order_id /
    // p2g_hash columns come through when they exist without erroring when they
    // don't (an explicit select of a missing column 400s in PostgREST).
    const or = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=*&limit=1`,
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

    // Best-effort PATCH that won't blow up if a column doesn't exist yet.
    const patchOrder = (body: Record<string, unknown>) =>
      fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
        method: "PATCH", headers: { ...sb, "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).catch(() => {});

    // Already have the stored PDF → just hand it back.
    if (order.label_url) return json({ configured: true, already: true, tracking_number: order.tracking_number, label_url: order.label_url });

    // Label already bought (tracking set) but no stored PDF. If we kept Parcel2Go's
    // OrderId + hash, re-fetch the PDF now (by now Parcel2Go has generated it) and
    // stash it - no new order, no extra charge. Legacy orders without the stored
    // ids can't be re-fetched (the one-time hash is gone) → tell the caller.
    if (order.tracking_number) {
      if (SHIPPING_PROVIDER === "parcel2go" && order.p2g_order_id && order.p2g_hash) {
        const token = await p2gToken();
        const r = await fetchAndStashP2GLabel(token, String(order.p2g_order_id), String(order.p2g_hash), 6);
        if (r.url) { await patchOrder({ label_url: r.url }); return json({ configured: true, tracking_number: order.tracking_number, label_url: r.url }); }
        return json({ configured: true, tracking_number: order.tracking_number, label_url: null, pending: true, error: `Label not ready: ${r.diag}` });
      }
      return json({ configured: true, already: true, legacy: true, tracking_number: order.tracking_number, label_url: null });
    }

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

    // Always-safe columns first (tracking).
    await patchOrder({ tracking_number: result.tracking_number, tracking_carrier: order.postage_carrier || null });

    // Persist the provider's OrderId + hash so VIEW LABEL can re-fetch the PDF
    // later, plus the label URL if we already managed to stash it. Best-effort and
    // separate so a missing column can't lose the tracking number above. Add these
    // columns once with:
    //   alter table orders add column if not exists label_url     text;
    //   alter table orders add column if not exists p2g_order_id  text;
    //   alter table orders add column if not exists p2g_hash      text;
    if (result.provider_order_id || result.provider_hash) {
      await patchOrder({ p2g_order_id: result.provider_order_id || null, p2g_hash: result.provider_hash || null });
    }
    if (result.label_url) await patchOrder({ label_url: result.label_url });

    return json({ configured: true, tracking_number: result.tracking_number, label_url: result.label_url ?? null, pending: !result.label_url });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not buy a label." }, 500);
  }
});
