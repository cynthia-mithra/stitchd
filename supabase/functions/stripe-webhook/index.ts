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

// Use Deno's native npm specifier rather than the esm.sh build. esm.sh bundles a
// `node:process` polyfill whose microtask/nextTick shim calls
// `Deno.core.runMicrotasks()`, which the current Supabase Edge Runtime no longer
// supports — that threw "Deno.core.runMicrotasks() is not supported in this
// environment" on every checkout.session.completed event and aborted the sale
// path. The `npm:` specifier uses Deno's built-in Node compatibility layer (the
// approach Supabase's own Stripe examples use) and avoids that broken shim.
import Stripe from "npm:stripe@17.5.0";
import {
  emailForUser,
  firstName,
  getProfile,
  render,
  sendViaResend,
} from "../_shared/email.ts";

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

// PostgREST rejects the whole request if a column doesn't exist. On an insert
// that's PGRST204 ("Could not find the 'x' column"); on a SELECT it's Postgres
// error 42703 ("column listings.x does not exist"). The schema varies between
// deployments, so detect either form, drop the offending column and retry rather
// than losing the whole record / query — same approach as src/lib/db.js.
const missingColumn = (msg: string) => {
  const m = /Could not find the '([^']+)' column/.exec(msg || "") ||
    /column (?:[\w.]+\.)?"?([\w]+)"? does not exist/.exec(msg || "");
  return m ? m[1] : null;
};

// Listing fields the sale path needs: id/name/price/user_id are REQUIRED (orders,
// notifications, emails); image_url/images are OPTIONAL email thumbnails that some
// older deployments don't have. Fetch with column-healing so a missing optional
// column 400s only that column away instead of failing the entire fetch — which
// is exactly the bug behind "[webhook] per-id listing fetch failed". Mirrors the
// self-healing the rest of the codebase already relies on.
type ListingRow = {
  id: string;
  name: string;
  price: string | number;
  user_id: string;
  image_url?: string;
  images?: unknown;
};
const LISTING_REQUIRED = "id,name,price,user_id";
const LISTING_OPTIONAL = ["image_url", "images"];
// Returns the rows, or null if the fetch genuinely failed (network / non-column
// error) so callers can distinguish a failure from a legitimate empty result.
async function fetchListingsHealing(filter: string): Promise<ListingRow[] | null> {
  let optional = [...LISTING_OPTIONAL];
  for (let i = 0; i <= LISTING_OPTIONAL.length; i++) {
    const select = [LISTING_REQUIRED, ...optional].filter(Boolean).join(",");
    const url = `${SUPABASE_URL}/rest/v1/listings?${filter}&select=${select}`;
    const r = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).catch(() => null);
    if (r && r.ok) return (await r.json().catch(() => [])) as ListingRow[];
    const text = r ? await r.text().catch(() => "(no body)") : "(network error)";
    const col = missingColumn(text);
    if (col && optional.includes(col)) {
      optional = optional.filter((c) => c !== col);
      continue; // drop the missing optional column and retry
    }
    console.error(
      "[webhook] listings fetch failed:",
      r ? r.status : "(network)",
      text,
      "| url:",
      url,
    );
    return null;
  }
  return null;
}
// ── Wallet — credit the seller's earnings on a completed sale ─────────────────
// Vinted-style fees: sellers sell FREE (no commission) — the platform's revenue is
// the Buyer Protection fee charged to the buyer at checkout. The seller credit is
// held as 'pending' (escrow) and released when the buyer confirms receipt.
// Idempotent on (listing_id, session) via the wallet_tx_sale_unique index, so a
// retried webhook can't double-credit (the duplicate insert fails the unique
// constraint and is ignored).
const WALLET_COMMISSION_RATE = 0; // sellers sell free
async function creditSellerWallet(
  sellerId: string | null | undefined,
  grossPence: number,
  ctx: { listingId?: string; sessionId?: string; orderId?: string; description?: string; postagePence?: number },
) {
  if (!sellerId || !Number.isFinite(grossPence) || grossPence <= 0) return;
  // 8% commission on the item only; buyer-paid postage is passed through in full
  // so the seller isn't out of pocket posting the item from home.
  const postage = Number(ctx.postagePence) || 0;
  const netPence = Math.round(grossPence * (1 - WALLET_COMMISSION_RATE)) + (postage > 0 ? postage : 0);
  if (netPence <= 0) return;
  await insertHealing("wallet_transactions", {
    user_id: sellerId,
    type: "sale",
    amount_pence: netPence,
    status: "pending", // held until the buyer confirms receipt
    listing_id: ctx.listingId ?? null,
    stripe_session_id: ctx.sessionId ?? null,
    order_id: ctx.orderId ?? null,
    description: ctx.description ?? "Sale earnings",
  });
}

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

