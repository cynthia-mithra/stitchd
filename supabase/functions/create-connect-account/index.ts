// Supabase Edge Function: create-connect-account
// -----------------------------------------------
// Phase 15 - Stripe Connect onboarding for tailors. A tailor taps CONNECT BANK
// ACCOUNT in their dashboard PROFILE → PAYMENTS section; the browser posts
// { tailor_id, user_id } here and this function:
//   1. loads the authoritative tailor row (service-role) and verifies it belongs
//      to this user,
//   2. reuses the tailor's existing Express account if they've started before,
//      otherwise creates a NEW Stripe Connect Express account (GB, GBP transfers),
//   3. stores account.id on tailors.stripe_account_id,
//   4. creates a Stripe account-onboarding link and returns its URL so the
//      browser can redirect the tailor to the Stripe-hosted onboarding flow.
//
// EXPRESS accounts = Stitch'd manages onboarding (recommended in the issue). When
// the tailor returns to /tailor-dashboard?connect=success the app calls
// verify-connect-account to confirm details_submitted and flip
// stripe_onboarding_complete.
//
// Mirrors create-verification-session (the other "create a Stripe thing + return
// a hosted URL" function): same CORS, same service-role re-read, never trusts the
// browser for anything but the ids.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE - Stripe Connect must be
//                                enabled on the account; see PR description)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to read + write the tailor row
//   SITE_URL                     e.g. https://stitchd.fit  (refresh/return base)
//
// Deploy: supabase functions deploy create-connect-account --no-verify-jwt

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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// Best-effort PATCH that drops any column the schema is missing and retries - so a
// deployment whose migration hasn't run yet still records what it can (same
// self-healing approach used across the project).
async function patchTailor(id: string, patch: Record<string, unknown>) {
  const payload = { ...patch };
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tailors?id=eq.${id}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (r && r.ok) return;
    if (!r) return;
    const text = await r.text();
    const m = /Could not find the '([^']+)' column/.exec(text || "");
    const col = m && m[1];
    if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
      delete payload[col];
      continue;
    }
    console.error("create-connect-account: tailor PATCH failed:", text);
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { tailor_id, user_id } = await req.json();
    if (!tailor_id || !user_id) {
      return json({ error: "Missing tailor_id or user_id." }, 400);
    }

    // Authoritative tailor row - never trust the browser for ownership or the
    // existing account id.
    const tr = await fetch(
      `${SUPABASE_URL}/rest/v1/tailors?id=eq.${tailor_id}&select=id,user_id,display_name,stripe_account_id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const tailor = tr && tr.ok ? (await tr.json().catch(() => []))[0] : null;
    if (!tailor) return json({ error: "Tailor not found." }, 404);
    if (tailor.user_id !== user_id) {
      return json({ error: "This tailor profile doesn't belong to you." }, 403);
    }

    // The tailor's email (for prefilling the Express onboarding) comes from auth -
    // best-effort; Stripe is fine without it.
    let email: string | undefined;
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).catch(() => null);
    if (ur && ur.ok) {
      const u = await ur.json().catch(() => null);
      if (u && typeof u.email === "string") email = u.email;
    }

    // Reuse an existing Express account if onboarding was started before; only
    // create a fresh one the first time so we don't orphan accounts.
    let accountId: string | null = tailor.stripe_account_id || null;
    if (accountId) {
      // Verify it still exists; if Stripe 404s (e.g. a stale id from another
      // environment) fall through and create a new one.
      try {
        await stripe.accounts.retrieve(accountId);
      } catch {
        accountId = null;
      }
    }
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        ...(email ? { email } : {}),
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { tailor_id, user_id },
      });
      accountId = account.id;
      await patchTailor(tailor_id, { stripe_account_id: accountId });
    }

    // Hosted onboarding link. refresh_url is hit if the link expires before the
    // tailor finishes; return_url when they complete - the dashboard reads
    // ?connect=success there and calls verify-connect-account.
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${SITE_URL}/tailor-dashboard?connect=refresh`,
      return_url: `${SITE_URL}/tailor-dashboard?connect=success`,
      type: "account_onboarding",
    });

    // Stash the latest onboarding URL so a half-finished setup can be resumed.
    await patchTailor(tailor_id, { stripe_onboarding_url: link.url });

    return json({ url: link.url, account_id: accountId });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not start payment setup." }, 500);
  }
});
