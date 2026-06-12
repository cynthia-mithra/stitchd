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
  const listingIds = (session.metadata?.listing_ids ?? "").split(",").filter(Boolean);
  const buyerId = session.metadata?.buyer_id || null;
  const stripeSessionId = session.id;

  try {
    // Re-fetch authoritative listing data (price + seller) for the order rows.
    const ids = listingIds.map((id) => `"${id}"`).join(",");
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.(${ids})&select=id,name,price,user_id,image_url,images`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    const listings: Array<{
      id: string;
      name: string;
      price: string | number;
      user_id: string;
      image_url?: string;
      images?: unknown;
    }> = r.ok ? await r.json() : [];

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
          const { subject, html } = await render(
            "order_confirmation",
            { title: l.name, image, price: priceStr, orderRef },
            buyerId,
          );
          await sendViaResend(buyerEmail, subject, html);
        }

        // Email 2 — sale notification (seller).
        const sellerProfile = await getProfile(l.user_id);
        if (sellerProfile?.email_notifications !== false) {
          const sellerEmail = await emailForUser(l.user_id);
          if (sellerEmail) {
            const { subject, html } = await render(
              "sale",
              { title: l.name, image, price: priceStr, buyerFirstName: buyerName },
              l.user_id,
            );
            await sendViaResend(sellerEmail, subject, html);
          }
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