// ── Phase 13 — promotion payment ──────────────────────────────────────────────
// A £2.99 "Promoted Listing" checkout (created by create-promotion-session, tagged
// metadata.type='promotion') completed. Flip the listing's promoted flag + 7-day
// expiry, mark the promotions row active, and notify the seller in-app + by email.
// Kept entirely separate from the sale path below so existing sale logic is
// untouched (issue PART 4).
const PROMOTION_DAYS = 7;
async function handlePromotion(session: Stripe.Checkout.Session) {
  const listingId = session.metadata?.listing_id || "";
  const sellerId = session.metadata?.seller_id || "";
  if (!listingId) {
    console.error("Promotion webhook: no listing_id in session metadata", session.id);
    return;
  }
  const now = new Date();
  const expires = new Date(now.getTime() + PROMOTION_DAYS * 86400000);
  const startedAt = now.toISOString();
  const expiresAt = expires.toISOString();

  // 1. Promote the listing (set both the flag and the expiry the shop sort reads).
  await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify({
      promoted: true,
      promoted_until: expiresAt,
      promotion_stripe_session_id: session.id,
    }),
  }).catch(() => {});

  // 2. Flip the pending promotions row → active. If create-promotion-session's
  //    insert never landed (best-effort), PATCH matches nothing — insert a fresh
  //    active row so the dashboard history is still complete.
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/promotions?stripe_session_id=eq.${session.id}`,
    {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ status: "active", started_at: startedAt, expires_at: expiresAt }),
    },
  ).catch(() => null);
  const patched = patchRes && patchRes.ok ? await patchRes.json().catch(() => []) : [];
  if (!Array.isArray(patched) || patched.length === 0) {
    await insertHealing("promotions", {
      listing_id: listingId,
      seller_id: sellerId,
      stripe_session_id: session.id,
      amount_pence: session.amount_total ?? 299,
      started_at: startedAt,
      expires_at: expiresAt,
      status: "active",
    });
  }

  // Listing details for the notification + email.
  const lr = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=name,image_url,images&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  const listing = lr && lr.ok ? (await lr.json().catch(() => []))[0] : null;
  const title = listing?.name || "Your listing";
  const untilStr = expires.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // 3. In-app notification to the seller.
  if (sellerId) {
    await insertHealing("notifications", {
      user_id: sellerId,
      type: "promotion",
      title: "⚡ Listing promoted",
      body: `Your listing "${title}" is now promoted for ${PROMOTION_DAYS} days!`,
      link_id: listingId,
      read: false,
    });
  }

  // 4. Email the seller (honouring unsubscribe). Wrapped so a send failure never
  //    blocks the promotion the webhook is responsible for.
  try {
    if (sellerId) {
      const sellerProfile = await getProfile(sellerId);
      if (sellerProfile?.email_notifications !== false) {
        const sellerEmail = await emailForUser(sellerId);
        if (sellerEmail) {
          const { subject, html } = await render(
            "promotion_active",
            { title, image: listingThumb(listing || {}), promotedUntil: untilStr, listingId },
            sellerId,
          );
          await sendViaResend(sellerEmail, subject, html);
        }
      }
    }
  } catch (e) {
    console.error("Promotion email send error:", (e as Error).message);
  }
}

// A listing's display thumbnail: prefer image_url, else the first of images[].
function listingThumb(l: { image_url?: string; images?: unknown }): string | undefined {
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) {
    return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
  }
  return undefined;
}

// ── Phase 14 — accepted-offer payment ─────────────────────────────────────────
// An offer-checkout session (created by create-offer-checkout, tagged
// metadata.type='offer') completed. The buyer paid the ACCEPTED offer amount, so:
//   1. mark the listing sold + offers_enabled=false
//   2. flip the offer to 'completed'
//   3. write the order row (offer amount, offer_accepted=true)
//   4. notify the seller + buyer in-app
//   5. email both — the buyer's regular order confirmation (with a "you saved £X"
//      note) and the seller's regular sale email (with a "sold via accepted offer"
//      note).
// Kept entirely separate from the bag-sale path below so the existing type='sale'
// logic is untouched (issue constraint).
async function handleOffer(session: Stripe.Checkout.Session) {
  const offerId = session.metadata?.offer_id || "";
  const listingId = session.metadata?.listing_id || "";
  const buyerId = session.metadata?.buyer_id || null;
  let sellerId = session.metadata?.seller_id || "";
  if (!offerId || !listingId) {
    console.error("Offer webhook: missing offer_id/listing_id in metadata", session.id);
    return;
  }

  // Authoritative offer (the paid amount must come from the stored offer, never
  // the client) + listing (title/thumbnail/list price for the saving note).
  const or = await fetch(
    `${SUPABASE_URL}/rest/v1/offers?id=eq.${offerId}&select=id,amount_pence,buyer_id,seller_id,listing_id,status&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  const offer = or && or.ok ? (await or.json().catch(() => []))[0] : null;
  if (!sellerId && offer?.seller_id) sellerId = offer.seller_id;

  const lr = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=name,price,image_url,images&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  const listing = lr && lr.ok ? (await lr.json().catch(() => []))[0] : null;
  const title = listing?.name || "your listing";
  const image = listing ? listingThumb(listing) : undefined;

  // The amount actually charged is the offer amount; prefer the stored offer,
  // fall back to the Stripe session total. Listed price drives the saving.
  const offerPence = Number(offer?.amount_pence) || session.amount_total || 0;
  const listedPence = Math.round(parseFloat(String(listing?.price ?? 0)) * 100);
  const savedPence = listedPence > offerPence ? listedPence - offerPence : 0;
  const fmt = (pence: number) => `£${(pence / 100).toFixed(2)}`;
  const fmtTrim = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;

  // 1. Mark the listing sold + close offers (set both status + legacy flags).
  await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify({ status: "sold", sold: true, payment_status: "paid", offers_enabled: false }),
  }).catch(() => {});

  // 2. Flip the offer to completed.
  await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offerId}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify({ status: "completed" }),
  }).catch(() => {});

  // Buyer delivery address collected by Stripe (so the seller can post it).
  const offerShipAddr = (() => {
    const sd = (session as { shipping_details?: { name?: string; address?: Record<string, string> }; customer_details?: { name?: string; address?: Record<string, string> } });
    const d = sd.shipping_details || sd.customer_details || null;
    const a = d?.address; if (!a) return null;
    return { name: d?.name || "", line1: a.line1 || "", line2: a.line2 || "", city: a.city || "", postcode: a.postal_code || "", country: a.country || "GB" };
  })();

  // 3. Order row — offer amount (NOT the list price), flagged offer_accepted.
  await insertHealing("orders", {
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: sellerId || null,
    amount_pence: offerPence,
    amount: offerPence / 100,
    stripe_session_id: session.id,
    status: "paid",
    offer_accepted: true,
    ...(offerShipAddr ? { delivery_address: offerShipAddr } : {}),
  });

  // 3b. Credit the seller's wallet (offer amount — sellers sell free).
  await creditSellerWallet(sellerId, offerPence, {
    listingId,
    sessionId: session.id,
    description: `Sale: ${title} (offer)`,
  });

  // 4. In-app notifications — seller + buyer.
  if (sellerId) {
    await insertHealing("notifications", {
      user_id: sellerId,
      type: "sale",
      title: "💰 You made a sale!",
      body: `Your listing "${title}" has been sold for ${fmtTrim(offerPence)} via an accepted offer!`,
      link_id: listingId,
      read: false,
    });
  }
  if (buyerId) {
    await insertHealing("notifications", {
      user_id: buyerId,
      type: "sale",
      title: "🩷 Purchase confirmed",
      body: `Your purchase of "${title}" is confirmed!`,
      link_id: listingId,
      read: false,
    });
  }

  // 5. Emails — same templates as a regular purchase/sale, with offer notes.
  try {
    const buyerEmail = session.customer_details?.email || session.customer_email || "";
    const buyerName = firstName(session.customer_details?.name || "");
    const orderRef = session.id.slice(-8);
    const savingNote = savedPence > 0 ? `You saved ${fmt(savedPence)} with your offer.` : "";

    // Buyer — order confirmation with the saving note.
    const buyerProfile = buyerId ? await getProfile(buyerId) : null;
    if (buyerEmail && buyerProfile?.email_notifications !== false) {
      const { subject, html } = await render(
        "order_confirmation",
        { title, image, price: fmt(offerPence), orderRef, note: savingNote },
        buyerId,
      );
      await sendViaResend(buyerEmail, subject, html);
    }

    // Seller — sale email noting it was via an accepted offer.
    if (sellerId) {
      const sellerProfile = await getProfile(sellerId);
      if (sellerProfile?.email_notifications !== false) {
        const sellerEmail = await emailForUser(sellerId);
        if (sellerEmail) {
          const { subject, html } = await render(
            "sale",
            { title, image, price: fmt(offerPence), buyerFirstName: buyerName, note: "Sold via accepted offer." },
            sellerId,
          );
          await sendViaResend(sellerEmail, subject, html);
        }
      }
    }
  } catch (e) {
    console.error("Offer email send error:", (e as Error).message);
  }
}

