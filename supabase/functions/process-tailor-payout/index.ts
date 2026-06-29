// Supabase Edge Function: process-tailor-payout
// ----------------------------------------------
// Phase 15 - releases a tailor's payout as a REAL Stripe Connect transfer once a
// booking is complete. Until now confirming completion only flipped the
// tailor_payouts row to 'paid' in the database; this function moves the money.
//
// The buyer's "confirm completion" action posts { alteration_request_id } here.
// This function (all server-side, never trusting the browser for amounts):
//   1. loads the authoritative alteration_requests row (+ tailor, + listing),
//   2. verifies the booking is 'completed' and finds its tailor_payouts row,
//   3. guards against double-paying (payout already 'paid' / has a transfer id),
//   4. if the tailor has NOT finished Stripe Connect onboarding → HOLDS the payout
//      in 'pending', notifies the tailor to finish setup, and returns (no transfer),
//   5. otherwise creates a Stripe transfer of the tailor's cut (total − 15%) to
//      their connected account, stamps the payout 'paid' + stripe_transfer_id +
//      paid_at, and notifies + emails the tailor.
//
// Separate-charges-and-transfers model: the buyer already paid the full quote to
// the Stitch'd platform account (create-alteration-checkout). Here we transfer the
// tailor's share from the platform balance to their connected account, keeping the
// commission. transfer_group ties the transfer back to the booking.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE - Stripe Connect enabled)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to read the booking + write the payout
//   SITE_URL                     e.g. https://stitchd.fit
//
// Deploy: supabase functions deploy process-tailor-payout --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { emailForUser, getProfile, render, sendViaResend } from "../_shared/email.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Stitch'd takes a 15% commission on each tailor booking.
const COMMISSION_RATE = 0.15;

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

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const fmt = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;

const listingThumb = (l: { image_url?: string; images?: unknown } | null): string | undefined => {
  if (!l) return undefined;
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) {
    return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
  }
  return undefined;
};

// PATCH that drops any column the schema is missing and retries (self-healing).
async function patchPayout(filter: string, patch: Record<string, unknown>) {
  const payload = { ...patch };
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tailor_payouts?${filter}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (r && r.ok) return;
    if (!r) return;
    const text = await r.text();
    const m = /Could not find the '([^']+)' column/.exec(text || "");
    const col = m && m[1];
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      delete payload[col];
      continue;
    }
    console.error("process-tailor-payout: payout PATCH failed:", text);
    return;
  }
}

