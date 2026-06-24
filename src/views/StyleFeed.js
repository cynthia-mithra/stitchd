import React, { useState } from "react";
import { Sparkles, Heart, Share2, Trash2, Plus, Camera, X, Search, Check } from "lucide-react";
import { currencySymbol, catEmoji } from "../lib/constants";
import { S } from "../styles";
import { Thumb } from "../components/Shared";
import LoginPromptModal from "../components/LoginPromptModal";

const PAGE = 12;            // posts loaded per LOAD MORE (matches App.js)
const MAX_CAPTION = 300;
const MAX_TAGS = 5;
const MAX_IMG_MB = 10;

// "3 hours ago" style relative time. Coarse buckets are plenty for a feed.
export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} minute${m !== 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} day${d !== 1 ? "s" : ""} ago`;
  const w = Math.floor(d / 7); if (w < 5) return `${w} week${w !== 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} month${mo !== 1 ? "s" : ""} ago`;
  const y = Math.floor(d / 365); return `${y} year${y !== 1 ? "s" : ""} ago`;
}

const displayName = (p) => (p && ((p.username && p.username.trim()) || (p.full_name && p.full_name.trim()))) || "Someone";
const initial = (p) => (displayName(p)[0] || "S").toUpperCase();

// 40px avatar circle, 2px #111 border, pink fill + initial fallback.
function Avatar({ profile, size = 40, onClick }) {
  return (
    <div onClick={onClick} style={{ width: size, height: size, borderRadius: "50%", border: "2px solid #111", overflow: "hidden", flexShrink: 0, background: "#FF1493", display: "flex", alignItems: "center", justifyContent: "center", cursor: onClick ? "pointer" : "default" }}>
      {profile && profile.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, color: "#fff", fontSize: size * 0.45 }}>{initial(profile)}</span>}
    </div>
  );
}

// ── A single style post card ─────────────────────────────────────────────────
function PostCard({ post, profile, listingsMap, liked, likeCount, isOwn, openProfile, openDetail, onLike, onShare, onDelete }) {
  const tagged = (post.listing_ids || []).map(id => listingsMap[id]).filter(Boolean);
  return (
    <article style={{ background: "#fff", border: "2px solid #111", borderRadius: 0, display: "flex", flexDirection: "column" }}>
      {/* Header — avatar, username, time ago */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <Avatar profile={profile} onClick={() => post.user_id && openProfile(post.user_id)} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p onClick={() => post.user_id && openProfile(post.user_id)} style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: "#111", letterSpacing: 0.5, lineHeight: 1.1, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(profile)}</p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#6f6f6f" }}>{timeAgo(post.created_at)}</p>
        </div>
      </div>

      {/* Post image — full width, square crop, 2px #111 top+bottom borders */}
      <div style={{ width: "100%", aspectRatio: "1", borderTop: "2px solid #111", borderBottom: "2px solid #111", overflow: "hidden", background: "#fafafa" }}>
        <img src={post.image_url} alt={post.caption || "Outfit"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Caption */}
        {post.caption && <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 14, color: "#333", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.caption}</p>}

        {/* Tagged listings — horizontal scroll row */}
        {tagged.length > 0 && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {tagged.map(l => (
              <button key={l.id} onClick={() => openDetail(l)} style={{ display: "flex", alignItems: "center", gap: 8, border: "2px solid #111", background: "#fff", borderRadius: 0, padding: "6px 10px 6px 6px", cursor: "pointer", flexShrink: 0, maxWidth: 220 }}>
                <div style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111", overflow: "hidden", position: "relative" }}>
                  <Thumb src={l.image_url || (l.images && l.images[0]) || ""} emoji={l.emoji || catEmoji(l.category)} accent="#fafafa" style={{ width: "100%", height: "100%" }} emojiStyle={{ fontSize: 20 }} />
                  {l.sold && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#111", border: "1.5px solid #111", padding: "1px 4px" }}>SOLD</span></div>}
                </div>
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, color: "#111", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{l.name}</p>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, color: "#FF1493" }}>{currencySymbol(l.currency)}{l.price}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Action row — like, share, (delete on own) */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, borderTop: "2px solid #f5f5f5", paddingTop: 12 }}>
          <button onClick={() => onLike(post)} aria-label="Like" style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: 0 }}>
            <Heart width={22} height={22} color={liked ? "#FF1493" : "#111"} fill={liked ? "#FF1493" : "none"} />
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: "#111" }}>{likeCount}</span>
          </button>
          <button onClick={() => onShare(post)} aria-label="Share" style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 0 }}>
            <Share2 width={20} height={20} color="#111" />
          </button>
          {isOwn && (
            <button onClick={() => onDelete(post)} aria-label="Delete post" style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: 0, marginLeft: "auto" }}>
              <Trash2 width={20} height={20} color="#111" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Create-post modal ────────────────────────────────────────────────────────
// One scrollable modal: upload area at the top, then caption + tag-listings.
// Transient form state stays local; App owns the actual upload + insert.
function CreatePostModal({ open, onClose, onShare, creating, searchActiveListings, flash }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [tags, setTags] = useState([]);   // tagged listing objects

  const reset = () => { setFile(null); setPreview(""); setCaption(""); setQuery(""); setResults([]); setTags([]); };
  const close = () => { reset(); onClose(); };

  if (!open) return null;

  const pickFile = (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) { flash("Please choose a JPG, PNG or WEBP image."); return; }
    if (f.size > MAX_IMG_MB * 1024 * 1024) { flash(`Image must be under ${MAX_IMG_MB}MB.`); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };

  const runSearch = async (q) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    try { const rows = await searchActiveListings(q); setResults((rows || []).slice(0, 5)); }
    catch { setResults([]); }
  };

  const addTag = (l) => {
    if (tags.length >= MAX_TAGS) { flash(`You can tag up to ${MAX_TAGS} listings.`); return; }
    if (tags.some(t => t.id === l.id)) return;
    setTags(prev => [...prev, l]);
  };
  const removeTag = (id) => setTags(prev => prev.filter(t => t.id !== id));

  const share = () => { if (!file || creating) return; onShare(file, caption.trim(), tags); reset(); };

  return (
    <div style={S.modalOverlay} onClick={close}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>SHARE YOUR <span style={{ color: "#FF1493" }}>STYLE</span></h2>
          <button onClick={close} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#111", padding: 4 }}><X width={24} height={24} /></button>
        </div>

        {/* STEP 1 — photo */}
        <div onClick={() => document.getElementById("style-photo-input").click()} style={{ border: preview ? "2px solid #111" : "3px dashed #e0e0e0", borderRadius: 0, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", minHeight: 240, aspectRatio: preview ? "1" : "auto", marginBottom: 20 }}>
          {preview ? (
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ textAlign: "center", pointerEvents: "none", padding: "40px 20px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Camera width={40} height={40} color="#6f6f6f" /></div>
              <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: 1, color: "#111", marginBottom: 4 }}>SHARE YOUR OUTFIT</p>
              <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#6f6f6f" }}>JPG, PNG or WEBP · max {MAX_IMG_MB}MB</p>
            </div>
          )}
        </div>
        <input id="style-photo-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => pickFile(e.target.files[0])} />
        {preview && <button onClick={() => document.getElementById("style-photo-input").click()} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: "#FF1493", textTransform: "uppercase", padding: 0, marginBottom: 20 }}>Change photo</button>}

        {/* STEP 2 — caption */}
        <div style={{ marginBottom: 20 }}>
          <textarea value={caption} maxLength={MAX_CAPTION} onChange={e => setCaption(e.target.value)} placeholder="Tell us about your outfit..." style={{ ...S.inp, height: 90, resize: "vertical", width: "100%" }} />
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#6f6f6f", textAlign: "right", marginTop: 4 }}>{caption.length} / {MAX_CAPTION}</p>
        </div>

        {/* TAG LISTINGS */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 3, color: "#6b6b6b", marginBottom: 10 }}>TAG LISTINGS ({tags.length}/{MAX_TAGS})</p>
          <div style={{ ...S.searchBox, height: 44, marginBottom: 10 }}>
            <span style={S.searchIcon}><Search width={16} height={16} /></span>
            <input style={S.searchInput} placeholder="Tag listings from Stitch'd" value={query} onChange={e => runSearch(e.target.value)} />
            {query && <button style={S.searchClear} onClick={() => runSearch("")}>✕</button>}
          </div>
          {query.trim() && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: tags.length ? 14 : 0 }}>
              {results.length === 0 ? (
                <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, color: "#6f6f6f", letterSpacing: 1 }}>No matching listings.</p>
              ) : results.map(l => {
                const added = tags.some(t => t.id === l.id);
                const full = tags.length >= MAX_TAGS;
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "2px solid #f0f0f0", padding: "8px 10px" }}>
                    <div style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111", overflow: "hidden" }}>
                      <Thumb src={l.image_url || (l.images && l.images[0]) || ""} emoji={l.emoji || catEmoji(l.category)} accent="#fafafa" style={{ width: "100%", height: "100%" }} emojiStyle={{ fontSize: 22 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>{l.name}</p>
                      <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, color: "#FF1493" }}>{currencySymbol(l.currency)}{l.price}</p>
                    </div>
                    <button disabled={added || full} onClick={() => addTag(l)} style={{ ...S.hBtn, background: added ? "#34C759" : full ? "#e8e8e8" : "#111", color: added ? "#fff" : full ? "#aaa" : "#fff", border: "none", fontSize: 11, padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 5, cursor: (added || full) ? "not-allowed" : "pointer" }}>{added ? <><Check width={14} height={14} /> ADDED</> : <><Plus width={14} height={14} /> TAG</>}</button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Tagged chips */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "2px solid #111", padding: "4px 8px 4px 4px", background: "#fff" }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, border: "2px solid #111", overflow: "hidden" }}>
                    <Thumb src={l.image_url || (l.images && l.images[0]) || ""} emoji={l.emoji || catEmoji(l.category)} accent="#fafafa" style={{ width: "100%", height: "100%" }} emojiStyle={{ fontSize: 14 }} />
                  </div>
                  <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, color: "#111", maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                  <button onClick={() => removeTag(l.id)} aria-label="Remove tag" style={{ background: "none", border: "none", cursor: "pointer", color: "#111", padding: 0, display: "flex" }}><X width={16} height={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SHARE */}
        <button onClick={share} disabled={!file || creating} style={{ width: "100%", background: "#FF1493", color: "#fff", border: "2px solid #111", borderRadius: 0, padding: "16px", fontSize: 16, cursor: (!file || creating) ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", opacity: (!file || creating) ? 0.45 : 1 }}>
          {creating ? "SHARING…" : "SHARE TO FEED"}
        </button>
      </div>
    </div>
  );
}

// ── STYLE FEED PAGE (view === "stylefeed") ───────────────────────────────────
export default function StyleFeed({
  view, setView, user, profile,
  tab, setTab,
  posts = [], profilesMap = {}, listingsMap = {},
  likedSet, likeCounts = {}, loading, hasMore, loadMore,
  openProfile, openDetail,
  toggleLike, deletePost, sharePost,
  onGateAuth = () => {},
  createOpen, setCreateOpen, onCreate, creating, searchActiveListings,
  flash = () => {},
}) {
  // Login gate — CREATE POST and the FOLLOWING tab are already hidden when
  // logged out; liking a post opens the shared sign-up prompt (context: default).
  const [gate, setGate] = useState(null);
  const onLike = (post) => { if (user) toggleLike(post); else setGate("default"); };
  if (view !== "stylefeed") return null;
  const liked = likedSet || new Set();

  const tabs = user ? [["foryou", "FOR YOU"], ["following", "FOLLOWING"]] : [["foryou", "FOR YOU"]];

  return (
    <main style={S.main}>
      <button style={S.back} onClick={() => setView("shop")}>← BACK</button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: "3px solid #111" }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 4, color: "#FF1493", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Sparkles width={16} height={16} /> THE COMMUNITY</p>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 48, fontWeight: 900, letterSpacing: -1, lineHeight: 1, marginBottom: 8 }}>STYLE FEED</h2>
          <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, color: "#888" }}>Real outfits. Real people. All pre-loved.</p>
        </div>
        {user && (
          <button className="style-create-desktop hbtn" onClick={() => setCreateOpen(true)} style={{ ...S.hBtn, background: "#FF1493", border: "2px solid #111", padding: "12px 20px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}><Plus width={16} height={16} /> CREATE POST</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(([k, label]) => (
          <button key={k} className="hbtn" onClick={() => setTab(k)} style={{ ...S.hBtn, background: tab === k ? "#FF1493" : "#fff", color: tab === k ? "#fff" : "#111", border: "2px solid #111", fontSize: 12, padding: "8px 20px" }}>{label}</button>
        ))}
      </div>

      {loading && posts.length === 0 && <div style={S.loadingWrap}><div style={S.spinner} /></div>}

      {/* Empty states */}
      {!loading && posts.length === 0 && tab === "foryou" && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Sparkles width={48} height={48} color="#ddd" /></p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 16 }}>NO POSTS YET — BE THE FIRST TO SHARE YOUR STYLE!</p>
          {user && <button className="hbtn" style={{ ...S.hBtn, background: "#FF1493", border: "2px solid #111", padding: "12px 24px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => setCreateOpen(true)}><Plus width={16} height={16} /> CREATE POST</button>}
        </div>
      )}
      {!loading && posts.length === 0 && tab === "following" && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Sparkles width={48} height={48} color="#ddd" /></p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 16 }}>FOLLOW OTHER USERS TO SEE THEIR STYLE POSTS HERE</p>
          <button className="hbtn" style={{ ...S.hBtn, padding: "12px 24px", fontSize: 14 }} onClick={() => setTab("foryou")}>BROWSE FEED →</button>
        </div>
      )}

      {/* Feed grid */}
      {posts.length > 0 && (
        <div className="style-feed-grid">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              profile={profilesMap[post.user_id]}
              listingsMap={listingsMap}
              liked={liked.has(post.id)}
              likeCount={likeCounts[post.id] != null ? likeCounts[post.id] : (post.likes_count || 0)}
              isOwn={!!(user && post.user_id === user.id)}
              openProfile={openProfile}
              openDetail={openDetail}
              onLike={onLike}
              onShare={sharePost}
              onDelete={deletePost}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {posts.length > 0 && hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <button className="hbtn" disabled={loading} style={{ ...S.hBtn, padding: "14px 36px", fontSize: 14, opacity: loading ? 0.6 : 1 }} onClick={loadMore}>{loading ? "LOADING…" : "LOAD MORE"}</button>
        </div>
      )}

      {/* Mobile floating CREATE button */}
      {user && (
        <button className="style-create-fab" aria-label="Create post" onClick={() => setCreateOpen(true)} style={{ position: "fixed", right: 18, bottom: 22, width: 56, height: 56, borderRadius: "50%", background: "#FF1493", border: "2px solid #111", color: "#fff", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 400, boxShadow: "0 6px 20px rgba(0,0,0,0.2)" }}><Plus width={26} height={26} /></button>
      )}

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} onShare={onCreate} creating={creating} searchActiveListings={searchActiveListings} flash={flash} />

      <LoginPromptModal open={!!gate} context={gate || "default"} onClose={() => setGate(null)} onAuth={m => { setGate(null); onGateAuth(m); }} />
    </main>
  );
}

// ── HOMEPAGE STYLE INSPIRATION PREVIEW ───────────────────────────────────────
// 4 most recent posts: image, username, like count. 2x2 grid desktop, rail on
// mobile. Hidden entirely when there are no posts (caller checks too).
export function StyleInspiration({ posts = [], profilesMap = {}, onOpen }) {
  if (!posts.length) return null;
  return (
    <div style={{ maxWidth: 1300, margin: "48px auto 0", borderTop: "3px solid #111", padding: "32px 10px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: "clamp(28px,5vw,40px)", fontWeight: 900, letterSpacing: -0.5, lineHeight: 1, color: "#111", display: "flex", alignItems: "center", gap: 10 }}><Sparkles width={26} height={26} color="#FF1493" /> STYLE INSPIRATION</h2>
          <p style={{ fontFamily: "'Barlow',sans-serif", fontSize: 14, color: "#888", marginTop: 4 }}>Real outfits. Real people. All pre-loved.</p>
        </div>
        <button className="hbtn" style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#FF1493", textTransform: "uppercase", padding: 0 }} onClick={onOpen}>VIEW ALL →</button>
      </div>
      <div className="style-home-grid style-home-rail">
        {posts.slice(0, 4).map(post => {
          const p = profilesMap[post.user_id];
          return (
            <article key={post.id} className="scard" onClick={onOpen} style={{ background: "#fff", border: "2px solid #111", borderRadius: 0, cursor: "pointer", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ width: "100%", aspectRatio: "1", borderBottom: "2px solid #111", overflow: "hidden", background: "#fafafa" }}>
                <img src={post.image_url} alt={post.caption || "Outfit"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(p)}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><Heart width={15} height={15} color="#FF1493" fill="#FF1493" /><span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, color: "#111" }}>{post.likes_count || 0}</span></span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
