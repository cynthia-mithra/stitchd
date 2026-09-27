// Checkout helpers. These POST to our own Vercel API functions, which build the
// Stripe Checkout Session server-side (the secret key never touches the client)
// and return the hosted-checkout URL.
//
// NATIVE NETWORKING: in the Capacitor app the web layer runs at
// capacitor://localhost, so calling our API at https://stitchd.fit is cross-origin.
// WKWebView's fetch was failing outright ("TypeError: Load failed") before the
// request ever reached the server - not a CORS-preflight problem (sending
// text/plain to avoid the preflight didn't help). So on native we send these
// requests through Capacitor's native HTTP client (CapacitorHttp), which runs
// outside the WKWebView and isn't subject to its cross-origin restrictions. On the
// web we use a normal same-origin fetch.
import { logError } from "./log";
import { API_BASE, IS_NATIVE } from "./constants";
import { openExternal } from "./native";

// "web" | "native" - tells the server which return URLs to build (native uses the
// native-return.html deep-link bridge instead of a normal site path).
const PLATFORM = IS_NATIVE ? "native" : "web";

// POST a JSON payload to one of our API routes and return a normalised
// { ok, status, data, raw }. Uses native HTTP in the app, fetch on the web.
async function apiPost(path, payload) {
  const url = `${API_BASE}${path}`;

  if (IS_NATIVE) {
    // Native request - bypasses the WKWebView (no CORS / preflight / "Load failed").
    const { CapacitorHttp } = await import("@capacitor/core");
    const resp = await CapacitorHttp.post({
      url,
      headers: { "Content-Type": "application/json" },
      data: payload,               // CapacitorHttp serialises this to a JSON body
      connectTimeout: 20000,
      readTimeout: 20000,
    });
    let data = resp.data;
    if (typeof data === "string") {
      try { data = data ? JSON.parse(data) : {}; } catch { data = {}; }
    }
    const raw = typeof resp.data === "string" ? resp.data : (() => { try { return JSON.stringify(resp.data); } catch { return ""; } })();
    return { ok: resp.status >= 200 && resp.status < 300, status: resp.status, data: data || {}, raw };
  }

  // Web - same-origin fetch, with a timeout so it can't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await res.text().catch(() => "");
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, data, raw };
  } finally {
    clearTimeout(timeout);
  }
}

// Turn a failed apiPost into a buyer-friendly message. `label` scopes the log.
function checkoutError(r, label) {
  logError(`[${label}] failed`, { status: r.status, body: r.raw });
  return new Error(
    (r.data && r.data.error) ||
    (r.raw && !r.raw.trim().startsWith("<") ? r.raw : "") ||
    `Could not start checkout (HTTP ${r.status}).`
  );
}

// Wrap the connection attempt so a thrown network error becomes a clear message
// (with a [build v4] stamp so we can tell which build a device is running).
function connectError(e) {
  if (e && e.name === "AbortError") return new Error("The checkout service took too long to respond. Please try again.");
  return new Error(`Checkout couldn't connect [build v4] · target=${API_BASE || "(relative/on-device)"} · ${(e && e.name) || "Error"}: ${(e && e.message) || "unknown"}`);
}

// Bag checkout.
export async function startCheckout(bag, { buyerId, buyerEmail, shipping } = {}) {
  const listing_ids = (bag || []).map((b) => b.id).filter(Boolean);
  if (!listing_ids.length) throw new Error("Your bag is empty.");

  let r;
  try {
    r = await apiPost("/api/stripe-checkout", {
      listing_ids, buyer_id: buyerId || null, buyer_email: buyerEmail || "", shipping: shipping || null, platform: PLATFORM,
    });
  } catch (e) { throw connectError(e); }

  if (!r.ok || !r.data.url) throw checkoutError(r, "checkout");
  await openExternal(r.data.url);
}

// Phase 14 - buy an ACCEPTED offer at the offer price.
export async function startOfferCheckout({ offerId, buyerId } = {}) {
  if (!offerId) throw new Error("No offer to check out.");
  if (!buyerId) throw new Error("Please sign in to complete your purchase.");

  let r;
  try {
    r = await apiPost("/api/create-offer-checkout", { offer_id: offerId, buyer_id: buyerId, platform: PLATFORM });
  } catch (e) { throw connectError(e); }

  if (!r.ok || !r.data.url) throw checkoutError(r, "offer-checkout");
  await openExternal(r.data.url);
}

// Phase 15 - pay a tailor's alteration QUOTE at the full quote amount.
export async function startAlterationCheckout({ alterationRequestId, buyerId } = {}) {
  if (!alterationRequestId) throw new Error("No alteration request to pay for.");
  if (!buyerId) throw new Error("Please sign in to complete your booking.");

  let r;
  try {
    r = await apiPost("/api/create-alteration-checkout", { alteration_request_id: alterationRequestId, buyer_id: buyerId, platform: PLATFORM });
  } catch (e) { throw connectError(e); }

  if (!r.ok || !r.data.url) throw checkoutError(r, "alteration-checkout");
  await openExternal(r.data.url);
}

// Server-side verification of a completed Checkout Session, used by the
// /order-success page. Returns { paid, currency, amount_total, items, ... }.
export async function verifySession(sessionId) {
  try {
    const r = await apiPost("/api/verify-session", { session_id: sessionId });
    return r.data || { paid: false };
  } catch (e) {
    return { paid: false };
  }
}
