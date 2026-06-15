// Supabase Edge Function: expire-offers
// --------------------------------------
// Sweeps expired offers. Called hourly by the pg_cron job in the phase14
// offers-response migration (and safe to POST manually for a test). It runs TWO
// sweeps each hour:
//
//   A. RESPONSE EXPIRY (phase14 offers-response) — a PENDING offer expires 48
//      hours after it's made if the seller hasn't responded (offers.expires_at
//      defaults to now() + 48h). For every pending offer past its deadline it:
//        1. marks the offer 'expired'
//        2. notifies the BUYER  ("Your offer on … has expired.")
//        3. notifies the SELLER ("An offer on … has expired without a response.")
//
//   B. PAYMENT EXPIRY (phase14 offer-checkout, issue PART 4) — an ACCEPTED offer
//      gives the buyer 24 hours to pay (timed from offers.accepted_at, falling
//      back to created_at on older rows). For every accepted offer past that
//      window it:
//        1. marks the offer 'expired'
//        2. re-enables offers on the listing (listings.offers_enabled = true)
//        3. notifies the BUYER  ("Your accepted offer on … has expired. The
//                                 listing is now available again.")
//        4. notifies the SELLER ("The buyer did not complete their purchase for
//                                 …. The listing is now available again.")
//      It also sends a one-time REMINDER email ~12 hours in (≤12h left, not yet
//      paid, payment_reminder_sent flag makes the hourly cron idempotent):
//        "Don't miss out — your offer expires soon."
//
// Doing this in an Edge Function rather than pure SQL is what lets the cron send
// the notifications + reminder email a plain UPDATE can't — mirroring
// expire-promotions and the regular sale emails in stripe-webhook.
//
// Required environment variables (auto-injected by Supabase):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY / SITE_URL   (for the reminder email; missing → email skipped)
//
// Deploy: supabase functions deploy expire-offers --no-verify-jwt

import { emailForUser, getProfile, render, sendViaResend } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 24h payment window; reminder once 12h are gone (i.e. ≤12h left).
const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REMINDER_AFTER_MS = 12 * 60 * 60 * 1000;

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// PostgREST rejects the whole insert if a column doesn't exist (PGRST204). Drop
// any missing column and retry — same approach as expire-promotions.
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

// A listing's display thumbnail: prefer image_url, else the first of images[].
function thumb(l: { image_url?: string; images?: unknown } | null | undefined): string | undefined {
  if (!l) return undefined;
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
  return undefined;
}

interface OfferRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_pence?: number;
  accepted_at?: string | null;
  created_at?: string;
  payment_reminder_sent?: boolean;
  listings?: { name?: string; image_url?: string; images?: unknown; currency?: string } | null;
}

