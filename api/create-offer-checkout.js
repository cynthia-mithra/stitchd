// Vercel serverless function: POST /api/create-offer-checkout
// ------------------------------------------------------------
// Phase 14 — completes the purchase of an ACCEPTED offer at the offer price.
// The buyer's /offers page posts { offer_id, buyer_id } here; this runs server-
// side on Vercel (same host that serves the app) so:
//   • the Stripe SECRET key never reaches the browser, and
//   • the request is same-origin — there's no CORS preflight to fail, which is
//     what produced the old "Load failed" / "Failed to fetch" error when the
//     browser hit the (CORS-bare) Supabase Edge Function directly.
//
// This is the same-origin sibling of supabase/functions/create-offer-checkout —
// identical verification, identical Stripe session — kept in lockstep with the
// sale flow (api/stripe-checkout.js). The webhook resolves payment via
// metadata.type='offer'.
//
// The ONLY setup step required: STRIPE_SECRET_KEY must already be set in
//   Vercel → Project → Settings → Environment Variables  (the sale flow uses it too).

const Stripe = require("stripe");

// Same Supabase project the app already reads from. The anon key is already
// public (it ships in the browser bundle); we re-read the offer + listing here
// so the buyer can't tamper with the amount or pay for a sold piece.
const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";

// A buyer has 24 hours from acceptance to complete payment (issue PART 4).
const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    const { offer_id, buyer_id } = body;
    if (!offer_id || !buyer_id) return res.status(400).json({ error: "Missing offer_id or buyer_id." });

    // Pull the authoritative offer (+ embedded listing) — never trust the client.
    let offer = null;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/offers?id=eq.${offer_id}&select=id,listing_id,buyer_id,seller_id,amount_pence,status,accepted_at,created_at,listings(id,name,sold,status)&limit=1`,
      { headers: sbHeaders },
    );
    if (r.ok) offer = (await r.json())[0] || null;
    if (!offer) {
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/offers?id=eq.${offer_id}&select=id,listing_id,buyer_id,seller_id,amount_pence,status,accepted_at,created_at&limit=1`,
        { headers: sbHeaders },
      );
      if (r2.ok) offer = (await r2.json())[0] || null;
    }
    if (!offer) return res.status(404).json({ error: "Offer not found." });

    if (offer.buyer_id !== buyer_id) {
      return res.status(403).json({ error: "This offer doesn't belong to you." });
    }
    if (offer.status !== "accepted") {
      const msg =
        offer.status === "completed"
          ? "This offer has already been paid."
          : offer.status === "expired"
          ? "This offer has expired."
          : "This offer isn't ready for payment.";
      return res.status(409).json({ error: msg });
    }
    const startedAt = offer.accepted_at || offer.created_at;
    if (startedAt && Date.now() - new Date(startedAt).getTime() > PAYMENT_WINDOW_MS) {
      return res.status(409).json({ error: "The 24-hour payment window for this offer has passed." });
    }

    let listing = offer.listings || null;
    if (!listing) {
      const lr = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${offer.listing_id}&select=id,name,sold,status&limit=1`,
        { headers: sbHeaders },
      );
      if (lr.ok) listing = (await lr.json())[0] || null;
    }
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    if (listing.sold === true || listing.status === "sold") {
      return res.status(409).json({ error: "This listing is no longer available." });
    }

    const pence = Math.round(Number(offer.amount_pence));
    if (!Number.isFinite(pence) || pence <= 0) {
      return res.status(400).json({ error: "Invalid offer amount." });
    }

    // Build success/cancel URLs from the request origin so this works on every
    // Vercel deployment (preview + production) without hardcoding a domain.
    const origin =
      req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : "https://stitchd.fit");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: { currency: "gbp", product_data: { name: listing.name }, unit_amount: pence },
          quantity: 1,
        },
      ],
      // type='offer' routes the webhook to the offer handler; listing_ids (plural)
      // lets verify-session + the order-success bag-clear reuse the sale path.
      metadata: {
        type: "offer",
        offer_id: offer.id,
        listing_id: offer.listing_id,
        listing_ids: offer.listing_id,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
      },
      success_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/offers`,
    });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not start offer checkout." });
  }
};