async function notify(userId: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify({ user_id: userId, read: false, ...body }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { alteration_request_id } = await req.json();
    if (!alteration_request_id) return json({ error: "Missing alteration_request_id." }, 400);

    // 1. Authoritative booking (+ tailor for the destination / onboarding state, +
    //    listing for the email/notification copy).
    const rr = await fetch(
      `${SUPABASE_URL}/rest/v1/alteration_requests?id=eq.${alteration_request_id}&select=id,buyer_id,tailor_id,listing_id,status,garment_type,quote_pence,quote_amount_pence,commission_amount_pence,tailor_payout_pence,listings(name,image_url,images),tailors(id,display_name,user_id,stripe_account_id,stripe_onboarding_complete)&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const reqRow = rr && rr.ok ? (await rr.json().catch(() => []))[0] : null;
    if (!reqRow) return json({ error: "Alteration request not found." }, 404);

    // 2. Must be completed (the buyer confirmed receipt).
    if (reqRow.status !== "completed") {
      return json({ error: "This booking isn't completed yet." }, 409);
    }

    const tailor = reqRow.tailors || null;
    const tailorId = reqRow.tailor_id || (tailor && tailor.id) || null;
    const tailorUserId = tailor?.user_id || null;
    const listing = reqRow.listings || null;
    const jobTitle = (listing && listing.name) || reqRow.garment_type || "your alteration job";

    // Find the payout row for this booking (created 'pending' by the webhook on
    // payment). If the webhook never ran, fall back to deriving from the request.
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/tailor_payouts?alteration_request_id=eq.${alteration_request_id}&select=*&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const payout = pr && pr.ok ? (await pr.json().catch(() => []))[0] : null;

    // Amounts - prefer the payout row, then the request's stored split, then derive.
    const totalPence = Number(payout?.amount_pence) ||
      Number(reqRow.quote_amount_pence) || Number(reqRow.quote_pence) || 0;
    const commissionPence = Number(payout?.commission_pence) ||
      Number(reqRow.commission_amount_pence) || Math.round(totalPence * COMMISSION_RATE);
    const payoutPence = Number(reqRow.tailor_payout_pence) || (totalPence - commissionPence);

    if (!Number.isFinite(payoutPence) || payoutPence <= 0) {
      return json({ error: "No valid payout amount for this booking." }, 400);
    }

    // 3. Already transferred? Key off the real transfer id, NOT status alone - a
    //    'paid' row WITHOUT a transfer id is a DB-only fallback release (made when
    //    Connect was unavailable at confirmation time) and SHOULD still transfer
    //    now. Only a present stripe_transfer_id means money actually moved.
    if (payout && payout.stripe_transfer_id) {
      return json({ already_paid: true, payout_pence: payoutPence });
    }

    // 4. Tailor hasn't finished Stripe Connect onboarding - HOLD in pending and
    //    nudge them to complete setup. Do NOT transfer.
    const onboarded = tailor?.stripe_onboarding_complete === true && !!tailor?.stripe_account_id;
    if (!onboarded) {
      await patchPayout(`alteration_request_id=eq.${alteration_request_id}`, { status: "pending" });
      if (tailorUserId) {
        await notify(tailorUserId, {
          type: "alteration_payout",
          title: "Payout pending - finish payment setup",
          body: `You have a pending payout of ${fmt(payoutPence)}. Complete your payment setup to receive it.`,
          link_id: reqRow.listing_id,
        });
      }
      return json({ held: true, reason: "onboarding_incomplete", payout_pence: payoutPence });
    }

    // 5. Transfer the tailor's cut from the platform balance to their connected
    //    account. transfer_group ties it back to the booking for reconciliation.
    let transferId: string | null = null;
    try {
      const transfer = await stripe.transfers.create({
        amount: payoutPence,
        currency: "gbp",
        destination: tailor.stripe_account_id,
        transfer_group: alteration_request_id,
        metadata: {
          alteration_request_id,
          tailor_id: tailorId || "",
          commission_pence: String(commissionPence),
        },
      });
      transferId = transfer.id;
    } catch (e) {
      // Record the failure so the admin PAYOUTS panel can flag it + offer a retry.
      const reason = (e as Error).message || "Stripe transfer failed.";
      await patchPayout(`alteration_request_id=eq.${alteration_request_id}`, {
        status: "failed",
        failure_reason: reason.slice(0, 480),
      });
      if (tailorUserId) {
        await notify(tailorUserId, {
          type: "alteration_payout",
          title: "Payout couldn't be sent",
          body: `We hit a problem sending your ${fmt(payoutPence)} payout. Our team has been notified and will retry shortly.`,
          link_id: reqRow.listing_id,
        });
      }
      return json({ error: reason }, 502);
    }

    // Stamp the payout paid + the transfer id + paid_at.
    await patchPayout(`alteration_request_id=eq.${alteration_request_id}`, {
      status: "paid",
      stripe_transfer_id: transferId,
      paid_at: new Date().toISOString(),
      failure_reason: null,
    });

    // Notify the tailor in-app.
    if (tailorUserId) {
      await notify(tailorUserId, {
        type: "alteration_payout",
        title: "💷 Payout sent!",
        body: `${fmt(payoutPence)} has been transferred to your bank account!`,
        link_id: reqRow.listing_id,
      });
    }

    // Email the tailor (honour unsubscribe). Wrapped so a send failure never undoes
    // the transfer we just made.
    try {
      if (tailorUserId) {
        const tailorProfile = await getProfile(tailorUserId);
        if (tailorProfile?.email_notifications !== false) {
          const tailorEmail = await emailForUser(tailorUserId);
          if (tailorEmail) {
            const { subject, html } = await render(
              "tailor_payout_sent",
              { amount: fmt(payoutPence), title: jobTitle, image: listingThumb(listing) },
              tailorUserId,
            );
            await sendViaResend(tailorEmail, subject, html);
          }
        }
      }
    } catch (e) {
      console.error("Payout email send error:", (e as Error).message);
    }

    return json({ paid: true, transfer_id: transferId, payout_pence: payoutPence });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not process the payout." }, 500);
  }
});
