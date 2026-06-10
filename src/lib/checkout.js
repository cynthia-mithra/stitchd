import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

// Kicks off Stripe checkout for the current bag. We never touch Stripe with a
// secret key from the browser — this posts the bagged listing ids to the
// `stripe-checkout` Edge Function, which builds the GBP Checkout Session
// server-side and returns the hosted-checkout URL to redirect to.
export async function startCheckout(bag, { buyerId, buyerEmail } = {}) {
  const listing_ids = (bag || []).map((b) => b.id).filter(Boolean);
  if (!listing_ids.length) throw new Error("Your bag is empty.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ listing_ids, buyer_id: buyerId || null, buyer_email: buyerEmail || "" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout.");
  // Hand the buyer over to Stripe's hosted checkout page.
  window.location.href = data.url;
}

// Server-side verification of a completed Checkout Session, used by the
// /order-success page. Returns { paid, currency, amount_total, items, ... }.
export async function verifySession(sessionId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return res.json().catch(() => ({ paid: false }));
}
