# Stitch'd — App Store Listing Pack

Everything to paste/answer when creating the App Store listing. Pair this with
`MAC_SETUP.md` (the build). Nothing here needs a Mac.

---

## 1. Listing text

**Name** (≤30 chars): `Stitch'd`
**Subtitle** (≤30): `Preloved South Asian fashion`

**Promotional text** (≤170, editable anytime):
> Buy and sell preloved lehengas, sarees, salwar suits and more. Loved pieces, new owners — with buyer protection built in.

**Keywords** (≤100, comma-separated):
> saree,lehenga,salwar,desi,indian,pakistani,asian,preloved,thrift,resell,bridal,kurta,fashion,vinted

**Description:**
> **Stitch'd — the home of preloved South Asian fashion.**
>
> Give your worn-once lehengas, sarees and salwar suits a second life — or find a stunning piece for a fraction of the retail price. Stitch'd is the marketplace made for desi wardrobes.
>
> **Why you'll love it**
> • Buy & sell preloved South Asian clothing, shoes and jewellery
> • Sellers list for free — no commission
> • Buyer Protection on every order, so you can shop with confidence
> • Secure checkout and in-app messaging with sellers
> • Make offers, build bundles, and follow your favourite sellers
> • Need alterations? Book a trusted tailor right in the app
>
> **Selling is simple**
> Snap a few photos, set your price, and post. When it sells, we guide you through postage and pay out safely to your wallet.
>
> **Shop with confidence**
> Every purchase is covered by Buyer Protection. Your payment is held securely and only released once you've confirmed your item arrived as described.
>
> From bridal lehengas to everyday kurtas, Stitch'd helps beautiful pieces find new homes — and helps you earn from the ones sitting in your wardrobe.
>
> Join the Stitch'd community today.

**What's New (v1):**
> Welcome to Stitch'd! Our very first release — buy and sell preloved South Asian fashion with buyer protection built in. We'd love your feedback.

**Category:** Primary **Shopping** · Secondary **Lifestyle**
**Support URL:** https://stitchd.fit/support
**Privacy Policy URL:** https://stitchd.fit/privacy
**Marketing URL (optional):** https://stitchd.fit

---

## 2. Screenshots plan

**What Apple needs:** at least one set for a **6.7"/6.9" iPhone** (1290 × 2796 px,
portrait). That set alone is accepted for all iPhone sizes. Provide 3–6 shots.

> Tip: capture these in the TestFlight build or the Simulator once the app is up,
> then (optionally) add a coloured caption bar on top. Claude can frame them.

**Shot list (in order):**
1. **Home / shop grid** — caption: *"Preloved South Asian fashion, curated"*
2. **Listing detail** (a lehenga/saree with measurements) — *"Real measurements, honest condition"*
3. **Sell flow** (add-listing screen) — *"List in minutes. Sell for free."*
4. **Messages / make an offer** — *"Chat and make offers"*
5. **Checkout / order confirmed** — *"Buyer Protection on every order"*
6. *(optional)* **Seller storefront or wishlist** — *"Follow your favourite sellers"*

**iPad:** the app currently allows iPad. To skip iPad screenshots for v1, we can
set the target to iPhone-only before building — tell Claude if you'd prefer that.

---

## 3. App Privacy ("nutrition labels")

Apple asks what data the app collects. Good news: Stitch'd runs **no ad or
tracking SDKs**, so the honest answer to *"used to track you"* is **No** for
everything — the simplest, most trustworthy label.

For each type below: **Linked to the user = Yes**, **Used for tracking = No**,
**Purpose = App Functionality** (unless noted).

| Data type | Collected? | Notes |
|---|---|---|
| **Contact Info — Email address** | Yes | Account sign-in |
| **Contact Info — Name** | Yes | Username / display name |
| **Contact Info — Physical Address** | Yes | Delivery address (collected by Stripe at checkout) |
| **User Content — Photos** | Yes | Listing & style-feed images |
| **User Content — Other (messages)** | Yes | Buyer–seller messages |
| **Identifiers — User ID** | Yes | Account identifier |
| **Identifiers — Device ID** | Yes | Push-notification token (App Functionality) |
| **Purchases — Purchase history** | Yes | Orders placed/sold |
| **Usage Data — Product interaction** | Yes | "Recently viewed" / recommendations (App Functionality + Analytics) |

**Financial info (cards):** handled entirely by **Stripe** on their hosted
checkout — the app never sees or stores card numbers, so you do **not** declare
card data as collected by the app.

**Not collected:** precise location, health, contacts, browsing history,
search history across other apps, sensitive info.

**Tracking:** **No** — the app does not track users across other companies'
apps or websites.

---

## 4. Age rating (questionnaire)

The app has user-generated content (listings, messages), but also **moderation
tools** (report + block), which Apple expects for UGC apps. Likely outcome
**12+** (Depop/Vinted are 12+). Answer the questionnaire honestly:
- Unrestricted web access: **No**
- User-generated content: **Yes** — and confirm you have filtering/reporting/
  blocking (you do: report a listing/user + block users are built in).
- Everything else (violence, mature themes, gambling…): **None**.

---

## 5. App Review notes (important — avoids rejection)

Most of the app is behind sign-in, so the reviewer needs a **demo account**.
In App Store Connect → your version → **App Review Information**:
- Provide a **test email + password** for a real account with a listing or two.
- **Notes:** *"Sign in with the demo account, or use email sign-up. Payments use
  Stripe for physical goods only (no digital content), so no in-app purchase is
  used; you can reach checkout without completing payment. Sign in with Apple is
  supported."*
- Sign-in required: **Yes** (attach the demo credentials).

### 5a. Demo account setup checklist (do before submitting)
The goal: when the reviewer signs in, the app looks alive and complete — not an
empty account. Set this up on the **live** app:

- [ ] **Create a dedicated account** with an email you control (e.g.
      `review@stitchd.fit` or a spare Gmail) and a simple password. Write both
      down for the review notes.
- [ ] **Do NOT turn on 2FA** for this account (the reviewer can't pass it).
- [ ] **Complete the profile** — username, profile photo, short bio. A finished
      profile makes the app feel real.
- [ ] **Post 2–3 active listings** from this account with good photos, real
      measurements, prices and categories (e.g. a lehenga, a saree, a kurta) so
      the seller side and dashboard aren't empty.
- [ ] **Check the wider shop looks populated** — several live listings so
      browsing feels active (your real listings likely cover this).
- [ ] *(Nice to have)* add one item to the **wishlist** and **follow** a seller,
      so those tabs aren't empty when the reviewer looks.
- [ ] Paste the email + password into **App Review Information** and add the
      notes above.

> Why a seller account: it lets the one demo login show BOTH sides — browsing/
> buying AND listing/selling/dashboard — so the reviewer sees the full app.

---

## 6. Quick submission order
1. Create the app record (bundle `fit.stitchd.app`).
2. Paste sections 1 here into the listing.
3. Add screenshots (section 2).
4. Answer App Privacy (section 3) + Age rating (section 4).
5. Add review notes + demo account (section 5).
6. Build via Codemagic (MAC_SETUP.md → C), attach the build, **Submit for Review**.
