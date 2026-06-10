// Supabase Edge Function: stripe-webhook
// ---------------------------------------
// Receives Stripe webhook events, verifies the signature, and on
// `checkout.session.completed` runs the post-purchase actions:
//   1. Mark each purchased listing as sold        (listings.status = 'sold')
//   2. Create an order record per listing         (orders table)
//   3. Notify each seller                          (notifications, type 'sale')
// The buyer's bag lives in the browser's localStorage, so it's cleared on the
// /order-success page rather than here.
//
// Required environment variables:
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE)
//   STRIPE_WEBHOOK_SECRET        whsec_…    (from the Stripe dashboard endpoint)
//   SUPABASE_URL                 auto-injected
//   SUPABASE_SERVICE_ROLE_KEY    bypasses RLS to write orders/notifications
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Then add the function URL as a webhook endpoint in the Stripe dashboard
// listening for `checkout.session.completed`.

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
// Webhook signature verification must be async in Deno (Web Crypto).
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// PostgREST rejects the whole insert if a column doesn't exist (PGRST204). The
// orders schema varies between deployments, so drop any missing column and
// retry rather than losing the whole record — same approach as src/lib/db.js.
const missingColumn = (msg: string) => {
  const m = /Could not find the '([^']+)' column/.exec(msg || "");
  return m ? m[1] : null;
};
async function insertHealing(table: string, body: Record<string, unknown>) {
  let payload = { ...body };
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify(payload),
    });
    if (res.ok) return;
    const text = await res.text();
    const col = missingColumn(text);
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      delete payload[col];
      continue;
    }
    console.error(`Insert into ${table} failed:`, text);
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature!,
      WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    console.error("Webhook signature verification failed:", (e as Error).message);
    return new Response(`Webhook Error: ${(e as Error).message}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const listingIds = (session.metadata?.listing_ids ?? "").split(",").filter(Boolean);
  const buyerId = session.metadata?.buyer_id || null;
  const stripeSessionId = session.id;

  try {
    // Re-fetch authoritative listing data (price + seller) for the order rows.
    const ids = listingIds.map((id) => `"${id}"`).join(",");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.(${ids})&select=id,name,price,user_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const listings: Array<{ id: string; name: string; price: string | number; user_id: string }> =
      r.ok ? await r.json() : [];

    for (const l of listings) {
      const pence = Math.round(parseFloat(String(l.price)) * 100);

      // 1. Mark as sold (set both `status` and the legacy `sold` flag the app uses).
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${l.id}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({ status: "sold", sold: true, payment_status: "paid" }),
      }).catch(() => {});

      // 2. Order record (pence). Resilient to whichever columns the table has.
      await insertHealing("orders", {
        listing_id: l.id,
        buyer_id: buyerId,
        seller_id: l.user_id,
        amount_pence: pence,
        amount: parseFloat(String(l.price)),
        stripe_session_id: stripeSessionId,
        status: "paid",
      });

      // 3. Notify the seller.
      await insertHealing("notifications", {
        user_id: l.user_id,
        type: "sale",
        title: "💰 You made a sale!",
        body: `"${l.name}" sold for £${parseFloat(String(l.price)).toFixed(2)}.`,
        link_id: l.id,
        read: false,
      });
    }

    return new Response(JSON.stringify({ received: true, processed: listings.length }), {
      status: 200,
    });
  } catch (e) {
    console.error("Post-purchase processing error:", (e as Error).message);
    // Return 200 so Stripe doesn't retry forever on a non-recoverable data issue;
    // the error is logged for investigation.
    return new Response(JSON.stringify({ received: true, error: (e as Error).message }), {
      status: 200,
    });
  }
});
