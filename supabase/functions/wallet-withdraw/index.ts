// Supabase Edge Function: wallet-withdraw
// ----------------------------------------
// A seller withdraws their available wallet balance to their bank account. The
// browser posts { user_id, amount_pence }; this function (all server-side, never
// trusting the browser for the balance):
//   1. loads the seller's profile (Connect state) and verifies onboarding,
//   2. derives the AVAILABLE balance from the ledger (sum of every non-'failed'
//      wallet_transactions.amount_pence) - sale credits positive, withdrawals
//      negative,
//   3. validates the requested amount (>0, ≤ balance),
//   4. writes a 'pending' withdrawal row, creates a Stripe transfer to the
//      seller's connected account, then stamps the row 'paid' + transfer id (or
//      'failed' + reason). Funds reach the bank on the connected account's payout
//      schedule.
//
// Separate-charges-and-transfers: sale money already sits in the platform
// balance, so a withdrawal is a transfer of the seller's own credited earnings.
//
// Required env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy wallet-withdraw --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const fmt = (p: number) => `£${(p / 100).toFixed(2).replace(/\.00$/, "")}`;

// Available (withdrawable) balance = every non-failed transaction EXCEPT sale
// credits still held 'pending' the buyer's confirmation (Vinted-style escrow).
async function availableBalance(userId: string): Promise<number> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/wallet_transactions?user_id=eq.${userId}&select=type,amount_pence,status`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  if (!r || !r.ok) return 0;
  const rows: Array<{ type: string; amount_pence: number; status: string }> = await r.json().catch(() => []);
  return rows
    .filter((t) => t.status !== "failed" && (t.type !== "sale" || t.status === "available"))
    .reduce((s, t) => s + (Number(t.amount_pence) || 0), 0);
}

async function patchTx(id: string, patch: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?id=eq.${id}`, {
    method: "PATCH", headers: sbHeaders, body: JSON.stringify(patch),
  }).catch(() => {});
}

async function notify(userId: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST", headers: sbHeaders, body: JSON.stringify({ user_id: userId, read: false, ...body }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user_id, amount_pence } = await req.json();
    if (!user_id) return json({ error: "Missing user_id." }, 400);
    const amount = Math.round(Number(amount_pence));
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter an amount greater than 0." }, 400);

    // 1. Profile / Connect state.
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&select=id,stripe_account_id,stripe_onboarding_complete&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const profile = pr && pr.ok ? (await pr.json().catch(() => []))[0] : null;
    if (!profile) return json({ error: "Profile not found." }, 404);

    const onboarded = profile.stripe_onboarding_complete === true && !!profile.stripe_account_id;
    if (!onboarded) return json({ needs_onboarding: true, error: "Finish your payment setup to withdraw." }, 409);

    // 2 + 3. Validate against the authoritative ledger balance.
    const balance = await availableBalance(user_id);
    if (amount > balance) {
      return json({ error: `That's more than your available balance (${fmt(balance)}).`, balance_pence: balance }, 400);
    }

    // 4. Record the withdrawal as pending FIRST (so the balance reflects it even if
    //    the transfer call is slow), then transfer.
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id, type: "withdrawal", amount_pence: -amount, status: "pending",
        description: "Withdrawal to bank",
      }),
    }).catch(() => null);
    const txRow = insRes && insRes.ok ? (await insRes.json().catch(() => []))[0] : null;
    if (!txRow?.id) return json({ error: "Couldn't start the withdrawal. Please try again." }, 500);

    // Transfer the seller's own earnings from the platform balance to their account.
    let transferId: string | null = null;
    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: "gbp",
        destination: profile.stripe_account_id,
        metadata: { user_id, wallet_withdrawal: "true", tx_id: txRow.id },
      });
      transferId = transfer.id;
    } catch (e) {
      const raw = (e as Error).message || "Stripe transfer failed.";
      await patchTx(txRow.id, { status: "failed", failure_reason: raw.slice(0, 480) });
      // Friendly message - the seller shouldn't see Stripe's raw "insufficient
      // available funds … dashboard.stripe.com" text. The withdrawal row was
      // marked failed, so the wallet balance is unchanged.
      const insufficient = /insufficient|balance/i.test(raw);
      const friendly = insufficient
        ? "We couldn't complete the withdrawal right now - the payment balance is still settling. Your wallet balance is unchanged; please try again shortly."
        : "We couldn't complete the withdrawal right now. Your wallet balance is unchanged; please try again.";
      return json({ error: friendly, code: insufficient ? "balance_settling" : "transfer_failed" }, 502);
    }

    await patchTx(txRow.id, { status: "paid", stripe_transfer_id: transferId });
    await notify(user_id, {
      type: "wallet",
      title: "💷 Withdrawal sent!",
      body: `${fmt(amount)} is on its way to your bank account.`,
    });

    return json({ paid: true, transfer_id: transferId, amount_pence: amount, balance_pence: balance - amount });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not process the withdrawal." }, 500);
  }
});
