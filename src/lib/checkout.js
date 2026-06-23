// Kicks off Stripe checkout for the current bag. We never touch Stripe with a
// secret key from the browser — this posts the bagged listing ids to our own
// `/api/stripe-checkout` Vercel function (same origin as the app, so there's no
// CORS preflight to fail), which builds the GBP Checkout Session server-side and
// returns the hosted-checkout URL to redirect to.
export async function startCheckout(bag, { buyerId, buyerEmail, shipping } = {}) {
  const listing_ids = (bag || []).map((b) => b.id).filter(Boolean);
  if (!listing_ids.length) throw new Error("Your bag is empty.");

  // Abort if the function never responds, so checkout can't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`/api/stripe-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_ids, buyer_id: buyerId || null, buyer_email: buyerEmail || "", shipping: shipping || null }),
      signal: controller.signal,
    });
  } catch (e) {
    // A rejected fetch never reached the function — offline, or the deploy is
    // mid-rollout. Browsers surface this as the unhelpful "Load failed" /
    // "Failed to fetch"; translate it into something a buyer can act on.
    if (e.name === "AbortError") {
      throw new Error("The checkout service took too long to respond. Please try again.");
    }
    throw new Error("Couldn't reach the checkout service. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  // Read the body once as text so we can still surface a reason even when the
  // function crashes and returns a non-JSON error page (e.g. a raw 500 HTML).
  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }

  if (!res.ok || !data.url) {
    // Log the full failure so the exact cause is visible in DevTools → Console,
    // not just the toast. This is what tells us "is it config, Stripe, or data?".
    console.error("[checkout] failed", { status: res.status, body: raw });
    const reason =
      data.error ||
      (raw && !raw.trim().startsWith("<") ? raw : "") ||
      `Could not start checkout (HTTP ${res.status}).`;
    throw new Error(reason);
  }
  // Hand the buyer over to Stripe's hosted checkout page.
  window.location.href = data.url;
}

// Phase 14 — completes the purchase of an ACCEPTED offer at the offer price.
// Mirrors startCheckout but posts a single offer id to our own
// `/api/create-offer-checkout` Vercel function (same origin → no CORS preflight),
// which re-verifies the offer server-side, builds the GBP Checkout Session for
// the offer amount and returns the hosted-checkout URL to redirect to.
export async function startOfferCheckout({ offerId, buyerId } = {}) {
  if (!offerId) throw new Error("No offer to check out.");
  if (!buyerId) throw new Error("Please sign in to complete your purchase.");

  // Abort if the function never responds, so checkout can't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`/api/create-offer-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_id: offerId, buyer_id: buyerId }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("The checkout service took too long to respond. Please try again.");
    }
    throw new Error("Couldn't reach the checkout service. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }

  if (!res.ok || !data.url) {
    console.error("[offer-checkout] failed", { status: res.status, body: raw });
    const reason =
      data.error ||
      (raw && !raw.trim().startsWith("<") ? raw : "") ||
      `Could not start checkout (HTTP ${res.status}).`;
    throw new Error(reason);
  }
  // Hand the buyer over to Stripe's hosted checkout page.
  window.location.href = data.url;
}

// Phase 15 — pays a tailor's alteration QUOTE at the full quote amount. Mirrors
// startOfferCheckout but posts the alteration request id to our own
// `/api/create-alteration-checkout` Vercel function (same origin → no CORS
// preflight), which re-verifies the quoted request server-side, builds the GBP
// Checkout Session for the full quote and returns the hosted-checkout URL.
export async function startAlterationCheckout({ alterationRequestId, buyerId } = {}) {
  if (!alterationRequestId) throw new Error("No alteration request to pay for.");
  if (!buyerId) throw new Error("Please sign in to complete your booking.");

  // Abort if the function never responds, so checkout can't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`/api/create-alteration-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alteration_request_id: alterationRequestId, buyer_id: buyerId }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("The checkout service took too long to respond. Please try again.");
    }
    throw new Error("Couldn't reach the checkout service. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }

  if (!res.ok || !data.url) {
    console.error("[alteration-checkout] failed", { status: res.status, body: raw });
    const reason =
      data.error ||
      (raw && !raw.trim().startsWith("<") ? raw : "") ||
      `Could not start checkout (HTTP ${res.status}).`;
    throw new Error(reason);
  }
  // Hand the buyer over to Stripe's hosted checkout page.
  window.location.href = data.url;
}

// Server-side verification of a completed Checkout Session, used by the
// /order-success page. Returns { paid, currency, amount_total, items, ... }.
export async function verifySession(sessionId) {
  const res = await fetch(`/api/verify-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return res.json().catch(() => ({ paid: false }));
}