async function sbGet(path: string, fallbackPath: string): Promise<OfferRow[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders }).catch(() => null);
  if (r && r.ok) return r.json();
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/${fallbackPath}`, { headers: sbHeaders }).catch(() => null);
  return r2 && r2.ok ? r2.json() : [];
}

async function resolveTitle(offer: OfferRow): Promise<string> {
  let title = offer.listings?.name;
  if (!title && offer.listing_id) {
    const lr = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${offer.listing_id}&select=name&limit=1`,
      { headers: sbHeaders },
    ).catch(() => null);
    const rows = lr && lr.ok ? await lr.json().catch(() => []) : [];
    title = rows[0]?.name;
  }
  return title || "a listing";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let responseExpired = 0;
  let paymentExpired = 0;
  let remindersSent = 0;

  try {
    // ── Sweep A — pending offers whose 48h response deadline has passed. ───────
    const duePending = await sbGet(
      `offers?status=eq.pending&expires_at=lt.${nowIso}&select=id,listing_id,buyer_id,seller_id,listings(name)`,
      `offers?status=eq.pending&expires_at=lt.${nowIso}&select=id,listing_id,buyer_id,seller_id`,
    );
    for (const offer of duePending) {
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({ status: "expired" }),
      }).catch(() => null);
      if (!patch || !patch.ok) continue;
      responseExpired++;
      const title = await resolveTitle(offer);
      if (offer.buyer_id) {
        await insertHealing("notifications", {
          user_id: offer.buyer_id, type: "offer", title: "Offer expired",
          body: `Your offer on ${title} has expired.`, link_id: offer.listing_id, read: false,
        });
      }
      if (offer.seller_id) {
        await insertHealing("notifications", {
          user_id: offer.seller_id, type: "offer", title: "Offer expired",
          body: `An offer on ${title} has expired without a response.`, link_id: offer.listing_id, read: false,
        });
      }
    }

    // ── Sweep B — accepted offers: payment expiry + 12h reminder. ──────────────
    // Pull every accepted offer with the timing fields + listing embed, then do
    // the 24h / 12h arithmetic here (the cutoff depends on accepted_at OR
    // created_at, so it's clearer in code than in two PostgREST filters).
    const accepted = await sbGet(
      `offers?status=eq.accepted&select=id,listing_id,buyer_id,seller_id,amount_pence,accepted_at,created_at,payment_reminder_sent,listings(name,image_url,images,currency)`,
      `offers?status=eq.accepted&select=id,listing_id,buyer_id,seller_id,amount_pence,accepted_at,created_at`,
    );
    for (const offer of accepted) {
      const startIso = offer.accepted_at || offer.created_at;
      if (!startIso) continue;
      const elapsed = now - new Date(startIso).getTime();

      // B1 — payment window elapsed → expire + reopen the listing + notify both.
      if (elapsed > PAYMENT_WINDOW_MS) {
        const patch = await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({ status: "expired" }),
        }).catch(() => null);
        if (!patch || !patch.ok) continue;
        paymentExpired++;
        // Re-enable offers on the listing (only if it wasn't sold via another route).
        await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${offer.listing_id}&status=neq.sold`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({ offers_enabled: true }),
        }).catch(() => {});
        const title = await resolveTitle(offer);
        if (offer.buyer_id) {
          await insertHealing("notifications", {
            user_id: offer.buyer_id, type: "offer", title: "Accepted offer expired",
            body: `Your accepted offer on ${title} has expired. The listing is now available again.`,
            link_id: offer.listing_id, read: false,
          });
        }
        if (offer.seller_id) {
          await insertHealing("notifications", {
            user_id: offer.seller_id, type: "offer", title: "Offer payment not completed",
            body: `The buyer did not complete their purchase for ${title}. The listing is now available again.`,
            link_id: offer.listing_id, read: false,
          });
        }
        continue;
      }

      // B2 — past the halfway mark, still unpaid, not yet reminded → email once.
      if (elapsed >= REMINDER_AFTER_MS && offer.payment_reminder_sent !== true && offer.buyer_id) {
        // Flag first (idempotent even if the email send is slow / retried). If the
        // column doesn't exist yet we skip the reminder rather than re-spamming.
        const flag = await fetch(`${SUPABASE_URL}/rest/v1/offers?id=eq.${offer.id}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({ payment_reminder_sent: true }),
        }).catch(() => null);
        if (!flag || !flag.ok) continue;

        try {
          const prof = await getProfile(offer.buyer_id);
          if (prof?.email_notifications === false) continue;
          const to = await emailForUser(offer.buyer_id);
          if (!to) continue;
          const title = offer.listings?.name || (await resolveTitle(offer));
          const cur = offer.listings?.currency;
          const sym = cur === "USD" ? "$" : cur === "EUR" ? "€" : "£";
          const amount = offer.amount_pence != null
            ? `${sym}${(offer.amount_pence / 100).toFixed(2).replace(/\.00$/, "")}`
            : undefined;
          const hoursLeft = Math.max(1, Math.ceil((PAYMENT_WINDOW_MS - elapsed) / 3600000));
          const { subject, html } = await render(
            "offer_reminder",
            { title, image: thumb(offer.listings), amount, hoursLeft },
            offer.buyer_id,
          );
          await sendViaResend(to, subject, html);
          remindersSent++;
        } catch (e) {
          console.error("Offer reminder email error:", (e as Error).message);
        }
      }
    }

    return json({ ok: true, responseExpired, paymentExpired, remindersSent });
  } catch (e) {
    console.error("expire-offers error:", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
