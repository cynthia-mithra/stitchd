import React, { useState, useEffect, useRef } from "react";
import {
  Scissors, MapPin, Instagram, Globe, Trash2, ArrowUp, ArrowDown,
  Star, X, Check, Camera,
} from "lucide-react";
import { S } from "../styles";
import { F } from "../components/Shared";

// ── Phase 14 — Tailor profiles ────────────────────────────────────────────────
// A NEW feature (separate from the older tailor_services marketplace): any user
// can apply to become a tailor and, once the admin approves, gets a public
// profile at /tailors/<id>. This one component owns three views:
//   • tailor-apply     — the 5-step "Become a tailor" application flow
//   • tailor-dashboard — the approved tailor's own dashboard (Profile/Portfolio/…)
//   • tailor-public    — the public profile page
// Form/local state lives here; persistence goes through the passed-in `db` +
// upload helpers, and App.js keeps the authoritative `myTailor` row in sync via
// `onTailorChange`.

export const SPECIALISMS = [
  "Saree blouse stitching", "Lehenga alterations", "Sherwani tailoring",
  "Salwar kameez alterations", "Bridal wear", "Embroidery and embellishment",
  "Hem alterations", "Taking in / letting out", "Custom stitching from scratch",
  "General alterations",
];
// Turnaround dropdown → the integer turnaround_days stored on the row. We keep the
// human label for display and map it to a representative number of days.
export const TURNAROUND = [
  { label: "1-3 days", days: 3 },
  { label: "3-5 days", days: 5 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "2+ weeks", days: 21 },
];
const MAX_PORTFOLIO = 8;

const turnaroundLabel = (days) => (TURNAROUND.find((t) => t.days === days) || {}).label || (days ? `${days} days` : "");
export const tailorPriceFrom = (t) => (t && t.price_from_pence != null ? Math.round(t.price_from_pence / 100) : null);
const poundsToPence = (v) => { const n = parseFloat(v); return isNaN(n) ? null : Math.round(n * 100); };

// Pink primary button used for SUBMIT / SAVE / BOOK (#FF1493, white, 2px #111).
const pinkBtn = { background: "#FF1493", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "16px 28px", fontSize: 15, cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 };
const sectionHeading = { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 900, letterSpacing: 3, color: "#111", borderLeft: "4px solid #FF1493", paddingLeft: 12, marginBottom: 16, textTransform: "uppercase" };
// Specialism pill: 2px #111 border, no radius, Barlow Condensed, white bg.
const specPill = { background: "#fff", border: "2px solid #111", borderRadius: 0, padding: "8px 16px", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1, color: "#111", whiteSpace: "nowrap" };

// Multi-select pill (same style as the occasion filter) used in step 2.
function SpecSelect({ selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {SPECIALISMS.map((s) => {
        const on = selected.includes(s);
        return (
          <button key={s} type="button" className="fpill" onClick={() => onToggle(s)}
            style={{ ...S.pill, ...(on ? { ...S.pillOn, background: "#FF1493", borderColor: "#FF1493" } : {}) }}>
            {s}
          </button>
        );
      })}
    </div>
  );
}

// A square image upload tile (used for the profile/banner image + portfolio).
function ImagePicker({ preview, onPick, onClear, label, height = 160, round = false }) {
  const ref = useRef();
  return (
    <div style={{ position: "relative", width: round ? height : "100%", height, border: "2px solid #111", borderRadius: round ? "50%" : 0, overflow: "hidden", background: "#fafafa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => ref.current && ref.current.click()}>
      {preview
        ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ textAlign: "center", color: "#bbb", pointerEvents: "none" }}><Camera width={26} height={26} /><div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, marginTop: 6 }}>{label}</div></div>}
      {preview && onClear && <button type="button" style={S.removeImg} onClick={(e) => { e.stopPropagation(); onClear(); }}>✕</button>}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) onPick(f); e.target.value = ""; }} />
    </div>
  );
}

