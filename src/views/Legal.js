import React from "react";

/* ------------------------------------------------------------------ *
 * Legal pages — Terms & Conditions (/terms), Privacy Policy (/privacy)
 * and Returns Policy (/returns). Content is hardcoded (no CMS / DB) as
 * these are static legal documents required by UK law and by Stripe
 * before live payments can be accepted.
 *
 * A single component renders whichever page matches the current `view`
 * ("terms" | "privacy" | "returns"). The global Footer is rendered once
 * in App.js so it appears below this (and every other) page.
 * ------------------------------------------------------------------ */

const BC = "'Barlow Condensed',sans-serif";
const PINK = "#FF1493";

// Each page: a title + ordered list of {heading, body} sections, and the
// "last updated" date shown in small grey text at the foot of the page.
const PAGES = {
  terms: {
    title: "TERMS & CONDITIONS",
    updated: "June 2026",
    sections: [
      {
        heading: "1. About Stitch'd",
        body: "Stitch'd is an online marketplace that allows individuals to buy and sell pre-loved South Asian fashion. Stitch'd acts as a platform only and is not a party to any transaction between buyers and sellers.",
      },
      {
        heading: "2. Your Account",
        body: "You must be 18 or over to use Stitch'd. You are responsible for keeping your account credentials secure. You must provide accurate information when creating an account.",
      },
      {
        heading: "3. Selling on Stitch'd",
        body: "Sellers are responsible for the accuracy of their listings including measurements, condition, and photographs. All items must be genuine and as described. Stitch'd reserves the right to remove any listing that violates these terms.",
      },
      {
        heading: "4. Buying on Stitch'd",
        body: "All sales are between the buyer and seller. Stitch'd facilitates payment via Stripe but is not responsible for the physical condition of items received. Buyers must report issues within 5 days of delivery.",
      },
      {
        heading: "5. Payments and Fees",
        body: "Payments are processed securely by Stripe. Stitch'd charges a commission on each sale. Sellers receive payment after the transaction is confirmed. Fees are displayed at listing creation.",
      },
      {
        heading: "6. Returns and Refunds",
        body: "Please see our Returns Policy for full details. Items that are significantly not as described may be eligible for a refund at Stitch'd's discretion.",
      },
      {
        heading: "7. Prohibited Items",
        body: "The following may not be listed on Stitch'd: counterfeit or replica items, items that infringe intellectual property rights, items that are illegal to sell in the UK.",
      },
      {
        heading: "8. Limitation of Liability",
        body: "Stitch'd is not liable for any loss or damage arising from transactions between buyers and sellers. Our total liability to you shall not exceed the value of the transaction in question.",
      },
      {
        heading: "9. Changes to These Terms",
        body: "Stitch'd reserves the right to update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.",
      },
      {
        heading: "10. Contact",
        body: "For any questions about these terms please contact us at hello@stitchd.fit",
      },
    ],
  },
  privacy: {
    title: "PRIVACY POLICY",
    updated: "June 2026",
    sections: [
      {
        heading: "1. Who We Are",
        body: "Stitch'd (stitchd.fit) is an online marketplace for pre-loved South Asian fashion, operated in the United Kingdom.",
      },
      {
        heading: "2. What Data We Collect",
        body: "We collect: name and email address when you create an account, listing information you provide as a seller, transaction data processed by Stripe, usage data including pages visited and listings viewed.",
      },
      {
        heading: "3. How We Use Your Data",
        body: "We use your data to: operate your account and the marketplace, process payments via Stripe, send order and account notifications, improve the platform. We do not sell your data to third parties.",
      },
      {
        heading: "4. Stripe",
        body: "Payments are processed by Stripe. Stripe's privacy policy applies to payment data. We do not store card details.",
      },
      {
        heading: "5. Supabase",
        body: "Our platform is built on Supabase for database and authentication. Data is stored securely in the EU.",
      },
      {
        heading: "6. Your Rights (UK GDPR)",
        body: "You have the right to: access your personal data, correct inaccurate data, request deletion of your data, object to processing of your data. To exercise these rights contact hello@stitchd.fit",
      },
      {
        heading: "7. Cookies",
        body: "We use essential cookies only to keep you logged in and maintain your session. We do not use advertising or tracking cookies.",
      },
      {
        heading: "8. Contact",
        body: "For privacy queries contact hello@stitchd.fit",
      },
    ],
  },
  returns: {
    title: "RETURNS POLICY",
    updated: "June 2026",
    sections: [
      {
        heading: "1. Our Policy",
        body: "Stitch'd is a peer-to-peer marketplace. All sales are final unless an item is significantly not as described.",
      },
      {
        heading: "2. When You Can Request a Return",
        body: "You may be eligible for a return if: the item is significantly different from the listing description or photographs, the item has undisclosed damage or faults, you received the wrong item.",
      },
      {
        heading: "3. How to Request a Return",
        body: "Contact us within 5 days of receiving your item at hello@stitchd.fit with your order reference and photographs of the issue. We will review your case within 3 working days.",
      },
      {
        heading: "4. Refunds",
        body: "If a return is approved, a refund will be issued to your original payment method within 5-10 working days. Stitch'd reserves the right to make the final decision on all disputes.",
      },
      {
        heading: "5. Items Not Eligible for Return",
        body: "Items are not eligible for return if: you changed your mind, the item does not fit (please check measurements carefully before purchasing), the issue was disclosed in the listing.",
      },
      {
        heading: "6. Contact",
        body: "hello@stitchd.fit",
      },
    ],
  },
};

