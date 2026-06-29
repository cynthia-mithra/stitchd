// Supabase Edge Function: create-alteration-checkout
// ---------------------------------------------------
// Phase 15 - when a tailor has QUOTED on an alteration request, the buyer pays
// the full quote here. Mirrors create-offer-checkout (the accepted-offer flow):
// it re-verifies the request server-side so a buyer can't pay an arbitrary
// amount or pay for a request that isn't theirs / isn't quoted.
//
// The browser NEVER talks to Stripe with the secret key - it posts
// { alteration_request_id, buyer_id } here (in production via the same-origin
// Vercel proxy /api/create-alteration-checkout); this function:
//   1. loads the request with the service-role key and verifies it:
//        • the request exists AND belongs to this buyer
//        • its status is 'quoted'
//        • a quote amount (quote_pence) is set
//   2. calculates the 15% Stitch'd commission and the tailor's payout,
//   3. creates a GBP Checkout Session for the FULL quote, tagged
//      metadata.type='alteration' (so the webhook routes it to the alteration
//      handler, NOT the bag-sale / offer / promotion handlers), and
//   4. stamps stripe_session_id + the commission split onto the request and
//      hands back the hosted-checkout URL to redirect to.
//
// The payment result arrives asynchronously on the `stripe-webhook` function
// (checkout.session.completed with metadata.type='alteration'), which flips the
// request to 'accepted', records the payout and notifies both parties. The
// existing type='sale' / 'offer' / 'promotion' paths are untouched.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE - do NOT use a live key)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to read the authoritative request + tailor
//   SITE_URL                     e.g. https://stitchd.fit  (success/cancel base)
//
// Deploy: supabase functions deploy create-alteration-checkout --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://stitchd.fit").replace(/\/$/, "");

// Stitch'd takes a 15% commission on each tailor booking (issue PART 3).
const COMMISSION_RATE = 0.15;

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
    const { alteration_request_id, buyer_id } = await req.json();
    if (!alteration_request_id || !buyer_id) {
      return json({ error: "Missing alteration_request_id or buyer_id." }, 400);
    }

    // Load the authoritative request with the service-role key, embedding the
    // tailor (for the metadata + payout target) and the listing (for the line
    // item label) so we don't make extra round-trips.
    let reqRow:
      | {
          id: string;
          buyer_id: string;
          tailor_id: string;
          listing_id: string;
          status: string;
          quote_pence?: number | null;
          garment_type?: string | null;
          tailors?: { id: string; user_id: string } | null;
          listings?: { id: string; name: string } | null;
        }
      | null = null;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${alteration_request_id}&select=id,buyer_id,tailor_id,listing_id,status,quote_pence,garment_type,tailors(id,user_id),listings(id,name)&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (r.ok) reqRow = (await r.json())[0] ?? null;
    if (!reqRow) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${alteration_request_id}&select=id,buyer_id,tailor_id,listing_id,status,quote_pence,garment_type&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      if (r2.ok) reqRow = (await r2.json())[0] ?? null;
    }
    if (!reqRow) return json({ error: "Alteration request not found." }, 404);

    // Verify ownership - a buyer can only pay their own request.
    if (reqRow.buyer_id !== buyer_id) {
      return json({ error: "This request doesn't belong to you." }, 403);
    }
    // Must be quoted (covers pending / declined / already-accepted / completed).
    if (reqRow.status !== "quoted") {
      const msg = reqRow.status === "accepted" || reqRow.status === "completed"
        ? "This booking has already been paid."
        : reqRow.status === "declined"
        ? "This quote was declined."
        : "This request doesn't have a quote to pay yet.";
      return json({ error: msg }, 409);
    }

    const quotePence = Math.round(Number(reqRow.quote_pence));
    if (!Number.isFinite(quotePence) || quotePence <= 0) {
      return json({ error: "This request doesn't have a valid quote amount." }, 400);
    }

    // Commission split - 15% to Stitch'd, the remainder owed to the tailor.
    const commissionPence = Math.round(quotePence * COMMISSION_RATE);
    const tailorPayoutPence = quotePence - commissionPence;

    const garment = (reqRow.garment_type || "").trim() || "garment";
    const productName = `Alteration - ${garment}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: productName },
            unit_amount: quotePence,
          },
          quantity: 1,
        },
      ],
      // The webhook reads these back: type='alteration' routes it to the
      // alteration handler. Amounts are carried so the payout can be recorded
      // without re-deriving (the webhook still re-reads the request as the
      // source of truth). Metadata values cap at 500 chars.
      metadata: {
        type: "alteration",
        alteration_request_id: reqRow.id,
        tailor_id: reqRow.tailor_id,
        buyer_id: reqRow.buyer_id,
        quote_amount_pence: String(quotePence),
        commission_amount_pence: String(commissionPence),
        tailor_payout_pence: String(tailorPayoutPence),
      },
      success_url: `${SITE_URL}/alterations?session_id={CHECKOUT_SESSION_ID}&paid=true`,
      cancel_url: `${SITE_URL}/alterations`,
    });

    // Stamp the session id + the commission split onto the request. Best-effort
    // and column-by-column tolerant: if a deployment is missing one of the new
    // columns, the PATCH still records whatever columns exist (the webhook
    // re-computes from quote_pence regardless).
    const patch: Record<string, unknown> = {
      stripe_session_id: session.id,
      quote_amount_pence: quotePence,
      commission_amount_pence: commissionPence,
      tailor_payout_pence: tailorPayoutPence,
    };
    for (let i = 0; i < 6; i++) {
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${reqRow.id}`,
        {
          method: "PATCH",
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      if (pr.ok) break;
      const text = await pr.text();
      const m = /Could not find the '([^']+)' column/.exec(text || "");
      const col = m && m[1];
      if (col && Object.prototype.hasOwnProperty.call(patch, col)) {
        delete patch[col];
        continue;
      }
      break; // non-recoverable - proceed, the webhook is authoritative anyway
    }

    return json({ url: session.url, id: session.id });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not start alteration checkout." }, 500);
  }
});
