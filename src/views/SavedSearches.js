import React from "react";
import { Bookmark, Trash2, Search, Bell } from "lucide-react";
import { S } from "../styles";
import { filterSummary } from "../lib/constants";

// Phase 12 — My Saved Searches (issue PART 3).
//
// Reached from the logged-in nav dropdown ("SAVED SEARCHES") and the
// /saved-searches path. Lists the buyer's saved shop filters; each card runs the
// search (SEARCH NOW → applies the filters back onto the shop), toggles its email
// alert on/off (PATCH email_alerts in Supabase) or deletes it. Empty state nudges
// the buyer to save one from the shop. Design system throughout: 2px #111
// borders, no border-radius, Barlow Condensed, #FF1493 active state.
export default function SavedSearches({
  view, setView, user,
  savedSearches = [],
  applySavedSearch = () => {},
  toggleSavedSearchAlerts = () => {},
  deleteSavedSearch = () => {},
  setAuthMode = () => {},
}) {
  if (view !== "saved-searches") return null;

  const fmtDate = (d) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return ""; }
  };

  return (
    <section style={{ maxWidth: 880, margin: "0 auto", padding: "36px 24px 80px", fontFamily: "'Barlow Condensed',sans-serif" }}>
      <button style={S.back} onClick={() => setView("shop")}>← BACK TO SHOP</button>
      <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(34px,7vw,56px)", fontWeight: 900, letterSpacing: -1, lineHeight: 0.95, color: "#111", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 14 }}>
        <Bookmark width={38} height={38} /> SAVED SEARCHES
      </h1>
      <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "#888", marginTop: 6, marginBottom: 28 }}>
        Run a saved search any time, or let us email you when new listings match.
      </p>

      {!user ? (
        <div style={{ ...S.empty, padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Bookmark width={48} height={48} color="#808080" /></p>
          <p style={{ fontSize: 24, fontWeight: 900, margin: "0 0 18px", fontFamily: "'Barlow Condensed',sans-serif" }}>LOG IN TO VIEW SAVED SEARCHES</p>
          <button className="hbtn" style={S.hBtn} onClick={() => { setAuthMode("login"); setView("auth"); }}>LOG IN →</button>
        </div>
      ) : savedSearches.length === 0 ? (
        <div style={{ ...S.empty, padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Search width={48} height={48} color="#808080" /></p>
          <p style={{ fontSize: 26, fontWeight: 900, margin: "0 0 8px", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>NO SAVED SEARCHES YET</p>
          <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "#888", margin: "0 0 22px" }}>
            Save a search from the shop to get notified about new listings.
          </p>
          <button className="hbtn" style={S.hBtn} onClick={() => setView("shop")}>BROWSE LISTINGS →</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {savedSearches.map((s) => {
            const title = s.name && s.name.trim() ? s.name.trim() : filterSummary(s.filters);
            const summary = filterSummary(s.filters);
            const alertsOn = s.email_alerts !== false;
            return (
              <div key={s.id} style={{ border: "2px solid #111", borderRadius: 0, background: "#fff", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: 0.3, color: "#111", margin: 0, lineHeight: 1.1 }}>{title}</p>
                    {s.name && s.name.trim() && summary !== title && (
                      <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#888", margin: "4px 0 0", letterSpacing: 0.5 }}>{summary}</p>
                    )}
                    <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "#6f6f6f", margin: "8px 0 0" }}>Saved {fmtDate(s.created_at)}</p>
                  </div>
                  <button
                    aria-label="Delete saved search"
                    onClick={() => deleteSavedSearch(s.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#6f6f6f", flexShrink: 0, display: "flex" }}
                    className="ss-del"
                  >
                    <Trash2 width={20} height={20} />
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
                  {/* Email alerts toggle — #FF1493 active state */}
                  <button
                    type="button"
                    onClick={() => toggleSavedSearchAlerts(s.id, !alertsOn)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Barlow Condensed',sans-serif" }}
                  >
                    <span style={{ width: 44, height: 24, borderRadius: 0, border: "2px solid #111", background: alertsOn ? "#FF1493" : "#fff", position: "relative", transition: "background .15s", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 2, left: alertsOn ? 22 : 2, width: 16, height: 16, background: alertsOn ? "#fff" : "#111", transition: "left .15s" }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: alertsOn ? "#FF1493" : "#999", display: "inline-flex", alignItems: "center", gap: 5, textTransform: "uppercase" }}>
                      <Bell width={14} height={14} /> {alertsOn ? "Email alerts on" : "Email alerts off"}
                    </span>
                  </button>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => applySavedSearch(s)}
                      style={{ background: "#111", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "9px 18px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Search width={15} height={15} /> SEARCH NOW
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedSearch(s.id)}
                      style={{ background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, padding: "9px 18px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 1.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Trash2 width={15} height={15} /> DELETE
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
