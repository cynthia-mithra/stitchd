// Supabase Edge Function: refund-order
// -------------------------------------
// Issues a REAL Stripe refund to the buyer when the Stitch'd admin resolves a
// dispute as "refunded" (the dispute flow previously only stopped the seller
// being paid — the buyer's money was never returned). The browser posts
// { order_id, admin_id }; this function, all server-side:
//   1. verifies admin_id is a real admin (profiles.is_admin = true),
//   2. loads the order (Checkout Session id + amount),
//   3. resolves the Session → payment_intent,
//   4. refunds the ORDER's amount on that payment_intent (a partial refund, so a
//      bag purchase that shares one Session only refunds the disputed item),
//   5. stamps the order refunded + stores the refund id, and notifies the buyer.
//
// Idempotent: an order already marked refunded returns ok without re-charging.
//
// Required env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy refund-order --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const fmt = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, "")}`;

async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  if (!r || !r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.is_admin === true;
}

async function notify(userId: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST", headers: sbHeaders, body: JSON.stringify({ user_id: userId, read: false, ...body }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { order_id, admin_id } = await req.json();
    if (!order_id) return json({ error: "Missing order_id." }, 400);
    if (!(await isAdmin(admin_id))) return json({ error: "Not authorised." }, 403);

    // 1. Authoritative order row.
    const or = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=id,buyer_id,listing_id,amount,amount_pence,status,stripe_session_id,stripe_refund_id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const order = or && or.ok ? (await or.json().catch(() => []))[0] : null;
    if (!order) return json({ error: "Order not found." }, 404);

    // Idempotency — already refunded.
    if (order.status === "refunded" || order.stripe_refund_id) {
      return json({ refunded: true, already: true, refund_id: order.stripe_refund_id ?? null });
    }

    const amountPence = Number(order.amount_pence) || Math.round(Number(order.amount) * 100) || 0;
    if (amountPence <= 0) return json({ error: "Order has no refundable amount." }, 400);
    if (!order.stripe_session_id) return json({ error: "Order has no Stripe payment to refund." }, 400);

    // 2 + 3. Session → payment_intent.
    let paymentIntentId: string | null = null;
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    } catch (e) {
      return json({ error: `Couldn't load the payment: ${(e as Error).message}` }, 502);
    }
    if (!paymentIntentId) return json({ error: "No payment found for this order." }, 400);

    // 4. Partial refund of just this order's amount (handles shared bag sessions).
    let refundId: string | null = null;
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountPence,
        metadata: { order_id: String(order_id), refunded_by: String(admin_id), stitchd_dispute: "true" },
      });
      refundId = refund.id;
    } catch (e) {
      const raw = (e as Error).message || "Stripe refund failed.";
      // A bag session can be over-refunded if siblings were already refunded —
      // surface a clear message rather than Stripe's raw text.
      const tooMuch = /amount|charge has already been refunded|exceeds/i.test(raw);
      return json({
        error: tooMuch
          ? "This payment can't be refunded for that amount (it may already be partly refunded). Check Stripe."
          : "Couldn't issue the refund right now. Please try again.",
        detail: raw.slice(0, 300),
      }, 502);
    }

    // 5. Stamp the order + tell the buyer.
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
      method: "PATCH", headers: sbHeaders,
      body: JSON.stringify({ status: "refunded", stripe_refund_id: refundId, refunded_at: new Date().toISOString() }),
    }).catch(() => {});

    if (order.buyer_id) {
      await notify(order.buyer_id, {
        type: "dispute",
        title: "💸 Refund issued",
        body: `Your dispute was resolved in your favour — ${fmt(amountPence)} has been refunded to your original payment method (5–10 working days).`,
        listing_id: order.listing_id ?? null,
      });
    }

    return json({ refunded: true, refund_id: refundId, amount_pence: amountPence });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not process the refund." }, 500);
  }
});
