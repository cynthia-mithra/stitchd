import React from "react";
import { Package, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { S } from "../styles";
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

export default function Orders({
  view, setView, user, items,
  ordersTab, setOrdersTab, ordersLoading, myOrders,
  orderProfiles = {},
  updateOrderStatus, confirmOrderReceived = () => {}, startOrderConversation,
  openDispute = () => {},
}) {
  if (view !== "orders") return null;
  if (!user) return null;

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
        <div style={S.loadingWrap}><div style={S.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Package width={48} height={48} /></p>
          <p style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>NO ORDERS YET</p>
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
              <div key={order.id} style={{ border: "2px solid #111", padding: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
