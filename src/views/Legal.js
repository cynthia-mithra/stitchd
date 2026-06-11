import React from "react";
import { S } from "../styles";

/* ------------------------------------------------------------------ *
 * LEGAL PAGES — Terms & Conditions (/terms), Privacy Policy (/privacy)
 * and Returns Policy (/returns). Content is hardcoded (required by UK
 * law and by Stripe before live payments can be accepted).
 *
 * One component renders whichever page matches `view`; the footer links
 * (see components/Footer.js) drive `view` + the URL. Sections share a
 * single layout so all three pages read consistently.
 * ------------------------------------------------------------------ */

const BC = "'Barlow Condensed',sans-serif";
const PINK = "#FF1493";

// Each page is { eyebrow, title (rendered with a pink second line), updated,
// intro?, sections:[{heading, body | bullets}] }.
const PAGES = {
  terms: {
    eyebrow: "THE LEGAL BIT",
    title: ["TERMS &", "CONDITIONS."],
    updated: "June 2026",
    sections: [
      { heading: "1. About Stitch'd", body: "Stitch'd is an online marketplace that allows individuals to buy and sell pre-loved South Asian fashion. Stitch'd acts as a platform only and is not a party to any transaction between buyers and sellers." },
      { heading: "2. Your Account", body: "You must be 18 or over to use Stitch'd. You are responsible for keeping your account credentials secure. You must provide accurate information when creating an account." },
      { heading: "3. Selling on Stitch'd", body: "Sellers are responsible for the accuracy of their listings including measurements, condition, and photographs. All items must be genuine and as described. Stitch'd reserves the right to remove any listing that violates these terms." },
      { heading: "4. Buying on Stitch'd", body: "All sales are between the buyer and seller. Stitch'd facilitates payment via Stripe but is not responsible for the physical condition of items received. Buyers must report issues within 48 hours of delivery." },
      { heading: "5. Payments and Fees", body: "Payments are processed securely by Stripe. Stitch'd charges a commission on each sale. Sellers receive payment after the transaction is confirmed. Fees are displayed at listing creation." },
      { heading: "6. Returns and Refunds", body: "Please see our Returns Policy for full details. Items that are significantly not as described may be eligible for a refund at Stitch'd's discretion." },
      { heading: "7. Prohibited Items", body: "The following may not be listed on Stitch'd: counterfeit or replica items, items that infringe intellectual property rights, items that are illegal to sell in the UK." },
      { heading: "8. Limitation of Liability", body: "Stitch'd is not liable for any loss or damage arising from transactions between buyers and sellers. Our total liability to you shall not exceed the value of the transaction in question." },
      { heading: "9. Changes to These Terms", body: "Stitch'd reserves the right to update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms." },
      { heading: "10. Contact", body: "For any questions about these terms please contact us at hello@stitchd.fit" },
    ],
  },
  privacy: {
    eyebrow: "YOUR DATA, YOUR RIGHTS",
    title: ["PRIVACY", "POLICY."],
    updated: "June 2026",
    sections: [
      { heading: "1. Who We Are", body: "Stitch'd (stitchd.fit) is an online marketplace for pre-loved South Asian fashion, operated in the United Kingdom. We are the data controller responsible for your personal data." },
      { heading: "2. What Data We Collect", body: "We collect:", bullets: [
        "Name and email address when you create an account",
        "Listing information you provide as a seller",
        "Transaction and order details when you buy or sell",
        "Delivery address details you provide at checkout",
        "Messages you send to other users through the platform",
      ] },
      { heading: "3. How We Use Your Data", body: "We use your data to operate your account, process and facilitate transactions, enable buyers and sellers to communicate, send service notifications relating to your activity, and keep the platform safe and secure." },
      { heading: "4. Payment Data", body: "Payments are processed securely by Stripe. We do not store your full card details on our servers. Stripe processes your payment information in accordance with their own privacy policy and the PCI-DSS standards." },
      { heading: "5. Sharing Your Data", body: "We share only what is necessary to complete a transaction — for example, a buyer's delivery details are shared with the relevant seller to fulfil an order. We use Stripe to process payments and Supabase to host our data. We do not sell your personal data to third parties." },
      { heading: "6. Cookies", body: "We use essential cookies and local storage to keep you signed in and to remember your bag and wishlist. We do not use these for advertising." },
      { heading: "7. Data Retention", body: "We keep your personal data for as long as your account is active. You may request deletion of your account at any time, after which we retain only the records we are legally required to keep (such as transaction records)." },
      { heading: "8. Your Rights", body: "Under UK GDPR you have the right to access, correct, or delete your personal data, to object to or restrict its processing, and to request a copy of it. To exercise any of these rights, contact us at hello@stitchd.fit." },
      { heading: "9. Security", body: "We take reasonable technical and organisational measures to protect your data, including encrypted connections and secure authentication. No method of transmission over the internet is completely secure, but we work to keep your information safe." },
      { heading: "10. Contact", body: "For any questions about this policy or your data please contact us at hello@stitchd.fit" },
    ],
  },
  returns: {
    eyebrow: "PEACE OF MIND",
    title: ["RETURNS", "POLICY."],
    updated: "June 2026",
    sections: [
      { heading: "1. Overview", body: "Stitch'd is a marketplace for pre-loved items, so most sales are final. However, you are protected if an item arrives significantly not as described. This policy explains when a return or refund may be available." },
      { heading: "2. Significantly Not As Described", body: "An item is significantly not as described if it differs materially from the listing — for example, undisclosed damage, the wrong item, incorrect measurements, or a counterfeit item. Normal signs of wear consistent with a pre-loved item, or a change of mind, do not qualify." },
      { heading: "3. Report Within 48 Hours", body: "You must report any issue within 48 hours of delivery. Inspect your item as soon as it arrives and contact us promptly with photographs and a description of the problem so we can investigate." },
      { heading: "4. How to Request a Return", body: "Email hello@stitchd.fit with your order details, a clear description of the issue, and supporting photographs. We will review your request and may contact both the buyer and the seller before reaching a decision." },
      { heading: "5. Refunds", body: "Where a return is approved, refunds are issued to your original payment method via Stripe. Refunds that are approved are processed at Stitch'd's discretion and may require the item to be returned to the seller first." },
      { heading: "6. Return Postage", body: "Where an item is significantly not as described, return postage will be covered. If a return is for any other reason and is accepted as a goodwill gesture, the buyer is responsible for return postage costs." },
      { heading: "7. Items That Cannot Be Returned", body: "We cannot accept returns for change of mind, for items that match their description, or for issues reported more than 48 hours after delivery. Pierced jewellery and other hygiene-sensitive items may be non-returnable for health reasons." },
      { heading: "8. Contact", body: "For any questions about returns or refunds please contact us at hello@stitchd.fit" },
    ],
  },
};

