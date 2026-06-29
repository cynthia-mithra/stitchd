// Supabase Edge Function: send-email
// -----------------------------------
// The single delivery path for every Stitch'd transactional email (issue PART 4).
//
// POST - send an email. Two shapes:
//   { type, to?, userId?, data?, …ids }   templated: renders a brand template,
//                                          resolving the recipient + content
//                                          server-side, honouring unsubscribe and
//                                          the new-message "active user" guard.
//   { type:"raw", to, subject, html }      raw passthrough - SERVICE-ROLE ONLY
//                                          (used internally by stripe-webhook).
//
// GET ?unsubscribe=1&u=<userId>&sig=<hmac> - the footer link. Verifies the
//   signature, flips profiles.email_notifications to false, returns a small page.
//
// Required secrets (set via `supabase secrets set` - see DEPLOY.md):
//   RESEND_API_KEY              re_…  (Resend API key, sender = hello@stitchd.fit)
//   SITE_URL                    https://stitchd.fit  (link targets; already set)
//   EMAIL_UNSUB_SECRET          optional - signs unsubscribe links (defaults to
//                               the service-role key if unset)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   auto-injected by Supabase.
//
// Deploy: supabase functions deploy send-email   (verify_jwt=false in config.toml)

import {
  corsHeaders,
  emailForUser,
  getProfile,
  render,
  sbPatch,
  sendViaResend,
  SITE_URL,
  verifyUnsubscribe,
} from "../_shared/email.ts";
import type { EmailType } from "../_shared/email-templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // new-message emails skip recently-active users

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sbGetOne<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as T[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// A listing's display thumbnail: prefer image_url, else the first of images[].
function thumb(l: { image_url?: string; images?: unknown } | null): string | undefined {
  if (!l) return undefined;
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
  return undefined;
}

// Resolve recipient + template data for an id-based trigger (the data-layer
// hooks pass only ids; the browser has no access to emails). Returns null when
// the email should be silently skipped (no recipient, unsubscribed, active, etc).
async function resolveTemplated(
  type: EmailType,
  body: Record<string, any>,
): Promise<{ to: string; userId: string | null; data: Record<string, unknown> } | { skip: string } | null> {
  // Explicit recipient + data path (used by the webhook for order_confirmation /
  // sale, which already hold Stripe-sourced values).
  if (body.to && body.data) {
    if (body.userId) {
      const prof = await getProfile(body.userId);
      if (prof && prof.email_notifications === false) return { skip: "unsubscribed" };
    }
    return { to: body.to, userId: body.userId ?? null, data: body.data };
  }

  switch (type) {
    case "order_dispatched":
    case "order_delivered": {
      const order = await sbGetOne<{ buyer_id: string; listing_id: string }>(
        `orders?id=eq.${body.orderId}&select=buyer_id,listing_id&limit=1`,
      );
      if (!order?.buyer_id) return { skip: "no buyer" };
      const prof = await getProfile(order.buyer_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(order.buyer_id);
      if (!to) return { skip: "no email" };
      const listing = await sbGetOne<{ name: string; image_url?: string; images?: unknown }>(
        `listings?id=eq.${order.listing_id}&select=name,image_url,images&limit=1`,
      );
      return {
        to,
        userId: order.buyer_id,
        data: { title: listing?.name, image: thumb(listing), listingId: order.listing_id },
      };
    }

    case "new_message": {
      const conv = await sbGetOne<{ buyer_id: string; seller_id: string }>(
        `conversations?id=eq.${body.conversationId}&select=buyer_id,seller_id&limit=1`,
      );
      if (!conv) return { skip: "no conversation" };
      const recipientId = body.senderId === conv.buyer_id ? conv.seller_id : conv.buyer_id;
      if (!recipientId || recipientId === body.senderId) return { skip: "no recipient" };
      const prof = await getProfile(recipientId);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      // Skip if the recipient was active in the last 10 minutes (issue PART 3.5).
      if (prof?.last_active_at) {
        const age = Date.now() - new Date(prof.last_active_at).getTime();
        if (age >= 0 && age < ACTIVE_WINDOW_MS) return { skip: "recipient active" };
      }
      const to = await emailForUser(recipientId);
      if (!to) return { skip: "no email" };
      const sender = body.senderId ? await getProfile(body.senderId) : null;
      const senderName = sender?.full_name || sender?.username || body.senderName || "Someone";
      const preview = String(body.content ?? body.preview ?? "").slice(0, 100);
      return { to, userId: recipientId, data: { senderName, preview } };
    }

    case "verification_approved": {
      let userId: string | null = body.userId ?? null;
      let username: string | undefined;
      if (!userId && body.applicationId) {
        const app = await sbGetOne<{ user_id: string }>(
          `verification_applications?id=eq.${body.applicationId}&select=user_id&limit=1`,
        );
        userId = app?.user_id ?? null;
      }
      if (!userId) return { skip: "no user" };
      const prof = await getProfile(userId);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      username = prof?.username;
      const to = await emailForUser(userId);
      if (!to) return { skip: "no email" };
      return { to, userId, data: { username } };
    }

    case "new_offer": {
      // Phase 14 - a buyer made an offer. Resolve the seller (recipient), the
      // listing (thumbnail/title), the buyer's name and the formatted amount
      // from the offer id. The seller-response flow lands in a later issue.
      const offer = await sbGetOne<{
        seller_id: string;
        buyer_id: string;
        listing_id: string;
        amount_pence: number;
        message?: string;
      }>(
        `offers?id=eq.${body.offerId}&select=seller_id,buyer_id,listing_id,amount_pence,message&limit=1`,
      );
      if (!offer?.seller_id) return { skip: "no seller" };
      const prof = await getProfile(offer.seller_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(offer.seller_id);
      if (!to) return { skip: "no email" };
      const listing = await sbGetOne<{ name: string; image_url?: string; images?: unknown; currency?: string }>(
        `listings?id=eq.${offer.listing_id}&select=name,image_url,images,currency&limit=1`,
      );
      const buyer = offer.buyer_id ? await getProfile(offer.buyer_id) : null;
      const buyerName = buyer?.full_name || buyer?.username || "A buyer";
      const sym = listing?.currency === "USD" ? "$" : listing?.currency === "EUR" ? "€" : "£";
      const amount = `${sym}${(offer.amount_pence / 100).toFixed(2).replace(/\.00$/, "")}`;
      return {
        to,
        userId: offer.seller_id,
        data: { title: listing?.name, image: thumb(listing), amount, buyerName, message: offer.message },
      };
    }

    case "offer_accepted":
    case "offer_declined": {
      // Phase 14 - the seller responded to an offer. Resolve the buyer
      // (recipient), the listing (thumbnail/title) and the formatted amount from
      // the offer id. For a decline, the seller's optional counter price comes
      // either from the persisted offer column or the request body.
      const offer = await sbGetOne<{
        buyer_id: string;
        listing_id: string;
        amount_pence: number;
        counter_offer_pence?: number | null;
      }>(
        `offers?id=eq.${body.offerId}&select=buyer_id,listing_id,amount_pence,counter_offer_pence&limit=1`,
      );
      if (!offer?.buyer_id) return { skip: "no buyer" };
      const prof = await getProfile(offer.buyer_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(offer.buyer_id);
      if (!to) return { skip: "no email" };
      const listing = await sbGetOne<{ name: string; image_url?: string; images?: unknown; currency?: string }>(
        `listings?id=eq.${offer.listing_id}&select=name,image_url,images,currency&limit=1`,
      );
      const sym = listing?.currency === "USD" ? "$" : listing?.currency === "EUR" ? "€" : "£";
      const fmt = (pence: number) => `${sym}${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
      if (type === "offer_accepted") {
        return {
          to,
          userId: offer.buyer_id,
          data: { title: listing?.name, image: thumb(listing), amount: fmt(offer.amount_pence) },
        };
      }
      // offer_declined - counter from the column, else the request body.
      const counterPence = offer.counter_offer_pence ?? (typeof body.counterPence === "number" ? body.counterPence : null);
      return {
        to,
        userId: offer.buyer_id,
        data: {
          title: listing?.name,
          image: thumb(listing),
          counter: counterPence != null ? fmt(counterPence) : undefined,
          listingId: offer.listing_id,
        },
      };
    }

    case "tailor_approved": {
      // Phase 15 - a tailor application was approved. Resolve the applicant
      // (recipient) and their display name from the tailor id.
      let userId: string | null = body.userId ?? null;
      let displayName: string | undefined;
      if (body.tailorId) {
        const tailor = await sbGetOne<{ user_id: string; display_name: string }>(
          `tailors?id=eq.${body.tailorId}&select=user_id,display_name&limit=1`,
        );
        if (!userId) userId = tailor?.user_id ?? null;
        displayName = tailor?.display_name;
      }
      if (!userId) return { skip: "no user" };
      const prof = await getProfile(userId);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(userId);
      if (!to) return { skip: "no email" };
      return { to, userId, data: { displayName, tailorId: body.tailorId ?? null } };
    }

    case "tailor_review": {
      // Phase 15 - a buyer reviewed a tailor. Recipient is the tailor's user;
      // resolve the rating + comment from the review id, the tailor (for the
      // profile deep link) and the buyer's name.
      const review = await sbGetOne<{
        tailor_id: string;
        buyer_id: string;
        rating: number;
        comment?: string | null;
      }>(
        `tailor_reviews?id=eq.${body.reviewId}&select=tailor_id,buyer_id,rating,comment&limit=1`,
      );
      if (!review?.tailor_id) return { skip: "no review" };
      const tailor = await sbGetOne<{ user_id: string }>(
        `tailors?id=eq.${review.tailor_id}&select=user_id&limit=1`,
      );
      if (!tailor?.user_id) return { skip: "no tailor user" };
      const prof = await getProfile(tailor.user_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(tailor.user_id);
      if (!to) return { skip: "no email" };
      const buyer = review.buyer_id ? await getProfile(review.buyer_id) : null;
      const buyerName = buyer?.full_name || buyer?.username || "A buyer";
      return {
        to,
        userId: tailor.user_id,
        data: {
          rating: review.rating,
          comment: review.comment || undefined,
          buyerName,
          tailorId: review.tailor_id,
        },
      };
    }

    case "alteration_request": {
      // Phase 15 - a buyer sent an alteration request. Recipient is the tailor's
      // user; resolve the listing, the buyer's name and the formatted budget.
      const reqRow = await sbGetOne<{
        buyer_id: string;
        tailor_id: string;
        listing_id: string;
        alterations_needed?: string[];
        additional_notes?: string;
        description?: string;
        budget_pence?: number | null;
      }>(
        `alteration_requests?id=eq.${body.requestId}&select=buyer_id,tailor_id,listing_id,alterations_needed,additional_notes,description,budget_pence&limit=1`,
      );
      if (!reqRow?.tailor_id) return { skip: "no request" };
      const tailor = await sbGetOne<{ user_id: string; display_name: string }>(
        `tailors?id=eq.${reqRow.tailor_id}&select=user_id,display_name&limit=1`,
      );
      if (!tailor?.user_id) return { skip: "no tailor user" };
      const prof = await getProfile(tailor.user_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(tailor.user_id);
      if (!to) return { skip: "no email" };
      const listing = await sbGetOne<{ name: string; image_url?: string; images?: unknown }>(
        `listings?id=eq.${reqRow.listing_id}&select=name,image_url,images&limit=1`,
      );
      const buyer = reqRow.buyer_id ? await getProfile(reqRow.buyer_id) : null;
      const buyerName = buyer?.full_name || buyer?.username || "A buyer";
      const budget = reqRow.budget_pence != null
        ? `£${(reqRow.budget_pence / 100).toFixed(2).replace(/\.00$/, "")}`
        : undefined;
      return {
        to,
        userId: tailor.user_id,
        data: {
          title: listing?.name,
          image: thumb(listing),
          buyerName,
          alterations: reqRow.alterations_needed || [],
          notes: reqRow.additional_notes || reqRow.description || "",
          budget,
        },
      };
    }

    case "alteration_quote":
    case "alteration_declined": {
      // Phase 15 - the tailor responded to a request. Recipient is the buyer;
      // resolve the listing, the tailor's display name and (for a quote) the
      // formatted amount + optional message.
      const reqRow = await sbGetOne<{
        buyer_id: string;
        tailor_id: string;
        listing_id: string;
        quote_pence?: number | null;
        quote_message?: string | null;
      }>(
        `alteration_requests?id=eq.${body.requestId}&select=buyer_id,tailor_id,listing_id,quote_pence,quote_message&limit=1`,
      );
      if (!reqRow?.buyer_id) return { skip: "no request" };
      const prof = await getProfile(reqRow.buyer_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(reqRow.buyer_id);
      if (!to) return { skip: "no email" };
      const tailor = await sbGetOne<{ display_name: string }>(
        `tailors?id=eq.${reqRow.tailor_id}&select=display_name&limit=1`,
      );
      const listing = await sbGetOne<{ name: string; image_url?: string; images?: unknown }>(
        `listings?id=eq.${reqRow.listing_id}&select=name,image_url,images&limit=1`,
      );
      const base = { title: listing?.name, image: thumb(listing), tailorName: tailor?.display_name };
      if (type === "alteration_declined") {
        return { to, userId: reqRow.buyer_id, data: base };
      }
      const amount = reqRow.quote_pence != null
        ? `£${(reqRow.quote_pence / 100).toFixed(2).replace(/\.00$/, "")}`
        : "";
      return {
        to,
        userId: reqRow.buyer_id,
        data: { ...base, amount, message: reqRow.quote_message || undefined },
      };
    }

    case "alteration_completed_buyer": {
      // Phase 15 - the tailor marked the alteration complete; ask the buyer to
      // confirm receipt (which releases the payout). Recipient is the buyer;
      // resolve the listing + the tailor's display name from the request id.
      const reqRow = await sbGetOne<{
        buyer_id: string;
        tailor_id: string;
        listing_id: string;
      }>(
        `alteration_requests?id=eq.${body.requestId}&select=buyer_id,tailor_id,listing_id&limit=1`,
      );
      if (!reqRow?.buyer_id) return { skip: "no request" };
      const prof = await getProfile(reqRow.buyer_id);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(reqRow.buyer_id);
      if (!to) return { skip: "no email" };
      const tailor = await sbGetOne<{ display_name: string }>(
        `tailors?id=eq.${reqRow.tailor_id}&select=display_name&limit=1`,
      );
      const listing = await sbGetOne<{ name: string; image_url?: string; images?: unknown }>(
        `listings?id=eq.${reqRow.listing_id}&select=name,image_url,images&limit=1`,
      );
      return {
        to,
        userId: reqRow.buyer_id,
        data: { title: listing?.name, image: thumb(listing), tailorName: tailor?.display_name },
      };
    }

    case "tailor_application_received": {
      // Phase 15 - confirm to the applicant that their tailor application landed.
      // Resolve the applicant (recipient) + display name from the tailor id.
      let userId: string | null = body.userId ?? null;
      let displayName: string | undefined;
      if (body.tailorId) {
        const tailor = await sbGetOne<{ user_id: string; display_name: string }>(
          `tailors?id=eq.${body.tailorId}&select=user_id,display_name&limit=1`,
        );
        if (!userId) userId = tailor?.user_id ?? null;
        displayName = tailor?.display_name;
      }
      if (!userId) return { skip: "no user" };
      const prof = await getProfile(userId);
      if (prof?.email_notifications === false) return { skip: "unsubscribed" };
      const to = await emailForUser(userId);
      if (!to) return { skip: "no email" };
      return { to, userId, data: { displayName } };
    }

    case "tailor_application_admin": {
      // Phase 15 - alert an admin that a new tailor application needs review. This
      // is an operational alert, so it deliberately does NOT honour the
      // email_notifications unsubscribe flag. `userId` is the admin recipient;
      // the applicant's name/location come from the tailor id.
      const adminId: string | null = body.userId ?? null;
      if (!adminId) return { skip: "no admin" };
      const to = await emailForUser(adminId);
      if (!to) return { skip: "no email" };
      let displayName: string | undefined;
      let location: string | undefined;
      if (body.tailorId) {
        const tailor = await sbGetOne<{ display_name: string; location: string }>(
          `tailors?id=eq.${body.tailorId}&select=display_name,location&limit=1`,
        );
        displayName = tailor?.display_name;
        location = tailor?.location;
      }
      return { to, userId: adminId, data: { displayName, location, tailorId: body.tailorId ?? null } };
    }

    case "welcome": {
      const userId: string | null = body.userId ?? null;
      if (!userId) return { skip: "no user" };
      const prof = await getProfile(userId);
      if (!prof) return { skip: "no profile" };
      if (prof.welcome_email_sent) return { skip: "already welcomed" };
      if (prof.email_notifications === false) return { skip: "unsubscribed" };
      const to = body.to || (await emailForUser(userId));
      if (!to) return { skip: "no email" };
      return { to, userId, data: {} };
    }

    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Unsubscribe (GET) ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("unsubscribe")) {
      const u = url.searchParams.get("u") ?? "";
      const sig = url.searchParams.get("sig") ?? "";
      const ok = await verifyUnsubscribe(u, sig);
      if (ok) await sbPatch("profiles", `id=eq.${u}`, { email_notifications: false });
      const msg = ok
        ? "You've been unsubscribed. You won't receive marketing or notification emails from Stitch'd. Important account &amp; order emails may still be sent."
        : "This unsubscribe link is invalid or has expired.";
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
         <title>Stitch'd</title></head>
         <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#fff;">
           <div style="background:#111;padding:22px 28px;">
             <span style="font-family:'Barlow Condensed',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:3px;color:#fff;">STITCH'D</span>
           </div>
           <div style="max-width:520px;margin:48px auto;padding:0 24px;text-align:center;">
             <h1 style="font-size:24px;color:${ok ? "#FF1493" : "#111"};">${ok ? "You're unsubscribed" : "Link not valid"}</h1>
             <p style="font-size:15px;line-height:1.6;color:#444;">${msg}</p>
             <p><a href="${SITE_URL}" style="color:#FF1493;font-weight:700;text-decoration:none;">Back to Stitch'd &rarr;</a></p>
           </div>
         </body></html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const type = body.type as EmailType | "raw" | undefined;
  if (!type) return json({ error: "Missing 'type'" }, 400);

  // ── Raw passthrough - service role only ─────────────────────────────────────
  if (type === "raw") {
    const auth = req.headers.get("authorization") || "";
    if (!SERVICE_KEY || auth !== `Bearer ${SERVICE_KEY}`) {
      return json({ error: "raw send requires service-role authorization" }, 401);
    }
    if (!body.to || !body.subject || !body.html) return json({ error: "raw requires to, subject, html" }, 400);
    const res = await sendViaResend(body.to, body.subject, body.html);
    return json(res, res.ok ? 200 : 502);
  }

  // ── Templated ───────────────────────────────────────────────────────────────
  const resolved = await resolveTemplated(type, body);
  if (!resolved) return json({ error: `Unknown email type '${type}'` }, 400);
  if ("skip" in resolved) return json({ skipped: resolved.skip });

  const { subject, html } = await render(type, resolved.data, resolved.userId);
  const res = await sendViaResend(resolved.to, subject, html);
  if (!res.ok) return json(res, 502);

  // Stamp welcome_email_sent so the data-layer's fire-on-every-upsert is idempotent.
  if (type === "welcome" && resolved.userId) {
    await sbPatch("profiles", `id=eq.${resolved.userId}`, { welcome_email_sent: true });
  }
  return json({ ok: true, sent: type });
});
