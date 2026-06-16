// Phase 15 — Stripe Connect for tailor payouts (frontend callers).
//
// Three thin wrappers around the Connect Edge Functions. As with lib/identity.js
// and lib/promotion.js, the browser NEVER touches Stripe with a secret key — it
// posts ids to a Supabase Edge Function which does the Stripe work server-side and
// hands back a URL / result. The functions return permissive CORS headers so we
// can call them directly (no Vercel proxy needed).
import { SUPABASE_URL, SUPABASE_KEY } from "./constants";

const fnHeaders = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

// POST helper with a 20s abort + tolerant body parsing, shared by the three calls.
async function callFn(name, body, friendly) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: fnHeaders,
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`${friendly} took too long to respond. Please try again.`);
    throw new Error(`Couldn't reach the payment service. Please check your connection and try again.`);
  } finally {
    clearTimeout(timeout);
  }
  const raw = await res.text().catch(() => "");
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }
  if (!res.ok) {
    console.error(`[connect:${name}] failed`, { status: res.status, body: raw });
    const reason = data.error || (raw && !raw.trim().startsWith("<") ? raw : "") || `${friendly} failed (HTTP ${res.status}).`;
    throw new Error(reason);
  }
  return data;
}

// Start (or resume) Stripe Connect Express onboarding for a tailor and redirect
// them to the Stripe-hosted flow. Returns to /tailor-dashboard?connect=success.
export async function startConnectOnboarding(tailorId, userId) {
  if (!tailorId || !userId) throw new Error("You need to be signed in as a tailor to set up payments.");
  const data = await callFn("create-connect-account", { tailor_id: tailorId, user_id: userId }, "Payment setup");
  if (!data.url) throw new Error("Could not start payment setup. Please try again.");
  window.location.href = data.url;
}

// Confirm whether onboarding is finished (reads Stripe details_submitted). Returns
// the function's JSON: { onboarding_complete, details_submitted, url? }.
export async function verifyConnectAccount(tailorId) {
  if (!tailorId) throw new Error("Missing tailor.");
  return callFn("verify-connect-account", { tailor_id: tailorId }, "Payment verification");
}

// Release a completed booking's payout as a real Stripe transfer. Returns the
// function's JSON: { paid } | { held, reason } | { already_paid }.
export async function processTailorPayout(alterationRequestId) {
  if (!alterationRequestId) throw new Error("Missing booking.");
  return callFn("process-tailor-payout", { alteration_request_id: alterationRequestId }, "Payout");
}
