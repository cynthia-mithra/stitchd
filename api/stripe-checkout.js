// Vercel serverless function: POST /api/stripe-checkout
// ------------------------------------------------------
// Creates a Stripe Checkout Session for the given listing ids and returns the
// hosted-checkout URL for the browser to redirect to. This runs server-side on
// Vercel (the same host that serves the app), so:
//   • the Stripe SECRET key never reaches the browser, and
//   • the request is same-origin — there is no CORS preflight to fail, which is
//     what produced the old "Load failed" / "Failed to fetch" error when the
//     (undeployed) Supabase Edge Function had no Access-Control headers.
//
// The ONLY setup step required: add the secret key in
//   Vercel → Project → Settings → Environment Variables
//     STRIPE_SECRET_KEY = sk_test_…   (use your Stripe TEST secret key)
// then redeploy. No CLI needed — Vercel auto-deploys this file on push.

const Stripe = require("stripe");

// Same Supabase project the app already reads from. The anon key is already
// public (it ships in the browser bundle) and can only read publicly-readable
// listing rows — we re-read prices here so a buyer can't tamper with them.
const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    // Surface the real reason instead of a generic 500, so it's obvious what's
    // missing the first time checkout is hit on a fresh deploy.
    return res.status(500).json({
      error:
        "Checkout isn't configured yet — set STRIPE_SECRET_KEY in your Vercel environment variables and redeploy.",
    });
  }
  const stripe = new Stripe(secret, { apiVersion: "2024-12-18.acacia" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { listing_ids, buyer_id, buyer_email, shipping } = body;
    if (!Array.isArray(listing_ids) || listing_ids.length === 0) {
      return res.status(400).json({ error: "No items to check out." });
    }

    // Buyer-chosen delivery (Vinted-style, per seller). `shipping` is an array of
    // { seller_id, label, amount_pence }; validate each (sane integer pence capped
    // at £30, short label). Anything dodgy is dropped. A single object is accepted
    // for backwards-compatibility.
    const shipArr = Array.isArray(shipping) ? shipping : (shipping ? [shipping] : []);
    const shipments = [];
    for (const s of shipArr) {
      if (!s || !Number.isFinite(Number(s.amount_pence))) continue;
      const p = Math.round(Number(s.amount_pence));
      if (p < 0 || p > 3000) continue;
      shipments.push({ seller_id: s.seller_id ? String(s.seller_id) : "", pence: p, label: String(s.label || "Delivery").slice(0, 80) });
    }

    // Pull authoritative prices straight from Supabase — never trust the client.
    const ids = listing_ids.map((id) => `"${id}"`).join(",");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.(${ids})&select=id,name,price,user_id,sold,status`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!r.ok) return res.status(502).json({ error: `Could not load listings: ${await r.text()}` });
    const listings = await r.json();
    if (!Array.isArray(listings) || listings.length === 0) {
      return res.status(404).json({ error: "Listings not found." });
    }

    // Refuse anything already sold so two buyers can't pay for the same piece.
    const unavailable = listings.filter((l) => l.sold === true || l.status === "sold");
    if (unavailable.length) {
      return res
        .status(409)
        .json({ error: `No longer available: ${unavailable.map((l) => l.name).join(", ")}` });
    }

    // One GBP line item per listing, quantity 1.
    const line_items = listings.map((l) => {
      const pence = Math.round(parseFloat(String(l.price)) * 100);
      if (!Number.isFinite(pence) || pence <= 0) throw new Error(`Invalid price for "${l.name}"`);
      return {
        price_data: { currency: "gbp", product_data: { name: l.name }, unit_amount: pence },
        quantity: 1,
      };
    });

    // Delivery as its own line item per seller, so the buyer pays item(s) + each
    // seller's shipping and every courier choice is itemised on Stripe's hosted
    // page (free in-person collection adds no line). Multi-seller bags get one
    // delivery line each.
    const multiSeller = new Set(listings.map((l) => l.user_id)).size > 1;
    shipments.forEach((s) => {
      if (s.pence > 0) {
        line_items.push({
          price_data: {
            currency: "gbp",
            product_data: { name: multiSeller ? `Delivery (1 seller) — ${s.label}` : `Delivery — ${s.label}` },
            unit_amount: s.pence,
          },
          quantity: 1,
        });
      }
    });

    // ── Phase 14 — bundle discounts ──────────────────────────────────────────
    // A seller who has bundle_discount_enabled and 2+ of their items in this
    // checkout gives that % off their own items. Computed authoritatively here
    // from the listing/seller data — never trust the client. Each discounting
    // seller discounts only their own items; we sum the discounts and apply them
    // as a single Stripe coupon (amount_off), so the buyer pays the discounted
    // total. (Stripe Checkout has no "negative line item" — a once-off coupon is
    // the supported way to subtract an amount; it shows as a discount line on the
    // hosted page.) The per-seller breakdown is carried in metadata for the
    // webhook to record against each order.
    let bundleInfo = [];
    const sellerIds = [...new Set(listings.map((l) => l.user_id).filter(Boolean))];
    if (sellerIds.length) {
      const sids = sellerIds.map((id) => `"${id}"`).join(",");
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${sids})&select=id,bundle_discount_enabled,bundle_discount_percentage`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
      ).catch(() => null);
      const profiles = pr && pr.ok ? await pr.json().catch(() => []) : [];
      const byId = {};
      (Array.isArray(profiles) ? profiles : []).forEach((p) => { byId[p.id] = p; });
      sellerIds.forEach((sid) => {
        const prof = byId[sid];
        const sellerLines = listings.filter((l) => l.user_id === sid);
        if (prof && prof.bundle_discount_enabled && sellerLines.length >= 2) {
          const pct = [5, 10, 15, 20].includes(prof.bundle_discount_percentage)
            ? prof.bundle_discount_percentage
            : 10;
          const subtotal = sellerLines.reduce(
            (sum, l) => sum + Math.round(parseFloat(String(l.price)) * 100),
            0,
          );
          const amount = Math.round((subtotal * pct) / 100);
          if (amount > 0) bundleInfo.push({ seller_id: sid, percentage: pct, amount_pence: amount });
        }
      });
    }
    const bundleTotalPence = bundleInfo.reduce((s, b) => s + b.amount_pence, 0);

    // Build the discount (a single once-off coupon for the combined amount).
    let discounts;
    if (bundleTotalPence > 0) {
      const couponName =
        bundleInfo.length === 1
          ? `Bundle discount (${bundleInfo[0].percentage}%)`
          : "Bundle discount";
      const coupon = await stripe.coupons.create({
        amount_off: bundleTotalPence,
        currency: "gbp",
        duration: "once",
        name: couponName,
      });
      discounts = [{ coupon: coupon.id }];
    }

    // Metadata: flag the discount + carry the per-seller breakdown so the webhook
    // can record it against each order. Single-seller convenience keys mirror the
    // issue's metadata shape ({ bundle_discount, discount_percentage,
    // discount_amount_pence, seller_id }).
    const bundleMeta = bundleInfo.length
      ? {
          bundle_discount: "true",
          discount_amount_pence: String(bundleTotalPence),
          bundle_discounts: JSON.stringify(bundleInfo),
          ...(bundleInfo.length === 1
            ? {
                discount_percentage: String(bundleInfo[0].percentage),
                seller_id: bundleInfo[0].seller_id,
              }
            : {}),
        }
      : {};

    // Build success/cancel URLs from the request origin so this works on every
    // Vercel deployment (preview + production) without hardcoding a domain.
    const origin =
      req.headers.origin || (req.headers.host ? `https://${req.headers.host}` : "https://stitchd.fit");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      ...(discounts ? { discounts } : {}),
      success_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bag`,
      customer_email: buyer_email || undefined,
      metadata: {
        listing_ids: listings.map((l) => l.id).join(","),
        seller_ids: listings.map((l) => l.user_id).join(","),
        buyer_id: buyer_id || "",
        ...(shipments.length ? { postage: JSON.stringify(shipments) } : {}),
        ...bundleMeta,
      },
    });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Checkout failed." });
  }
};
