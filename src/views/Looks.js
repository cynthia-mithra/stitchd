import React from "react";
import { Layers, ShoppingBag } from "lucide-react";
import { CARD_COLORS, catEmoji, currencySymbol, lookListings, lookTotal, lookGenders } from "../lib/constants";
import { S } from "../styles";
import { Thumb } from "../components/Shared";

// ── LOOK CARD ────────────────────────────────────────────────────────────────
// Square cover crop, 2px #111 border, no radius, white bg, Barlow Condensed
// throughout, #FF1493 on the "FROM £…" price. Shared by the homepage rail and
// the /looks page. `onOpen` opens the look detail view.
export function LookCard({ look, onOpen }) {
  const listings = lookListings(look);
  const total = lookTotal(listings);
  const count = listings.length;
  return (
    <article className="scard" style={{ background: "#fff", border: "2px solid #111", borderRadius: 0, cursor: "pointer", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={() => onOpen(look)}>
      <Thumb
        src={look.cover_image_url || listings[0]?.image_url || (listings[0]?.images && listings[0].images[0]) || ""}
        emoji={<Layers width={56} height={56} />}
        accent="#fafafa"
        style={{ width: "100%", aspectRatio: "1", borderBottom: "2px solid #111" }}
        emojiStyle={{ color: "#111" }}
      />
      <div style={{ padding: "12px 14px" }}>
        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: "#111", lineHeight: 1.1, marginBottom: 6, letterSpacing: 0.3 }}>{look.title}</p>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: "#6b6b6b" }}>{count} {count === 1 ? "PIECE" : "PIECES"}</span>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: -0.5, color: "#FF1493" }}>FROM {currencySymbol()}{total}</span>
        </div>
      </div>
    </article>
  );
}

