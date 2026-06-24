import React from "react";
import { Layers, Search, Plus, X, Camera, Check } from "lucide-react";
import { catEmoji, currencySymbol, lookTotal } from "../lib/constants";
import { S } from "../styles";
import { Sec, F, Thumb } from "../components/Shared";
import { LookCard } from "./Looks";

const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

// Three-step create / edit flow for a Shop the Look outfit. Reached from the
// seller dashboard TOOLS tab. Admins use the exact same flow — only the stored
// created_by_type differs (handled by publishLook in App.js).
export default function CreateLook({
  view, setView, user, isAdmin = false,
  lookForm, setLookForm,
  lookStep, setLookStep,
  lookSearch, setLookSearch, lookSearchResults = [], searchLookListings,
  addListingToLook, removeListingFromLook,
  publishLook, lookSaving = false,
  editingLook,
  flash = () => {},
}) {
  if (view !== "createlook" || !user) return null;

  const items = lookForm.items || [];
  const total = lookTotal(items);
  const inLook = (id) => items.some(i => i.id === id);

  const Step = ({ n, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: 0, border: "2px solid #111", background: lookStep >= n ? "#FF1493" : "#fff", color: lookStep >= n ? "#fff" : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 14 }}>{lookStep > n ? <Check width={15} height={15} /> : n}</div>
      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: lookStep >= n ? "#111" : "#bbb", textTransform: "uppercase" }}>{label}</span>
    </div>
  );

  const goStep2 = () => {
    if (!lookForm.title.trim()) { flash("Add a title for your look."); return; }
    if (!lookForm.coverPreview && !lookForm.cover_image_url) { flash("Add a cover image."); return; }
    setLookStep(2);
  };
  const goStep3 = () => {
    if (items.length < MIN_ITEMS) { flash(`Add at least ${MIN_ITEMS} pieces.`); return; }
    setLookStep(3);
  };

  return (
    <main style={{ ...S.main, maxWidth: 820 }}>
      <button style={S.back} onClick={() => setView("dashboard")}>← BACK TO DASHBOARD</button>
      <div style={S.formCard} className="form-card">
        <div style={S.formHero}>
          <h2 style={S.formTitle}>{editingLook ? "EDIT YOUR\n" : "CREATE A\n"}<span style={{ color: "#FF1493" }}>LOOK.</span></h2>
          <p style={S.formSub}>Curate an outfit from pieces across Stitch'd.{isAdmin ? " Published as Stitch'd." : ""}</p>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 32, paddingBottom: 24, borderBottom: "2px solid #f0f0f0" }}>
          <Step n={1} label="Details" />
          <div style={{ flex: "0 0 20px", height: 2, background: "#eee" }} />
          <Step n={2} label="Add pieces" />
          <div style={{ flex: "0 0 20px", height: 2, background: "#eee" }} />
          <Step n={3} label="Publish" />
        </div>

        {/* STEP 1 — DETAILS */}
        {lookStep === 1 && (
          <>
            <Sec label="LOOK DETAILS">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <F l="Title *"><input style={S.inp} placeholder="e.g. Mehndi Night Glam" value={lookForm.title} onChange={e => setLookForm(f => ({ ...f, title: e.target.value }))} /></F>
                <F l="Description (optional)"><textarea style={{ ...S.inp, height: 90, resize: "vertical" }} placeholder="What's the vibe? When would you wear it?" value={lookForm.description} onChange={e => setLookForm(f => ({ ...f, description: e.target.value }))} /></F>
              </div>
            </Sec>
            <Sec label="COVER IMAGE *">
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 160, height: 160, border: (lookForm.coverPreview || lookForm.cover_image_url) ? "2px solid #111" : "3px dashed #e0e0e0", cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", flexShrink: 0 }} onClick={() => document.getElementById("look-cover-input").click()}>
                  {(lookForm.coverPreview || lookForm.cover_image_url) ? (
                    <img src={lookForm.coverPreview || lookForm.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ textAlign: "center", pointerEvents: "none" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}><Camera width={24} height={24} color="#6f6f6f" /></div>
                      <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#6f6f6f" }}>ADD COVER</p>
                    </div>
                  )}
                </div>
                <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 13, color: "#888", maxWidth: 280 }}>A square hero shot works best — square crop, no rounded corners.</p>
              </div>
              <input id="look-cover-input" type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files[0]; if (file) setLookForm(f => ({ ...f, coverFile: file, coverPreview: URL.createObjectURL(file) })); }} />
            </Sec>
            <button className="hbtn" style={{ ...S.hBtn, width: "100%", padding: "16px", fontSize: 15, letterSpacing: 2 }} onClick={goStep2}>NEXT: ADD PIECES →</button>
          </>
        )}

        {/* STEP 2 — ADD LISTINGS */}
        {lookStep === 2 && (
          <>
            <Sec label={`ADD PIECES (${items.length}/${MAX_ITEMS} — min ${MIN_ITEMS})`}>
              <div style={{ ...S.searchBox, height: 44, marginBottom: 14 }}>
                <span style={S.searchIcon}><Search width={16} height={16} /></span>
                <input style={S.searchInput} placeholder="SEARCH ALL LISTINGS BY TITLE…" value={lookSearch} onChange={e => { setLookSearch(e.target.value); searchLookListings(e.target.value); }} />
                {lookSearch && <button style={S.searchClear} onClick={() => { setLookSearch(""); searchLookListings(""); }}>✕</button>}
              </div>
              {lookSearch.trim().length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  {lookSearchResults.length === 0 ? (
                    <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, color: "#6f6f6f", letterSpacing: 1 }}>No matching listings.</p>
                  ) : lookSearchResults.map(item => {
                    const added = inLook(item.id);
                    const full = items.length >= MAX_ITEMS;
                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "2px solid #f0f0f0", padding: "8px 10px" }}>
                        <div style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111", overflow: "hidden" }}>
                          <Thumb src={item.image_url || (item.images && item.images[0]) || ""} emoji={item.emoji || catEmoji(item.category)} accent="#fafafa" style={{ width: "100%", height: "100%" }} emojiStyle={{ fontSize: 22 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>{item.name}</p>
                          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, color: "#FF1493" }}>{currencySymbol(item.currency)}{item.price}</p>
                        </div>
                        <button className="hbtn" disabled={added || full} style={{ ...S.hBtn, background: added ? "#34C759" : full ? "#e8e8e8" : "#111", color: added ? "#fff" : full ? "#aaa" : "#fff", border: "none", fontSize: 11, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 5, cursor: (added || full) ? "not-allowed" : "pointer" }} onClick={() => addListingToLook(item)}>{added ? <><Check width={14} height={14} /> ADDED</> : <><Plus width={14} height={14} /> ADD</>}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Sec>

            <Sec label={`IN THIS LOOK (${items.length})`}>
              {items.length === 0 ? (
                <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, color: "#6f6f6f", letterSpacing: 1 }}>Search above and add at least {MIN_ITEMS} pieces.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "2px solid #111", padding: "8px 10px" }}>
                      <div style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111", overflow: "hidden" }}>
                        <Thumb src={item.image_url || (item.images && item.images[0]) || ""} emoji={item.emoji || catEmoji(item.category)} accent="#fafafa" style={{ width: "100%", height: "100%" }} emojiStyle={{ fontSize: 22 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>{item.name}</p>
                        <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, color: "#FF1493" }}>{currencySymbol(item.currency)}{item.price}</p>
                      </div>
                      <button aria-label="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: "#111", padding: 4 }} onClick={() => removeListingFromLook(item.id)}><X width={20} height={20} /></button>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #111", paddingTop: 10, marginTop: 2 }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#111" }}>TOTAL</span>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: "#FF1493", letterSpacing: -0.5 }}>{currencySymbol()}{total}</span>
                  </div>
                </div>
              )}
            </Sec>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="hbtn" style={{ ...S.hBtn, flex: "0 0 auto", background: "#fff", color: "#111", border: "2px solid #111", padding: "16px 22px", fontSize: 14 }} onClick={() => setLookStep(1)}>← BACK</button>
              <button className="hbtn" style={{ ...S.hBtn, flex: 1, padding: "16px", fontSize: 15, letterSpacing: 2, opacity: items.length < MIN_ITEMS ? 0.45 : 1, cursor: items.length < MIN_ITEMS ? "not-allowed" : "pointer" }} onClick={goStep3} disabled={items.length < MIN_ITEMS}>PREVIEW →</button>
            </div>
          </>
        )}

        {/* STEP 3 — PREVIEW + PUBLISH */}
        {lookStep === 3 && (
          <>
            <Sec label="PREVIEW">
              <div style={{ maxWidth: 300 }}>
                <LookCard
                  look={{ title: lookForm.title, cover_image_url: lookForm.coverPreview || lookForm.cover_image_url, look_items: items.map((l, i) => ({ listings: l, position: i })) }}
                  onOpen={() => {}}
                />
              </div>
            </Sec>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="hbtn" style={{ ...S.hBtn, width: "100%", background: "#FF1493", border: "2px solid #111", padding: "16px", fontSize: 16, letterSpacing: 2, opacity: lookSaving ? 0.6 : 1, cursor: lookSaving ? "wait" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => publishLook(true)} disabled={lookSaving}><Layers width={18} height={18} /> {lookSaving ? "SAVING…" : "PUBLISH LOOK →"}</button>
              <button className="hbtn" style={{ ...S.hBtn, width: "100%", background: "#fff", color: "#111", border: "2px solid #111", padding: "14px", fontSize: 14, letterSpacing: 2, opacity: lookSaving ? 0.6 : 1, cursor: lookSaving ? "wait" : "pointer" }} onClick={() => publishLook(false)} disabled={lookSaving}>SAVE AS DRAFT</button>
              <button className="hbtn" style={{ ...S.hBtn, width: "100%", background: "#fff", color: "#111", border: "2px solid #111", padding: "12px", fontSize: 13 }} onClick={() => setLookStep(2)}>← BACK TO PIECES</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
