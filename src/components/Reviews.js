import React from "react";
import { Star, Scissors, X } from "lucide-react";
import { Stars } from "./Shared";

const PINK = "#FF1493";
const INK  = "#111";

// "3 days ago" / "just now" — relative time for review timestamps. Falls back to
// an empty string on an unparseable date.
export function timeAgo(d) {
  try {
    const then = new Date(d).getTime();
    if (isNaN(then)) return "";
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  } catch { return ""; }
}

// Buyer's first name from a resolved profile (full_name → first token, else
// username, else a neutral fallback).
const firstName = (prof) => {
  if (!prof) return "A buyer";
  const fn = (prof.full_name || "").trim();
  if (fn) return fn.split(/\s+/)[0];
  return prof.username || "A buyer";
};

// ════════════════════════════ LEAVE A REVIEW MODAL ════════════════════════════
// Shown when a buyer reviews a tailor after a completed booking (Part 2). A tap-
// to-select 5-star rating + optional comment. SUBMIT is disabled until a rating
// is chosen; SKIP FOR NOW closes without reviewing.
export function ReviewModal({ open, onClose, tailor, busy = false, onSubmit = () => {} }) {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover]   = React.useState(0);
  const [comment, setComment] = React.useState("");

  // Reset each time the modal (re)opens.
  React.useEffect(() => { if (open) { setRating(0); setHover(0); setComment(""); } }, [open]);

  if (!open) return null;
  const name = (tailor && tailor.display_name) || "your tailor";
  const shown = hover || rating;

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, lineHeight: 1.05, textTransform: "uppercase" }}>
            HOW WAS {name}?
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: INK, flexShrink: 0 }}><X width={22} height={22} /></button>
        </div>

        {/* Tailor profile image + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #111", overflow: "hidden", flexShrink: 0, background: PINK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {tailor && tailor.profile_image_url
              ? <img src={tailor.profile_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <Scissors width={20} height={20} color="#fff" />}
          </div>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 19, fontWeight: 900 }}>{tailor && tailor.display_name}</span>
        </div>

        {/* Star selector — 5 large tap-to-select stars */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22, justifyContent: "center" }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => {
            const on = n <= shown;
            return (
              <button key={n} type="button" aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
                style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: on ? PINK : "#ccc", lineHeight: 0 }}>
                <Star width={40} height={40} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>

        {/* Comment (optional) */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: "#6b6b6b", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>
            YOUR REVIEW (OPTIONAL) ({comment.length}/500)
          </label>
          <textarea
            style={{ width: "100%", border: "2px solid #e0e0e0", borderRadius: 0, padding: "12px 14px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, height: 110, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            maxLength={500} placeholder="Share your experience with other buyers..."
            value={comment} onChange={e => setComment(e.target.value.slice(0, 500))} />
        </div>

        {/* SUBMIT — disabled until a rating is chosen */}
        <button className="hbtn" disabled={busy || rating === 0}
          style={{ width: "100%", background: PINK, color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "16px", fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 2, cursor: (busy || rating === 0) ? "not-allowed" : "pointer", opacity: (busy || rating === 0) ? 0.4 : 1 }}
          onClick={() => onSubmit({ rating, comment: comment.trim() })}>
          {busy ? "SUBMITTING…" : "SUBMIT REVIEW"}
        </button>
        <button onClick={onClose} disabled={busy}
          style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", padding: 0, color: "#6b6b6b", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, cursor: "pointer" }}>
          SKIP FOR NOW
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════ RATING SUMMARY ════════════════════════════
// The overall rating block: big average number, star display, total count and a
// 5→1 breakdown bar chart. Used on the public profile and the dashboard.
export function RatingSummary({ reviews = [], average = null }) {
  const count = reviews.length;
  const avg = count
    ? (average != null ? Number(average) : reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count)
    : 0;
  // Bucket counts for 5..1.
  const buckets = [5, 4, 3, 2, 1].map(star => ({
    star,
    n: reviews.filter(r => Math.round(Number(r.rating) || 0) === star).length,
  }));
  return (
    <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
      {/* Big number + stars + count */}
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 64, fontWeight: 900, lineHeight: 0.9, color: INK }}>{avg.toFixed(1)}</div>
        <div style={{ marginTop: 6 }}><Stars value={avg} size={18} /></div>
        <div style={{ fontSize: 13, color: "#6b6b6b", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 0.5, marginTop: 4 }}>
          ({count} review{count === 1 ? "" : "s"})
        </div>
      </div>
      {/* Breakdown bars */}
      <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
        {buckets.map(b => {
          const pct = count ? Math.round((b.n / count) * 100) : 0;
          return (
            <div key={b.star} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 14, fontSize: 13, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", color: INK, textAlign: "right" }}>{b.star}</span>
              <Star width={13} height={13} fill={PINK} stroke={PINK} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, height: 12, border: "2px solid #111", background: "#fff", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: PINK }} />
              </div>
              <span style={{ width: 20, fontSize: 13, fontWeight: 700, color: "#666", textAlign: "right" }}>{b.n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════ REVIEW LIST ════════════════════════════
// Individual reviews, newest first. Shows 5 by default with a SHOW ALL REVIEWS
// toggle. `buyers` is an id→profile map for the reviewer's name + avatar.
export function ReviewList({ reviews = [], buyers = {} }) {
  const [showAll, setShowAll] = React.useState(false);
  const shown = showAll ? reviews : reviews.slice(0, 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {shown.map(rv => {
        const buyer = buyers[rv.buyer_id];
        const garment = rv.alteration_requests && rv.alteration_requests.garment_type;
        return (
          <div key={rv.id} style={{ border: "2px solid #111", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #111", overflow: "hidden", flexShrink: 0, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {buyer && buyer.avatar_url
                  ? <img src={buyer.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 900, color: "#888" }}>{firstName(buyer)[0].toUpperCase()}</span>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{firstName(buyer)}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
                  <Stars value={Number(rv.rating) || 0} size={13} />
                  <span style={{ fontSize: 11, color: "#6b6b6b", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>{timeAgo(rv.created_at)}</span>
                </div>
              </div>
            </div>
            {rv.comment && <p style={{ fontSize: 14, color: "#444", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{rv.comment}</p>}
            {garment && (
              <p style={{ fontSize: 11, color: "#6b6b6b", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{garment} alteration</p>
            )}
          </div>
        );
      })}
      {reviews.length > 5 && !showAll && (
        <button onClick={() => setShowAll(true)}
          style={{ alignSelf: "center", background: "none", border: "none", padding: 0, color: INK, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textDecoration: "underline", cursor: "pointer" }}>
          SHOW ALL REVIEWS ({reviews.length})
        </button>
      )}
    </div>
  );
}

// Small inline "★ 4.8 (12)" rating chip for tailor cards (Part 4). Shows
// "No reviews yet" in grey when the tailor has none.
export function RatingChip({ average = 0, count = 0, size = 12 }) {
  if (!count) {
    return <span style={{ fontSize: 12, color: "#6b6b6b", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>No reviews yet</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Stars value={Number(average) || 0} size={size} />
      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", color: INK }}>
        {(Number(average) || 0).toFixed(1)} ({count})
      </span>
    </span>
  );
}

// Modal chrome — mirrors S.modalOverlay / S.modalBox so this component is
// self-contained (no styles import needed).
const modalOverlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 };
const modalBox = { background: "#fff", border: "3px solid #111", borderRadius: 0, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" };
