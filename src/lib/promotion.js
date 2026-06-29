// Kicks off a £2.99 Stripe Checkout to promote a listing for 7 days. We never
// touch Stripe with a secret key from the browser - this posts { listing_id,
// seller_id } to the `create-promotion-session` Supabase Edge Function, which
// verifies the listing belongs to the seller, creates the GBP Checkout Session
// (metadata.type='promotion'), records a pending promotions row, and returns the
// hosted-checkout URL to redirect to. The payment result lands later on the
// stripe-webhook function, which flips the listing's promoted flag + expiry.
//
// Mirrors lib/identity.js (the other direct-to-Edge-Function Stripe flow).
import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

export async function startPromotion(listingId, sellerId) {
  if (!listingId || !sellerId) throw new Error("You need to be signed in to promote a listing.");

  // Abort if the function never responds, so the button can't hang forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/create-promotion-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ listing_id: listingId, seller_id: sellerId }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("The promotion service took too long to respond. Please try again.");
    }
    throw new Error("Couldn't reach the promotion service. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }

  if (!res.ok || !data.url) {
    console.error("[promotion] failed", { status: res.status, body: raw });
    const reason =
      data.error ||
      (raw && !raw.trim().startsWith("<") ? raw : "") ||
      `Could not start promotion (HTTP ${res.status}).`;
    throw new Error(reason);
  }

  // Hand the seller over to Stripe's hosted checkout page.
  window.location.href = data.url;
}
