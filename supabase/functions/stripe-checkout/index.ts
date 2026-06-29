// Supabase Edge Function: stripe-checkout
// ----------------------------------------
// Creates a Stripe Checkout Session for the items in a buyer's bag and returns
// the hosted-checkout URL. The frontend NEVER talks to Stripe with the secret
// key - it posts the listing ids here, this function looks the listings up in
// Supabase (so the buyer can't tamper with prices), builds one line item per
// listing in GBP, and hands back the session URL to redirect to.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE - do NOT use a live key)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to read authoritative listing prices
//   SITE_URL                     e.g. https://stitchd.fit  (success/cancel base)
//
// Deploy: supabase functions deploy stripe-checkout --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://stitchd.fit").replace(/\/$/, "");

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
    const { listing_ids, buyer_id, buyer_email } = await req.json();

    if (!Array.isArray(listing_ids) || listing_ids.length === 0) {
      return json({ error: "No items to check out." }, 400);
    }

    // Fetch the authoritative listings straight from Supabase using the service
    // role key. Trusting client-supplied prices would let a buyer pay £0.01.
    const ids = listing_ids.map((id: string) => `"${id}"`).join(",");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.(${ids})&select=id,name,price,user_id,sold,status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!r.ok) return json({ error: `Could not load listings: ${await r.text()}` }, 502);
    const listings: Array<{
      id: string; name: string; price: string | number; user_id: string;
      sold?: boolean; status?: string;
    }> = await r.json();

    if (listings.length === 0) return json({ error: "Listings not found." }, 404);

    // Refuse anything already sold so two buyers can't pay for the same piece.
    const unavailable = listings.filter((l) => l.sold === true || l.status === "sold");
    if (unavailable.length) {
      return json({
        error: `No longer available: ${unavailable.map((l) => l.name).join(", ")}`,
      }, 409);
    }

    // One line item per listing - currency hardcoded to GBP, quantity 1.
    const line_items = listings.map((l) => {
      const pence = Math.round(parseFloat(String(l.price)) * 100);
      if (!Number.isFinite(pence) || pence <= 0) {
        throw new Error(`Invalid price for "${l.name}"`);
      }
      return {
        price_data: {
          currency: "gbp",
          product_data: { name: l.name },
          unit_amount: pence,
        },
        quantity: 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      // {CHECKOUT_SESSION_ID} is substituted by Stripe on redirect.
      success_url: `${SITE_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/bag`,
      customer_email: buyer_email || undefined,
      // The webhook reads these back to mark listings sold, create order rows
      // and notify sellers. (Stripe metadata values cap at 500 chars.)
      metadata: {
        listing_ids: listings.map((l) => l.id).join(","),
        seller_ids: listings.map((l) => l.user_id).join(","),
        buyer_id: buyer_id || "",
      },
    });

    return json({ url: session.url, id: session.id });
  } catch (e) {
    return json({ error: (e as Error).message || "Checkout failed." }, 500);
  }
});
