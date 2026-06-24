import React from "react";

/* ------------------------------------------------------------------ *
 * Custom 404 — shown when a cold load / shared link hits a path the
 * app doesn't recognise (App.js sets view="notfound" via isKnownPath).
 * On-brand: oversized 404 in the brand palette, a bit of attitude, and
 * two clear ways back into the shop.
 * ------------------------------------------------------------------ */

export default function NotFound({ view, onHome = () => {}, onBrowse = () => {} }) {
  if (view !== "notfound") return null;
  return (
    <div style={S.wrap}>
      <p style={S.tag}>ERROR 404</p>
      <h1 style={S.code}>
        <span style={S.d1}>4</span>
        <span style={S.d2}>0</span>
        <span style={S.d3}>4</span>
      </h1>
      <p style={S.head}>THIS PAGE WENT OUT OF STYLE.</p>
      <p style={S.sub}>The link's broken or the piece has moved on — let's get you back to the good stuff.</p>
      <div style={S.ctas}>
        <button className="hbtn" style={S.primary} onClick={onHome}>BACK TO SHOP <span className="btn-arrow">→</span></button>
        <button className="hbtn" style={S.secondary} onClick={onBrowse}>NEW ARRIVALS ↓</button>
      </div>
    </div>
  );
}

const BC = "'Barlow Condensed',sans-serif";
const S = {
  wrap: { minHeight: "72vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "64px 24px" },
  tag: { fontFamily: BC, fontSize: 13, fontWeight: 800, letterSpacing: 3.5, color: "#FF1493", margin: "0 0 8px" },
  code: { fontFamily: BC, fontWeight: 900, fontSize: "clamp(96px,22vw,220px)", lineHeight: 0.85, letterSpacing: -4, margin: 0, display: "flex" },
  d1: { color: "#111" },
  d2: { color: "#FF1493" },
  d3: { color: "#fff", WebkitTextStroke: "3px #111" },
  head: { fontFamily: BC, fontSize: "clamp(26px,5vw,44px)", fontWeight: 900, letterSpacing: -1, color: "#111", margin: "24px 0 8px" },
  sub: { fontFamily: "'Barlow',sans-serif", fontSize: 16, color: "#6b6b6b", lineHeight: 1.6, maxWidth: 420, margin: "0 0 28px" },
  ctas: { display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" },
  primary: { background: "#FF1493", color: "#fff", border: "2px solid #FF1493", borderRadius: 0, padding: "14px 30px", fontFamily: BC, fontWeight: 800, letterSpacing: 2, fontSize: 14, cursor: "pointer" },
  secondary: { background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, padding: "14px 30px", fontFamily: BC, fontWeight: 800, letterSpacing: 2, fontSize: 14, cursor: "pointer" },
};
