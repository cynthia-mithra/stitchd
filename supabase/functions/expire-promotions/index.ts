// Supabase Edge Function: expire-promotions
// ------------------------------------------
// Sweeps expired promotions (issue PART 6). Called hourly by the pg_cron job in
// the phase13 promoted-listings migration (and safe to POST manually for a test).
// For every promotion whose 7 days are up it:
//   1. un-promotes the listing       (listings.promoted=false, promoted_until=null)
//   2. marks the promotion 'expired'  (promotions.status='expired')
//   3. notifies the seller in-app     ("Your promoted listing … has expired …")
//   4. emails the seller              (promotion_expired template, PROMOTE AGAIN)
//
// Doing this in an Edge Function rather than pure SQL is what lets the cron send
// the notification + email a plain UPDATE can't — mirroring saved-search-alerts.
//
// Required environment variables (auto-injected / shared with the other functions):
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   auto-injected by Supabase
//   RESEND_API_KEY / SITE_URL / EMAIL_FROM     used by the shared email helpers
//
// Deploy: supabase functions deploy expire-promotions --no-verify-jwt

import { emailForUser, getProfile, render, sendViaResend } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
// any missing column and retry — same approach as the stripe-webhook function.
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

function listingThumb(l: { image_url?: string; images?: unknown } | null): string | undefined {
  if (!l) return undefined;
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) {
    return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const nowIso = new Date().toISOString();
  let expiredCount = 0;

  try {
    // The active promotions whose 7 days are up. We process the promotions table
    // (not just the listings flag) so we can notify the seller once per promotion.
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/promotions?status=eq.active&expires_at=lt.${nowIso}&select=id,listing_id,seller_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const due: Array<{ id: string; listing_id: string; seller_id: string }> = r.ok ? await r.json() : [];

    for (const promo of due) {
      // 1. Un-promote the listing.
      if (promo.listing_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${promo.listing_id}`, {
          method: "PATCH",
          headers: sbHeaders,
          body: JSON.stringify({ promoted: false, promoted_until: null }),
        }).catch(() => {});
      }

      // 2. Mark the promotion expired.
      await fetch(`${SUPABASE_URL}/rest/v1/promotions?id=eq.${promo.id}`, {
        method: "PATCH",
        headers: sbHeaders,
        body: JSON.stringify({ status: "expired" }),
      }).catch(() => {});
      expiredCount++;

      // Listing details for the notification + email.
      const lr = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${promo.listing_id}&select=name,image_url,images&limit=1`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      ).catch(() => null);
      const listing = lr && lr.ok ? (await lr.json().catch(() => []))[0] : null;
      const title = listing?.name || "Your listing";

      if (!promo.seller_id) continue;

      // 3. In-app notification.
      await insertHealing("notifications", {
        user_id: promo.seller_id,
        type: "promotion",
        title: "Promotion expired",
        body: `Your promoted listing "${title}" has expired. Promote again to keep the boost.`,
        link_id: promo.listing_id,
        read: false,
      });

      // 4. Email (honouring unsubscribe). Best-effort.
      try {
        const sellerProfile = await getProfile(promo.seller_id);
        if (sellerProfile?.email_notifications !== false) {
          const sellerEmail = await emailForUser(promo.seller_id);
          if (sellerEmail) {
            const { subject, html } = await render(
              "promotion_expired",
              { title, image: listingThumb(listing) },
              promo.seller_id,
            );
            await sendViaResend(sellerEmail, subject, html);
          }
        }
      } catch (e) {
        console.error("Promotion-expired email error:", (e as Error).message);
      }
    }

    // Safety net: clear the promoted flag on any listing whose promoted_until has
    // passed even if it had no matching active promotions row (e.g. legacy data).
    await fetch(`${SUPABASE_URL}/rest/v1/listings?promoted=eq.true&promoted_until=lt.${nowIso}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({ promoted: false, promoted_until: null }),
    }).catch(() => {});

    return json({ ok: true, expired: expiredCount });
  } catch (e) {
    console.error("expire-promotions error:", (e as Error).message);
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
