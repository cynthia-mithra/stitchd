// Supabase Edge Function: create-promotion-session
// -------------------------------------------------
// Creates a Stripe Checkout Session that charges a seller £2.99 to promote one
// of their listings to the top of search results for 7 days, and returns the
// hosted-checkout URL to redirect to. The browser NEVER talks to Stripe with the
// secret key - it posts { listing_id, seller_id } here; this function:
//   1. verifies the listing exists AND belongs to the seller (so a seller can't
//      pay to promote someone else's listing),
//   2. creates a £2.99 GBP Checkout Session tagged metadata.type='promotion',
//   3. records a `pending` row in the promotions table, and
//   4. hands back the hosted-checkout URL.
//
// The payment result arrives asynchronously on the `stripe-webhook` function
// (checkout.session.completed with metadata.type='promotion'), which flips the
// listing's promoted flag + promoted_until and the promotions row to 'active'.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE - do NOT use a live key)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to verify ownership + insert the promotion
//   SITE_URL                     e.g. https://stitchd.fit  (success/cancel base)
//
// Deploy: supabase functions deploy create-promotion-session --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://stitchd.fit").replace(/\/$/, "");

// £2.99 for 7 days - hardcoded GBP per the issue. Kept as named constants so the
// webhook + emails can never drift from the amount actually charged here.
const PROMOTION_PENCE = 299;
const PROMOTION_DAYS = 7;

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
    const { listing_id, seller_id } = await req.json();
    if (!listing_id || !seller_id) return json({ error: "Missing listing_id or seller_id." }, 400);

    // Fetch the authoritative listing from Supabase with the service role key and
    // verify it belongs to the seller. Trusting the client here would let a seller
    // pay to promote a listing that isn't theirs.
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listing_id}&select=id,name,user_id,sold,status&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!r.ok) return json({ error: `Could not load listing: ${await r.text()}` }, 502);
    const rows: Array<{ id: string; name: string; user_id: string; sold?: boolean; status?: string }> =
      await r.json();
    const listing = rows[0];
    if (!listing) return json({ error: "Listing not found." }, 404);
    if (listing.user_id !== seller_id) {
      return json({ error: "This listing doesn't belong to you." }, 403);
    }
    // No point promoting an already-sold listing.
    if (listing.sold === true || listing.status === "sold") {
      return json({ error: "This listing is already sold." }, 409);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "Promoted Listing - 7 days" },
            unit_amount: PROMOTION_PENCE,
          },
          quantity: 1,
        },
      ],
      // The webhook reads these back to know this is a promotion (not a sale) and
      // which listing/seller to promote. (Stripe metadata values cap at 500 chars.)
      metadata: { listing_id: listing.id, seller_id, type: "promotion" },
      success_url: `${SITE_URL}/dashboard?promoted=true&listing_id=${listing.id}`,
      cancel_url: `${SITE_URL}/dashboard`,
    });

    // Record the pending promotion. Best-effort - a failure here must not block
    // the checkout the seller is about to be redirected to; the webhook re-resolves
    // everything from the Stripe session on payment.
    await fetch(`${SUPABASE_URL}/rest/v1/promotions`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        listing_id: listing.id,
        seller_id,
        stripe_session_id: session.id,
        amount_pence: PROMOTION_PENCE,
        status: "pending",
      }),
    }).catch((e) => console.error("promotions insert failed:", (e as Error).message));

    return json({ url: session.url, id: session.id, days: PROMOTION_DAYS });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not start promotion." }, 500);
  }
});