function Section({ s }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <h2 style={{ fontFamily: BC, fontSize: 24, fontWeight: 900, letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase", color: "#111" }}>
        {s.heading}
      </h2>
      {s.body && (
        <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15.5, lineHeight: 1.6, color: "#333", marginBottom: s.bullets ? 12 : 0 }}>
          {s.body}
        </p>
      )}
      {s.bullets && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {s.bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
              <span style={{ color: PINK, fontSize: 16, fontWeight: 900, lineHeight: 1.5, flexShrink: 0 }}>■</span>
              <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15.5, lineHeight: 1.6, color: "#333" }}>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Legal({ view, setView }) {
  const page = PAGES[view];
  if (!page) return null;

  return (
    <main style={{ ...S.main, maxWidth: 820 }}>
      <button
        style={S.back}
        onClick={() => {
          window.history.pushState({}, "", "/");
          setView("shop");
        }}
      >
        ← BACK
      </button>

      <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: "3px solid #111" }}>
        <p style={{ fontFamily: BC, fontSize: 13, fontWeight: 700, letterSpacing: 4, color: PINK, marginBottom: 6 }}>{page.eyebrow}</p>
        <h1 style={{ fontFamily: BC, fontSize: "clamp(40px,8vw,56px)", fontWeight: 900, letterSpacing: -1, lineHeight: 1, marginBottom: 14 }}>
          {page.title[0]}<br /><span style={{ color: PINK }}>{page.title[1]}</span>
        </h1>
        <p style={{ fontFamily: BC, fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#999", textTransform: "uppercase" }}>
          Last updated: {page.updated}
        </p>
      </div>

      {page.intro && (
        <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 16, lineHeight: 1.6, color: "#333", marginBottom: 30 }}>{page.intro}</p>
      )}

      {page.sections.map((s, i) => <Section key={i} s={s} />)}

      <div style={{ marginTop: 12, paddingTop: 24, borderTop: "1px solid #eee" }}>
        <p style={{ fontFamily: BC, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#999", textTransform: "uppercase" }}>
          Stitch'd · Registered in the UK · hello@stitchd.fit
        </p>
      </div>
    </main>
  );
}
