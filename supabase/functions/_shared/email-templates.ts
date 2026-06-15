// Shared Stitch'd email templates — used by both the send-email Edge Function
// (frontend/data-layer triggers) and the stripe-webhook (order + sale emails).
//
// Brand (issue PART 2):
//   • white background, clean minimal layout
//   • black (#111) header bar, STITCH'D wordmark in white Barlow Condensed
//   • #FF1493 pink accent for headings and CTA buttons
//   • footer: © 2026 Stitch'd · stitchd.fit · Unsubscribe
//
// Every builder returns { subject, html }. Templates are inline-styled tables —
// the only layout email clients render reliably (no external CSS, no flexbox).

// Escape user-supplied strings before they go into HTML (listing names, sender
// names, message previews) so a stray `<` or `&` can't break the markup.
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PINK = "#FF1493";
const INK = "#111111";

// A pink CTA button. `kind:"secondary"` renders an outlined/muted variant for the
// "REPORT A PROBLEM" style secondary actions.
function button(label: string, href: string, kind: "primary" | "secondary" = "primary"): string {
  const bg = kind === "primary" ? PINK : "#ffffff";
  const color = kind === "primary" ? "#ffffff" : INK;
  const border = kind === "primary" ? PINK : "#dddddd";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;">
    <tr><td style="border-radius:2px;background:${bg};">
      <a href="${esc(href)}" target="_blank"
         style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;
                font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;
                color:${color};text-decoration:none;border:2px solid ${border};border-radius:2px;">
        ${esc(label)}</a>
    </td></tr></table>`;
}

// Optional listing card — thumbnail + title (+ price). Thumb falls back to a
// neutral block if the listing has no image.
function listingCard(opts: { image?: string; title?: string; price?: string }): string {
  if (!opts.title && !opts.image) return "";
  const img = opts.image
    ? `<img src="${esc(opts.image)}" width="80" height="80" alt=""
            style="display:block;width:80px;height:80px;object-fit:cover;border-radius:2px;background:#f2f2f2;">`
    : `<div style="width:80px;height:80px;border-radius:2px;background:#f2f2f2;"></div>`;
  const price = opts.price
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:${INK};margin-top:4px;">${esc(opts.price)}</div>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
            style="margin:18px 0;background:#fafafa;border-radius:4px;">
    <tr>
      <td style="padding:14px;width:80px;vertical-align:top;">${img}</td>
      <td style="padding:14px 14px 14px 0;vertical-align:top;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${INK};">${esc(opts.title || "")}</div>
        ${price}
      </td>
    </tr></table>`;
}

