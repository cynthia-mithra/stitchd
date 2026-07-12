import React, { useMemo } from "react";
import { Search, Heart, X } from "lucide-react";
import { S } from "../styles";
import { Thumb } from "../components/Shared";
import { catEmoji, currencySymbol, CARD_COLORS } from "../lib/constants";

// Explore — one big personalised discovery feed. The ranked list is built in
// App.js (a blend of fresh drops, trending, and sellers-you-follow); here we just
// render the category chips, an inline search filter, and a clean uniform grid.
// No section headers — it's a single Instagram-style stream.

// Chip value → label. Values must match listing.category (see CATEGORIES).
const CHIPS = [
  ["all", "For You"],
  ["Lehenga", "Lehengas"],
  ["Saree", "Sarees"],
  ["Salwar Kameez", "Salwar"],
  ["Kurta", "Kurtas"],
  ["Co-ord Set", "Co-ords"],
  ["Sherwani", "Sherwani"],
  ["Dupatta", "Dupattas"],
  ["Accessories", "Accessories"],
];

function ExploreCard({ item, idx, onOpen, onSave, saved }) {
  const accent = CARD_COLORS[idx % CARD_COLORS.length];
  return (
    <article className="scard" style={{ ...S.card, opacity: item.sold ? 0.55 : 1 }} onClick={() => onOpen(item)}>
      <Thumb src={item.image_url || (item.images && item.images[0]) || ""} emoji={item.emoji || catEmoji(item.category)} accent={accent} gradient style={S.cardTop} className="card-top" emojiStyle={S.cardEmoji}>
        {item.sold && <div style={S.soldVeil}><span style={S.soldStamp}>SOLD</span></div>}
        <button className="card-heart" aria-label={saved ? "Remove from saved" : "Save"} style={saved ? { background: "#FF1493", borderColor: "#FF1493" } : null} onClick={(e) => { e.stopPropagation(); onSave(item); }}>
          <Heart width={15} height={15} fill={saved ? "#fff" : "none"} color={saved ? "#fff" : "#111"} />
        </button>
      </Thumb>
      <div style={S.cardBody} className="card-body">
        <p style={S.cardName} className="card-name">{item.name}</p>
        <div style={S.cardFoot}>
          <span style={{ ...S.cardPrice, color: accent }} className="card-price">{currencySymbol(item.currency)}{item.price}</span>
          {item.size && item.size !== "Free Size" && <span style={S.cardSizePill}>{item.size}</span>}
        </div>
      </div>
      <div style={{ ...S.accentBar, background: accent }} />
    </article>
  );
}

export default function Explore({
  items = [], exploreCat, setExploreCat, query, setQuery,
  onOpen, onSave, myWishlist,
}) {
  // Inline text filter over the already-ranked feed (name / brand / category).
  const shown = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      (i.name || "").toLowerCase().includes(q) ||
      (i.brand || "").toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 16px 40px" }}>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, border: "2px solid #111", padding: "12px 14px", marginBottom: 14 }}>
        <Search width={18} height={18} color="#8a8a8a" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search styles, brands, sellers…"
          style={{ flex: 1, border: "none", outline: "none", fontFamily: "'Barlow',sans-serif", fontSize: 15, background: "transparent" }}
        />
        {query && <button aria-label="Clear" onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X width={16} height={16} color="#8a8a8a" /></button>}
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 14, marginBottom: 4, WebkitOverflowScrolling: "touch" }} className="explore-chips">
        {CHIPS.map(([val, label]) => {
          const on = exploreCat === val;
          return (
            <button key={val} onClick={() => setExploreCat(val)} style={{
              flexShrink: 0, border: "2px solid #111", borderRadius: 0, cursor: "pointer",
              padding: "9px 18px", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
              fontSize: 13, letterSpacing: 1, textTransform: "uppercase",
              background: on ? "#FF1493" : "#fff", color: on ? "#fff" : "#111",
            }}>{label}</button>
          );
        })}
      </div>

      {/* Grid — clean uniform, 2 cols on a phone, more on wider screens */}
      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#8a8a8a", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1 }}>
          NOTHING HERE YET — TRY ANOTHER CATEGORY
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(168px,1fr))", gap: 14 }}>
          {shown.map((item, idx) => (
            <ExploreCard key={item.id} item={item} idx={idx} onOpen={onOpen} onSave={onSave} saved={myWishlist.has(item.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
