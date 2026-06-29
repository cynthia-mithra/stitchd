// Supabase Edge Function: refund-order
// -------------------------------------
// Issues a REAL Stripe refund to the buyer when the Stitch'd admin resolves a
// dispute as "refunded" - for BOTH a purchase (order) and a tailoring booking
// (alteration_request). The browser posts { order_id | alteration_request_id,
// admin_id }; this function, all server-side:
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
    const { order_id, alteration_request_id, admin_id } = await req.json();
    if (!order_id && !alteration_request_id) return json({ error: "Missing order_id or alteration_request_id." }, 400);
    if (!(await isAdmin(admin_id))) return json({ error: "Not authorised." }, 403);

    // Resolve the thing being refunded into a common shape: the row, its Checkout
    // Session, the amount to refund, where to record the refund, and the buyer.
    let table: string; let rowId: string; let buyerId: string | null;
    let listingId: string | null; let amountPence: number; let sessionId: string | null;
    let alreadyRefunded: string | null = null; let refundedStatus: string;

    if (alteration_request_id) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${alteration_request_id}&select=id,buyer_id,listing_id,status,quote_amount_pence,quote_pence,stripe_session_id,stripe_refund_id&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      ).catch(() => null);
      const a = r && r.ok ? (await r.json().catch(() => []))[0] : null;
      if (!a) return json({ error: "Alteration not found." }, 404);
      if (a.stripe_refund_id) return json({ refunded: true, already: true, refund_id: a.stripe_refund_id });
      table = "alteration_requests"; rowId = a.id; buyerId = a.buyer_id ?? null;
      listingId = a.listing_id ?? null; sessionId = a.stripe_session_id ?? null;
      amountPence = Number(a.quote_amount_pence) || Number(a.quote_pence) || 0;
      refundedStatus = "cancelled";
    } else {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=id,buyer_id,listing_id,amount,amount_pence,status,stripe_session_id,stripe_refund_id&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      ).catch(() => null);
      const o = r && r.ok ? (await r.json().catch(() => []))[0] : null;
      if (!o) return json({ error: "Order not found." }, 404);
      if (o.status === "refunded" || o.stripe_refund_id) {
        return json({ refunded: true, already: true, refund_id: o.stripe_refund_id ?? null });
      }
      table = "orders"; rowId = o.id; buyerId = o.buyer_id ?? null;
      listingId = o.listing_id ?? null; sessionId = o.stripe_session_id ?? null;
      amountPence = Number(o.amount_pence) || Math.round(Number(o.amount) * 100) || 0;
      refundedStatus = "refunded";
    }

    if (amountPence <= 0) return json({ error: "Nothing refundable on this record." }, 400);
    if (!sessionId) return json({ error: "No Stripe payment found to refund." }, 400);

    // Session → payment_intent.
    let paymentIntentId: string | null = null;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    } catch (e) {
      return json({ error: `Couldn't load the payment: ${(e as Error).message}` }, 502);
    }
    if (!paymentIntentId) return json({ error: "No payment found for this record." }, 400);

    // Refund this record's amount (partial, so a shared bag session only refunds
    // the disputed item; alteration sessions are single-item so it's the full amount).
    let refundId: string | null = null;
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountPence,
        metadata: { refund_target: table, target_id: String(rowId), refunded_by: String(admin_id), stitchd_dispute: "true" },
      });
      refundId = refund.id;
    } catch (e) {
      const raw = (e as Error).message || "Stripe refund failed.";
      const tooMuch = /amount|charge has already been refunded|exceeds/i.test(raw);
      return json({
        error: tooMuch
          ? "This payment can't be refunded for that amount (it may already be partly refunded). Check Stripe."
          : "Couldn't issue the refund right now. Please try again.",
        detail: raw.slice(0, 300),
      }, 502);
    }

    // Stamp the record + tell the buyer.
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${rowId}`, {
      method: "PATCH", headers: sbHeaders,
      body: JSON.stringify({ status: refundedStatus, stripe_refund_id: refundId, refunded_at: new Date().toISOString() }),
    }).catch(() => {});

    if (buyerId) {
      await notify(buyerId, {
        type: "dispute",
        title: "💸 Refund issued",
        body: `Your dispute was resolved in your favour - ${fmt(amountPence)} has been refunded to your original payment method (5-10 working days).`,
        listing_id: listingId ?? null,
      });
    }

    return json({ refunded: true, refund_id: refundId, amount_pence: amountPence });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not process the refund." }, 500);
  }
});
