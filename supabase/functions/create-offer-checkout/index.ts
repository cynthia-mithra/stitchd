// Supabase Edge Function: create-offer-checkout
// ----------------------------------------------
// Phase 14 - when a seller has ACCEPTED a buyer's offer, the buyer completes the
// purchase at the offer price here. This mirrors stripe-checkout (the bag sale
// flow) but charges the single accepted offer amount instead of the bag's list
// prices, and re-verifies the offer server-side so a buyer can't pay an arbitrary
// amount or buy a piece that's no longer available.
//
// The browser NEVER talks to Stripe with the secret key - it posts
// { offer_id, buyer_id } here; this function:
//   1. loads the offer with the service-role key and verifies it:
//        • the offer exists AND belongs to this buyer
//        • its status is 'accepted'
//        • the 24h payment window (from accepted_at, else created_at) is open
//        • the listing is still active (not sold by another route)
//   2. creates a GBP Checkout Session for offer.amount_pence, tagged
//      metadata.type='offer' (so the webhook routes it to the offer handler,
//      NOT the bag-sale handler), and
//   3. hands back the hosted-checkout URL to redirect to.
//
// The payment result arrives asynchronously on the `stripe-webhook` function
// (checkout.session.completed with metadata.type='offer'), which marks the
// listing sold, flips the offer to 'completed', writes the order row and notifies
// both parties. The existing type='sale' / type='promotion' paths are untouched.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE - do NOT use a live key)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to read the authoritative offer + listing
//   SITE_URL                     e.g. https://stitchd.fit  (success/cancel base)
//
// Deploy: supabase functions deploy create-offer-checkout --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://stitchd.fit").replace(/\/$/, "");

// A buyer has 24 hours from acceptance to complete payment (issue PART 4).
const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { offer_id, buyer_id } = await req.json();
    if (!offer_id || !buyer_id) return json({ error: "Missing offer_id or buyer_id." }, 400);

    // Load the authoritative offer with the service-role key. Embed the listing
    // so we can verify availability and label the line item without a second
    // round-trip (falling back to a plain select if the embed isn't available).
    let offer: {
      id: string; listing_id: string; buyer_id: string; seller_id: string;
      amount_pence: number; status: string; accepted_at?: string | null; created_at?: string;
      listings?: { id: string; name: string; sold?: boolean; status?: string } | null;
    } | null = null;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/offers?id=eq.${offer_id}&select=id,listing_id,buyer_id,seller_id,amount_pence,status,accepted_at,created_at,listings(id,name,sold,status)&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (r.ok) offer = (await r.json())[0] ?? null;
    if (!offer) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/offers?id=eq.${offer_id}&select=id,listing_id,buyer_id,seller_id,amount_pence,status,accepted_at,created_at&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      if (r2.ok) offer = (await r2.json())[0] ?? null;
    }
    if (!offer) return json({ error: "Offer not found." }, 404);

    // Verify ownership - a buyer can only pay their own accepted offer.
    if (offer.buyer_id !== buyer_id) {
      return json({ error: "This offer doesn't belong to you." }, 403);
    }
    // Must be accepted (covers pending / declined / withdrawn / already-completed).
    if (offer.status !== "accepted") {
      const msg = offer.status === "completed"
        ? "This offer has already been paid."
        : offer.status === "expired"
        ? "This offer has expired."
        : "This offer isn't ready for payment.";
      return json({ error: msg }, 409);
    }
    // Payment window: 24h from acceptance (fall back to created_at on older rows).
    const startedAt = offer.accepted_at || offer.created_at;
    if (startedAt) {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      if (elapsed > PAYMENT_WINDOW_MS) {
        return json({ error: "The 24-hour payment window for this offer has passed." }, 409);
      }
    }

    // Re-load the listing if the embed didn't ride along, then refuse anything
    // already sold so the buyer can't pay for a piece sold via another route.
    let listing = offer.listings ?? null;
    if (!listing) {
      const lr = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${offer.listing_id}&select=id,name,sold,status&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      if (lr.ok) listing = (await lr.json())[0] ?? null;
    }
    if (!listing) return json({ error: "Listing not found." }, 404);
    if (listing.sold === true || listing.status === "sold") {
      return json({ error: "This listing is no longer available." }, 409);
    }

    const pence = Math.round(Number(offer.amount_pence));
    if (!Number.isFinite(pence) || pence <= 0) {
      return json({ error: "Invalid offer amount." }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: listing.name },
            unit_amount: pence,
          },
          quantity: 1,
        },
      ],
      // The webhook reads these back: type='offer' routes it to the offer handler;
      // listing_ids (plural) lets verify-session + the order-success bag-clear
      // reuse the existing sale path unchanged. (Metadata values cap at 500 chars.)
      metadata: {
        type: "offer",
        offer_id: offer.id,
        listing_id: offer.listing_id,
        listing_ids: offer.listing_id,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
      },
      success_url: `${SITE_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/offers`,
    });

    return json({ url: session.url, id: session.id });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not start offer checkout." }, 500);
  }
});
