import React from "react";
import { Eye, Heart, Mail, Star, TrendingUp, Zap } from "lucide-react";
import { catEmoji, CARD_COLORS } from "../lib/constants";
import { Thumb, Stars } from "../components/Shared";

// Phase 10c — seller analytics dashboard.
//
// Rendered as a third tab inside the seller Dashboard (alongside ACTIVE / SOLD).
// Everything here is the logged-in seller's own data only: `myItems` are already
// scoped to the seller in App.js (getListingsByUser), and we filter `orders`
// down to rows where seller_id === user.id before any earnings maths, so another
// seller's numbers can never leak in.
//
// SCHEMA NOTE (flagged in the PR): `listings.views` is a single lifetime counter
// with no per-event timestamps, so view-derived metrics (Total Views, per-listing
// views, conversion, avg-views, most-viewed) are LIFETIME and cannot honour the
// time filter. The filter therefore drives only the timestamped metrics — total
// earnings, sales count, the earnings chart and recent sales — via orders.created_at.

// Currency is always £ GBP per the issue's design system.
const gbp = (n) => `£${(Number(n) || 0).toFixed(2)}`;
const orderAmount = (o) => (o.amount != null ? Number(o.amount) : (o.amount_pence || 0) / 100);

// Collapse the varied stored order statuses onto the issue's three-state model
// (mirrors Orders.js so badges stay consistent across the app).
const normaliseStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "dispatched" || v === "shipped") return "dispatched";
  if (v === "delivered") return "delivered";
  return "pending";
};
const STATUS_BADGE = {
  pending:    { label: "PENDING",    background: "#111",    color: "#fff" },
  dispatched: { label: "DISPATCHED", background: "#00E5CC", color: "#111" },
  delivered:  { label: "DELIVERED",  background: "#FF1493", color: "#fff" },
};

const PERIODS = [["7", "7 DAYS"], ["30", "30 DAYS"], ["all", "ALL TIME"]];

// ---- shared inline styles -------------------------------------------------
const ST = {
  filterBtn: (on) => ({
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2,
    padding: "9px 18px", border: "2px solid #111", borderRadius: 0, cursor: "pointer",
    background: on ? "#FF1493" : "#fff", color: on ? "#fff" : "#111",
  }),
  sectionLabel: {
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 2,
    color: "#111", borderLeft: "4px solid #FF1493", paddingLeft: 12, marginBottom: 18,
    display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase",
  },
  card: {
    border: "none", boxShadow: "0 6px 22px rgba(17,17,17,0.09)", borderRadius: 0, background: "#fff", padding: "18px 20px",
    display: "flex", flexDirection: "column", gap: 6,
  },
  cardLabel: {
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 2,
    color: "#FF1493", textTransform: "uppercase",
  },
  cardNum: {
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 38, fontWeight: 900, color: "#111",
    lineHeight: 1, letterSpacing: -1,
  },
  cardSub: {
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
    color: "#6b6b6b",
  },
  th: (active) => ({
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 1.5,
    color: active ? "#FF1493" : "#888", textTransform: "uppercase", padding: "12px 14px",
    textAlign: "left", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
    borderBottom: "2px solid #111",
  }),
  td: {
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#111",
    padding: "10px 14px", whiteSpace: "nowrap",
  },
};

// Headline / engagement stat card — same styling for both per the issue.
function StatCard({ label, value, sub, valueNode }) {
  return (
    <div style={ST.card}>
      <span style={ST.cardLabel}>{label}</span>
      <span style={ST.cardNum}>{valueNode || value}</span>
      {sub != null && <span style={ST.cardSub}>{sub}</span>}
    </div>
  );
}

// Build chart buckets from a list of (already seller-scoped, period-scoped) orders.
// 7 days → by day, 30 days → by week, all time → by month. `now` is passed in so
// the buckets line up with the same clock used for the period cutoff.
function buildBuckets(orders, period, now) {
  const day = 86400000;
  if (period === "7") {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - i);
      const end = new Date(start); end.setDate(start.getDate() + 1);
      const total = orders
        .filter(o => { const t = new Date(o.created_at); return t >= start && t < end; })
        .reduce((a, o) => a + orderAmount(o), 0);
      out.push({ label: start.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(), total });
    }
    return out;
  }
  if (period === "30") {
    const out = [];
    // Five rolling 7-day windows ending today (~30 days of coverage).
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
      const total = orders
        .filter(o => { const t = new Date(o.created_at); return t >= start && t <= end; })
        .reduce((a, o) => a + orderAmount(o), 0);
      out.push({ label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase(), total });
    }
    return out;
  }
  // ALL TIME — one bucket per calendar month that actually has sales.
  const months = {};
  orders.forEach(o => {
    const t = new Date(o.created_at);
    const key = t.getFullYear() * 12 + t.getMonth();
    if (!months[key]) months[key] = { sort: key, total: 0, label: t.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }).toUpperCase() };
    months[key].total += orderAmount(o);
  });
  return Object.values(months).sort((a, b) => a.sort - b.sort);
}

