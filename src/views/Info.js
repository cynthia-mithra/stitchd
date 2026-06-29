import React from "react";
import { Leaf, Recycle, Sparkles, Camera, Video, Ruler, Tag, MessageCircle, Share2, PoundSterling, Heart, ShieldCheck } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Static content pages — Selling Tips (/selling-tips) and About &
 * Sustainability (/about). Hardcoded (no CMS); a single component renders
 * whichever page matches the current `view`. The global Footer is rendered
 * once in App.js so it sits below this (and every other) page.
 * ------------------------------------------------------------------ */

const BC = "'Barlow Condensed',sans-serif";
const PINK = "#FF1493";
const TEAL = "#00E5CC";

// Selling tips — each a numbered card with an icon, headline and body.
const TIPS = [
  { Icon: Camera, title: "Nail your photos", body: "Shoot in natural daylight against a plain background. Show the full piece, then close-ups of the embroidery, fabric and any flaws. Your first photo is your shop window — make it count." },
  { Icon: Video, title: "Add a short video", body: "A 3–30 second clip showing the drape, sheen and movement sells far better than stills alone — especially for silks, sequins and flowy fabrics. It plays right inside your listing's gallery." },
  { Icon: Ruler, title: "Give real measurements", body: "Buyers can't try it on, so accurate bust, waist, hips and length (in cm or inches) build trust and dramatically cut returns. Note if it can be taken in or has spare fabric to let out." },
  { Icon: ShieldCheck, title: "Be honest about condition", body: "Mention any marks, missing beads, loose threads or past alterations. Honesty earns great reviews and repeat buyers — and protects you if there's ever a dispute." },
  { Icon: Tag, title: "Price it to sell", body: "Check what similar pieces have sold for (the pricing guide on the listing form helps). Competitive prices move faster — and you can always switch on offers and set a minimum you'll accept." },
  { Icon: Sparkles, title: "Tag everything", body: "Add the occasion, colours and brand. These power search and saved-search alerts, putting your piece in front of buyers who are looking for exactly that — and earn you the badges that build trust." },
  { Icon: MessageCircle, title: "Reply quickly", body: "Momentum closes sales. Answer questions and offers fast — responsive sellers convert more and earn the FAST SELLER badge that buyers look for." },
  { Icon: Share2, title: "Share your listing", body: "Tap Share to post a branded card to Instagram or WhatsApp. Your own network is your best marketing — a single share can be the difference between sitting and selling." },
  { Icon: PoundSterling, title: "Bundle and bargain", body: "Offer bundle discounts to encourage multi-buys, and welcome offers from keen buyers. A small discount on two pieces often beats waiting weeks for full price on one." },
];

// About page — story, a sustainability callout, and a short "how it works".
const ABOUT = {
  title: "ABOUT\nSTITCH'D",
  lead: "Stitch'd is the UK marketplace for pre-loved South Asian fashion — sarees, lehengas, sherwanis, salwar kameez and more, given a second life with real measurements, verified sellers and buyer protection.",
  sections: [
    {
      heading: "Our story",
      body: "South Asian occasionwear is some of the most beautiful — and most expensive — clothing in the world. Yet so much of it is worn once for a wedding or Eid, then sits in a wardrobe for years. Stitch'd was built for our community to buy, sell and restyle these pieces, so a lehenga that lit up one celebration can light up the next.",
    },
  ],
};

// Sustainability points shown as cards on the About page.
const SUSTAIN = [
  { Icon: Recycle, title: "Circular by design", body: "Every piece resold on Stitch'd is one less made from scratch and one less in landfill. Re-wearing is the most sustainable wardrobe there is." },
  { Icon: Leaf, title: "Less waste, more wear", body: "Heavily embellished South Asian outfits are resource-intensive to produce. Keeping them in circulation honours that craftsmanship instead of wasting it." },
  { Icon: Heart, title: "A conscious wardrobe", body: "Shopping pre-loved first means fewer impulse buys, slower fashion and a closet with a story. Looking incredible and treading lightly aren't a trade-off." },
];

const PAGES = {
  "selling-tips": { kind: "tips" },
  "about": { kind: "about" },
};

export const INFO_VIEWS = Object.keys(PAGES);

