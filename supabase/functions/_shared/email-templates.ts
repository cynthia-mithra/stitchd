// Shared Stitch'd email templates — used by both the send-email Edge Function
// (frontend/data-layer triggers) and the stripe-webhook (order + sale emails).
//
// Brand (issue PART 2):
//   • white background, clean minimal layout
//   • black (#111) header bar, STITCH'D wordmark in white Barlow Condensed
//   • #FF1493 pink accent for headings and CTA buttons
//   • footer: 2026 Stitch'd · stitchd.fit · Unsubscribe
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

// Two-font system matching the website. HEAD = Barlow Condensed (the wordmark,
// headings, labels, CTAs, prices); BODY = Barlow (running copy). Both fall back
// to web-safe stacks so the email still reads well where the real fonts can't
// load — Arial Narrow / Helvetica Neue Condensed keep the tall condensed feel
// for HEAD, Helvetica/Arial for BODY. A Google Fonts @import in the head lets
// supporting clients (Apple Mail, iOS Mail) pull the real Barlow fonts.
const HEAD = "'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue Condensed', Arial, sans-serif";
const BODY = "'Barlow', 'Helvetica Neue', Helvetica, Arial, sans-serif";
// Kept for backward-compatibility with builders that reference FONT (e.g. the
// big offer/quote amount numbers) — those want the condensed look, so FONT = HEAD.
const FONT = HEAD;

// Split a heading so its last word is emphasised in pink (the "It's yours."
// look) while the rest sits in ink. Single-word headings render fully pink.
function headingHtml(heading: string): string {
  const words = String(heading).trim().split(/\s+/);
  if (words.length <= 1) {
    return `<span style="color:${PINK};">${esc(heading)}</span>`;
  }
  const tail = words.pop() as string;
  return `${esc(words.join(" "))} <span style="color:${PINK};">${esc(tail)}</span>`;
}

