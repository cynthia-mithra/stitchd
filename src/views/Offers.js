import React from "react";
import { Tag, Clock, ShoppingBag, X, RefreshCw } from "lucide-react";
import { S } from "../styles";

// Phase 14 — My Offers (issue PART 1).
//
// Reached from the logged-in nav dropdown ("MY OFFERS") and the /offers path.
// Lists every offer THIS buyer has made, grouped by status with ACCEPTED shown
// first and most prominently:
//
//   ACCEPTED  → list price (grey strikethrough), accepted amount (large pink),
//               "You saved £X", a "Pay within X hours" countdown (red under 6h)
//               and a full-width black COMPLETE PURCHASE button → Stripe checkout.
//   PENDING   → the amount + an awaiting-response note, with WITHDRAW OFFER.
//   DECLINED  → MAKE NEW OFFER back to the listing.
//   EXPIRED   → greyed out, no actions.
//
// GBP throughout (the feature is GBP-only). Design system: 2px #111 borders, no
// border-radius, Barlow Condensed, #FF1493 / #00E5CC accents.

const PINK = "#FF1493";
const INK = "#111";
const PAYMENT_WINDOW_HOURS = 24;

const gbp = (pence) => `£${(Number(pence || 0) / 100).toFixed(2).replace(/\.00$/, "")}`;
const poundsToPence = (p) => Math.round(parseFloat(String(p ?? 0)) * 100);

const listingOf = (o) => o.listings || {};
const thumbOf = (l) => l.image_url || (Array.isArray(l.images) && l.images[0]) || "";

// Whole hours left in the 24h payment window, from accepted_at (fallback
// created_at). Negative/zero means the window has lapsed (cron will flip it).
const hoursLeft = (o) => {
  const start = o.accepted_at || o.created_at;
  if (!start) return PAYMENT_WINDOW_HOURS;
  const end = new Date(start).getTime() + PAYMENT_WINDOW_HOURS * 3600000;
  return Math.ceil((end - Date.now()) / 3600000);
};

