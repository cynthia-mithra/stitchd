import React from "react";
import { S } from "../styles";

const PINK = "#FF1493";

// Body copy swaps per context — the action the logged-out buyer just tried.
// Anything unmapped falls back to the friendly default.
const BODY = {
  message: "Create a free account to message sellers and tailors on Stitch'd.",
  offer: "Create a free account to make offers on listings.",
  wishlist: "Create a free account to save listings to your wishlist.",
  review: "Create a free account to leave reviews on Stitch'd.",
  comment: "Create a free account to ask questions on listings.",
  follow: "Create a free account to follow sellers and tailors.",
  book: "Create a free account to book alterations and connect with our vetted South Asian fashion tailors.",
  listing: "Create a free account to browse listings, buy pre-loved South Asian fashion, and sell your own pieces.",
  default: "Create a free account to get the most out of Stitch'd.",
};

// Heading also swaps per context. Tapping a listing card while logged out gets a
// listings-specific headline; everything else keeps the generic JOIN STITCH'D.
const HEADING = {
  listing: "JOIN STITCH'D TO VIEW LISTINGS",
  book: "JOIN STITCH'D TO BOOK A TAILOR",
  default: "JOIN STITCH'D",
};

// One reusable sign-up gate, used everywhere a logged-out buyer taps an action
// that needs an account (message, offer, wishlist, follow, book, comment, like,
// save search…). It's never an error — always this friendly prompt. SIGN UP and
// LOG IN both call onAuth(mode), which routes to /auth and (via App) returns the
// user to the same page once they're in. CANCEL just closes.
// Design system: Barlow Condensed, #FF1493 pink, #111 2px borders, no radius.
export default function LoginPromptModal({ open, context = "default", onAuth = () => {}, onClose = () => {} }) {
  if (!open) return null;
  const body = BODY[context] || BODY.default;
  const heading = HEADING[context] || HEADING.default;
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", border: "3px solid #111", borderRadius: 0, maxWidth: 420, width: "100%", padding: 32, textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.05, marginBottom: 14 }}>{heading}</h2>
        <p style={{ fontSize: 15, color: "#444", lineHeight: 1.6, marginBottom: 24 }}>{body}</p>
        <button className="hbtn"
          style={{ width: "100%", background: PINK, color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "15px 24px", fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 3, cursor: "pointer", marginBottom: 18 }}
          onClick={() => onAuth("signup")}>
          SIGN UP
        </button>
        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#666", letterSpacing: 0.5, marginBottom: 18 }}>
          Already have an account?{" "}
          <button onClick={() => onAuth("login")}
            style={{ background: "none", border: "none", padding: 0, color: "#111", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, letterSpacing: 1, textDecoration: "underline", cursor: "pointer" }}>LOG IN</button>
        </p>
        <button onClick={onClose}
          style={{ background: "none", border: "none", padding: 0, color: "#999", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, cursor: "pointer" }}>CANCEL</button>
      </div>
    </div>
  );
}
