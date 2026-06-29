import React from "react";
import { Copy, Check, Pencil, Trash2, Heart } from "lucide-react";
import { S } from "../styles";
import { Thumb } from "../components/Shared";
import { CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";

// Phase 14 - Public shared wishlist page (/wishlist/<slug>).
//
// Visible to anyone with the link - no login required (PostgREST's anon key
// reads the list; see the phase14 migration's "no RLS" note). The owner, when
// signed in and viewing their own list, additionally gets COPY LINK / EDIT LIST
// / DELETE LIST controls. A missing, deleted or private (non-owner) list shows
// the "no longer available" state. Design system throughout: Barlow Condensed,
// #FF1493, 2px #111 borders, no border-radius.
export default function PublicWishlist({
  view, list, loading, ownerName, isOwner = false,
  copied = false,
  openDetail = () => {},
  setView = () => {},
  onCopyLink = () => {},
  onEdit = () => {},
  onDelete = () => {},
}) {
  if (view !== "public-wishlist") return null;

  const shopBtn = (
    <button
      className="hbtn"
      style={{ ...S.hBtn, fontSize: 14, padding: "14px 28px" }}
      onClick={() => setView("shop")}
    >
      SHOP STITCH'D →
    </button>
  );

  // LOADING
  if (loading) {
    return (
      <main style={S.main}>
        <div style={S.loadingWrap}>
          <div style={S.spinner} />
          <p style={S.loadingText}>LOADING WISHLIST…</p>
        </div>
      </main>
    );
  }

  // NOT FOUND / DELETED / PRIVATE (to a non-owner)
  const visibleToViewer = list && (list.public !== false || isOwner);
  if (!list || !visibleToViewer) {
    return (
      <main style={S.main}>
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Heart width={64} height={64} color="#ddd" />
          </p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 900, letterSpacing: -0.5, marginBottom: 20, lineHeight: 1.05 }}>
            THIS WISHLIST IS NO LONGER AVAILABLE
          </p>
          {shopBtn}
        </div>
      </main>
    );
  }

  // Resolve the list's pieces (ordered by position), dropping any whose listing
  // has since been deleted. Sold pieces stay visible with a SOLD overlay.
  const rows = [...(list.shared_wishlist_items || [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((r) => r.listings)
    .filter(Boolean);

  const displayName = (ownerName || "Someone").trim();

  return (
    <main style={S.main}>
      <button style={S.back} onClick={() => setView("shop")}>← SHOP STITCH'D</button>

      {/* HEADER */}
      <div style={{ marginBottom: 36, paddingBottom: 24, borderBottom: "3px solid #111" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(34px,7vw,56px)", fontWeight: 900, letterSpacing: -1, lineHeight: 0.95, color: "#111", margin: 0 }}>
              {displayName.toUpperCase()}'S WISHLIST
            </h1>
            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: 0.5, color: "#FF1493", margin: "8px 0 0" }}>
              {list.name}
            </p>
            <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 14, color: "#888", margin: "8px 0 0" }}>
              Find these pieces on Stitch'd
            </p>
          </div>

          {/* OWNER CONTROLS - only when the signed-in viewer owns this list. */}
          {isOwner && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
              <button
                type="button"
                className="hbtn"
                onClick={onCopyLink}
                style={{ ...S.hBtn, background: copied ? "#FF1493" : "#fff", color: copied ? "#fff" : "#111", border: "2px solid #111", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {copied ? <Check width={15} height={15} /> : <Copy width={15} height={15} />} {copied ? "COPIED!" : "COPY LINK"}
              </button>
              <button
                type="button"
                className="hbtn"
                onClick={onEdit}
                style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Pencil width={15} height={15} /> EDIT LIST
              </button>
              <button
                type="button"
                className="hbtn"
                onClick={onDelete}
                style={{ ...S.hBtn, background: "#fff", color: "#FF0000", border: "2px solid #FF0000", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Trash2 width={15} height={15} /> DELETE LIST
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GRID */}
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, letterSpacing: -0.5, marginBottom: 24 }}>
            THIS LIST HAS NO PIECES YET
          </p>
          {shopBtn}
        </div>
      ) : (
        <div style={S.grid} className="shop-grid">
          {rows.map((item, idx) => {
            const accent = CARD_COLORS[idx % CARD_COLORS.length];
            return (
              <article
                key={item.id}
                className="scard"
                style={{ ...S.card, borderColor: item.sold ? "#ccc" : accent, opacity: item.sold ? 0.85 : 1 }}
                onClick={() => openDetail(item)}
              >
                <Thumb src={item.image_url || (item.images && item.images[0]) || ""} emoji={item.emoji || catEmoji(item.category)} accent={accent} style={S.cardTop} emojiStyle={S.cardEmoji}>
                  {item.sold && <div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
                </Thumb>
                <div style={S.cardBody}>
                  <p style={{ ...S.cardCatLabel, color: item.sold ? "#999" : accent }}>{item.category?.toUpperCase()}</p>
                  <p style={S.cardName}>{item.name}</p>
                  <div style={S.cardFoot}><span style={{ ...S.cardPrice, color: item.sold ? "#999" : accent }}>{currencySymbol(item.currency)}{item.price}</span></div>
                </div>
                <div style={{ ...S.accentBar, background: item.sold ? "#ccc" : accent }} />
              </article>
            );
          })}
        </div>
      )}

      {/* SHOP STITCH'D */}
      <div style={{ textAlign: "center", marginTop: 56, paddingTop: 32, borderTop: "3px solid #111" }}>
        {shopBtn}
      </div>
    </main>
  );
}
