// Supabase Edge Function: create-verification-session
// ----------------------------------------------------
// Starts a Stripe Identity verification for a seller and returns the URL of the
// Stripe-hosted flow to redirect them to. The browser NEVER talks to Stripe with
// the secret key — it posts the seller's user_id here; this function creates the
// VerificationSession, records it on the seller's profile (status → 'pending'),
// and hands back the hosted-flow URL.
//
// The actual pass/fail result arrives asynchronously on the `stripe-webhook`
// function (identity.verification_session.verified / .requires_input), which
// flips identity_verified / identity_verification_status.
//
// Required environment variables (Supabase → Project Settings → Edge Functions):
//   STRIPE_SECRET_KEY            sk_test_…  (TEST MODE — Stripe Identity must be
//                                enabled on the account)
//   SUPABASE_URL                 auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    used to write the session id onto the profile
//   SITE_URL                     e.g. https://stitchd.fit  (return_url base)
//
// Deploy: supabase functions deploy create-verification-session --no-verify-jwt

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user_id } = await req.json();
    if (!user_id) return json({ error: "Missing user_id." }, 400);

    // Create the Stripe Identity VerificationSession. metadata.user_id lets the
    // webhook (as a fallback) map the result back to the seller; the primary link
    // is the session id we store on the profile below.
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { user_id },
      return_url: `${SITE_URL}/dashboard?verified=true`,
    });

    // Record the session on the profile and move the seller to 'pending' so the
    // dashboard shows VERIFICATION IN PROGRESS until the webhook resolves it.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stripe_verification_session_id: session.id,
        identity_verification_status: "pending",
      }),
    });
    if (!res.ok) {
      console.error("Failed to persist verification session:", await res.text());
    }

    return json({ url: session.url, id: session.id });
  } catch (e) {
    return json({ error: (e as Error).message || "Could not start verification." }, 500);
  }
});