// A pink CTA button — sharp corners, 2px border, condensed uppercase label.
// `kind:"secondary"` renders an outlined/muted variant for the "REPORT A
// PROBLEM" style secondary actions.
function button(label: string, href: string, kind: "primary" | "secondary" = "primary"): string {
  const bg = kind === "primary" ? PINK : "#ffffff";
  const color = kind === "primary" ? "#ffffff" : INK;
  const border = kind === "primary" ? PINK : "#cccccc";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 4px 0;">
    <tr><td style="background:${bg};">
      <a href="${esc(href)}" target="_blank"
         style="display:inline-block;padding:14px 30px;font-family:${HEAD};
                font-size:14px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
                color:${color};text-decoration:none;border:2px solid ${border};">
        ${esc(label)}</a>
    </td></tr></table>`;
}

// Optional listing card — pink left-accent bar, thumbnail, title (+ price).
// Thumb falls back to a neutral block if the listing has no image. Sharp
// corners, hairline border — matches the website's product cards.
function listingCard(opts: { image?: string; title?: string; price?: string }): string {
  if (!opts.title && !opts.image) return "";
  const img = opts.image
    ? `<img src="${esc(opts.image)}" width="78" height="78" alt=""
            style="display:block;width:78px;height:78px;object-fit:cover;background:#f2f2f2;">`
    : `<div style="width:78px;height:78px;background:#f2f2f2;"></div>`;
  const price = opts.price
    ? `<div style="font-family:${HEAD};font-size:20px;font-weight:900;color:${PINK};margin-top:3px;">${esc(opts.price)}</div>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
            style="margin:18px 0;border:1.5px solid #ececec;border-collapse:separate;">
    <tr>
      <td style="padding:0;width:6px;background:${PINK};"></td>
      <td style="padding:12px;width:78px;vertical-align:middle;">${img}</td>
      <td style="padding:12px 14px 12px 4px;vertical-align:middle;">
        <div style="font-family:${HEAD};font-size:18px;font-weight:700;letter-spacing:.3px;color:${INK};">${esc(opts.title || "")}</div>
        ${price}
      </td>
    </tr></table>`;
}

// The shell every email shares: centered wordmark header + pink ticker strip +
// heading + body + centered footer.
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
<style>@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800;900&family=Barlow:wght@400;500;600&display=swap');</style>
<title>Stitch'd</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;">

      <!-- Header: centered wordmark -->
      <tr><td style="background:${INK};padding:22px 30px;text-align:center;">
        <a href="https://stitchd.fit" target="_blank" style="text-decoration:none;">
          <span style="font-family:${HEAD};font-size:32px;font-weight:900;letter-spacing:4px;
                       color:#ffffff;text-transform:uppercase;line-height:1;">STITCH'D</span>
        </a>
      </td></tr>

      <!-- Pink ticker strip -->
      <tr><td style="background:${PINK};padding:8px 30px;text-align:center;">
        <span style="font-family:${HEAD};font-size:11px;font-weight:700;letter-spacing:4px;color:#ffffff;">
          PRE-LOVED SOUTH ASIAN FASHION &nbsp;&middot;&nbsp; BUY. SELL. STYLE.
        </span>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:36px 30px 26px 30px;">
        <h1 style="margin:0 0 16px 0;font-family:${HEAD};
                   font-size:44px;line-height:.96;font-weight:900;letter-spacing:1px;
                   text-transform:uppercase;color:${INK};">${headingHtml(opts.heading)}</h1>
        <div style="font-family:${BODY};font-size:16px;line-height:1.6;color:#333333;">
          ${opts.bodyHtml}
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 30px 30px 30px;border-top:2px solid ${INK};text-align:center;">
        <div style="font-family:${HEAD};font-size:12px;font-weight:800;letter-spacing:2px;color:${INK};margin-bottom:6px;">
          FOLLOW @STITCHD_FIT
        </div>
        <div style="font-family:${BODY};font-size:12px;line-height:1.6;color:#9a9a9a;">
          &copy; 2026 Stitch'd &middot;
          <a href="https://stitchd.fit" target="_blank" style="color:#9a9a9a;text-decoration:underline;">stitchd.fit</a>
          &middot;
          <a href="${esc(opts.unsubscribeUrl)}" target="_blank" style="color:#9a9a9a;text-decoration:underline;">Unsubscribe from these emails</a>
        </div>
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
          p("Your order has been marked as delivered. If something isn't right, you have 5 days to report a problem.") +
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
      subject: "You're verified on Stitch'd",
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
          `<div style="font-family:${FONT};font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount || "")}</div>` +
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
          `<div style="font-family:${FONT};font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount || "")}</div>` +
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
            `<div style="font-family:${FONT};font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.counter)}</div>` +
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
            ? `<div style="font-family:${FONT};font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount)}</div>`
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
      subject: "You're approved as a Stitch'd tailor",
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

  // 16 — New alteration request (tailor). Phase 15 — a buyer asked this tailor to
  // quote on alterations. `alterations` is the list of selected types; `notes` is
  // the buyer's description; `budget` is the formatted optional budget. CTA opens
  // the tailor's dashboard where they can quote or decline.
  alteration_request(
    d: { title?: string; image?: string; buyerName?: string; alterations?: string[]; notes?: string; budget?: string },
    ctx: BuildCtx,
  ) {
    const who = d.buyerName || "A buyer";
    const list = (d.alterations || []).length
      ? `<ul style="margin:0 0 16px 0;padding-left:20px;color:${INK};">${(d.alterations || []).map((a) => `<li style="margin:0 0 4px 0;">${esc(a)}</li>`).join("")}</ul>`
      : "";
    return {
      subject: "New alteration request — Stitch'd",
      html: baseTemplate({
        heading: "New alteration request.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(who)}</strong> has sent you an alteration request:`) +
          listingCard({ image: d.image, title: d.title }) +
          (list ? p("<strong>Alterations needed:</strong>") + list : "") +
          (d.notes
            ? `<blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ${PINK};background:#fafafa;color:#555;font-style:italic;">${esc(d.notes)}</blockquote>`
            : "") +
          (d.budget ? p(`<strong>Buyer budget:</strong> ${esc(d.budget)}`) : "") +
          p("Send a quote or decline from your dashboard.") +
          button("View request", `${ctx.site}/`),
      }),
    };
  },

  // 17 — Alteration quote (buyer). Phase 15 — a tailor quoted on the buyer's
  // request. `amount` is the formatted quote; `tailorName` is who sent it.
  alteration_quote(
    d: { title?: string; image?: string; amount?: string; tailorName?: string; message?: string },
    ctx: BuildCtx,
  ) {
    const who = d.tailorName || "Your tailor";
    return {
      subject: `You have a quote from ${who} — Stitch'd`,
      html: baseTemplate({
        heading: "You have a quote.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(who)}</strong> has sent you a quote for your alteration request:`) +
          listingCard({ image: d.image, title: d.title }) +
          `<div style="font-family:${FONT};font-size:40px;font-weight:800;color:${PINK};letter-spacing:1px;margin:6px 0 14px 0;">${esc(d.amount || "")}</div>` +
          (d.message
            ? `<blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ${PINK};background:#fafafa;color:#555;font-style:italic;">${esc(d.message)}</blockquote>`
            : "") +
          button("View quote", `${ctx.site}/alterations`),
      }),
    };
  },

  // 18 — Alteration declined (buyer). Phase 15 — a tailor couldn't take on the
  // request. CTA points back to the tailor directory to find another.
  alteration_declined(
    d: { title?: string; image?: string; tailorName?: string },
    ctx: BuildCtx,
  ) {
    const who = d.tailorName || "The tailor";
    return {
      subject: "Update on your alteration request — Stitch'd",
      html: baseTemplate({
        heading: "Update on your request.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(who)}</strong> is unable to take on your alteration request at this time.`) +
          listingCard({ image: d.image, title: d.title }) +
          p("Plenty more vetted tailors on Stitch'd — find another to help.") +
          button("Find another tailor", `${ctx.site}/tailors`),
      }),
    };
  },

  // 19 — Booking confirmed (tailor). Phase 15 — a buyer paid the tailor's quote.
  // `earnings` is the formatted payout AFTER the 15% Stitch'd commission;
  // `buyerName` and the alteration list/notes give the tailor the job detail.
  // CTA opens the tailor dashboard where the booking now lives under ACCEPTED.
  alteration_booking_tailor(
    d: { title?: string; image?: string; buyerName?: string; alterations?: string[]; earnings?: string },
    ctx: BuildCtx,
  ) {
    const who = d.buyerName || "A buyer";
    const list = (d.alterations || []).length
      ? `<ul style="margin:0 0 16px 0;padding-left:20px;color:${INK};">${(d.alterations || []).map((a) => `<li style="margin:0 0 4px 0;">${esc(a)}</li>`).join("")}</ul>`
      : "";
    return {
      subject: "Booking confirmed — Stitch'd",
      html: baseTemplate({
        heading: "Booking confirmed.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`Payment received for your alteration booking from <strong>${esc(who)}</strong>.`) +
          listingCard({ image: d.image, title: d.title }) +
          (list ? p("<strong>Alterations booked:</strong>") + list : "") +
          (d.earnings
            ? noteLine(`Your earnings: ${d.earnings} (after 15% Stitch'd commission). Paid on completion.`)
            : "") +
          p("Get started, then mark the booking complete from your dashboard when the work is done.") +
          button("View booking", `${ctx.site}/tailors`),
      }),
    };
  },

  // 20 — Booking confirmed (buyer). Phase 15 — the buyer paid for their
  // alteration. `amount` is the formatted total paid; `tailorName` is who'll do
  // the work. CTA opens the buyer's /alterations page.
  alteration_booking_buyer(
    d: { title?: string; image?: string; tailorName?: string; amount?: string },
    ctx: BuildCtx,
  ) {
    const who = d.tailorName || "Your tailor";
    return {
      subject: "Alteration booking confirmed — Stitch'd",
      html: baseTemplate({
        heading: "Your booking is confirmed!",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`Your payment went through — your alteration booking with <strong>${esc(who)}</strong> is confirmed.`) +
          listingCard({ image: d.image, title: d.title, price: d.amount }) +
          (d.amount ? p(`<strong>Amount paid:</strong> ${esc(d.amount)}`) : "") +
          p(`${esc(who)} will be in touch to arrange your fitting.`) +
          button("View booking", `${ctx.site}/alterations`),
      }),
    };
  },

  // 21 — Alteration marked complete (buyer). Phase 15 — the tailor marked the
  // job done; the buyer confirms receipt to release the payout. CTA opens
  // /alterations where the CONFIRM COMPLETION button lives.
  alteration_completed_buyer(
    d: { title?: string; image?: string; tailorName?: string },
    ctx: BuildCtx,
  ) {
    const who = d.tailorName || "Your tailor";
    return {
      subject: "Your alteration is ready — please confirm — Stitch'd",
      html: baseTemplate({
        heading: "Your alteration is ready.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(who)}</strong> has marked your alteration as complete.`) +
          listingCard({ image: d.image, title: d.title }) +
          p("Please confirm once you've received your item — this releases the tailor's payout.") +
          button("Confirm completion", `${ctx.site}/alterations`),
      }),
    };
  },

  // 22 — New tailor review (tailor). Phase 15 — a buyer reviewed the tailor after
  // a completed booking. `rating` is 1–5 (shown as filled/empty stars), `comment`
  // is the buyer's optional note, `buyerName` is who left it. CTA deep-links the
  // tailor's public profile where the review now appears.
  tailor_review(
    d: { rating?: number; comment?: string; buyerName?: string; tailorId?: string },
    ctx: BuildCtx,
  ) {
    const who = d.buyerName || "A buyer";
    const n = Math.max(0, Math.min(5, Math.round(Number(d.rating) || 0)));
    // Visual star row — filled pink stars + grey remainder (★/☆ unicode renders
    // reliably across email clients where icon fonts / SVGs don't).
    const stars =
      `<div style="font-size:30px;line-height:1;letter-spacing:4px;margin:6px 0 16px 0;">` +
      `<span style="color:${PINK};">${"★".repeat(n)}</span>` +
      `<span style="color:#dddddd;">${"★".repeat(5 - n)}</span>` +
      `</div>`;
    const profileLink = d.tailorId ? `${ctx.site}/tailors/${d.tailorId}` : `${ctx.site}/`;
    return {
      subject: "You have a new review — Stitch'd",
      html: baseTemplate({
        heading: "You have a new review.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`<strong>${esc(who)}</strong> left you a review:`) +
          stars +
          (d.comment
            ? `<blockquote style="margin:0 0 16px 0;padding:12px 16px;border-left:3px solid ${PINK};background:#fafafa;color:#555;font-style:italic;">${esc(d.comment)}</blockquote>`
            : "") +
          p("Reviews build trust and help buyers choose you for their alterations.") +
          button("View your profile", profileLink),
      }),
    };
  },

  // 23 — Payout sent (tailor). Phase 15 — Stripe Connect transferred the tailor's
  // cut to their connected bank account after the buyer confirmed completion.
  // `amount` is the formatted payout (after the 15% commission); `title` is the
  // job. CTA opens the dashboard EARNINGS section.
  tailor_payout_sent(
    d: { amount?: string; title?: string; image?: string },
    ctx: BuildCtx,
  ) {
    const job = d.title || "your alteration job";
    return {
      subject: "Payment sent — Stitch'd",
      html: baseTemplate({
        heading: "Your payment is on its way.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          (d.amount
            ? p(`<strong>${esc(d.amount)}</strong> has been transferred to your connected bank account.`)
            : p("Your payout has been transferred to your connected bank account.")) +
          listingCard({ image: d.image, title: job, price: d.amount }) +
          p(`<strong>Job:</strong> ${esc(job)}`) +
          noteLine("Funds typically arrive within 2–7 business days.") +
          button("View earnings", `${ctx.site}/tailor-dashboard`),
      }),
    };
  },

  // 24 — Tailor application received (applicant). Confirms we got the application.
  tailor_application_received(d: { displayName?: string }, ctx: BuildCtx) {
    return {
      subject: "We've received your tailor application — Stitch'd",
      html: baseTemplate({
        heading: "Application received.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`Thanks${d.displayName ? `, ${esc(d.displayName)}` : ""} — we've received your application to become a Stitch'd tailor.`) +
          p("Our team will review it and get back to you within 3 working days. We'll email you as soon as there's an update.") +
          button("Browse Stitch'd", `${ctx.site}/`),
      }),
    };
  },

  // 25 — New tailor application (admin). Operational alert prompting a review.
  tailor_application_admin(d: { displayName?: string; location?: string; tailorId?: string }, ctx: BuildCtx) {
    return {
      subject: "New tailor application to review — Stitch'd",
      html: baseTemplate({
        heading: "New tailor application.",
        unsubscribeUrl: ctx.unsub,
        bodyHtml:
          p(`A new tailor application has been submitted${d.displayName ? ` by <strong>${esc(d.displayName)}</strong>` : ""}${d.location ? ` <span style="color:#888;">(${esc(d.location)})</span>` : ""}.`) +
          p("Review their profile, specialisms and portfolio, then approve or decline from the admin dashboard.") +
          button("Review application", `${ctx.site}/dashboard`),
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
