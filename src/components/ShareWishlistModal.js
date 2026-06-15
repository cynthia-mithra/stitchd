import React from "react";
import { X, Copy, Check, Square, CheckSquare, MessageCircle } from "lucide-react";
import { S } from "../styles";
import { Thumb } from "./Shared";
import { CARD_COLORS, catEmoji, currencySymbol } from "../lib/constants";

// Phase 14 — Create / edit a shareable wishlist (issue PART 2).
//
// One modal, two steps. The "form" step collects a name, a selection of the
// user's saved pieces (all selected by default) and a public toggle; the
// "success" step (create only) shows the shareable link with COPY LINK and
// WhatsApp share. In edit mode the same form is pre-filled and saving closes the
// modal straight away. Purely presentational — App.js owns all the state and the
// create/save handlers. Design system: Barlow Condensed, #FF1493, 2px #111
// borders, no border-radius.
export default function ShareWishlistModal({
  open,
  mode = "create",            // "create" | "edit"
  step = "form",              // "form" | "success"
  items = [],                 // the user's wishlist pieces available to pick
  name, setName,
  selected,                   // Set of selected listing ids
  toggleSelect = () => {},
  toggleAll = () => {},
  isPublic = true, setIsPublic = () => {},
  saving = false,
  shareUrl = "",
  copied = false,
  onCreate = () => {},
  onCopy = () => {},
  onWhatsApp = () => {},
  onClose = () => {},
  onDone = () => {},
}) {
  if (!open) return null;

  const allSelected = items.length > 0 && items.every((i) => selected?.has(i.id));
  const canCreate = !!(name && name.trim()) && (selected?.size > 0) && !saving;

  const heading = step === "success"
    ? "YOUR LIST IS READY"
    : mode === "edit" ? "EDIT YOUR SHAREABLE LIST" : "CREATE A SHAREABLE WISHLIST";

  return (
    <div style={S.modalOverlay} onClick={() => (saving ? null : onClose())}>
      <div style={{ ...S.modalBox, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1, color: "#111" }}>
            {heading}
          </h2>
          <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#111", padding: 4, flexShrink: 0, display: "flex" }}>
            <X width={22} height={22} />
          </button>
        </div>

        {step === "success" ? (
          /* ── SUCCESS STATE ─────────────────────────────────────────────── */
          <div>
            <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 14, color: "#666", marginBottom: 18 }}>
              Share this link with anyone — no login needed to view it.
            </p>

            {/* Shareable link */}
            <div style={{ border: "2px solid #111", borderRadius: 0, padding: "14px 16px", marginBottom: 16, background: "#fafafa", wordBreak: "break-all", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 0.5, color: "#111" }}>
              {shareUrl}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              <button
                type="button"
                className="hbtn"
                onClick={onCopy}
                style={{ flex: 1, minWidth: 150, background: copied ? "#FF1493" : "#fff", color: copied ? "#fff" : "#111", border: "2px solid #111", borderRadius: 0, padding: "13px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {copied ? <Check width={16} height={16} /> : <Copy width={16} height={16} />} {copied ? "COPIED!" : "COPY LINK"}
              </button>
              <button
                type="button"
                className="hbtn"
                onClick={onWhatsApp}
                style={{ flex: 1, minWidth: 150, background: "#25D366", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "13px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <MessageCircle width={16} height={16} /> WHATSAPP
              </button>
            </div>

            <button
              type="button"
              className="hbtn"
              onClick={onDone}
              style={{ width: "100%", background: "#111", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "14px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: 2, cursor: "pointer" }}
            >
              DONE
            </button>
          </div>
        ) : (
          /* ── FORM STATE ────────────────────────────────────────────────── */
          <div>
            {/* Name */}
            <label style={{ fontSize: 10, fontWeight: 800, color: "#999", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 6 }}>List name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              maxLength={50}
              placeholder='e.g. "My wedding wishlist"'
              style={{ ...S.inp, marginBottom: 4 }}
            />
            <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 11, color: "#bbb", textAlign: "right", marginBottom: 18 }}>{(name || "").length}/50</p>

            {/* Item selector */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#999", letterSpacing: 1.5, textTransform: "uppercase" }}>Pieces to include</span>
              <button
                type="button"
                onClick={toggleAll}
                style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: allSelected ? "#FF1493" : "#111" }}
              >
                {allSelected ? <CheckSquare width={16} height={16} /> : <Square width={16} height={16} />} SELECT ALL
              </button>
            </div>

            <div style={{ border: "2px solid #111", borderRadius: 0, maxHeight: 260, overflowY: "auto", marginBottom: 20 }}>
              {items.length === 0 ? (
                <p style={{ padding: "20px", textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>NO SAVED PIECES</p>
              ) : (
                items.map((item, idx) => {
                  const on = selected?.has(item.id);
                  const accent = CARD_COLORS[idx % CARD_COLORS.length];
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: idx === items.length - 1 ? "none" : "1px solid #f0f0f0", cursor: "pointer", background: on ? "#fff5fa" : "#fff" }}
                    >
                      <span style={{ flexShrink: 0, color: on ? "#FF1493" : "#bbb", display: "flex" }}>
                        {on ? <CheckSquare width={20} height={20} /> : <Square width={20} height={20} />}
                      </span>
                      <Thumb
                        src={item.image_url || (item.images && item.images[0]) || ""}
                        emoji={item.emoji || catEmoji(item.category)}
                        accent={accent}
                        style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111" }}
                        emojiStyle={{ fontSize: 24 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: "#111", lineHeight: 1.1, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</p>
                        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, color: "#FF1493", marginTop: 2 }}>{currencySymbol(item.currency)}{item.price}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Public toggle */}
            <div
              onClick={() => setIsPublic(!isPublic)}
              style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0", cursor: "pointer", marginBottom: 22 }}
            >
              <span style={{ width: 44, height: 24, borderRadius: 0, border: "2px solid #111", background: isPublic ? "#FF1493" : "#fff", position: "relative", transition: "background .15s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, left: isPublic ? 22 : 2, width: 16, height: 16, background: isPublic ? "#fff" : "#111", transition: "left .15s" }} />
              </span>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: "#111" }}>Make this list public</div>
                <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "#aaa", marginTop: 3 }}>Anyone with the link can view this list</div>
              </div>
            </div>

            {/* Actions */}
            <button
              type="button"
              className="hbtn"
              onClick={onCreate}
              disabled={!canCreate}
              style={{ width: "100%", background: "#FF1493", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "15px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 2, cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : 0.45 }}
            >
              {saving ? "SAVING…" : mode === "edit" ? "SAVE CHANGES" : "CREATE LIST"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#111", textDecoration: "underline", textTransform: "uppercase" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
