import React from "react";
import { Instagram } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Global site footer — appears at the bottom of every page (rendered
 * once in App.js, below the page content).
 *
 * Editorial layout: oversized wordmark + tagline + socials on the left,
 * link columns on the right, then a legal bar. Navigation goes through
 * onNav(viewKey) (App maps each key to the right view + loaders); items
 * with an `href` (Contact / socials) are plain links.
 * ------------------------------------------------------------------ */

const BC = "'Barlow Condensed',sans-serif";
const PINK = "#FF1493";

const COLUMNS = [
  {
    title: "SHOP",
    items: [
      { label: "Browse all", view: "shop" },
      { label: "New arrivals", view: "newarrivals" },
      { label: "Find a tailor", view: "tailors" },
    ],
  },
  {
    title: "SELL",
    items: [
      { label: "Sell an item", view: "sell" },
      { label: "How to measure", view: "measuring" },
    ],
  },
  {
    title: "HELP",
    items: [
      { label: "T&Cs", view: "terms" },
      { label: "Privacy policy", view: "privacy" },
      { label: "Returns policy", view: "returns" },
      { label: "Contact", href: "mailto:hello@stitchd.fit" },
    ],
  },
];

export default function Footer({ onNav = () => {} }) {
  const FootLink = ({ item }) =>
    item.href ? (
      <a href={item.href} className="footer-link" style={S.link}>{item.label}</a>
    ) : (
      <button type="button" className="footer-link" style={S.link} onClick={() => onNav(item.view)}>{item.label}</button>
    );

  return (
    <footer style={S.footer}>
      <div style={S.inner}>
        <div style={S.top}>
          {/* LEFT — brand */}
          <div style={S.brand}>
            <span style={S.wordmark}>STITCH'D</span>
            <p style={S.tagline}>The UK marketplace for pre-loved South Asian fashion. Real measurements, measured fits only.</p>
            <div style={S.socials}>
              <a href="https://instagram.com/stitchd_fit" target="_blank" rel="noreferrer" aria-label="Instagram" className="footer-social" style={S.social}><Instagram width={18} height={18} /></a>
              <a href="https://instagram.com/stitchd_fit" target="_blank" rel="noreferrer" className="footer-social" style={S.socialText}>@STITCHD_FIT</a>
            </div>
          </div>

          {/* RIGHT — link columns */}
          <div style={S.cols}>
            {COLUMNS.map((c) => (
              <div key={c.title} style={S.col}>
                <p style={S.colTitle}>{c.title}</p>
                {c.items.map((it) => <FootLink key={it.label} item={it} />)}
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div style={S.bar}>
          <span style={S.copy}>© 2026 STITCH'D · Registered in the UK</span>
          <span style={S.barLinks}>
            <button type="button" className="footer-link" style={S.barLink} onClick={() => onNav("terms")}>T&Cs</button>
            <span style={S.dot}>·</span>
            <button type="button" className="footer-link" style={S.barLink} onClick={() => onNav("privacy")}>Privacy</button>
            <span style={S.dot}>·</span>
            <button type="button" className="footer-link" style={S.barLink} onClick={() => onNav("returns")}>Returns</button>
          </span>
        </div>
      </div>
    </footer>
  );
}

const S = {
  footer: { background: "#111", borderTop: `3px solid ${PINK}`, borderRadius: 0, padding: "48px 22px 28px", marginTop: 64 },
  inner: { maxWidth: 1200, margin: "0 auto" },
  top: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 36, paddingBottom: 32, borderBottom: "1px solid #333" },
  brand: { maxWidth: 360, minWidth: 240, flex: "1 1 280px" },
  wordmark: { fontFamily: BC, fontSize: 40, fontWeight: 900, letterSpacing: 1, color: "#fff", lineHeight: 1, display: "block" },
  tagline: { fontFamily: "'Barlow',sans-serif", fontSize: 14, color: "#999", lineHeight: 1.6, margin: "14px 0 18px" },
  socials: { display: "flex", alignItems: "center", gap: 14 },
  social: { width: 38, height: 38, border: "2px solid #444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", borderRadius: 0 },
  socialText: { fontFamily: BC, fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#fff", textDecoration: "none", border: "2px solid #444", padding: "0 14px", height: 38, display: "inline-flex", alignItems: "center" },
  cols: { display: "flex", gap: 48, flexWrap: "wrap" },
  col: { display: "flex", flexDirection: "column", gap: 11, minWidth: 110 },
  colTitle: { fontFamily: BC, fontSize: 12, fontWeight: 900, letterSpacing: 2.5, color: PINK, margin: "0 0 4px" },
  link: { background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: BC, fontSize: 15, fontWeight: 600, letterSpacing: 0.5, color: "#ddd", textDecoration: "none" },
  bar: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, paddingTop: 22 },
  copy: { fontFamily: BC, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#777" },
  barLinks: { display: "inline-flex", alignItems: "center", gap: 8 },
  barLink: { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: BC, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#777" },
  dot: { color: "#555" },
};