function Thumb({ listing, faded }) {
  const src = thumbOf(listing);
  return (
    <div style={{ width: 84, height: 84, flexShrink: 0, border: "2px solid #111", background: "#f6f6f6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: faded ? 0.5 : 1 }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Tag width={28} height={28} color="#6f6f6f" />}
    </div>
  );
}

export default function Offers({
  view, setView, user,
  buyerOffers = [], offersLoading = false,
  completeOfferPurchase = () => {},
  withdrawBuyerOffer = () => {},
  makeNewOffer = () => {},
  checkoutOfferId = null,
  setAuthMode = () => {},
}) {
  if (view !== "offers") return null;

  const groups = { accepted: [], pending: [], declined: [], expired: [] };
  for (const o of buyerOffers) {
    if (o.status === "accepted") groups.accepted.push(o);
    else if (o.status === "pending") groups.pending.push(o);
    else if (o.status === "declined") groups.declined.push(o);
    else if (o.status === "expired") groups.expired.push(o);
    // 'withdrawn' / 'completed' are intentionally not shown here.
  }
  const hasAny = groups.accepted.length || groups.pending.length || groups.declined.length || groups.expired.length;

  const Heading = ({ label, count, color }) => (
    <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: 0.5, color: color || INK, margin: "30px 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
      {label} <span style={{ fontSize: 14, fontWeight: 800, color: "#6f6f6f" }}>({count})</span>
    </h2>
  );

  return (
    <section style={{ maxWidth: 880, margin: "0 auto", padding: "36px 24px 80px", fontFamily: "'Barlow Condensed',sans-serif" }}>
      <button style={S.back} onClick={() => setView("shop")}>← BACK TO SHOP</button>
      <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(34px,7vw,56px)", fontWeight: 900, letterSpacing: -1, lineHeight: 0.95, color: INK, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 14 }}>
        <Tag width={38} height={38} /> MY OFFERS
      </h1>
      <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "#888", marginTop: 6, marginBottom: 8 }}>
        Track your offers and complete your purchase when a seller accepts.
      </p>

      {!user ? (
        <div style={{ ...S.empty, padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Tag width={48} height={48} color="#808080" /></p>
          <p style={{ fontSize: 24, fontWeight: 900, margin: "0 0 18px", fontFamily: "'Barlow Condensed',sans-serif" }}>LOG IN TO VIEW YOUR OFFERS</p>
          <button className="hbtn" style={S.hBtn} onClick={() => { setAuthMode("login"); setView("auth"); }}>LOG IN →</button>
        </div>
      ) : offersLoading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 1, color: "#111" }}>LOADING YOUR OFFERS…</p>
        </div>
      ) : !hasAny ? (
        <div style={{ ...S.empty, padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Tag width={48} height={48} color="#808080" /></p>
          <p style={{ fontSize: 26, fontWeight: 900, margin: "0 0 8px", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>NO OFFERS YET</p>
          <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "#888", margin: "0 0 22px" }}>
            Make an offer on any active listing.
          </p>
          <button className="hbtn" style={S.hBtn} onClick={() => setView("shop")}>BROWSE LISTINGS →</button>
        </div>
      ) : (
        <>
          {/* ── ACCEPTED — shown first and most prominently ─────────────────── */}
          {groups.accepted.length > 0 && (
            <>
              <Heading label="ACCEPTED" count={groups.accepted.length} color={PINK} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {groups.accepted.map((o) => {
                  const l = listingOf(o);
                  const listedPence = poundsToPence(l.price);
                  const savedPence = listedPence > o.amount_pence ? listedPence - o.amount_pence : 0;
                  const hrs = hoursLeft(o);
                  const lapsed = hrs <= 0;
                  const urgent = hrs > 0 && hrs < 6;
                  const busy = checkoutOfferId === o.id;
                  return (
                    <div key={o.id} style={{ border: `2px solid ${PINK}`, background: "#fff", padding: "18px 20px" }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <Thumb listing={l} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1 }}>{l.name || "Listing"}</p>
                          {listedPence > 0 && (
                            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, color: "#6b6b6b", textDecoration: "line-through", margin: "6px 0 0" }}>{gbp(listedPence)}</p>
                          )}
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 900, color: PINK, letterSpacing: -0.5, lineHeight: 1, margin: "2px 0 0" }}>{gbp(o.amount_pence)}</p>
                          {savedPence > 0 && (
                            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: "#00B89C", letterSpacing: 0.5, margin: "6px 0 0" }}>You saved {gbp(savedPence)}</p>
                          )}
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 0.5, color: lapsed ? "#999" : urgent ? "#E60000" : "#666", margin: "10px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                            <Clock width={15} height={15} />
                            {lapsed ? "Payment window has passed" : `Pay within ${hrs} hour${hrs === 1 ? "" : "s"}`}
                          </p>
                        </div>
                      </div>
                      <button
                        className="hbtn"
                        disabled={busy || lapsed}
                        onClick={() => completeOfferPurchase(o)}
                        style={{ width: "100%", marginTop: 16, background: INK, color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "16px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", cursor: busy || lapsed ? "not-allowed" : "pointer", opacity: busy || lapsed ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <ShoppingBag width={17} height={17} /> {busy ? "REDIRECTING…" : "COMPLETE PURCHASE"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── PENDING ──────────────────────────────────────────────────────── */}
          {groups.pending.length > 0 && (
            <>
              <Heading label="PENDING" count={groups.pending.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {groups.pending.map((o) => {
                  const l = listingOf(o);
                  return (
                    <div key={o.id} style={{ border: "2px solid #111", background: "#fff", padding: "18px 20px" }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <Thumb listing={l} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1 }}>{l.name || "Listing"}</p>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: INK, letterSpacing: -0.5, margin: "6px 0 0" }}>{gbp(o.amount_pence)}</p>
                          <span style={{ display: "inline-block", marginTop: 8, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#111", background: "#00E5CC", padding: "3px 10px" }}>AWAITING SELLER RESPONSE</span>
                        </div>
                      </div>
                      <button
                        onClick={() => withdrawBuyerOffer(o)}
                        style={{ width: "100%", marginTop: 16, background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, padding: "13px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <X width={16} height={16} /> WITHDRAW OFFER
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── DECLINED ─────────────────────────────────────────────────────── */}
          {groups.declined.length > 0 && (
            <>
              <Heading label="DECLINED" count={groups.declined.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {groups.declined.map((o) => {
                  const l = listingOf(o);
                  return (
                    <div key={o.id} style={{ border: "2px solid #111", background: "#fff", padding: "18px 20px" }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <Thumb listing={l} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: INK, margin: 0, lineHeight: 1.1 }}>{l.name || "Listing"}</p>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: "#6b6b6b", letterSpacing: -0.5, margin: "6px 0 0" }}>{gbp(o.amount_pence)}</p>
                          {o.counter_offer_pence != null && (
                            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, color: PINK, margin: "6px 0 0" }}>Seller suggested {gbp(o.counter_offer_pence)}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => makeNewOffer(o)}
                        style={{ width: "100%", marginTop: 16, background: "#111", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "13px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <RefreshCw width={15} height={15} /> MAKE NEW OFFER
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── EXPIRED — greyed out, no actions ──────────────────────────────── */}
          {groups.expired.length > 0 && (
            <>
              <Heading label="EXPIRED" count={groups.expired.length} color="#6b6b6b" />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {groups.expired.map((o) => {
                  const l = listingOf(o);
                  return (
                    <div key={o.id} style={{ border: "2px solid #ddd", background: "#fafafa", padding: "18px 20px", opacity: 0.75 }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <Thumb listing={l} faded />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: "#6b6b6b", margin: 0, lineHeight: 1.1 }}>{l.name || "Listing"}</p>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: "#6f6f6f", letterSpacing: -0.5, margin: "6px 0 0" }}>{gbp(o.amount_pence)}</p>
                          <span style={{ display: "inline-block", marginTop: 8, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#fff", background: "#999", padding: "3px 10px" }}>EXPIRED</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
