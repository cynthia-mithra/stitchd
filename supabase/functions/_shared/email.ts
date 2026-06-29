// Shared email plumbing: Resend delivery, Supabase service-role reads, recipient
// resolution and signed unsubscribe links. Imported by send-email/index.ts and
// stripe-webhook/index.ts so the brand templates have exactly one delivery path.

import { BuildCtx, EmailType, templates } from "./email-templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// stripe-checkout already sets SITE_URL; reuse it so links match the live domain.
export const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://stitchd.fit").replace(/\/$/, "");
export const FROM = Deno.env.get("EMAIL_FROM") ?? "Stitch'd <hello@stitchd.fit>";
// Secret used to sign unsubscribe links so they can't be forged for arbitrary
// users. Falls back to the service key (always present) if unset.
const UNSUB_SECRET = Deno.env.get("EMAIL_UNSUB_SECRET") || SERVICE_KEY;

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ── Supabase reads (service role - bypasses RLS) ──────────────────────────────

async function sbGet<T = unknown>(path: string): Promise<T[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
    if (!r.ok) return [];
    return (await r.json()) as T[];
  } catch {
    return [];
  }
}

export async function sbPatch(table: string, filter: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify(body),
    });
  } catch { /* best-effort */ }
}

// Profiles don't store the email address - it lives on auth.users. The Admin API
// is the only service-role way to read it from a user id.
export async function emailForUser(userId: string): Promise<string | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: sbHeaders });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.email ?? null;
  } catch {
    return null;
  }
}

export interface ProfileRow {
  id: string;
  username?: string;
  full_name?: string;
  email_notifications?: boolean;
  welcome_email_sent?: boolean;
  last_active_at?: string | null;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await sbGet<ProfileRow>(
    `profiles?id=eq.${userId}&select=id,username,full_name,email_notifications,welcome_email_sent,last_active_at&limit=1`,
  );
  return rows[0] ?? null;
}

export const firstName = (full?: string | null) => (full || "").trim().split(/\s+/)[0] || "";

// ── Unsubscribe link signing ──────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return b64url(new Uint8Array(sig));
}

export async function unsubscribeUrl(userId: string | null): Promise<string> {
  // No user id (e.g. guest order) → point at a generic preferences hint; the link
  // still renders, it just can't toggle a specific account.
  if (!userId) return `${SITE_URL}/orders`;
  const sig = await sign(userId);
  const fnBase = `${SUPABASE_URL}/functions/v1/send-email`;
  return `${fnBase}?unsubscribe=1&u=${encodeURIComponent(userId)}&sig=${encodeURIComponent(sig)}`;
}

export async function verifyUnsubscribe(userId: string, sig: string): Promise<boolean> {
  if (!userId || !sig) return false;
  const expected = await sign(userId);
  // Constant-ish time compare.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// ── Resend delivery ───────────────────────────────────────────────────────────

export async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  // Log every send attempt so it's traceable in the Edge Function logs, and make
  // the two "silent" early-returns below noisy - these used to fail without any
  // log line, so a missing key or empty recipient looked like nothing happened.
  console.log(`[email] attempting send to: ${to || "(none)"} | subject: ${subject}`);
  if (!RESEND_API_KEY) {
    console.error("[email] send aborted: RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  if (!to) {
    console.error("[email] send aborted: no recipient address");
    return { ok: false, error: "no recipient" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error("[email] Resend send failed:", r.status, text);
      return { ok: false, error: `Resend ${r.status}: ${text}` };
    }
    console.log(`[email] sent successfully to: ${to}`);
    return { ok: true };
  } catch (e) {
    console.error("[email] Resend send threw:", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

// Build a rendered email (subject + html) for a given type. Resolves the signed
// unsubscribe link for the recipient. Pure rendering - no delivery, no DB reads
// beyond the unsubscribe signature.
export async function render(
  type: EmailType,
  data: Record<string, unknown>,
  recipientUserId: string | null,
): Promise<{ subject: string; html: string }> {
  const ctx: BuildCtx = { site: SITE_URL, unsub: await unsubscribeUrl(recipientUserId) };
  return templates[type](data as never, ctx);
}
