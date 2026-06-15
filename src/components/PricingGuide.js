import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "../lib/db";

// ── Phase 13 — Pricing suggestions based on similar sold listings ──────────────
// A self-contained panel shown below the price input on the listing create/edit
// form. When the seller has picked a category and typed at least 3 characters of
// a title, it queries SOLD comparable listings (db.getSoldComps) and surfaces the
// price range, average, a suggested price (average − 10%) and a USE THIS PRICE
// button. With too little data it shows a "not enough data" message and a BROWSE
// SIMILAR link into the shop pre-filtered by category. Frontend-only — all the
// aggregation happens here from the rows the query returns.
//
// Props:
//   category   effective listing category (e.g. "Lehenga")
//   title      the item name the seller is typing
//   token      auth token for the query (may be null — anon read is fine)
//   onUsePrice (price:number) => void  — fills the price input
//   collapsible  edit form: render collapsed behind a SHOW PRICING GUIDE toggle

const FONT = "'Barlow Condensed',sans-serif";
const TEAL = "#00E5CC";
const MIN_TITLE_CHARS = 3;
const MIN_COMPS = 3;          // need at least this many sold rows to suggest
const DEBOUNCE_MS = 400;

// Keywords = first 3 words of the title, stripped to alphanumerics and at least
// 2 chars long so single letters / punctuation don't widen the match to noise.
function keywordsFromTitle(title) {
  return String(title || "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(w => w.length >= 2);
}

// Pack {category} into the base64url `sf` param the shop reads on a cold load to
// pre-apply filters (see the deep-link handler in App.js), so BROWSE SIMILAR opens
// the shop filtered by this category in a new tab.
function browseSimilarHref(category) {
  try {
    const json = JSON.stringify({ category });
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `/?sf=${b64}`;
  } catch {
    return "/";
  }
}

const money = n => `£${Math.round(n)}`;

export default function PricingGuide({ category, title, token, onUsePrice, collapsible = false }) {
  // null = nothing to show yet; {comps,...} once a lookup has resolved.
  const [state, setState] = useState({ status: "idle" });
  const [open, setOpen] = useState(!collapsible);

  const titleReady = String(title || "").trim().length >= MIN_TITLE_CHARS;

  const lookup = useCallback(async () => {
    if (!category || !titleReady) { setState({ status: "idle" }); return; }
    setState({ status: "loading" });
    const keywords = keywordsFromTitle(title);
    let rows = await db.getSoldComps(category, keywords, token);
    let usedFallback = false;
    // PART 3 — too few keyword matches: fall back to category-only matching.
    if (rows.length < MIN_COMPS) {
      const catOnly = await db.getSoldComps(category, [], token);
      if (catOnly.length > rows.length) { rows = catOnly; usedFallback = true; }
    }
    const prices = rows.map(r => parseFloat(r.price)).filter(p => !isNaN(p) && p > 0);
    if (prices.length < MIN_COMPS) { setState({ status: "empty" }); return; }
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / prices.length;
    setState({
      status: "data",
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg,
      count: prices.length,
      suggested: Math.max(1, Math.round(avg * 0.9)),
      usedFallback,
    });
  }, [category, title, titleReady, token]);

  // Debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    if (!category || !titleReady) { setState({ status: "idle" }); return; }
    const id = setTimeout(lookup, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [category, title, titleReady, lookup]);

  // Hide entirely until there's a category AND enough of a title to act on.
  if (!category || !titleReady) return null;

  const panel = {
    border: "2px solid #111", borderRadius: 0, background: "#f5f5f5",
    padding: "16px 18px", marginTop: 16, fontFamily: FONT,
  };
  const heading = {
    display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 900,
    letterSpacing: 2, color: "#111", textTransform: "uppercase", margin: 0,
  };

  // Edit form: collapsed behind a toggle until the seller opens it.
  if (collapsible && !open) {
    return (
      <div style={panel}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT }}
        >
          <span style={heading}><TrendingUp width={16} height={16} color={TEAL} /> SHOW PRICING GUIDE</span>
          <ChevronDown width={18} height={18} color="#111" />
        </button>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={heading}><TrendingUp width={16} height={16} color={TEAL} /> PRICING GUIDE</p>
        {collapsible && (
          <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }} aria-label="Hide pricing guide">
            <ChevronUp width={18} height={18} color="#111" />
          </button>
        )}
      </div>

      {state.status === "loading" && (
        <p style={{ fontFamily: FONT, fontSize: 14, color: "#888", margin: 0, letterSpacing: 0.5 }}>Checking similar sold listings…</p>
      )}

      {state.status === "empty" && (
        <div>
          <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 4px", letterSpacing: 0.3 }}>Not enough data yet for this category</p>
          <p style={{ fontFamily: FONT, fontSize: 14, color: "#666", margin: "0 0 12px", letterSpacing: 0.3 }}>Check similar listings on Stitch'd for guidance.</p>
          <a
            href={browseSimilarHref(category)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", fontFamily: FONT, fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "#111", textTransform: "uppercase", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            BROWSE SIMILAR →
          </a>
        </div>
      )}

      {state.status === "data" && (
        <div>
          <p style={{ fontFamily: FONT, fontSize: 14, color: "#666", margin: "0 0 8px", letterSpacing: 0.3 }}>Similar items have sold for:</p>
          <p style={{ fontFamily: FONT, fontSize: 26, fontWeight: 900, color: "#111", margin: "0 0 6px", letterSpacing: -0.5 }}>
            {money(state.min)} — {money(state.max)}
          </p>
          <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: 0.3 }}>Average: {money(state.avg)}</p>
          <p style={{ fontFamily: FONT, fontSize: 13, color: "#888", margin: "0 0 14px", letterSpacing: 0.5 }}>
            Based on {state.count} {state.count === 1 ? "sale" : "sales"}{state.usedFallback ? " in this category" : ""}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: "#111", letterSpacing: 0.3 }}>
              We suggest: {money(state.suggested)}
            </span>
            <button
              type="button"
              onClick={() => onUsePrice && onUsePrice(state.suggested)}
              style={{ background: TEAL, color: "#111", border: "2px solid #111", borderRadius: 0, padding: "8px 14px", fontFamily: FONT, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}
            >
              USE THIS PRICE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