// ── Phase 15 — alteration booking payment ─────────────────────────────────────
// An alteration-checkout session (created by create-alteration-checkout, tagged
// metadata.type='alteration') completed. The buyer paid the tailor's full quote,
// so:
//   1. flip the request to 'accepted', stamp paid_at + the session id + the
//      commission split (15% to Stitch'd, the rest owed to the tailor)
//   2. record a tailor_payouts row (status 'pending' — released on completion)
//   3. notify the tailor + buyer in-app
//   4. email the tailor (earnings after commission) and buyer (amount paid)
// Kept entirely separate from the sale / offer / promotion paths so the existing
// logic is untouched (issue constraint).
const COMMISSION_RATE = 0.15;
async function handleAlteration(session: Stripe.Checkout.Session) {
  const requestId = session.metadata?.alteration_request_id || "";
  if (!requestId) {
    console.error("Alteration webhook: no alteration_request_id in metadata", session.id);
    return;
  }

  // Authoritative request (the paid amount must come from the stored quote, not
  // the client) + embedded listing (title/thumbnail) and tailor (name/image/user).
  const rr = await fetch(
    `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${requestId}&select=id,buyer_id,tailor_id,listing_id,status,quote_pence,alterations_needed,listings(name,image_url,images),tailors(display_name,profile_image_url,user_id)&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  const reqRow = rr && rr.ok ? (await rr.json().catch(() => []))[0] : null;
  if (!reqRow) {
    console.error("Alteration webhook: request not found", requestId);
    return;
  }

  // Amounts — prefer the stored quote, fall back to metadata then the session.
  const quotePence = Number(reqRow.quote_pence) ||
    Number(session.metadata?.quote_amount_pence) ||
    session.amount_total || 0;
  const commissionPence = Number(session.metadata?.commission_amount_pence) ||
    Math.round(quotePence * COMMISSION_RATE);
  const payoutPence = Number(session.metadata?.tailor_payout_pence) ||
    (quotePence - commissionPence);

  const buyerId = reqRow.buyer_id || session.metadata?.buyer_id || null;
  const tailorId = reqRow.tailor_id || session.metadata?.tailor_id || null;
  const tailor = reqRow.tailors || null;
  const tailorUserId = tailor?.user_id || null;
  const tailorName = tailor?.display_name || "your tailor";
  const tailorImage = tailor?.profile_image_url || undefined;
  const listing = reqRow.listings || null;
  const title = listing?.name || "your item";
  const image = listing ? listingThumb(listing) : undefined;
  const fmt = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;

  // 1. Flip the request to accepted + stamp the payment fields. insertHealing
  //    isn't used for PATCH; drop missing columns manually so a deployment
  //    behind on the migration still records what it can.
  const patch: Record<string, unknown> = {
    status: "accepted",
    paid_at: new Date().toISOString(),
    stripe_session_id: session.id,
    quote_amount_pence: quotePence,
    commission_amount_pence: commissionPence,
    tailor_payout_pence: payoutPence,
  };
  for (let i = 0; i < 8; i++) {
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${requestId}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (pr && pr.ok) break;
    if (!pr) break;
    const text = await pr.text();
    const col = missingColumn(text);
    if (col && Object.prototype.hasOwnProperty.call(patch, col)) {
      delete patch[col];
      continue;
    }
    console.error("Alteration request PATCH failed:", text);
    break;
  }

  // 2. Record the payout (pending — released when the buyer confirms completion).
  await insertHealing("tailor_payouts", {
    tailor_id: tailorId,
    alteration_request_id: requestId,
    amount_pence: quotePence,
    commission_pence: commissionPence,
    stripe_session_id: session.id,
    status: "pending",
  });

  // 3. In-app notifications — tailor + buyer.
  if (tailorUserId) {
    await insertHealing("notifications", {
      user_id: tailorUserId,
      type: "alteration_booking",
      title: "💷 Payment received",
      body: `Payment received for your alteration booking! ${fmt(payoutPence)} will be paid to you on completion.`,
      link_id: reqRow.listing_id,
      read: false,
    });
  }
  if (buyerId) {
    await insertHealing("notifications", {
      user_id: buyerId,
      type: "alteration_booking",
      title: "🩷 Booking confirmed",
      body: `Your alteration booking with ${tailorName} is confirmed!`,
      link_id: reqRow.listing_id,
      read: false,
    });
  }

  // 4. Emails — tailor (earnings after commission) + buyer (amount paid).
  try {
    // Tailor.
    if (tailorUserId) {
      const tailorProfile = await getProfile(tailorUserId);
      if (tailorProfile?.email_notifications !== false) {
        const tailorEmail = await emailForUser(tailorUserId);
        if (tailorEmail) {
          const buyer = buyerId ? await getProfile(buyerId) : null;
          const buyerName = buyer?.full_name || buyer?.username || "A buyer";
          const { subject, html } = await render(
            "alteration_booking_tailor",
            { title, image, buyerName, alterations: reqRow.alterations_needed || [], earnings: fmt(payoutPence) },
            tailorUserId,
          );
          await sendViaResend(tailorEmail, subject, html);
        }
      }
    }
    // Buyer.
    if (buyerId) {
      const buyerProfile = await getProfile(buyerId);
      if (buyerProfile?.email_notifications !== false) {
        const buyerEmail = (await emailForUser(buyerId)) ||
          session.customer_details?.email || session.customer_email || "";
        if (buyerEmail) {
          const { subject, html } = await render(
            "alteration_booking_buyer",
            { title, image: tailorImage || image, tailorName, amount: fmt(quotePence) },
            buyerId,
          );
          await sendViaResend(buyerEmail, subject, html);
        }
      }
    }
  } catch (e) {
    console.error("Alteration email send error:", (e as Error).message);
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

  // ── Phase 11 — Stripe Identity results ──────────────────────────────────────
  // The identity flow is started by the create-verification-session function,
  // which stamps the session id onto the seller's profile. Here we resolve the
  // async pass/fail: `verified` → ID VERIFIED badge goes live; `requires_input`
  // (Stripe's "needs another attempt") → mark failed so the dashboard offers a
  // retry. Add both events to the Stripe webhook endpoint in the dashboard.
  if (
    event.type === "identity.verification_session.verified" ||
    event.type === "identity.verification_session.requires_input"
  ) {
    const vs = event.data.object as Stripe.Identity.VerificationSession;
    try {
      // Find the profile this session belongs to — primary link is the session id
      // we stored at creation, with metadata.user_id as a fallback.
      let userId = (vs.metadata?.user_id as string) || null;
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?stripe_verification_session_id=eq.${vs.id}&select=id`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      if (pr.ok) {
        const rows: Array<{ id: string }> = await pr.json();
        if (rows[0]?.id) userId = rows[0].id;
      }
      if (!userId) {
        console.error("Identity webhook: no profile for session", vs.id);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (event.type === "identity.verification_session.verified") {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({
            identity_verified: true,
            identity_verification_status: "verified",
            identity_verified_at: new Date().toISOString(),
          }),
        }).catch(() => {});
        await insertHealing("notifications", {
          user_id: userId,
          type: "identity",
          title: "🛡️ Identity verified",
          body: "Your identity has been verified. Your ID VERIFIED badge is now live on your profile.",
          read: false,
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({ identity_verification_status: "failed" }),
        }).catch(() => {});
        await insertHealing("notifications", {
          user_id: userId,
          type: "identity",
          title: "Identity verification unsuccessful",
          body: "Your identity verification was unsuccessful. Please try again from your dashboard.",
          read: false,
        });
      }
    } catch (e) {
      console.error("Identity webhook processing error:", (e as Error).message);
    }
    // 200 so Stripe doesn't retry forever on a non-recoverable data issue.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Diagnostics — surface the data the email branches depend on so a missing
  // metadata field or unset secret is obvious in the Edge Function logs rather
  // than silently skipping the send.
  console.log("[webhook] checkout.session.completed:", session.id);
  console.log("[webhook] session metadata:", JSON.stringify(session.metadata ?? {}));
  console.log("[webhook] RESEND_API_KEY present:", !!Deno.env.get("RESEND_API_KEY"));

  // Phase 13 — a promotion checkout (metadata.type='promotion') is handled on a
  // completely separate path; the sale logic below is left exactly as it was.
  if (session.metadata?.type === "promotion") {
    try {
      await handlePromotion(session);
    } catch (e) {
      console.error("Promotion processing error:", (e as Error).message);
    }
    return new Response(JSON.stringify({ received: true, promotion: true }), { status: 200 });
  }

  // Phase 14 — an accepted-offer payment (metadata.type='offer') is handled on a
  // completely separate path; the bag-sale logic below is left exactly as it was.
  if (session.metadata?.type === "offer") {
    try {
      await handleOffer(session);
    } catch (e) {
      console.error("Offer processing error:", (e as Error).message);
    }
    return new Response(JSON.stringify({ received: true, offer: true }), { status: 200 });
  }

  // Phase 15 — an alteration booking payment (metadata.type='alteration') is
  // handled on a completely separate path; the bag-sale logic below is untouched.
  if (session.metadata?.type === "alteration") {
    try {
      await handleAlteration(session);
    } catch (e) {
      console.error("Alteration processing error:", (e as Error).message);
    }
    return new Response(JSON.stringify({ received: true, alteration: true }), { status: 200 });
  }

  const listingIds = (session.metadata?.listing_ids ?? "").split(",").filter(Boolean);
  const buyerId = session.metadata?.buyer_id || null;
  const stripeSessionId = session.id;

  // Phase 14 — bundle discount breakdown (seller_id → {percentage, amount_pence}),
  // carried in the checkout metadata by api/stripe-checkout.js. Used to record the
  // discount against each order row below. Absent for non-bundle checkouts.
  const bundleBySeller: Record<string, { percentage: number; amount_pence: number }> = {};
  try {
    const parsed = JSON.parse(session.metadata?.bundle_discounts || "[]");
    if (Array.isArray(parsed)) {
      for (const b of parsed) {
        if (b && b.seller_id) bundleBySeller[b.seller_id] = b;
      }
    }
  } catch { /* no/!invalid bundle metadata — proceed as a normal sale */ }

  try {
    // Re-fetch authoritative listing data (price + seller) for the order rows.
    // The ids are bare UUIDs (stripe-checkout stores `listings.map(l => l.id)`),
    // and PostgREST's `in.()` matches UUID columns WITHOUT quoting — wrapping each
    // id in double quotes was unnecessary, so encode them plainly. Note there is
    // deliberately NO status filter here: a listing already flipped to 'sold'
    // (e.g. a Stripe retry, or the offer path) must still resolve so the order
    // rows + emails are produced. fetchListingsHealing drops any optional column
    // (image_url/images) the deployment lacks instead of 400-ing the whole query.
    const ids = listingIds.map((id) => encodeURIComponent(id)).join(",");
    let listings = (await fetchListingsHealing(`id=in.(${ids})`)) ?? [];

    // Fallback — if the batch query returned nothing but we DO have ids, re-fetch
    // each id individually. This both works around any `in.()` quirk and makes the
    // logs show exactly which ids resolve, so one unresolved id can't silently
    // block the emails for the whole order.
    if (listings.length === 0 && listingIds.length > 0) {
      console.warn("[webhook] sale path — batch fetch returned 0 rows; retrying per id");
      const perId = await Promise.all(
        listingIds.map(async (id) => {
          const rows = await fetchListingsHealing(`id=eq.${encodeURIComponent(id)}&limit=1`);
          if (rows === null) {
            console.error("[webhook] per-id listing fetch failed for", id);
            return null;
          }
          if (!rows[0]) console.warn("[webhook] no listing row matched id", id);
          return rows[0] ?? null;
        }),
      );
      listings = perId.filter((l): l is ListingRow => !!l);
    }

    // Diagnostics — surface the inputs so a missing metadata field, an id/format
    // mismatch or a failed fetch is obvious in the Edge logs rather than silently
    // skipping the send.
    console.log("[webhook] sale path — listing_ids:", JSON.stringify(listingIds));
    console.log("[webhook] sale path — listings fetched:", listings.length);

    // Phase 12 — buyer details for the order-confirmation + sale emails. The buyer
    // email comes straight off the Stripe session (works even for guest checkout);
    // the first name is best-effort from the Stripe customer name.
    const buyerEmail = session.customer_details?.email || session.customer_email || "";
    const buyerName = firstName(session.customer_details?.name || "");
    const orderRef = stripeSessionId.slice(-8);
    const listingThumb = (l: { image_url?: string; images?: unknown }): string | undefined => {
      if (l.image_url) return l.image_url;
      const imgs = l.images;
      if (Array.isArray(imgs) && imgs.length) {
        return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
      }
      return undefined;
    };

    // Buyer-chosen delivery (Vinted-style, per seller) carried in the session
    // metadata as a JSON array of { seller_id, pence, label }. Each seller's
    // carrier label goes on their order(s); the postage amount is recorded once
    // per seller (the first of that seller's orders) so it isn't counted twice.
    let postageBySeller: Record<string, { label: string; pence: number }> = {};
    try {
      const arr = JSON.parse(session.metadata?.postage || "[]");
      if (Array.isArray(arr)) arr.forEach((s) => { if (s && s.seller_id) postageBySeller[String(s.seller_id)] = { label: String(s.label || "Delivery"), pence: Number(s.pence) || 0 }; });
    } catch { /* no/!malformed postage metadata */ }
    const postageDone = new Set<string>();

    // Buyer delivery address (collected by Stripe via shipping_address_collection)
    // so the seller has somewhere to post to / can buy a label.
    const shipAddr = (() => {
      const sd = (session as { shipping_details?: { name?: string; address?: Record<string, string> }; customer_details?: { name?: string; address?: Record<string, string> } });
      const d = sd.shipping_details || sd.customer_details || null;
      const a = d?.address; if (!a) return null;
      return { name: d?.name || buyerName || "", line1: a.line1 || "", line2: a.line2 || "", city: a.city || "", postcode: a.postal_code || "", country: a.country || "GB" };
    })();

    for (const l of listings) {
      const pence = Math.round(parseFloat(String(l.price)) * 100);
      const ship = postageBySeller[String(l.user_id)] || null;

      // 1. Mark as sold (set both `status` and the legacy `sold` flag the app uses).
      await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${l.id}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({ status: "sold", sold: true, payment_status: "paid" }),
      }).catch(() => {});

      // 2. Order record (pence). Resilient to whichever columns the table has.
      //    Phase 14 — when this seller offered a bundle discount, record the % and
      //    this listing's share of the discount (linePence × %); insertHealing
      //    drops the columns on a deployment where the migration hasn't run.
      const bundle = bundleBySeller[l.user_id];
      // Postage the buyer paid for this seller — credited to the seller ONCE (on
      // their first item) so they can cover posting it themselves, and recorded as
      // the order's postage_amount once. No commission is taken on postage.
      const sellerKey = String(l.user_id);
      const postageForThis = ship && !postageDone.has(sellerKey) ? ship.pence : 0;
      await insertHealing("orders", {
        listing_id: l.id,
        buyer_id: buyerId,
        seller_id: l.user_id,
        amount_pence: pence,
        amount: parseFloat(String(l.price)),
        stripe_session_id: stripeSessionId,
        status: "paid",
        ...(bundle
          ? {
              bundle_discount_percentage: bundle.percentage,
              bundle_discount_amount_pence: Math.round((pence * bundle.percentage) / 100),
            }
          : {}),
        ...(ship
          ? { postage_carrier: ship.label, postage_amount: postageForThis / 100 }
          : {}),
        ...(shipAddr ? { delivery_address: shipAddr } : {}),
      });
      if (ship) postageDone.add(sellerKey);

      // 2b. Credit the seller's wallet: sale price − 8% commission, PLUS the
      //     buyer-paid postage (no fee on postage) so the seller can post it.
      await creditSellerWallet(l.user_id, pence, {
        listingId: l.id,
        sessionId: stripeSessionId,
        description: postageForThis > 0 ? `Sale: ${l.name} (incl. postage)` : `Sale: ${l.name}`,
        postagePence: postageForThis,
      });

      // 3. Notify the seller (in-app).
      await insertHealing("notifications", {
        user_id: l.user_id,
        type: "sale",
        title: "💰 You made a sale!",
        body: `"${l.name}" sold for £${parseFloat(String(l.price)).toFixed(2)}.`,
        link_id: l.id,
        read: false,
      });

      // 4. Phase 12 — transactional emails. Wrapped so an email failure never
      //    blocks the order processing the webhook is really responsible for.
      try {
        const priceStr = `£${parseFloat(String(l.price)).toFixed(2)}`;
        const image = listingThumb(l);

        // Email 1 — order confirmation (buyer). Honour unsubscribe when the buyer
        // is a known user; guests (no buyer_id) always get the receipt.
        const buyerProfile = buyerId ? await getProfile(buyerId) : null;
        if (buyerEmail && buyerProfile?.email_notifications !== false) {
          console.log("[webhook] sending order confirmation to buyer:", buyerEmail);
          const { subject, html } = await render(
            "order_confirmation",
            { title: l.name, image, price: priceStr, orderRef },
            buyerId,
          );
          const res = await sendViaResend(buyerEmail, subject, html);
          if (!res.ok) console.error("[webhook] buyer order-confirmation NOT sent:", res.error);
        } else {
          console.log(
            "[webhook] buyer email skipped — email:",
            buyerEmail || "(none)",
            "| email_notifications:",
            buyerProfile?.email_notifications,
          );
        }

        // Email 2 — sale notification (seller).
        const sellerProfile = await getProfile(l.user_id);
        if (sellerProfile?.email_notifications !== false) {
          const sellerEmail = await emailForUser(l.user_id);
          if (sellerEmail) {
            console.log("[webhook] sending sale notification to seller:", sellerEmail);
            const { subject, html } = await render(
              "sale",
              { title: l.name, image, price: priceStr, buyerFirstName: buyerName },
              l.user_id,
            );
            const res = await sendViaResend(sellerEmail, subject, html);
            if (!res.ok) console.error("[webhook] seller sale email NOT sent:", res.error);
          } else {
            console.log("[webhook] seller email skipped — no address for user:", l.user_id);
          }
        } else {
          console.log("[webhook] seller email skipped — email_notifications disabled:", l.user_id);
        }
      } catch (e) {
        console.error("Phase 12 email send error:", (e as Error).message);
      }
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