export default function TailorProfile({
  view, setView, user, token, flash, db,
  myTailor, onTailorChange,
  viewedTailor, viewedTailorLoading,
  uploadProfileImage, uploadPortfolioImage,
  onSubmitApplication, openTailorPublic,
}) {
  // ── Application flow state (5 steps) ──────────────────────────────────────
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ display_name: "", location: "", bio: "", specialisms: [], price_from: "", price_to: "", turnaround: "", instagram_handle: "", website_url: "" });
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [portfolio, setPortfolio] = useState([]); // {file,preview,caption,garment_type}
  const [submitting, setSubmitting] = useState(false);

  // Reset the wizard each time the apply view is (re)entered.
  useEffect(() => { if (view === "tailor-apply") { setStep(1); } }, [view]);

  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSpec = (s) => setForm((f) => ({ ...f, specialisms: f.specialisms.includes(s) ? f.specialisms.filter((x) => x !== s) : [...f.specialisms, s] }));

  const pickProfile = (file) => { setProfileFile(file); setProfilePreview(URL.createObjectURL(file)); };
  const addPortfolio = (file) => setPortfolio((p) => p.length >= MAX_PORTFOLIO ? p : [...p, { file, preview: URL.createObjectURL(file), caption: "", garment_type: "" }]);
  const setPortfolioField = (i, k, v) => setPortfolio((p) => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const removePortfolio = (i) => setPortfolio((p) => p.filter((_, idx) => idx !== i));

  const step1Valid = form.display_name.trim() && form.location.trim() && form.bio.trim() && profileFile;
  const canSubmit = step1Valid && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmitApplication({ form, profileFile, portfolio });
    } finally {
      setSubmitting(false);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // APPLY FLOW
  // ════════════════════════════════════════════════════════════════════════
  if (view === "tailor-apply") {
    return (
      <main style={{ ...S.main, maxWidth: 780 }}>
        <button style={S.back} onClick={() => setView("shop")}>← BACK</button>
        <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: "3px solid #111" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 4, color: "#FF1493", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Scissors width={16} height={16} /> JOIN AS A TAILOR</p>
          <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(40px,8vw,72px)", fontWeight: 900, letterSpacing: -1, lineHeight: 0.95 }}>BECOME A<br /><span style={{ color: "#FF1493" }}>TAILOR.</span></h1>
        </div>

        {/* Step progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
          {["Basics", "Specialisms", "Pricing", "Portfolio", "Review"].map((label, i) => {
            const n = i + 1; const active = n === step; const done = n < step;
            return <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "2px solid #111", background: active ? "#FF1493" : done ? "#111" : "#fff", color: active || done ? "#fff" : "#111", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>{done ? <Check width={13} height={13} /> : `${n}.`} {label.toUpperCase()}</div>;
          })}
        </div>

        <div style={S.formCard}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <h3 style={sectionHeading}>BASIC INFO</h3>
              <F l="DISPLAY NAME *"><input style={S.inp} placeholder="Your name or business name" value={form.display_name} onChange={(e) => up("display_name", e.target.value)} /></F>
              <F l="LOCATION *"><input style={S.inp} placeholder="e.g. London, UK" value={form.location} onChange={(e) => up("location", e.target.value)} /></F>
              <F l="BIO *">
                <textarea style={{ ...S.inp, height: 120, resize: "vertical" }} maxLength={500} placeholder="Tell buyers about your experience and skills..." value={form.bio} onChange={(e) => up("bio", e.target.value)} />
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, color: "#bbb", letterSpacing: 1, alignSelf: "flex-end" }}>{form.bio.length}/500</span>
              </F>
              <F l="PROFILE IMAGE *">
                <div style={{ width: 140 }}><ImagePicker preview={profilePreview} onPick={pickProfile} onClear={() => { setProfileFile(null); setProfilePreview(""); }} label="UPLOAD" height={140} round /></div>
              </F>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={sectionHeading}>SPECIALISMS</h3>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>Select all that apply.</p>
              <SpecSelect selected={form.specialisms} onToggle={toggleSpec} />
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <h3 style={sectionHeading}>PRICING & TURNAROUND</h3>
              <div>
                <div style={S.fg2}>
                  <F l="FROM (£)"><input style={S.inp} type="number" min="0" placeholder="e.g. 15" value={form.price_from} onChange={(e) => up("price_from", e.target.value)} /></F>
                  <F l="TO (£)"><input style={S.inp} type="number" min="0" placeholder="e.g. 80" value={form.price_to} onChange={(e) => up("price_to", e.target.value)} /></F>
                </div>
                <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>Your typical price range for alterations</p>
              </div>
              <F l="TURNAROUND TIME">
                <select style={S.inp} value={form.turnaround} onChange={(e) => up("turnaround", e.target.value)}>
                  <option value="">Select…</option>
                  {TURNAROUND.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
              </F>
              <F l="INSTAGRAM HANDLE (optional)"><input style={S.inp} placeholder="@yourhandle" value={form.instagram_handle} onChange={(e) => up("instagram_handle", e.target.value)} /></F>
              <F l="WEBSITE URL (optional)"><input style={S.inp} placeholder="https://…" value={form.website_url} onChange={(e) => up("website_url", e.target.value)} /></F>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 style={sectionHeading}>PORTFOLIO</h3>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>Show buyers your best work. Optional — you can add up to {MAX_PORTFOLIO} images now or later from your dashboard.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
                {portfolio.map((it, i) => (
                  <div key={i} style={{ border: "2px solid #111", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ position: "relative", height: 150, border: "1px solid #eee", overflow: "hidden" }}>
                      <img src={it.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button type="button" style={S.removeImg} onClick={() => removePortfolio(i)}>✕</button>
                    </div>
                    <input style={{ ...S.inp, padding: "8px 10px", fontSize: 13 }} placeholder="Caption" value={it.caption} onChange={(e) => setPortfolioField(i, "caption", e.target.value)} />
                    <input style={{ ...S.inp, padding: "8px 10px", fontSize: 13 }} placeholder="Garment type" value={it.garment_type} onChange={(e) => setPortfolioField(i, "garment_type", e.target.value)} />
                  </div>
                ))}
                {portfolio.length < MAX_PORTFOLIO && (
                  <div style={{ minHeight: 150 }}><ImagePicker onPick={addPortfolio} label="ADD PHOTO" height={232} /></div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 style={sectionHeading}>REVIEW & SUBMIT</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                <ReviewRow label="Name" value={form.display_name} />
                <ReviewRow label="Location" value={form.location} />
                <ReviewRow label="Bio" value={form.bio} />
                <ReviewRow label="Specialisms" value={form.specialisms.join(", ") || "—"} />
                <ReviewRow label="Price range" value={form.price_from || form.price_to ? `£${form.price_from || "?"} – £${form.price_to || "?"}` : "—"} />
                <ReviewRow label="Turnaround" value={form.turnaround || "—"} />
                <ReviewRow label="Instagram" value={form.instagram_handle || "—"} />
                <ReviewRow label="Website" value={form.website_url || "—"} />
                <ReviewRow label="Portfolio" value={`${portfolio.length} image${portfolio.length === 1 ? "" : "s"}`} />
              </div>
              {!step1Valid && <p style={{ ...S.aError, marginBottom: 16 }}>Please complete the required basics (name, location, bio, profile image) in step 1 before submitting.</p>}
              <button className="hbtn" style={{ ...pinkBtn, width: "100%", opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>{submitting ? "SUBMITTING…" : "SUBMIT APPLICATION →"}</button>
            </div>
          )}

          {/* Wizard nav */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "2px solid #f0f0f0" }}>
            <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", padding: "12px 22px", fontSize: 13, visibility: step === 1 ? "hidden" : "visible" }} onClick={() => setStep((s) => Math.max(1, s - 1))}>← BACK</button>
            {step < 5 && (
              <button className="hbtn" style={{ ...S.hBtn, background: "#111", color: "#fff", padding: "12px 22px", fontSize: 13, opacity: step === 1 && !step1Valid ? 0.5 : 1 }} disabled={step === 1 && !step1Valid} onClick={() => setStep((s) => Math.min(5, s + 1))}>NEXT →</button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════════════════
  if (view === "tailor-dashboard") {
    return <TailorDashboard tailor={myTailor} token={token} db={db} flash={flash} setView={setView} onTailorChange={onTailorChange} uploadProfileImage={uploadProfileImage} uploadPortfolioImage={uploadPortfolioImage} openTailorPublic={openTailorPublic} />;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PUBLIC PROFILE
  // ════════════════════════════════════════════════════════════════════════
  if (view === "tailor-public") {
    return <PublicTailor tailor={viewedTailor} loading={viewedTailorLoading} setView={setView} flash={flash} />;
  }

  return null;
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 14, borderBottom: "1px solid #f0f0f0", paddingBottom: 10 }}>
      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: "#bbb", textTransform: "uppercase", width: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111", whiteSpace: "pre-wrap" }}>{value}</span>
    </div>
  );
}

// ── Tailor dashboard ──────────────────────────────────────────────────────────
function TailorDashboard({ tailor, token, db, flash, setView, onTailorChange, uploadProfileImage, uploadPortfolioImage, openTailorPublic }) {
  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState(null);
  const [profileFile, setProfileFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [portfolio, setPortfolio] = useState([]);
  const addRef = useRef();

  useEffect(() => {
    if (!tailor) return;
    setForm({
      display_name: tailor.display_name || "", location: tailor.location || "", bio: tailor.bio || "",
      specialisms: tailor.specialisms || [],
      price_from: tailor.price_from_pence != null ? Math.round(tailor.price_from_pence / 100) : "",
      price_to: tailor.price_to_pence != null ? Math.round(tailor.price_to_pence / 100) : "",
      turnaround: turnaroundLabel(tailor.turnaround_days),
      instagram_handle: tailor.instagram_handle || "", website_url: tailor.website_url || "",
    });
    setProfileFile(null); setBannerFile(null);
    setPortfolio(tailor.tailor_portfolio ? [...tailor.tailor_portfolio].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : []);
    // Refresh portfolio from the server for the freshest order.
    db.getTailorPortfolio(tailor.id, token).then((rows) => { if (rows && rows.length) setPortfolio(rows); }).catch(() => {});
  }, [tailor, token, db]);

  if (!tailor || !form) return null;
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSpec = (s) => setForm((f) => ({ ...f, specialisms: f.specialisms.includes(s) ? f.specialisms.filter((x) => x !== s) : [...f.specialisms, s] }));

  async function save() {
    setSaving(true);
    try {
      const patch = {
        display_name: form.display_name.trim(), location: form.location.trim(), bio: form.bio.trim(),
        specialisms: form.specialisms,
        price_from_pence: poundsToPence(form.price_from), price_to_pence: poundsToPence(form.price_to),
        turnaround_days: (TURNAROUND.find((t) => t.label === form.turnaround) || {}).days ?? null,
        instagram_handle: form.instagram_handle.trim() || null, website_url: form.website_url.trim() || null,
      };
      if (profileFile) patch.profile_image_url = await uploadProfileImage(profileFile, token);
      if (bannerFile) patch.banner_image_url = await uploadProfileImage(bannerFile, token);
      const updated = await db.updateTailor(tailor.id, patch, token);
      onTailorChange({ ...tailor, ...patch, ...(updated || {}) });
      setProfileFile(null); setBannerFile(null);
      flash("✓ Profile saved");
    } catch (e) { flash("Couldn't save: " + e.message); }
    finally { setSaving(false); }
  }

  async function addPhotos(files) {
    const room = MAX_PORTFOLIO - portfolio.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (!list.length) { flash(`Max ${MAX_PORTFOLIO} portfolio images.`); return; }
    try {
      let pos = portfolio.length;
      const added = [];
      for (const f of list) {
        const url = await uploadPortfolioImage(f, token);
        const row = await db.insertPortfolioItem({ tailor_id: tailor.id, image_url: url, position: pos++, caption: null, garment_type: null }, token);
        added.push(row);
      }
      setPortfolio((p) => [...p, ...added]);
      flash("✓ Photos added");
    } catch (e) { flash("Upload failed: " + e.message); }
  }

  async function delPhoto(id) {
    try { await db.deletePortfolioItem(id, token); setPortfolio((p) => p.filter((x) => x.id !== id)); }
    catch (e) { flash("Couldn't delete: " + e.message); }
  }

  async function savePhotoField(id, patch) {
    setPortfolio((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
    db.updatePortfolioItem(id, patch, token).catch(() => {});
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= portfolio.length) return;
    const next = [...portfolio];
    [next[i], next[j]] = [next[j], next[i]];
    setPortfolio(next);
    // Persist new positions.
    next.forEach((it, idx) => { if (it.position !== idx) db.updatePortfolioItem(it.id, { position: idx }, token).catch(() => {}); });
  }

  const TabBtn = ({ v, l }) => <button className="hbtn" style={{ ...S.hBtn, background: tab === v ? "#FF1493" : "#fff", color: tab === v ? "#fff" : "#111", border: "2px solid #111", padding: "10px 18px", fontSize: 12 }} onClick={() => setTab(v)}>{l}</button>;

  return (
    <main style={{ ...S.main, maxWidth: 1000 }}>
      <button style={S.back} onClick={() => setView("shop")}>← BACK TO SHOP</button>
      <div style={S.dashHeader}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 4, color: "#FF1493", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Scissors width={16} height={16} /> TAILOR DASHBOARD</p>
          <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(34px,6vw,56px)", fontWeight: 900, letterSpacing: -1, lineHeight: 0.95 }}>{tailor.display_name}</h1>
        </div>
        <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", padding: "12px 20px", fontSize: 12 }} onClick={() => openTailorPublic(tailor.id)}>PREVIEW PROFILE ↗</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
        <TabBtn v="profile" l="PROFILE" /><TabBtn v="portfolio" l="PORTFOLIO" /><TabBtn v="bookings" l="BOOKINGS" /><TabBtn v="reviews" l="REVIEWS" />
      </div>

      {tab === "profile" && (
        <div style={S.formCard}>
          <h3 style={sectionHeading}>BANNER IMAGE</h3>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Optional, full-width header on your public profile.</p>
          <ImagePicker preview={bannerFile ? URL.createObjectURL(bannerFile) : tailor.banner_image_url} onPick={setBannerFile} onClear={() => setBannerFile(null)} label="UPLOAD BANNER" height={140} />
          <div style={{ display: "flex", gap: 24, marginTop: 24, flexWrap: "wrap" }}>
            <div style={{ width: 130 }}>
              <h3 style={sectionHeading}>PROFILE</h3>
              <ImagePicker preview={profileFile ? URL.createObjectURL(profileFile) : tailor.profile_image_url} onPick={setProfileFile} onClear={() => setProfileFile(null)} label="UPLOAD" height={130} round />
            </div>
            <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 14 }}>
              <F l="DISPLAY NAME *"><input style={S.inp} value={form.display_name} onChange={(e) => up("display_name", e.target.value)} /></F>
              <F l="LOCATION *"><input style={S.inp} value={form.location} onChange={(e) => up("location", e.target.value)} /></F>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <F l="BIO"><textarea style={{ ...S.inp, height: 110, resize: "vertical" }} maxLength={500} value={form.bio} onChange={(e) => up("bio", e.target.value)} /></F>
          </div>
          <div style={{ marginTop: 20 }}>
            <h3 style={sectionHeading}>SPECIALISMS</h3>
            <SpecSelect selected={form.specialisms} onToggle={toggleSpec} />
          </div>
          <div style={{ ...S.fg2, marginTop: 20 }}>
            <F l="FROM (£)"><input style={S.inp} type="number" min="0" value={form.price_from} onChange={(e) => up("price_from", e.target.value)} /></F>
            <F l="TO (£)"><input style={S.inp} type="number" min="0" value={form.price_to} onChange={(e) => up("price_to", e.target.value)} /></F>
          </div>
          <div style={{ marginTop: 14 }}>
            <F l="TURNAROUND">
              <select style={S.inp} value={form.turnaround} onChange={(e) => up("turnaround", e.target.value)}>
                <option value="">Select…</option>
                {TURNAROUND.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </F>
          </div>
          <div style={{ ...S.fg2, marginTop: 14 }}>
            <F l="INSTAGRAM HANDLE"><input style={S.inp} value={form.instagram_handle} onChange={(e) => up("instagram_handle", e.target.value)} /></F>
            <F l="WEBSITE URL"><input style={S.inp} value={form.website_url} onChange={(e) => up("website_url", e.target.value)} /></F>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <button className="hbtn" style={{ ...pinkBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? "SAVING…" : "SAVE CHANGES"}</button>
            <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", padding: "16px 24px", fontSize: 14, letterSpacing: 2 }} onClick={() => openTailorPublic(tailor.id)}>PREVIEW PROFILE ↗</button>
          </div>
        </div>
      )}

      {tab === "portfolio" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#888" }}>{portfolio.length}/{MAX_PORTFOLIO} IMAGES</p>
            <button className="hbtn" style={{ ...pinkBtn, padding: "12px 22px", fontSize: 13, opacity: portfolio.length >= MAX_PORTFOLIO ? 0.5 : 1 }} disabled={portfolio.length >= MAX_PORTFOLIO} onClick={() => addRef.current && addRef.current.click()}>+ ADD PHOTOS</button>
            <input ref={addRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files.length) addPhotos(e.target.files); e.target.value = ""; }} />
          </div>
          {portfolio.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", border: "3px dashed #e0e0e0" }}>
              <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Scissors width={48} height={48} color="#ccc" /></p>
              <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: "#bbb" }}>NO PHOTOS YET.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
              {portfolio.map((it, i) => (
                <div key={it.id} style={{ border: "2px solid #111", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ position: "relative", height: 170, border: "1px solid #eee", overflow: "hidden" }}>
                    <img src={it.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" title="Delete" style={{ ...S.removeImg, display: "flex", alignItems: "center", gap: 0, padding: "4px 6px" }} onClick={() => delPhoto(it.id)}><Trash2 width={14} height={14} /></button>
                  </div>
                  <input style={{ ...S.inp, padding: "8px 10px", fontSize: 13 }} placeholder="Caption" defaultValue={it.caption || ""} onBlur={(e) => savePhotoField(it.id, { caption: e.target.value })} />
                  <input style={{ ...S.inp, padding: "8px 10px", fontSize: 13 }} placeholder="Garment type" defaultValue={it.garment_type || ""} onBlur={(e) => savePhotoField(it.id, { garment_type: e.target.value })} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", flex: 1, justifyContent: "center", display: "flex", padding: "8px", opacity: i === 0 ? 0.4 : 1 }} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp width={14} height={14} /></button>
                    <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", flex: 1, justifyContent: "center", display: "flex", padding: "8px", opacity: i === portfolio.length - 1 ? 0.4 : 1 }} disabled={i === portfolio.length - 1} onClick={() => move(i, 1)}><ArrowDown width={14} height={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bookings" && (
        <div style={{ textAlign: "center", padding: "60px 20px", border: "3px dashed #e0e0e0" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: "#bbb", marginBottom: 8 }}>BOOKINGS COMING SOON</p>
          <p style={{ fontSize: 14, color: "#999" }}>Alteration requests will appear here.</p>
        </div>
      )}
      {tab === "reviews" && (
        <div style={{ textAlign: "center", padding: "60px 20px", border: "3px dashed #e0e0e0" }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: "#bbb", marginBottom: 8 }}>NO REVIEWS YET</p>
          <p style={{ fontSize: 14, color: "#999" }}>Your reviews will appear here.</p>
        </div>
      )}
    </main>
  );
}

// ── Public tailor profile (/tailors/<id>) ─────────────────────────────────────
function PublicTailor({ tailor, loading, setView, flash }) {
  const [lightbox, setLightbox] = useState(null);

  if (loading) {
    return <main style={S.main}><div style={S.loadingWrap}><div style={S.spinner} /><p style={S.loadingText}>LOADING…</p></div></main>;
  }
  if (!tailor) {
    return (
      <main style={{ ...S.main, maxWidth: 700 }}>
        <button style={S.back} onClick={() => setView("shop")}>← BACK TO SHOP</button>
        <div style={{ textAlign: "center", padding: "80px 20px", border: "3px dashed #e0e0e0" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Scissors width={56} height={56} color="#ccc" /></p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: "#bbb" }}>TAILOR NOT FOUND.</p>
        </div>
      </main>
    );
  }

  const portfolio = (tailor.tailor_portfolio || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const priceFrom = tailorPriceFrom(tailor);
  const ig = (tailor.instagram_handle || "").replace(/^@/, "");

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Header / banner */}
      <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ width: "100%", height: 200, background: tailor.banner_image_url ? "#000" : "#FF1493", borderBottom: "2px solid #111", overflow: "hidden" }}>
          {tailor.banner_image_url && <img src={tailor.banner_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ position: "absolute", left: 24, bottom: -40, width: 80, height: 80, borderRadius: "50%", border: "2px solid #111", overflow: "hidden", background: "#FF1493", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {tailor.profile_image_url
            ? <img src={tailor.profile_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 34, fontWeight: 900, color: "#fff" }}>{(tailor.display_name || "T")[0].toUpperCase()}</span>}
        </div>
      </div>

      <main style={{ ...S.main, maxWidth: 1000, paddingTop: 56 }}>
        <button style={S.back} onClick={() => setView("shop")}>← BACK TO SHOP</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(34px,6vw,56px)", fontWeight: 900, letterSpacing: -1, lineHeight: 0.95, marginBottom: 8 }}>{tailor.display_name}</h1>
            {tailor.location && <p style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 1, color: "#555", marginBottom: 8 }}><MapPin width={16} height={16} /> {tailor.location}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#FF1493", marginBottom: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} width={16} height={16} fill="none" stroke="#ddd" />)}
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>No reviews yet</span>
            </div>
            {priceFrom != null && <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: "#FF1493", marginBottom: 4 }}>From £{priceFrom}</p>}
            {tailor.turnaround_days != null && <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#555", letterSpacing: 1 }}>Typically {turnaroundLabel(tailor.turnaround_days)}</p>}
            <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
              {ig && <a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "#111", textDecoration: "none", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}><Instagram width={16} height={16} /> @{ig}</a>}
              {tailor.website_url && <a href={tailor.website_url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "#111", textDecoration: "none", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}><Globe width={16} height={16} /> Website</a>}
            </div>
          </div>
          <button className="hbtn" style={pinkBtn} onClick={() => flash("Booking coming soon!")}><Scissors width={16} height={16} /> BOOK THIS TAILOR</button>
        </div>

        {/* Specialisms */}
        {(tailor.specialisms || []).length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={sectionHeading}>SPECIALISMS</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tailor.specialisms.map((s) => <span key={s} style={specPill}>{s}</span>)}
            </div>
          </section>
        )}

        {/* About */}
        {tailor.bio && (
          <section style={{ marginTop: 32 }}>
            <h2 style={sectionHeading}>ABOUT</h2>
            <p style={{ fontSize: 15, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{tailor.bio}</p>
          </section>
        )}

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <h2 style={sectionHeading}>PORTFOLIO</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
              {portfolio.map((it) => (
                <figure key={it.id} style={{ border: "2px solid #111", overflow: "hidden", cursor: "pointer", background: "#fff" }} onClick={() => setLightbox(it)}>
                  <div style={{ height: 220, overflow: "hidden", background: "#fafafa" }}><img src={it.image_url} alt={it.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                  {(it.caption || it.garment_type) && (
                    <figcaption style={{ padding: "10px 12px", borderTop: "2px solid #111" }}>
                      {it.caption && <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#111" }}>{it.caption}</p>}
                      {it.garment_type && <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#FF1493", textTransform: "uppercase", marginTop: 2 }}>{it.garment_type}</p>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        <section style={{ marginTop: 32, marginBottom: 48 }}>
          <h2 style={sectionHeading}>REVIEWS</h2>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, color: "#bbb", letterSpacing: 1 }}>No reviews yet</p>
        </section>
      </main>

      {lightbox && (
        <div style={S.modalOverlay} onClick={() => setLightbox(null)}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button style={{ ...S.removeImg, top: -14, right: -14, borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setLightbox(null)}><X width={16} height={16} /></button>
            <img src={lightbox.image_url} alt={lightbox.caption || ""} style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", border: "2px solid #111", background: "#fff" }} />
            {lightbox.caption && <p style={{ textAlign: "center", color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, marginTop: 12 }}>{lightbox.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
