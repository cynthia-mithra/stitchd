// Stitch'd store policies — EDIT THIS FILE to change what the assistant tells
// shoppers about shipping, returns and sizing.
// ---------------------------------------------------------------------------
// The assistant is instructed to answer ONLY from this text and the live
// listings, and to never invent anything. Replace the [EDIT] placeholders with
// your real policy wording (keep it short and factual). You can add or remove
// lines freely — just keep the SHIPPING / RETURNS / SIZING / GENERAL headings
// so it stays easy to read.
//
// This file is SERVER-SIDE ONLY — it never ships to the browser, and the leading
// underscore in the filename keeps Vercel from exposing it as an API endpoint.

module.exports.STORE_POLICIES = `
SHIPPING
- [EDIT] UK delivery is typically 3–5 working days after an order is confirmed.
- [EDIT] Sellers post items directly; tracked postage is used wherever possible.
- [EDIT] We currently ship within the UK only.

RETURNS
- [EDIT] You have 5 days from delivery to report a problem (item not as described, damaged, or not received).
- [EDIT] Buyer Protection covers eligible orders — the team reviews each case individually.
- [EDIT] To start a return or report an issue, leave your email and the team will help.

SIZING
- [EDIT] Most listings include real garment measurements (bust, waist, length) — check these against a garment you already own.
- [EDIT] Sizes are as provided by the seller; if a size isn't listed, ask and we'll check with the seller.
- [EDIT] If you're between sizes, the measurements are the most reliable guide.

SELLING
- Anyone with a Stitch'd account can sell. Tap "List it" (or "List your piece"), add clear photos, the garment's measurements, the condition and your price.
- Selling is free — there is no seller commission. Buyers pay a small Buyer Protection fee at checkout.
- Your payment is held securely and released to you once the buyer confirms the item arrived as described.

BECOMING A TAILOR
- Stitch'd has approved tailors who offer alterations. To apply, open your account menu and tap "Become a tailor", then complete the short application.
- The team reviews each application and aims to respond within about 3 working days. If approved, your tailor profile goes live and you can offer alterations and set your availability.
- If an application isn't approved this time, you can reapply 30 days after applying.

GENERAL
- Stitch'd is a UK marketplace for pre-loved South Asian fashion (sarees, lehengas, sherwanis, salwar kameez and more).
- [EDIT] For anything about a specific order, payment, refund or dispute, the team will follow up personally.
- [EDIT] Contact: hello@stitchd.fit
`;
