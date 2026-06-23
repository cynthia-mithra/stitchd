// Wallet — Stripe Connect onboarding + withdrawals for sellers (frontend callers).
// Thin wrappers around the seller-connect / wallet-withdraw Edge Functions. As
// with lib/connect.js the browser never touches Stripe with a secret key — it
// posts ids/amounts to a Supabase Edge Function which does the Stripe work.
import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

const fnHeaders = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function callFn(name, body, friendly) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST", headers: fnHeaders, body: JSON.stringify(body || {}), signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`${friendly} took too long to respond. Please try again.`);
    throw new Error("Couldn't reach the payment service. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
  if (!res.ok) {
    console.error(`[wallet:${name}] failed`, { status: res.status, body: raw });
    const reason = data.error || (raw && !raw.trim().startsWith("<") ? raw : "") || `${friendly} failed (HTTP ${res.status}).`;
    const err = new Error(reason);
    err.data = data;
    throw err;
  }
  return data;
}

// Start (or resume) Stripe Connect onboarding for a seller and redirect them to
// the Stripe-hosted flow. Returns to /wallet?connect=success. If already done,
// returns { onboarding_complete:true } and the caller stays put.
export async function startSellerConnect(userId) {
  if (!userId) throw new Error("You need to be signed in to set up payouts.");
  const data = await callFn("seller-connect", { user_id: userId, action: "start" }, "Payout setup");
  if (data.url) { window.location.href = data.url; return data; }
  return data; // { onboarding_complete:true }
}

// Confirm whether onboarding is finished (reads Stripe details_submitted, sets the
// flag). Returns { onboarding_complete }.
export async function verifySellerConnect(userId) {
  if (!userId) throw new Error("Missing user.");
  return callFn("seller-connect", { user_id: userId, action: "verify" }, "Payout verification");
}

// Withdraw an amount (in pence) from the wallet to the seller's bank. Returns
// { paid, amount_pence, balance_pence } or throws (err.data may hold needs_onboarding).
export async function withdrawFromWallet(userId, amountPence) {
  if (!userId) throw new Error("You need to be signed in.");
  return callFn("wallet-withdraw", { user_id: userId, amount_pence: amountPence }, "Withdrawal");
}

// Admin: issue a real Stripe refund to the buyer for an order (called when a
// dispute is resolved as "refunded"). Returns { refunded, refund_id, amount_pence }.
export async function refundOrder(orderId, adminId) {
  if (!orderId) throw new Error("Missing order.");
  return callFn("refund-order", { order_id: orderId, admin_id: adminId }, "Refund");
}

// Admin: refund a tailoring booking (alteration) to the buyer when a tailoring
// dispute is resolved as "refunded". Returns { refunded, refund_id, amount_pence }.
export async function refundAlteration(alterationRequestId, adminId) {
  if (!alterationRequestId) throw new Error("Missing alteration.");
  return callFn("refund-order", { alteration_request_id: alterationRequestId, admin_id: adminId }, "Refund");
}
