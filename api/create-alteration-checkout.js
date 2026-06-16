// Vercel serverless function: POST /api/create-alteration-checkout
// -----------------------------------------------------------------
// Phase 15 — completes payment for a tailor's alteration QUOTE at the full quote
// amount. The buyer's /alterations page posts { alteration_request_id, buyer_id }
// here; this runs server-side on Vercel (same host that serves the app) so:
//   • the Stripe SECRET key never reaches the browser, and
//   • the request is same-origin — there's no CORS preflight to fail (the same
//     fix the offer/sale flows use).
//
// This is the same-origin sibling of supabase/functions/create-alteration-checkout
// — identical verification, identical Stripe session — kept in lockstep with the
// offer flow (api/create-offer-checkout.js). The webhook resolves payment via
// metadata.type='alteration'.
//
// The ONLY setup step required: STRIPE_SECRET_KEY must already be set in
//   Vercel → Project → Settings → Environment Variables  (the sale flow uses it too).

const Stripe = require("stripe");

// Same Supabase project the app already reads from. The anon key is already
// public (it ships in the browser bundle); we re-read the request here so the
// buyer can't tamper with the amount or pay a request that isn't theirs.
const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";

// Stitch'd takes a 15% commission on each tailor booking (issue PART 3).
const COMMISSION_RATE = 0.15;

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({
      error:
        "Checkout isn't configured yet — set STRIPE_SECRET_KEY in your Vercel environment variables and redeploy.",
    });
  }
  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { alteration_request_id, buyer_id } = body;
    if (!alteration_request_id || !buyer_id) {
      return res.status(400).json({ error: "Missing alteration_request_id or buyer_id." });
    }

    // Pull the authoritative request (+ embedded tailor/listing) — never trust
    // the client for the amount.
    let reqRow = null;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${alteration_request_id}&select=id,buyer_id,tailor_id,listing_id,status,quote_pence,garment_type,tailors(id,user_id),listings(id,name)&limit=1`,
      { headers: sbHeaders },
    );
    if (r.ok) reqRow = (await r.json())[0] || null;
    if (!reqRow) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${alteration_request_id}&select=id,buyer_id,tailor_id,listing_id,status,quote_pence,garment_type&limit=1`,
        { headers: sbHeaders },
      );
      if (r2.ok) reqRow = (await r2.json())[0] || null;
    }
    if (!reqRow) return res.status(404).json({ error: "Alteration request not found." });

    if (reqRow.buyer_id !== buyer_id) {
      return res.status(403).json({ error: "This request doesn't belong to you." });
    }
    if (reqRow.status !== "quoted") {
      const msg =
        reqRow.status === "accepted" || reqRow.status === "completed"
          ? "This booking has already been paid."
          : reqRow.status === "declined"
          ? "This quote was declined."
          : "This request doesn't have a quote to pay yet.";
      return res.status(409).json({ error: msg });
    }

    const quotePence = Math.round(Number(reqRow.quote_pence));
    if (!Number.isFinite(quotePence) || quotePence <= 0) {
      return res.status(400).json({ error: "This request doesn't have a valid quote amount." });
    }

    const commissionPence = Math.round(quotePence * COMMISSION_RATE);
    const tailorPayoutPence = quotePence - commissionPence;

    const garment = (reqRow.garment_type || "").trim() || "garment";
    const productName = `Alteration — ${garment}`;

    // Build success/cancel URLs from the request origin so this works on every
    // Vercel deployment (preview + production) without hardcoding a domain.
    const origin =
      req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : "https://stitchd.fit");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: { currency: "gbp", product_data: { name: productName }, unit_amount: quotePence },
          quantity: 1,
        },
      ],
      // type='alteration' routes the webhook to the alteration handler.
      metadata: {
        type: "alteration",
        alteration_request_id: reqRow.id,
        tailor_id: reqRow.tailor_id,
        buyer_id: reqRow.buyer_id,
        quote_amount_pence: String(quotePence),
        commission_amount_pence: String(commissionPence),
        tailor_payout_pence: String(tailorPayoutPence),
      },
      success_url: `${origin}/alterations?session_id={CHECKOUT_SESSION_ID}&paid=true`,
      cancel_url: `${origin}/alterations`,
    });

    // Stamp the session id + commission split onto the request (best-effort;
    // the webhook re-computes from quote_pence regardless).
    const patch = {
      stripe_session_id: session.id,
      quote_amount_pence: quotePence,
      commission_amount_pence: commissionPence,
      tailor_payout_pence: tailorPayoutPence,
    };
    for (let i = 0; i < 6; i++) {
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${reqRow.id}`, {
        method: "PATCH",
        headers: { ...sbHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (pr.ok) break;
      const text = await pr.text();
      const m = /Could not find the '([^']+)' column/.exec(text || "");
      const col = m && m[1];
      if (col && Object.prototype.hasOwnProperty.call(patch, col)) {
        delete patch[col];
        continue;
      }
      break;
    }

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not start alteration checkout." });
  }
};