// Which view names this component owns.
export const LEGAL_VIEWS = Object.keys(PAGES);

export default function Legal({ view, setView, onBack }) {
  const page = PAGES[view];
  if (!page) return null;

  const goBack = onBack || (() => setView("shop"));

  return (
    <main style={st.main}>
      <button style={st.back} onClick={goBack}>← BACK</button>

      <h1 style={st.title}>{page.title}</h1>

      {page.sections.map((s) => (
        <section key={s.heading} style={st.section}>
          <h2 style={st.heading}>{s.heading}</h2>
          <p style={st.body}>{s.body}</p>
        </section>
      ))}

      <p style={st.updated}>Last updated: {page.updated}</p>
    </main>
  );
}

const st = {
  // White background, max 800px, centred.
  main: { maxWidth: 800, margin: "0 auto", padding: "32px 20px 48px", background: "#fff" },
  back: {
    background: "none",
    border: "none",
    color: "#6b6b6b",
    fontSize: 12,
    cursor: "pointer",
    marginBottom: 28,
    padding: 0,
    fontWeight: 800,
    letterSpacing: 2,
    fontFamily: BC,
    textTransform: "uppercase",
  },
  // Large Barlow Condensed bold #111, with a 2px #111 bottom border.
  title: {
    fontFamily: BC,
    fontSize: "clamp(36px,8vw,56px)",
    fontWeight: 900,
    letterSpacing: -1,
    color: "#111",
    lineHeight: 1,
    paddingBottom: 20,
    marginBottom: 32,
    borderBottom: "2px solid #111",
  },
  section: { marginBottom: 28 },
  // Section headings in Barlow Condensed bold #FF1493.
  heading: {
    fontFamily: BC,
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: 0.5,
    color: PINK,
    marginBottom: 8,
  },
  // Body text in regular weight, readable size (15px).
  body: { fontFamily: "'Barlow',sans-serif", fontSize: 15, fontWeight: 400, color: "#222", lineHeight: 1.7 },
  // Last updated date in small grey text.
  updated: {
    fontFamily: BC,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 1,
    color: "#6b6b6b",
    marginTop: 40,
    paddingTop: 20,
    borderTop: "1px solid #eee",
  },
};
