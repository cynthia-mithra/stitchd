import React from "react";
import { X, Search, ShieldCheck, Tag } from "lucide-react";
import { S } from "../styles";

// First-run welcome — shown once to a new visitor (gated by localStorage in App).
// A short "how Stitch'd works" with two CTAs: browse, or list a piece. Dismissible
// by the X, the backdrop, or either CTA.
export default function Onboarding({ show, onClose, onBrowse, onSell }) {
  if (!show) return null;
  const steps = [
    { Icon: Search,      title: "DISCOVER",    body: "Browse pre-loved South Asian fashion — every piece listed with real measurements." },
    { Icon: ShieldCheck, title: "BUY SAFELY",  body: "Buyer Protection on every order, with tracked UK delivery from the seller." },
    { Icon: Tag,         title: "SELL FREE",   body: "List your own pieces for free — set a price, add photos, and you're live." },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...S.modalBox, maxWidth: 540, padding: 0, overflow: "hidden", position: "relative" }}>
        <button aria-label="Close" onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}><X width={18} height={18} /></button>

        {/* Header band */}
        <div style={{ background: "#FF1493", color: "#fff", padding: "26px 28px 22px", borderBottom: "3px solid #111" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 4, opacity: 0.92, margin: 0 }}>THE MARKETPLACE FOR DESI FITS</p>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 38, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1, margin: "6px 0 0" }}>WELCOME TO STITCH'D</h2>
        </div>

        {/* Steps */}
        <div style={{ padding: "22px 28px 6px" }}>
          {steps.map(({ Icon, title, body }, i) => (
            <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: i < steps.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <span style={{ flexShrink: 0, width: 44, height: 44, border: "2px solid #111", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF1493" }}><Icon width={20} height={20} /></span>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: 1, margin: 0, color: "#111" }}>{title}</p>
                <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 13.5, color: "#555", lineHeight: 1.5, margin: "3px 0 0" }}>{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 12, padding: "16px 28px 26px", flexWrap: "wrap" }}>
          <button className="hbtn" onClick={onBrowse} style={{ ...S.heroBtnPrimary, flex: "1 1 180px", padding: "14px 20px", fontSize: 14 }}>BROWSE DROPS <span className="btn-arrow">→</span></button>
          <button className="hbtn" onClick={onSell} style={{ ...S.heroBtnSecondary, flex: "1 1 140px", padding: "14px 20px", fontSize: 14 }}>LIST A PIECE</button>
        </div>
      </div>
    </div>
  );
}