// The shell every email shares: header bar + heading + body + footer.
export function baseTemplate(opts: {
  heading: string;
  bodyHtml: string;
  unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>Stitch'd</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">

      <!-- Header bar -->
      <tr><td style="background:${INK};padding:22px 28px;">
        <a href="https://stitchd.fit" target="_blank" style="text-decoration:none;">
          <span style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;
                       font-size:30px;font-weight:700;letter-spacing:3px;color:#ffffff;
                       text-transform:uppercase;">STITCH'D</span>
        </a>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:34px 28px 10px 28px;">
        <h1 style="margin:0 0 18px 0;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;
                   font-size:34px;line-height:1.1;font-weight:700;letter-spacing:1px;
                   text-transform:uppercase;color:${PINK};">${esc(opts.heading)}</h1>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">
          ${opts.bodyHtml}
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:30px 28px 40px 28px;border-top:1px solid #eeeeee;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#999999;">
          &copy; 2026 Stitch'd &middot;
          <a href="https://stitchd.fit" target="_blank" style="color:#999999;text-decoration:underline;">stitchd.fit</a>
          &middot;
          <a href="${esc(opts.unsubscribeUrl)}" target="_blank" style="color:#999999;text-decoration:underline;">Unsubscribe from these emails</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Per-email builders ────────────────────────────────────────────────────────
// `site` is the app origin (e.g. https://stitchd.fit); `unsub` is the recipient's
// signed unsubscribe URL. Each returns the subject + full HTML.

export interface BuildCtx {
  site: string;
  unsub: string;
}

const p = (text: string) => `<p style="margin:0 0 14px 0;">${text}</p>`;

// A pink highlighted note line — used for the offer-purchase "You saved £X"
// / "Sold via accepted offer" extras layered onto the standard order/sale emails.
const noteLine = (text: string) =>
  `<p style="margin:0 0 16px 0;padding:10px 14px;background:#fff0f7;border-left:3px solid ${PINK};font-weight:700;color:${INK};">${esc(text)}</p>`;

export const templates = {
  // 1 — Order confirmation (buyer). Phase 14: optional `note` renders a pink
  // highlight line (e.g. "You saved £15 with your offer") for offer purchases —
  // the regular sale path leaves it unset, so the email is unchanged for sales.
  order_confirmation(d: { title?: string; image?: string; price?: string; orderRef?: string; note?: string }, ctx: BuildCtx) {
    return {
      subject: "Your order is confirmed — Stitch'd",
      html: baseTemplate({
        heading: "It's yours.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("Your payment went through and your order is confirmed. Here's what you bought:") +
          listingCard({ image: d.image, title: d.title, price: d.price }) +
          (d.note ? noteLine(d.note) : "") +
          (d.orderRef ? p(`<strong>Order reference:</strong> ${esc(d.orderRef)}`) : "") +
          p("The seller will be in touch about delivery.") +
          button("View your order", `${ctx.site}/orders`),
      }),
    };
  },

  // 2 — Sale notification (seller). Phase 14: optional `note` (e.g. "Sold via
  // accepted offer.") is appended for offer sales; unset for regular sales.
  sale(d: { title?: string; image?: string; price?: string; buyerFirstName?: string; note?: string }, ctx: BuildCtx) {
    return {
      subject: "You've made a sale! — Stitch'd",
      html: baseTemplate({
        heading: "You made a sale!",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`Great news${d.buyerFirstName ? `, ${esc(d.buyerFirstName)} just bought one of your pieces` : ""}!`) +
          listingCard({ image: d.image, title: d.title, price: d.price }) +
          (d.note ? noteLine(d.note) : "") +
          p("Message your buyer to arrange delivery.") +
          button("View sale", `${ctx.site}/dashboard`),
      }),
    };
  },

  // 3 — Order dispatched (buyer)
  order_dispatched(d: { title?: string; image?: string }, ctx: BuildCtx) {
    return {
      subject: "Your order has been dispatched — Stitch'd",
      html: baseTemplate({
        heading: "It's on its way.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          listingCard({ image: d.image, title: d.title }) +
          p("Your seller has marked your order as dispatched.") +
          button("View order", `${ctx.site}/orders`),
      }),
    };
  },

  // 4 — Order delivered (buyer)
  order_delivered(d: { title?: string; image?: string; listingId?: string }, ctx: BuildCtx) {
    const listingLink = d.listingId ? `${ctx.site}/listing/${d.listingId}` : `${ctx.site}/orders`;
    return {
      subject: "Your order has been delivered — Stitch'd",
      html: baseTemplate({
        heading: "Enjoy your new piece.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          listingCard({ image: d.image, title: d.title }) +
          p("Your order has been marked as delivered. If something isn't right, you have 48 hours to report a problem.") +
          button("Leave a review", listingLink) +
          button("Report a problem", `${ctx.site}/orders`, "secondary"),
      }),
    };
  },

  // 5 — New message (recipient)
  new_message(d: { senderName?: string; preview?: string }, ctx: BuildCtx) {
    const sender = d.senderName || "Someone";
    return {
      subject: `${sender} sent you a message — Stitch'd`,
      html: baseTemplate({
        heading: "You have a new message.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(sender)}</strong> sent you a message:`) +
          (d.preview
            ? `<blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ${PINK};background:#fafafa;color:#555;font-style:italic;">${esc(d.preview)}</blockquote>`
            : "") +
          button("Reply", `${ctx.site}/messages`),
      }),
    };
  },

  // 6 — Verification approved (seller)
  verification_approved(d: { username?: string }, ctx: BuildCtx) {
    const profileLink = d.username ? `${ctx.site}/seller/${d.username}` : `${ctx.site}/dashboard`;
    return {
      subject: "You're verified on Stitch'd! 🎉",
      html: baseTemplate({
        heading: "You're verified.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("Your verified seller badge is now live on your profile and listings.") +
          button("View your profile", profileLink),
      }),
    };
  },

  // 8 — Saved-search alert (buyer). New listings matched a saved search.
  // `summary` is the human filter chip (e.g. "Lehenga · Pink · Under £200");
  // `matchUrl` deep-links the shop with the saved filters pre-applied; `listings`
  // are up to 4 matching cards.
  saved_search_alert(
    d: { name?: string; summary?: string; matchUrl?: string; total?: number; listings?: Array<{ title?: string; price?: string; image?: string }> },
    ctx: BuildCtx,
  ) {
    const cards = (d.listings || []).slice(0, 4).map((l) => listingCard({ image: l.image, title: l.title, price: l.price })).join("");
    const label = d.name || d.summary || "your saved search";
    const more = d.total && d.total > 4 ? p(`<span style="color:#888;">…and ${d.total - 4} more.</span>`) : "";
    return {
      subject: "New listings match your saved search — Stitch'd",
      html: baseTemplate({
        heading: "New matches for you.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`New listings just landed for <strong>${esc(label)}</strong>${d.summary && d.name ? ` <span style="color:#888;">(${esc(d.summary)})</span>` : ""}.`) +
          cards +
          more +
          button("See all matches", d.matchUrl || `${ctx.site}/shop`) +
          p(`<a href="${esc(`${ctx.site}/saved-searches`)}" target="_blank" style="color:#FF1493;font-weight:700;text-decoration:none;">Manage your saved searches</a>`),
      }),
    };
  },

  // 9 — Promotion active (seller). Sent by the stripe-webhook once a £2.99
  // promotion payment completes. `listingId` deep-links the public listing.
  promotion_active(
    d: { title?: string; image?: string; promotedUntil?: string; listingId?: string },
    ctx: BuildCtx,
  ) {
    const listingLink = d.listingId ? `${ctx.site}/?listing=${d.listingId}` : `${ctx.site}/dashboard`;
    return {
      subject: "Your listing is now promoted — Stitch'd",
      html: baseTemplate({
        heading: "You're boosted.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("Your payment went through — your listing is now promoted to the top of search results for 7 days.") +
          listingCard({ image: d.image, title: d.title }) +
          (d.promotedUntil ? p(`<strong>Promoted until:</strong> ${esc(d.promotedUntil)}`) : "") +
          p("Sit back and watch the views roll in.") +
          button("View your listing", listingLink),
      }),
    };
  },

  // 10 — Promotion expired (seller). Sent by the expire-promotions cron function
  // when the 7 days are up, with a PROMOTE AGAIN CTA back to the dashboard.
  promotion_expired(d: { title?: string; image?: string }, ctx: BuildCtx) {
    return {
      subject: "Your promotion has ended — Stitch'd",
      html: baseTemplate({
        heading: "Your boost has ended.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("Your 7 days of boosted visibility have ended. Promote again to keep your listing at the top of search results.") +
          listingCard({ image: d.image, title: d.title }) +
          button("Promote again", `${ctx.site}/dashboard`),
      }),
    };
  },

  // 11 — New offer (seller). Phase 14 — a buyer made an offer on the seller's
  // listing. `amount` is the formatted offer (e.g. "£45"); `message` is the
  // buyer's optional note. CTA deep-links the dashboard where offers are managed.
  new_offer(
    d: { title?: string; image?: string; amount?: string; buyerName?: string; message?: string },
    ctx: BuildCtx,
  ) {
    const who = d.buyerName || "A buyer";
    return {
      subject: "You have a new offer — Stitch'd",
      html: baseTemplate({
        heading: "You have a new offer.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(who)}</strong> made an offer on your listing:`) +
          listingCard({ image: d.image, title: d.title }) +
          `<div style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount || "")}</div>` +
          (d.message
            ? `<blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ${PINK};background:#fafafa;color:#555;font-style:italic;">${esc(d.message)}</blockquote>`
            : "") +
          p("This offer expires in 48 hours.") +
          button("View offer", `${ctx.site}/dashboard`),
      }),
    };
  },

  // 12 — Offer accepted (buyer). Phase 14 — the seller accepted the buyer's
  // offer. `amount` is the accepted price (formatted, e.g. "£45"); the CTA links
  // to /offers for now (it'll be wired to checkout in the next issue). The buyer
  // has 24 hours to complete payment before the offer expires.
  offer_accepted(
    d: { title?: string; image?: string; amount?: string },
    ctx: BuildCtx,
  ) {
    return {
      subject: "Your offer was accepted — Stitch'd",
      html: baseTemplate({
        heading: "Your offer was accepted!",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("Great news — the seller accepted your offer:") +
          listingCard({ image: d.image, title: d.title }) +
          `<div style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount || "")}</div>` +
          p("<strong>Complete your purchase within 24 hours</strong> or the offer will expire.") +
          button("Complete purchase", `${ctx.site}/offers`),
      }),
    };
  },

  // 13 — Offer declined (buyer). Phase 14 — the seller declined the offer. If
  // they suggested a different price, `counter` holds the formatted amount and
  // the CTA invites a new offer on the listing; otherwise it's a plain decline
  // with a BROWSE SIMILAR LISTINGS CTA. `listingId` deep-links the listing.
  offer_declined(
    d: { title?: string; image?: string; counter?: string; listingId?: string },
    ctx: BuildCtx,
  ) {
    const listingLink = d.listingId ? `${ctx.site}/?listing=${d.listingId}` : `${ctx.site}/shop`;
    return {
      subject: "Update on your offer — Stitch'd",
      html: baseTemplate({
        heading: "Update on your offer.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml: d.counter
          ? p("Your offer wasn't accepted, but the seller has suggested a different price:") +
            listingCard({ image: d.image, title: d.title }) +
            `<div style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.counter)}</div>` +
            p("Make a new offer to take the seller up on it.") +
            button("Make a new offer", listingLink)
          : p("Your offer was not accepted this time.") +
            listingCard({ image: d.image, title: d.title }) +
            p("Plenty more pieces where that came from.") +
            button("Browse similar listings", `${ctx.site}/shop`),
      }),
    };
  },

  // 14 — Offer payment reminder (buyer). Phase 14 — sent by the expire-offers
  // sweep ~12 hours into the 24h payment window if the buyer hasn't paid yet.
  // `amount` is the accepted price (formatted); `hoursLeft` is the whole hours
  // remaining. CTA links to /offers where the COMPLETE PURCHASE button lives.
  offer_reminder(
    d: { title?: string; image?: string; amount?: string; hoursLeft?: number },
    ctx: BuildCtx,
  ) {
    const hrs = typeof d.hoursLeft === "number" && d.hoursLeft > 0 ? d.hoursLeft : 0;
    return {
      subject: "Don't miss out — your offer expires soon",
      html: baseTemplate({
        heading: "Your offer expires soon.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("The seller accepted your offer — but you haven't completed your purchase yet:") +
          listingCard({ image: d.image, title: d.title }) +
          (d.amount
            ? `<div style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount)}</div>`
            : "") +
          p(`<strong>You have ${hrs} hour${hrs === 1 ? "" : "s"} left to complete your purchase</strong> before the offer expires and the listing reopens to other buyers.`) +
          button("Complete purchase", `${ctx.site}/offers`),
      }),
    };
  },

  // 15 — Tailor application approved (Phase 15). The applicant's tailor profile
  // is now live; `tailorId` deep-links their public profile at /tailors/<id>.
  tailor_approved(d: { displayName?: string; tailorId?: string }, ctx: BuildCtx) {
    const profileLink = d.tailorId ? `${ctx.site}/tailors/${d.tailorId}` : `${ctx.site}/`;
    return {
      subject: "You're approved as a Stitch'd tailor! 🎉",
      html: baseTemplate({
        heading: "You're a Stitch'd tailor.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`Congratulations${d.displayName ? `, ${esc(d.displayName)}` : ""} — your tailor application has been approved and your public profile is now live on Stitch'd.`) +
          p("Buyers can now find you, browse your specialisms and portfolio, and (soon) book alterations with you.") +
          button("View your profile", profileLink),
      }),
    };
  },

  // 7 — Welcome (new user)
  welcome(_d: Record<string, unknown>, ctx: BuildCtx) {
    return {
      subject: "Welcome to Stitch'd",
      html: baseTemplate({
        heading: "Welcome to Stitch'd.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p("The marketplace for pre-loved South Asian fashion.") +
          button("Browse listings", `${ctx.site}/shop`) +
          button("List your first piece", `${ctx.site}/sell`, "secondary"),
      }),
    };
  },
} as const;

export type EmailType = keyof typeof templates;
