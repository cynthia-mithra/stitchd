// Supabase Edge Function: verify-connect-account
// -----------------------------------------------
// Phase 15 - confirms whether a tailor has finished Stripe Connect (Express)
// onboarding. Called when the tailor returns to /tailor-dashboard?connect=success
// (and any time the dashboard wants to re-check). It posts { tailor_id }; this
// function:
//   1. loads the authoritative tailor row (service-role) for its stripe_account_id,
//   2. retrieves the Stripe account and reads details_submitted (Express
//      onboarding finished) AND payouts/charges enablement,
//   3. writes stripe_onboarding_complete accordingly, and
//   4. if NOT complete, mints a fresh onboarding link and returns its URL so the
//      tailor can pick up where they left off.
//
// details_submitted means the tailor has submitted everything Stripe asked for.
// We also surface payouts_enabled so the UI can tell the difference between
// "submitted, pending Stripe review" and "ready to receive transfers".
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to read + write the tailor row
//   SITE_URL                     e.g. https://stitchd.fit  (refresh/return base)
//
// Deploy: supabase functions deploy verify-connect-account --no-verify-jwt

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
    console.error("verify-connect-account: tailor PATCH failed:", text);
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { tailor_id } = await req.json();
    if (!tailor_id) return json({ error: "Missing tailor_id." }, 400);

    const tr = await fetch(
      `${SUPABASE_URL}/rest/v1/tailors?id=eq.${tailor_id}&select=id,user_id,stripe_account_id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    ).catch(() => null);
    const tailor = tr && tr.ok ? (await tr.json().catch(() => []))[0] : null;
    if (!tailor) return json({ error: "Tailor not found." }, 404);
    if (!tailor.stripe_account_id) {
      // Onboarding never started - nothing to verify.
      await patchTailor(tailor_id, { stripe_onboarding_complete: false });
      return json({ onboarding_complete: false, details_submitted: false, needs_onboarding: true });
    }

    const account = await stripe.accounts.retrieve(tailor.stripe_account_id);
    const detailsSubmitted = account.details_submitted === true;
    const payoutsEnabled = account.payouts_enabled === true;
    const chargesEnabled = account.charges_enabled === true;

    await patchTailor(tailor_id, { stripe_onboarding_complete: detailsSubmitted });

    if (detailsSubmitted) {
      // A login link to the tailor's Express dashboard (MANAGE PAYMENTS). Only
      // available once onboarding is far enough along - wrap so a not-yet-ready
      // account still returns onboarding_complete without failing the whole call.
      let dashboardUrl: string | undefined;
      try {
        const login = await stripe.accounts.createLoginLink(tailor.stripe_account_id);
        dashboardUrl = login.url;
      } catch (e) {
        console.error("verify-connect-account: login link unavailable:", (e as Error).message);
      }
      return json({
        onboarding_complete: true,
        details_submitted: true,
        payouts_enabled: payoutsEnabled,
        charges_enabled: chargesEnabled,
        ...(dashboardUrl ? { dashboard_url: dashboardUrl } : {}),
      });
    }

    // Not finished - hand back a fresh onboarding link so the tailor can resume.
    const link = await stripe.accountLinks.create({
      account: tailor.stripe_account_id,
      refresh_url: `${SITE_URL}/tailor-dashboard?connect=refresh`,
      return_url: `${SITE_URL}/tailor-dashboard?connect=success`,
      type: "account_onboarding",
    });
    await patchTailor(tailor_id, { stripe_onboarding_url: link.url });

    return json({
      onboarding_complete: false,
      details_submitted: false,
      url: link.url,
    });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not verify payment setup." }, 500);
  }
});
