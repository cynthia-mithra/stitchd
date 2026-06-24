import React from "react";
import { Package, Mail, AlertCircle, CheckCircle, Star, Truck, ExternalLink } from "lucide-react";
import { S } from "../styles";
import { trackingUrl, SHIPPING_LABELS_ENABLED } from "../lib/constants";
import { VerifiedBadge } from "../components/Shared";

// Post-purchase order history (issue PART 2 & PART 5).
//
// Orders are stored with a `status` that has varied across deployments
// (the webhook writes "paid"; sellers move it through dispatched/delivered).
// `normaliseStatus` collapses every legacy value onto the issue's three-state
// model so the badge + seller dropdown stay consistent no matter what's stored.
const normaliseStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "completed" || v === "received") return "completed";
  if (v === "dispatched" || v === "shipped") return "dispatched";
  if (v === "delivered") return "delivered";
  return "pending"; // paid / pending / disputed / anything else
};

// Badge palette from the design system in the issue.
const STATUS_BADGE = {
  pending:    { label: "PENDING",    background: "#111",     color: "#fff" },
  dispatched: { label: "DISPATCHED", background: "#00E5CC",  color: "#111" },
  delivered:  { label: "DELIVERED",  background: "#FF1493",  color: "#fff" },
  completed:  { label: "COMPLETED",  background: "#34C759",  color: "#fff" },
};
const STATUS_FLOW = ["pending", "dispatched", "delivered"];

// Shimmer block for the loading skeleton rows.
const SK = { background: "linear-gradient(90deg,#f3f3f3 25%,#e9e9e9 50%,#f3f3f3 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite", borderRadius: 2 };