// Lightweight dependency-free SVG bar chart. Pink bars, #111 axes, Barlow labels.
function EarningsChart({ buckets }) {
  const hasData = buckets.some(b => b.total > 0);
  if (!buckets.length || !hasData) {
    return (
      <div style={{ border: "2px solid #111", padding: "48px 20px", textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1, color: "#6f6f6f" }}>
        NO SALES IN THIS PERIOD
      </div>
    );
  }
  const W = Math.max(buckets.length * 64, 320), H = 220;
  const padL = 44, padB = 34, padT = 16, padR = 12;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(...buckets.map(b => b.total), 1);
  // Round the axis max up to a "nice" number for the gridline labels.
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const barGap = plotW / buckets.length;
  const barW = Math.min(barGap * 0.55, 56);
  const gridlines = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div style={{ border: "2px solid #111", padding: 12, overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: W, maxWidth: "100%", height: "auto" }} preserveAspectRatio="xMinYMid meet" role="img" aria-label="Earnings over time">
        {/* horizontal gridlines + £ labels */}
        {gridlines.map((g, i) => {
          const y = padT + plotH * (1 - g);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={g === 0 ? "#111" : "#eee"} strokeWidth={g === 0 ? 2 : 1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 700, fill: "#999" }}>£{Math.round(niceMax * g)}</text>
            </g>
          );
        })}
        {/* Y axis */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#111" strokeWidth={2} />
        {/* bars + x labels */}
        {buckets.map((b, i) => {
          const h = (b.total / niceMax) * plotH;
          const x = padL + i * barGap + (barGap - barW) / 2;
          const y = padT + plotH - h;
          return (
            <g key={i}>
              {b.total > 0 && <rect x={x} y={y} width={barW} height={h} fill="#FF1493" />}
              {b.total > 0 && <text x={x + barW / 2} y={y - 5} textAnchor="middle" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 800, fill: "#111" }}>£{Math.round(b.total)}</text>}
              <text x={x + barW / 2} y={H - 12} textAnchor="middle" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 700, fill: "#888", letterSpacing: 0.5 }}>{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Phase 13 — collapse the promotion lifecycle onto a badge. 'active' only counts
// while expires_at is still in the future; a stale 'active' the cron hasn't swept
// reads as expired so the row never lies about being live.
const promoStatus = (p) => {
  const s = String(p.status || "").toLowerCase();
  const live = s === "active" && p.expires_at && new Date(p.expires_at).getTime() > Date.now();
  if (live) return "active";
  if (s === "pending") return "pending";
  return "expired";
};
const PROMO_BADGE = {
  active:  { label: "ACTIVE",  background: "#FF1493", color: "#fff" },
  pending: { label: "PENDING", background: "#FF9500", color: "#fff" },
  expired: { label: "EXPIRED", background: "#111",    color: "#fff" },
};

export default function Analytics({ user, myItems = [], orders = [], wishlistCounts = {}, sellerRatings = {}, openDetail, messageBuyer, promotions = [], onPromoteAgain }) {
  const [period, setPeriod] = React.useState("30");
  const [sortBy, setSortBy] = React.useState("views");

  // `now` is computed once per render so the cutoff and chart buckets agree.
  const now = new Date();
  const days = period === "7" ? 7 : period === "30" ? 30 : null;
  const cutoff = days == null ? null : new Date(now.getTime() - days * 86400000);

  // Seller-scoped orders, then period-scoped (the only place the time filter
  // applies — see the SCHEMA NOTE at the top of this file).
  const sellerOrders = React.useMemo(
    () => orders.filter(o => o.seller_id === user?.id),
    [orders, user]
  );
  const periodOrders = React.useMemo(
    () => sellerOrders.filter(o => !cutoff || (o.created_at && new Date(o.created_at) >= cutoff)),
    [sellerOrders, cutoff]
  );

  // ---- aggregates ----
  const totalEarnings = periodOrders.reduce((a, o) => a + orderAmount(o), 0);
  const salesCount = periodOrders.length;
  const activeCount = myItems.filter(i => !i.sold).length;
  const soldCount = myItems.filter(i => i.sold).length;
  const totalViews = myItems.reduce((a, i) => a + (i.views || 0), 0);
  const savesFor = (id) => wishlistCounts[id] || 0;
  const totalSaves = myItems.reduce((a, i) => a + savesFor(i.id), 0);

  const conversionRate = totalViews > 0 ? (soldCount / totalViews) * 100 : 0;
  const avgViews = myItems.length > 0 ? totalViews / myItems.length : 0;
  const mostViewed = myItems.reduce((best, i) => ((i.views || 0) > (best?.views || 0) ? i : best), null);
  const rating = user ? sellerRatings[user.id] : null;
  // Avg sale price (period) and lifetime sell-through (sold ÷ everything listed).
  const avgSalePrice = salesCount > 0 ? totalEarnings / salesCount : 0;
  const listedTotal = soldCount + activeCount;
  const sellThrough = listedTotal > 0 ? (soldCount / listedTotal) * 100 : 0;
  // Buyer loyalty (lifetime): how many distinct buyers, and how many bought 2+ times.
  const buyerCounts = {};
  sellerOrders.forEach(o => { if (o.buyer_id) buyerCounts[o.buyer_id] = (buyerCounts[o.buyer_id] || 0) + 1; });
  const uniqueBuyers = Object.keys(buyerCounts).length;
  const repeatBuyers = Object.values(buyerCounts).filter(n => n > 1).length;
  // Earnings split by category (period) for the SALES BY CATEGORY bars.
  const catEarnings = {};
  periodOrders.forEach(o => { const l = myItems.find(i => i.id === o.listing_id); const cat = (l?.category || "Other").toUpperCase(); catEarnings[cat] = (catEarnings[cat] || 0) + orderAmount(o); });
  const catRows = Object.entries(catEarnings).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catMax = Math.max(...catRows.map(([, v]) => v), 1);

  const buckets = buildBuckets(periodOrders, period, now);

  // Listing performance rows — sortable by the three tappable columns.
  const rows = [...myItems].sort((a, b) => {
    if (sortBy === "price") return (b.price || 0) - (a.price || 0);
    if (sortBy === "saves") return savesFor(b.id) - savesFor(a.id);
    return (b.views || 0) - (a.views || 0); // views (default)
  });

  // Recent sales — 5 newest seller orders within the selected period.
  const recentSales = [...periodOrders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
  const listingById = (id) => myItems.find(i => i.id === id);

  const sortArrow = (key) => (sortBy === key ? " ▾" : "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {/* TIME PERIOD FILTER */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#6f6f6f", marginRight: 4 }}>PERIOD</span>
        {PERIODS.map(([v, l]) => (
          <button key={v} className="hbtn" style={ST.filterBtn(period === v)} onClick={() => setPeriod(v)}>{l}</button>
        ))}
      </div>

      {/* SECTION 1 — OVERVIEW STATS */}
      <div>
        <div style={ST.sectionLabel}><TrendingUp width={15} height={15} /> OVERVIEW</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }} className="analytics-stat-grid">
          <StatCard label="Total Earnings" value={gbp(totalEarnings)} sub={`from ${salesCount} sale${salesCount === 1 ? "" : "s"}`} />
          <StatCard label="Avg Sale Price" value={gbp(avgSalePrice)} sub={salesCount > 0 ? "per sale this period" : "no sales yet"} />
          <StatCard label="Active Listings" value={activeCount} sub={`${soldCount} sold all time`} />
          <StatCard label="Total Views" value={totalViews} sub="across all listings" />
          <StatCard label="Saves / Wishlists" value={totalSaves} sub="across all listings" />
        </div>
      </div>

      {/* SECTION 2 — EARNINGS CHART */}
      <div>
        <div style={ST.sectionLabel}>EARNINGS OVER TIME</div>
        <EarningsChart buckets={buckets} />
      </div>

      {/* SECTION 2b — SALES BY CATEGORY */}
      <div>
        <div style={ST.sectionLabel}>SALES BY CATEGORY</div>
        {catRows.length === 0 ? (
          <div style={{ border: "2px solid #111", padding: "40px 20px", textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1, color: "#6f6f6f" }}>
            NO SALES IN THIS PERIOD
          </div>
        ) : (
          <div style={{ border: "2px solid #111", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {catRows.map(([cat, total], i) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#111", width: 110, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
                <div style={{ flex: 1, height: 16, background: "#f3f3f3", position: "relative" }}>
                  <div style={{ width: `${Math.max(4, (total / catMax) * 100)}%`, height: "100%", background: CARD_COLORS[i % CARD_COLORS.length] }} />
                </div>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, color: "#111", width: 64, textAlign: "right", flexShrink: 0 }}>{gbp(total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3 — LISTING PERFORMANCE TABLE */}
      <div>
        <div style={ST.sectionLabel}>LISTING PERFORMANCE</div>
        {rows.length === 0 ? (
          <div style={{ border: "2px solid #111", padding: "40px 20px", textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, color: "#6f6f6f", letterSpacing: 1 }}>NO LISTINGS YET.</div>
        ) : (
          <div style={{ border: "2px solid #111", overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={ST.th(false)}>ITEM</th>
                  <th style={ST.th(false)}>STATUS</th>
                  <th style={ST.th(sortBy === "views")} onClick={() => setSortBy("views")}>VIEWS{sortArrow("views")}</th>
                  <th style={ST.th(sortBy === "saves")} onClick={() => setSortBy("saves")}>SAVES{sortArrow("saves")}</th>
                  <th style={ST.th(sortBy === "price")} onClick={() => setSortBy("price")}>PRICE{sortArrow("price")}</th>
                  <th style={ST.th(false)}>CONVERSION</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, idx) => {
                  const accent = CARD_COLORS[idx % CARD_COLORS.length];
                  const saves = savesFor(item.id);
                  const views = item.views || 0;
                  const ratio = views > 0 ? Math.min(100, (saves / views) * 100) : 0;
                  return (
                    <tr key={item.id} style={{ background: idx % 2 ? "#f9f9f9" : "#fff", borderBottom: "2px solid #111", cursor: openDetail ? "pointer" : "default" }} onClick={() => openDetail && openDetail(item)}>
                      <td style={ST.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Thumb src={item.image_url || (item.images && item.images[0]) || ""} emoji={item.emoji || catEmoji(item.category)} accent={accent} style={{ width: 40, height: 40, flexShrink: 0, border: "2px solid #111" }} emojiStyle={{ fontSize: 18 }} imgStyle={{ opacity: item.sold ? 0.55 : 1 }} />
                          <span style={{ fontWeight: 800, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
                        </div>
                      </td>
                      <td style={ST.td}>
                        <span style={{ display: "inline-block", padding: "3px 9px", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, border: "2px solid #111", background: item.sold ? "#111" : "#00E5CC", color: item.sold ? "#fff" : "#111" }}>{item.sold ? "SOLD" : "ACTIVE"}</span>
                      </td>
                      <td style={ST.td}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Eye width={13} height={13} /> {views}</span></td>
                      <td style={ST.td}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Heart width={13} height={13} /> {saves}</span></td>
                      <td style={{ ...ST.td, fontWeight: 900 }}>{gbp(item.price)}</td>
                      <td style={ST.td}>
                        {item.sold ? (
                          <span style={{ color: "#FF1493", fontWeight: 900, letterSpacing: 1 }}>SOLD</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                            <div style={{ flex: 1, height: 8, border: "1.5px solid #111", background: "#fff", maxWidth: 70 }}>
                              <div style={{ width: `${ratio}%`, height: "100%", background: "#FF1493" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#888" }}>{ratio.toFixed(1)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4 — ENGAGEMENT METRICS */}
      <div>
        <div style={ST.sectionLabel}>ENGAGEMENT</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }} className="analytics-stat-grid">
          <StatCard label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} sub="views that became sales" />
          <StatCard label="Sell-Through Rate" value={`${sellThrough.toFixed(0)}%`} sub={`${soldCount} of ${listedTotal} listed`} />
          <StatCard label="Repeat Buyers" value={repeatBuyers} sub={`${uniqueBuyers} unique buyer${uniqueBuyers === 1 ? "" : "s"}`} />
          <StatCard label="Avg Views / Listing" value={avgViews.toFixed(1)} sub="per listing" />
          <StatCard
            label="Most Viewed"
            valueNode={
              mostViewed ? (
                <span
                  onClick={() => openDetail && openDetail(mostViewed)}
                  style={{ fontSize: 20, cursor: openDetail ? "pointer" : "default", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111", textDecoration: openDetail ? "underline" : "none" }}
                >
                  {mostViewed.name}
                </span>
              ) : "—"
            }
            sub={mostViewed ? `${mostViewed.views || 0} views` : "no views yet"}
          />
          <StatCard
            label="Avg Star Rating"
            valueNode={
              rating && rating.count > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {rating.average.toFixed(1)} <span style={{ fontSize: 13, color: "#888", fontWeight: 700 }}>/ 5</span>
                  <Stars value={rating.average} size={16} />
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#6f6f6f" }}>—<Star width={16} height={16} /></span>
              )
            }
            sub={rating && rating.count > 0 ? `from ${rating.count} review${rating.count === 1 ? "" : "s"}` : "no reviews yet"}
          />
        </div>
      </div>

      {/* SECTION 5 — RECENT SALES */}
      <div>
        <div style={ST.sectionLabel}>RECENT SALES</div>
        {recentSales.length === 0 ? (
          <div style={{ border: "2px solid #111", padding: "40px 20px", textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1, color: "#6f6f6f" }}>
            NO SALES YET — YOUR SALES WILL APPEAR HERE
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentSales.map(order => {
              const listing = listingById(order.listing_id);
              const badge = STATUS_BADGE[normaliseStatus(order.status)];
              const dateStr = order.created_at
                ? new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()
                : "";
              return (
                <div key={order.id} style={{ border: "2px solid #111", padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <Thumb src={listing?.image_url || (listing?.images && listing.images[0]) || ""} emoji={listing?.emoji || catEmoji(listing?.category)} accent="#FF1493" style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111" }} emojiStyle={{ fontSize: 22 }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ background: badge.background, color: badge.color, padding: "3px 9px", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, fontFamily: "'Barlow Condensed',sans-serif" }}>{badge.label}</span>
                      {dateStr && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 700, color: "#6f6f6f", letterSpacing: 1 }}>{dateStr}</span>}
                    </div>
                    <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, color: "#111", lineHeight: 1.1 }}>{listing?.name || "Item"}</p>
                    <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 900, color: "#FF1493" }}>{gbp(orderAmount(order))}</p>
                  </div>
                  {messageBuyer && order.buyer_id && (
                    <button className="hbtn" style={{ background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, padding: "8px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => messageBuyer(order)}>
                      <Mail width={14} height={14} /> MESSAGE BUYER
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 6 — PROMOTIONS (Phase 13) */}
      <div>
        <div style={ST.sectionLabel}><Zap width={15} height={15} /> PROMOTIONS</div>
        {promotions.length === 0 ? (
          <div style={{ border: "2px solid #111", padding: "40px 20px", textAlign: "center", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1, color: "#6f6f6f" }}>
            NO PROMOTIONS YET — BOOST A LISTING FROM THE ACTIVE TAB
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {promotions.map(promo => {
              const status = promoStatus(promo);
              const badge = PROMO_BADGE[status];
              const listing = promo.listings || listingById(promo.listing_id) || {};
              const title = listing.name || "Listing";
              const amount = promo.amount_pence != null ? gbp(promo.amount_pence / 100) : "£2.99";
              const fmt = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase() : null;
              const start = fmt(promo.started_at) || fmt(promo.created_at);
              const end = fmt(promo.expires_at);
              const dateStr = start && end ? `${start} – ${end}` : (start || end || "");
              const daysLeft = status === "active" && promo.expires_at
                ? Math.max(0, Math.ceil((new Date(promo.expires_at).getTime() - Date.now()) / 86400000))
                : null;
              return (
                <div key={promo.id} style={{ border: "2px solid #111", padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <Thumb src={listing.image_url || (listing.images && listing.images[0]) || ""} emoji={catEmoji(listing.category)} accent="#FF1493" style={{ width: 48, height: 48, flexShrink: 0, border: "2px solid #111" }} emojiStyle={{ fontSize: 22 }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ background: badge.background, color: badge.color, padding: "3px 9px", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, fontFamily: "'Barlow Condensed',sans-serif", display: "inline-flex", alignItems: "center", gap: 4 }}><Zap width={11} height={11} fill="currentColor" /> {badge.label}</span>
                      {daysLeft != null && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 800, color: "#FF1493", letterSpacing: 1 }}>{daysLeft} DAY{daysLeft === 1 ? "" : "S"} LEFT</span>}
                      {dateStr && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 700, color: "#6f6f6f", letterSpacing: 1 }}>{dateStr}</span>}
                    </div>
                    <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, color: "#111", lineHeight: 1.1 }}>{title}</p>
                    <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, color: "#FF1493" }}>{amount} · 7 days</p>
                  </div>
                  {status === "expired" && onPromoteAgain && promo.listing_id && listingById(promo.listing_id) && (
                    <button className="hbtn" style={{ background: "#FF1493", color: "#fff", border: "2px solid #111", borderRadius: 0, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1.5, padding: "8px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => onPromoteAgain(promo.listing_id)}>
                      <Zap width={13} height={13} fill="currentColor" /> PROMOTE AGAIN
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
