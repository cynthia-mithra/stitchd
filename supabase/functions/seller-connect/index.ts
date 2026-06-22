// Supabase Edge Function: seller-connect
// ---------------------------------------
// Stripe Connect onboarding for SELLERS, so they can withdraw their wallet
// earnings to a bank account. Mirrors the tailor create/verify-connect-account
// pair, but state lives on `profiles` (any seller) and both actions live here:
//
//   POST { user_id, action:"start" }
//     → ensures the seller has a Stripe Connect Express account (GB, GBP
//       transfers), stores it on profiles.stripe_account_id, and returns a
//       hosted onboarding link { url } (or { onboarding_complete:true } if already
//       finished). The browser redirects to the link.
//
//   POST { user_id, action:"verify" }
//     → reads Stripe details_submitted, flips profiles.stripe_onboarding_complete,
//       returns { onboarding_complete }.
//
// The browser only ever sends ids; Stripe secret work happens here.
//
// Required env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
// Deploy: supabase functions deploy seller-connect --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://stitchd.fit").replace(/\/$/, "");

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

// Self-healing PATCH (drops a missing column and retries) so a deployment whose
// migration hasn't run yet still records what it can.
async function patchProfile(id: string, patch: Record<string, unknown>) {
  const payload = { ...patch };
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (r && r.ok) return;
    if (!r) return;
    const text = await r.text();
    const m = /Could not find the '([^']+)' column/.exec(text || "");
    const col = m && m[1];
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) { delete payload[col]; continue; }
    console.error("seller-connect: profile PATCH failed:", text);
    return;
  }
}

async function getProfileRow(userId: string) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,stripe_account_id,stripe_onboarding_complete&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).catch(() => null);
  return r && r.ok ? (await r.json().catch(() => []))[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user_id, action } = await req.json();
    if (!user_id) return json({ error: "Missing user_id." }, 400);

    const profile = await getProfileRow(user_id);
    if (!profile) return json({ error: "Profile not found." }, 404);

    // ── VERIFY ────────────────────────────────────────────────────────────────
    if (action === "verify") {
      if (!profile.stripe_account_id) return json({ onboarding_complete: false });
      let complete = false;
      try {
        const acct = await stripe.accounts.retrieve(profile.stripe_account_id);
        complete = !!acct.details_submitted;
      } catch { complete = false; }
      await patchProfile(user_id, { stripe_onboarding_complete: complete });
      return json({ onboarding_complete: complete });
    }

    // ── START (default) ─────────────────────────────────────────────────────────
    // Reuse an existing account; only create a fresh one the first time.
    let accountId: string | null = profile.stripe_account_id || null;
    if (accountId) {
      try {
        const acct = await stripe.accounts.retrieve(accountId);
        if (acct.details_submitted) {
          await patchProfile(user_id, { stripe_onboarding_complete: true });
          return json({ onboarding_complete: true });
        }
      } catch { accountId = null; }
    }

    if (!accountId) {
      let email: string | undefined;
      const ur = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }).catch(() => null);
      if (ur && ur.ok) {
        const u = await ur.json().catch(() => null);
        if (u && typeof u.email === "string") email = u.email;
      }
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        ...(email ? { email } : {}),
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { user_id, purpose: "seller_wallet" },
      });
      accountId = account.id;
      await patchProfile(user_id, { stripe_account_id: accountId });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${SITE_URL}/wallet?connect=refresh`,
      return_url: `${SITE_URL}/wallet?connect=success`,
      type: "account_onboarding",
    });
    await patchProfile(user_id, { stripe_onboarding_url: link.url });

    return json({ url: link.url, account_id: accountId });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not start payment setup." }, 500);
  }
});