export default function Orders({
  view, setView, user, items,
  ordersTab, setOrdersTab, ordersLoading, myOrders,
  orderProfiles = {},
  updateOrderStatus, confirmOrderReceived = () => {}, startOrderConversation,
  openDispute = () => {},
  onReviewOrder = () => {}, reviewedListings = new Set(),
  saveOrderTracking = () => {}, onBuyLabel = () => {},
}) {
  if (view !== "orders") return null;
  if (!user) return null;

  // Seller tracking-number entry: per-order input value + which orders are in edit mode.
  const [trackInputs, setTrackInputs] = React.useState({});
  const [trackEditing, setTrackEditing] = React.useState({});

  const firstName = (uid) => {
    const p = orderProfiles[uid];
    if (!p) return "A buyer";
    if (p.full_name && p.full_name.trim()) return p.full_name.trim().split(/\s+/)[0];
    return p.username || "A buyer";
  };
  const sellerName = (uid, listing) => orderProfiles[uid]?.username || orderProfiles[uid]?.full_name || listing?.seller || "Seller";

  const filtered = myOrders.filter(o =>
    ordersTab === "all" ||
    (ordersTab === "buying"  && o.buyer_id  === user.id) ||
    (ordersTab === "selling" && o.seller_id === user.id)
  );

  return (
    <main style={S.main}>
      <button style={S.back} onClick={() => setView("shop")}>← BACK</button>
      <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "3px solid #111", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 4, color: "#FF1493", marginBottom: 6 }}>YOUR TRANSACTIONS</p>
          <h2 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 48, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>MY ORDERS</h2>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["All", "all"], ["Buying", "buying"], ["Selling", "selling"]].map(([l, v]) => (
            <button key={v} className="fpill" style={{ ...S.pill, ...(ordersTab === v ? S.pillOn : {}) }} onClick={() => setOrdersTab(v)}>{l}</button>
          ))}
        </div>
      </div>

      {ordersLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array(3).fill(0).map((_, i) => (
            <div key={i} style={{ border: "2px solid #eee", padding: 20, display: "flex", gap: 16 }}>
              <div style={{ ...SK, width: 72, height: 72, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...SK, width: "35%", height: 11, marginBottom: 10 }} />
                <div style={{ ...SK, width: "70%", height: 16, marginBottom: 10 }} />
                <div style={{ ...SK, width: "25%", height: 18 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}><Package width={40} height={40} /></div>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 900, margin: "20px 0 6px", letterSpacing: -0.5 }}>NO ORDERS YET.</p>
          <p style={S.emptySub}>{ordersTab === "selling" ? "Your sales will show up here once someone buys a piece." : "Pieces you buy will appear here — go find something you love."}</p>
          <button className="hbtn" style={S.hBtn} onClick={() => setView("shop")}>BROWSE LISTINGS →</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(order => {
            const listing = items.find(i => i.id === order.listing_id);
            const isBuyer = order.buyer_id === user.id;
            const status = normaliseStatus(order.status);
            const badge = STATUS_BADGE[status];
            const amount = order.amount != null ? Number(order.amount) : (order.amount_pence || 0) / 100;
            const dateStr = order.created_at
              ? new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()
              : "";
            return (
              <div key={order.id} className="order-card" style={{ border: "2px solid #111", borderLeft: `6px solid ${badge.background}`, padding: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", background: "#fff" }}>
                <div style={{ width: 72, height: 72, flexShrink: 0, border: "2px solid #111", background: "#f6f6f6", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {listing?.image_url || (listing?.images && listing.images[0])
                    ? <img src={listing.image_url || listing.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <Package width={26} height={26} color="#bbb" />}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ background: badge.background, color: badge.color, padding: "3px 10px", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, fontFamily: "'Barlow Condensed',sans-serif" }}>{badge.label}</span>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: "#bbb", letterSpacing: 1 }}>{isBuyer ? "BUYING" : "SELLING"}{dateStr ? ` · ${dateStr}` : ""}</span>
                  </div>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, marginBottom: 4 }}>{listing?.name || "Item"}</p>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, color: "#888", letterSpacing: 0.5, marginBottom: 2, display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {isBuyer ? `from ${sellerName(order.seller_id, listing)}` : `to ${firstName(order.buyer_id)}`}
                    {/* Phase 11 — verified badge beside the seller name in buyer order history. */}
                    {isBuyer && orderProfiles[order.seller_id]?.verified && <VerifiedBadge size="sm" />}
                  </p>
                  <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, color: "#FF1493", marginBottom: 10 }}>£{amount.toFixed(2)}</p>

                  {/* SHIP TO — seller only, so they can post the item / buy a label. */}
                  {!isBuyer && order.delivery_address && (order.delivery_address.line1 || order.delivery_address.postcode) && (
                    <div style={{ border: "1px solid #e0e0e0", background: "#fafafa", padding: "10px 12px", marginBottom: 12, fontFamily: "'Barlow Condensed',sans-serif" }}>
                      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#888", marginBottom: 4 }}>SHIP TO</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111", lineHeight: 1.4 }}>
                        {order.delivery_address.name}{order.delivery_address.name ? <br /> : null}
                        {order.delivery_address.line1}{order.delivery_address.line2 ? `, ${order.delivery_address.line2}` : ""}<br />
                        {order.delivery_address.city}{order.delivery_address.city ? ", " : ""}{order.delivery_address.postcode}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {/* BUYER → message the seller */}
                    {isBuyer && startOrderConversation && (
                      <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, fontSize: 11, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => startOrderConversation(order)}>
                        <Mail width={14} height={14} /> MESSAGE SELLER
                      </button>
                    )}
                    {/* BUYER → confirm receipt (Vinted-style). Releases the seller's
                        held earnings. Shown once the item is on its way and not yet
                        completed. */}
                    {isBuyer && status !== "pending" && status !== "completed" && (
                      <button className="hbtn" style={{ ...S.hBtn, background: "#34C759", color: "#fff", border: "2px solid #111", borderRadius: 0, fontSize: 11, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => { if (window.confirm("Confirm you've received this item and everything's OK? This releases the seller's payment.")) confirmOrderReceived(order); }}>
                        <CheckCircle width={14} height={14} /> CONFIRM RECEIVED
                      </button>
                    )}
                    {/* BUYER → report a problem (dispute). Only once the item has been
                        dispatched/delivered — i.e. status is not PENDING (issue PART 2). */}
                    {isBuyer && status !== "pending" && status !== "completed" && (
                      <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, fontSize: 11, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => openDispute(order)}>
                        <AlertCircle width={14} height={14} /> REPORT A PROBLEM
                      </button>
                    )}
                    {isBuyer && status === "completed" && (
                      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#34C759", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle width={14} height={14} /> RECEIVED · PAYMENT RELEASED
                      </span>
                    )}
                    {/* Post-delivery review prompt — once the item's arrived, invite the
                        buyer to rate the seller (or show a Reviewed state if done). */}
                    {isBuyer && (status === "delivered" || status === "completed") && (
                      reviewedListings.has(order.listing_id) ? (
                        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#FF9500", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Star width={14} height={14} fill="currentColor" /> REVIEWED
                        </span>
                      ) : (
                        <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#FF9500", border: "2px solid #FF9500", borderRadius: 0, fontSize: 11, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => onReviewOrder(order)}>
                          <Star width={14} height={14} /> LEAVE A REVIEW
                        </button>
                      )
                    )}
                    {/* SELLER → status dropdown + message the buyer */}
                    {!isBuyer && (
                      <>
                        {status !== "completed" ? (
                          <>
                            <label style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#888" }}>STATUS</label>
                            <select
                              value={status}
                              onChange={e => updateOrderStatus(order.id, e.target.value)}
                              style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, padding: "8px 12px", border: "2px solid #111", borderRadius: 0, background: "#fff", color: "#111", cursor: "pointer" }}
                            >
                              {STATUS_FLOW.map(s => (
                                <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#34C759", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle width={14} height={14} /> PAYMENT RELEASED
                          </span>
                        )}
                        {startOrderConversation && order.buyer_id && (
                          <button className="hbtn" style={{ ...S.hBtn, background: "#fff", color: "#111", border: "2px solid #111", borderRadius: 0, fontSize: 11, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => startOrderConversation(order)}>
                            <Mail width={14} height={14} /> MESSAGE BUYER
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {/* TRACKING — seller adds a number once dispatched; both parties get
                      a "Track parcel" link to the carrier's tracking page. */}
                  {(status === "dispatched" || status === "delivered") && (() => {
                    const hasT = !!order.tracking_number;
                    const editing = !!trackEditing[order.id] || (!isBuyer && !hasT);
                    const url = trackingUrl(order.tracking_carrier || order.postage_carrier, order.tracking_number);
                    const rowStyle = { marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
                    const lblFont = { fontFamily: "'Barlow Condensed',sans-serif" };
                    if (hasT && !trackEditing[order.id]) {
                      return (
                        <div style={rowStyle}>
                          <span style={{ ...lblFont, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: "#111", display: "inline-flex", alignItems: "center", gap: 6 }}><Truck width={15} height={15} /> {order.tracking_carrier ? `${String(order.tracking_carrier).split("·")[0].trim()} · ` : ""}{order.tracking_number}</span>
                          {url && <a href={url} target="_blank" rel="noreferrer" style={{ ...lblFont, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#FF1493", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>TRACK PARCEL <ExternalLink width={12} height={12} /></a>}
                          {!isBuyer && order.label_url && <a href={order.label_url} target="_blank" rel="noreferrer" style={{ ...lblFont, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#111", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, border: "2px solid #111", padding: "5px 10px" }}><Package width={12} height={12} /> VIEW LABEL</a>}
                          {!isBuyer && <button onClick={() => { setTrackEditing(p => ({ ...p, [order.id]: true })); setTrackInputs(p => ({ ...p, [order.id]: order.tracking_number || "" })); }} style={{ ...lblFont, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", textDecoration: "underline", padding: 0 }}>EDIT</button>}
                        </div>
                      );
                    }
                    if (!isBuyer) {
                      const val = trackInputs[order.id] !== undefined ? trackInputs[order.id] : (order.tracking_number || "");
                      return (
                        <div style={rowStyle}>
                          <Truck width={15} height={15} style={{ flexShrink: 0 }} />
                          <input value={val} onChange={e => setTrackInputs(p => ({ ...p, [order.id]: e.target.value }))} placeholder="Tracking number" style={{ flex: "1 1 160px", minWidth: 0, border: "2px solid #111", borderRadius: 0, padding: "8px 12px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700 }} />
                          <button className="hbtn" onClick={() => { saveOrderTracking(order, val); setTrackEditing(p => ({ ...p, [order.id]: false })); }} style={{ ...S.hBtn, background: "#111", border: "none", borderRadius: 0, fontSize: 11, padding: "9px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}><Truck width={14} height={14} /> SAVE TRACKING</button>
                          {SHIPPING_LABELS_ENABLED && (
                            <button className="hbtn" onClick={() => onBuyLabel(order)} style={{ ...S.hBtn, background: "#FF1493", border: "none", borderRadius: 0, fontSize: 11, padding: "9px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}><Package width={14} height={14} /> GENERATE LABEL</button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <p style={{ ...lblFont, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0", fontSize: 11, color: "#bbb", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}><Truck width={14} height={14} /> Tracking will appear here once the seller adds it.</p>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