// Compact, tappable listing card used inside the look detail grid. Mirrors the
// "YOU MIGHT ALSO LIKE" card in Detail.js. Sold pieces stay visible with the
// SOLD veil, per spec.
function LookListingCard({ item, accent, onOpen }) {
  return (
    <article className="scard" style={{ ...S.card, borderColor: accent, opacity: item.sold ? 0.7 : 1 }} onClick={() => onOpen(item)}>
      <Thumb src={item.image_url || (item.images && item.images[0]) || ""} emoji={item.emoji || catEmoji(item.category)} accent={accent} style={{ ...S.cardTop, height: 160 }} emojiStyle={{ fontSize: 56 }}>
        {item.sold && <div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
      </Thumb>
      <div style={{ ...S.cardBody, padding: "12px 14px 10px" }}>
        <p style={{ ...S.cardCatLabel, color: accent, marginBottom: 2 }}>{item.category?.toUpperCase()}</p>
        <p style={{ ...S.cardName, fontSize: 16, marginBottom: 8 }}>{item.name}</p>
        <div style={S.cardFoot}><span style={{ ...S.cardPrice, color: accent, fontSize: 20 }}>{currencySymbol(item.currency)}{item.price}</span></div>
      </div>
      <div style={{ ...S.accentBar, background: accent }} />
    </article>
  );
}

export default function Looks({
  view, setView,
  looks = [], lookFilter = "ALL", setLookFilter = () => {},
  openLook,
  selLook, selLookCreator,
  openDetail, addLookToBag,
}) {
  // ── /looks PAGE ────────────────────────────────────────────────────────────
  if (view === "looks") {
    const filtered = looks.filter(l => {
      if (lookFilter === "ALL") return true;
      const genders = lookGenders(lookListings(l));
      return lookFilter === "WOMEN" ? genders.has("women") : genders.has("men");
    });
    return (
      <main style={S.main}>
        <button style={S.back} onClick={() => setView("shop")}>← BACK TO SHOP</button>
        <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "3px solid #111" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2.5, color: "#FF1493", marginBottom: 6 }}>CURATED OUTFITS</p>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 48, fontWeight: 900, letterSpacing: -1, lineHeight: 1, marginBottom: 8 }}>SHOP THE LOOK</h2>
          <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "#888" }}>Complete outfits. All pre-loved. All on Stitch'd.</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["ALL", "WOMEN", "MEN"].map(f => (
            <button key={f} className="hbtn" style={{ ...S.hBtn, background: lookFilter === f ? "#FF1493" : "#fff", color: lookFilter === f ? "#fff" : "#111", border: "2px solid #111", fontSize: 12, padding: "8px 20px" }} onClick={() => setLookFilter(f)}>{f}</button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Layers width={48} height={48} color="#ddd" /></p>
            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>NO LOOKS HERE YET.</p>
            <button className="hbtn" style={S.hBtn} onClick={() => setView("shop")}>BROWSE DROPS →</button>
          </div>
        ) : (
          <div className="looks-page-grid">
            {filtered.map(look => <LookCard key={look.id} look={look} onOpen={openLook} />)}
          </div>
        )}
      </main>
    );
  }

  // ── LOOK DETAIL — /looks/[id] ──────────────────────────────────────────────
  if (view === "lookdetail" && selLook) {
    const listings = lookListings(selLook);
    const available = listings.filter(l => !l.sold);
    const total = lookTotal(listings, true);
    const allSold = listings.length > 0 && available.length === 0;
    const curator = selLook.created_by_type === "admin"
      ? "Stitch'd"
      : (selLookCreator?.full_name || selLookCreator?.username || "a Stitch'd seller");
    return (
      <main style={S.main}>
        <button style={S.back} onClick={() => setView("looks")}>← ALL LOOKS</button>

        {/* Large cover image */}
        <div style={{ border: "2px solid #111", borderRadius: 0, overflow: "hidden", marginBottom: 24 }}>
          <Thumb
            src={selLook.cover_image_url || listings[0]?.image_url || (listings[0]?.images && listings[0].images[0]) || ""}
            emoji={<Layers width={72} height={72} />}
            accent="#fafafa"
            style={{ width: "100%", maxHeight: 460, aspectRatio: "16/9" }}
            emojiStyle={{ color: "#111" }}
          />
        </div>

        <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(40px,7vw,64px)", fontWeight: 900, letterSpacing: -1, lineHeight: 1, marginBottom: 8, color: "#111" }}>{selLook.title}</h1>
        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 2, color: "#FF1493", textTransform: "uppercase", marginBottom: selLook.description ? 14 : 20 }}>Curated by {curator}</p>
        {selLook.description && <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 16, color: "#555", lineHeight: 1.7, marginBottom: 24, maxWidth: 720 }}>{selLook.description}</p>}

        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#111", borderLeft: "4px solid #FF1493", paddingLeft: 12, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Layers width={16} height={16} /> THE PIECES ({listings.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 3 }} className="shop-grid">
          {listings.map((item, idx) => (
            <LookListingCard key={item.id} item={item} accent={CARD_COLORS[idx % CARD_COLORS.length]} onOpen={openDetail} />
          ))}
        </div>

        {/* Full-look total + ADD ALL TO BAG */}
        <div style={{ marginTop: 32, borderTop: "3px solid #111", paddingTop: 24, maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: 2, color: "#111", textTransform: "uppercase" }}>Get the full look</span>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 900, letterSpacing: -1, color: "#FF1493" }}>{currencySymbol()}{total}</span>
          </div>
          <button
            className={allSold ? "" : "hbtn"}
            disabled={allSold}
            style={{ width: "100%", background: allSold ? "#e5e5e5" : "#FF1493", color: allSold ? "#999" : "#fff", border: `2px solid ${allSold ? "#ccc" : "#111"}`, borderRadius: 0, padding: "16px", fontSize: 17, cursor: allSold ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            onClick={() => { if (!allSold) addLookToBag(selLook); }}>
            {allSold ? "SOLD OUT" : <><ShoppingBag width={18} height={18} /> ADD ALL TO BAG ({available.length})</>}
          </button>
          {!allSold && listings.length !== available.length && (
            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, color: "#6b6b6b", letterSpacing: 0.5, marginTop: 8, textAlign: "center" }}>{listings.length - available.length} sold piece{listings.length - available.length !== 1 ? "s" : ""} won't be added.</p>
          )}
        </div>
      </main>
    );
  }

  return null;
}