export default function Info({ view, setView, onBack }) {
  const page = PAGES[view];
  if (!page) return null;
  const goBack = onBack || (() => setView("shop"));

  return (
    <main style={st.main}>
      <button style={st.back} onClick={goBack}>← BACK</button>

      {page.kind === "tips" ? (
        <>
          <h1 style={st.title}>SELL<br /><span style={{ color: PINK }}>SMARTER.</span></h1>
          <p style={st.lead}>Pieces with great photos, real measurements and a fair price sell fastest. Here's how to give yours the best shot at finding a new home.</p>
          <div style={st.tipGrid}>
            {TIPS.map(({ Icon, title, body }, i) => (
              <div key={title} style={st.tipCard}>
                <div style={st.tipHead}>
                  <span style={st.tipNum}>{i + 1}</span>
                  <span style={st.tipChip}><Icon width={16} height={16} /></span>
                  <span style={st.tipTitle}>{title}</span>
                </div>
                <p style={st.tipBody}>{body}</p>
              </div>
            ))}
          </div>
          <div style={st.cta}>
            <p style={st.ctaText}>Ready to list?</p>
            <button style={st.ctaBtn} onClick={() => setView("add")}>SELL AN ITEM →</button>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ ...st.title, whiteSpace: "pre-line" }}>{ABOUT.title}</h1>
          <p style={st.lead}>{ABOUT.lead}</p>
          {ABOUT.sections.map((s) => (
            <section key={s.heading} style={st.section}>
              <h2 style={st.heading}>{s.heading}</h2>
              <p style={st.body}>{s.body}</p>
            </section>
          ))}

          {/* SUSTAINABILITY */}
          <div style={st.sustainHeadRow}>
            <span style={st.sustainChip}><Leaf width={18} height={18} /></span>
            <h2 style={st.sustainTitle}>FASHION WITH A CONSCIENCE</h2>
          </div>
          <p style={st.body}>Buying and selling pre-loved isn't just kinder on your wallet — it's kinder on the planet.</p>
          <div style={st.sustainGrid}>
            {SUSTAIN.map(({ Icon, title, body }) => (
              <div key={title} style={st.sustainCard}>
                <span style={st.sustainCardChip}><Icon width={18} height={18} /></span>
                <p style={st.sustainCardTitle}>{title}</p>
                <p style={st.sustainCardBody}>{body}</p>
              </div>
            ))}
          </div>

          <div style={st.cta}>
            <p style={st.ctaText}>Give a piece its next chapter.</p>
            <button style={st.ctaBtn} onClick={() => setView("shop")}>START BROWSING →</button>
          </div>
        </>
      )}
    </main>
  );
}

const st = {
  main: { maxWidth: 860, margin: "0 auto", padding: "32px 20px 48px", background: "#fff" },
  back: { background: "none", border: "none", color: "#6b6b6b", fontSize: 12, cursor: "pointer", marginBottom: 28, padding: 0, fontWeight: 800, letterSpacing: 2, fontFamily: BC, textTransform: "uppercase" },
  title: { fontFamily: BC, fontSize: "clamp(40px,9vw,64px)", fontWeight: 900, letterSpacing: -1, color: "#111", lineHeight: 0.95, marginBottom: 18 },
  lead: { fontFamily: "'Barlow',sans-serif", fontSize: 17, fontWeight: 400, color: "#333", lineHeight: 1.6, marginBottom: 32, maxWidth: 680 },
  // Tips
  tipGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 },
  tipCard: { border: "2px solid #ececec", padding: "20px 22px" },
  tipHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  tipNum: { fontFamily: BC, fontSize: 18, fontWeight: 900, color: PINK, lineHeight: 1, minWidth: 18 },
  tipChip: { width: 30, height: 30, background: "#111", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipTitle: { fontFamily: BC, fontSize: 18, fontWeight: 900, letterSpacing: 0.3, color: "#111" },
  tipBody: { fontFamily: "'Barlow',sans-serif", fontSize: 14.5, color: "#444", lineHeight: 1.6, margin: 0 },
  // About
  section: { marginBottom: 28 },
  heading: { fontFamily: BC, fontSize: 24, fontWeight: 900, letterSpacing: 0.5, color: PINK, marginBottom: 8 },
  body: { fontFamily: "'Barlow',sans-serif", fontSize: 15.5, fontWeight: 400, color: "#222", lineHeight: 1.7, marginBottom: 16 },
  sustainHeadRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 40, marginBottom: 12 },
  sustainChip: { width: 38, height: 38, background: TEAL, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sustainTitle: { fontFamily: BC, fontSize: 26, fontWeight: 900, letterSpacing: 0.5, color: "#111", margin: 0 },
  sustainGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, marginTop: 8 },
  sustainCard: { border: "2px solid #111", borderTop: `5px solid ${TEAL}`, padding: "20px 22px" },
  sustainCardChip: { width: 36, height: 36, border: "2px solid #111", color: "#111", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  sustainCardTitle: { fontFamily: BC, fontSize: 18, fontWeight: 900, letterSpacing: 0.3, color: "#111", margin: "0 0 6px" },
  sustainCardBody: { fontFamily: "'Barlow',sans-serif", fontSize: 14, color: "#444", lineHeight: 1.6, margin: 0 },
  // CTA
  cta: { marginTop: 44, paddingTop: 28, borderTop: "2px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  ctaText: { fontFamily: BC, fontSize: 22, fontWeight: 900, letterSpacing: 0.5, color: "#111", margin: 0 },
  ctaBtn: { fontFamily: BC, fontSize: 16, fontWeight: 800, letterSpacing: 2, color: "#fff", background: PINK, border: "none", padding: "14px 26px", cursor: "pointer" },
};
