// Supabase Edge Function: send-reset
// -----------------------------------
// Sends the password-reset email as a BRANDED Stitch'd email (via Resend),
// replacing Supabase's plain default recovery email.
//
// POST { email, redirectTo? }
//   1. Generates a GoTrue recovery action link via the Admin API (service role).
//      This does NOT send any email — it just returns the link.
//   2. Renders the `password_reset` brand template and sends it through Resend
//      (from "Stitch'd <hello@stitchd.fit>", same as every other email).
//
// Always returns { ok: true } regardless of whether the address has an account,
// so it can't be used to discover which emails are registered (no enumeration).
//
// Required secrets (already set for send-email):
//   RESEND_API_KEY, SITE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: verify_jwt = false (called from the browser before sign-in).

import { corsHeaders, render, sendViaResend, SITE_URL } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  let body: { email?: string; redirectTo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim();
  // Always answer success — never reveal whether the address has an account.
  if (!email) return json({ ok: true });

  // Bring the user back to the app; default to the live site. Must be allow-listed
  // in Supabase Authentication → URL Configuration (stitchd.fit already is).
  const redirectTo = body.redirectTo || SITE_URL;

  try {
    // Admin generate_link returns the recovery action link WITHOUT emailing it.
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "recovery", email, redirect_to: redirectTo }),
    });

    if (!r.ok) {
      // Most commonly "user not found" — swallow it and still return ok so the
      // caller can't tell registered emails apart from unregistered ones.
      console.log(`[send-reset] generate_link non-OK (${r.status}) for a request — returning ok`);
      return json({ ok: true });
    }

    const data = await r.json();
    const actionLink: string | undefined = data?.action_link || data?.properties?.action_link;
    const userId: string | null = data?.user?.id || data?.id || null;
    if (!actionLink) {
      console.error("[send-reset] generate_link returned no action_link");
      return json({ ok: true });
    }

    const { subject, html } = await render("password_reset", { resetUrl: actionLink }, userId);
    const res = await sendViaResend(email, subject, html);
    if (!res.ok) console.error("[send-reset] Resend send failed:", res.error);
    return json({ ok: true });
  } catch (e) {
    console.error("[send-reset] threw:", (e as Error).message);
    // Still return ok — don't leak internal state to the caller.
    return json({ ok: true });
  }
});
