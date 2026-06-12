// Supabase Edge Function: saved-search-alerts
// --------------------------------------------
// Phase 12 PART 4/5 — emails buyers when new listings match a saved search.
//
// Two triggers, one code path:
//   • Cron (every 6 hours) — POST {} (see the phase12 saved_search_cron migration).
//   • New listing published — POST {listingId, trigger:"new_listing"} fired
//     fire-and-forget by db.triggerSavedSearchAlerts so matches go out within
//     minutes instead of waiting for the next cron sweep.
//
// For each saved search with email_alerts = true it queries listings created
// after last_alerted_at (or the last 6 hours when null), applies the saved
// `filters` jsonb, and — if anything matches — renders the brand
// `saved_search_alert` template and sends it through the shared Resend helper
// (same delivery path as the stripe-webhook emails), then stamps
// last_alerted_at = now() so the same listings are never emailed twice.
//
// Unsubscribe is honoured: a buyer with profiles.email_notifications = false is
// skipped (their last_alerted_at is still advanced so they don't pile up).
//
// Required secrets (already set for send-email — see DEPLOY.md):
//   RESEND_API_KEY, SITE_URL, SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto).
//
// Deploy: supabase functions deploy saved-search-alerts  (verify_jwt=false — it
// is called by cron/pg_net and by the browser data layer, neither with a JWT;
// it only ever sends predefined brand templates to server-resolved recipients).

import {
  corsHeaders,
  emailForUser,
  getProfile,
  render,
  sendViaResend,
  SITE_URL,
} from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const MAX_CARDS = 4;

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface SavedSearch {
  id: string;
  user_id: string;
  name: string | null;
  filters: Record<string, unknown> | null;
  email_alerts: boolean | null;
  last_alerted_at: string | null;
}

interface Listing {
  id: string;
  name: string;
  price: number;
  category?: string;
  size?: string;
  condition?: string;
  occasions?: string[] | null;
  colours?: string[] | null;
  user_id?: string;
  sold?: boolean;
  status?: string;
  image_url?: string;
  images?: unknown;
  created_at?: string;
}

async function sbGet<T>(path: string): Promise<T[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
    if (!r.ok) return [];
    return (await r.json()) as T[];
  } catch {
    return [];
  }
}

async function stamp(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/saved_searches?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ last_alerted_at: new Date().toISOString() }),
    });
  } catch { /* best-effort */ }
}

function thumb(l: Listing): string | undefined {
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) return typeof imgs[0] === "string" ? imgs[0] : (imgs[0] as { url?: string })?.url;
  return undefined;
}

// Human filter chip — kept in sync with constants.js filterSummary (this function
// can't import the React bundle, so the logic is duplicated deliberately).
function filterSummary(f: Record<string, any> | null): string {
  if (!f || typeof f !== "object") return "All listings";
  const parts: string[] = [];
  if (f.query) parts.push(`“${f.query}”`);
  if (f.category) parts.push(f.category);
  if (f.type) parts.push(f.type);
  if (f.size) parts.push(f.size);
  if (f.condition) parts.push(f.condition);
  (f.colour || []).forEach((c: string) => parts.push(c));
  (f.occasion || []).forEach((o: string) => parts.push(o));
  if (f.verified_only) parts.push("Verified sellers");
  const hasMin = f.min_price != null && f.min_price !== "";
  const hasMax = f.max_price != null && f.max_price !== "";
  if (hasMin && hasMax) parts.push(`£${f.min_price}–£${f.max_price}`);
  else if (hasMax) parts.push(`Under £${f.max_price}`);
  else if (hasMin) parts.push(`Over £${f.min_price}`);
  return parts.length ? parts.join(" · ") : "All listings";
}

// Does a listing satisfy the saved filters? Mirrors App.js's `visible` matcher.
// Array filters (occasion/colour) match when the listing has none tagged (NULL =
// "untagged", stays visible) or overlaps the requested set — same as the shop.
function matches(l: Listing, f: Record<string, any> | null): boolean {
  if (!f || typeof f !== "object") return true;
  if (l.sold || l.status === "inactive") return false;

  if (f.query) {
    const q = String(f.query).toLowerCase();
    const hay = `${l.name || ""} ${l.category || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.category && f.category !== "All" && l.category !== f.category) return false;
  if (f.size && f.size !== "All" && l.size !== f.size) return false;
  if (f.condition && f.condition !== "All" && l.condition !== f.condition) return false;
  if (f.min_price != null && f.min_price !== "" && Number(l.price) < Number(f.min_price)) return false;
  if (f.max_price != null && f.max_price !== "" && Number(l.price) > Number(f.max_price)) return false;

  if (Array.isArray(f.occasion) && f.occasion.length) {
    const occ = Array.isArray(l.occasions) ? l.occasions : [];
    if (occ.length && !f.occasion.some((o: string) => occ.includes(o))) return false;
  }
  if (Array.isArray(f.colour) && f.colour.length) {
    const col = Array.isArray(l.colours) ? l.colours : [];
    if (col.length && !f.colour.some((c: string) => col.includes(c))) return false;
  }
  return true;
}

// Base64url-encode the filters so the email's "SEE ALL MATCHES" link deep-links
// the shop with them pre-applied (App.js reads the `sf` param on load).
function encodeFilters(f: Record<string, unknown> | null): string {
  try {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(f || {}))));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

async function processSearch(s: SavedSearch, verifiedIds: Set<string> | null): Promise<string> {
  if (s.email_alerts === false) return "alerts-off";
  const since = s.last_alerted_at ? new Date(s.last_alerted_at) : new Date(Date.now() - SIX_HOURS_MS);
  const sinceIso = since.toISOString();

  // Pull the candidate window once (new listings since `since`), then filter in
  // memory — the saved filter set is richer than a single PostgREST query.
  const candidates = await sbGet<Listing>(
    `listings?created_at=gt.${encodeURIComponent(sinceIso)}&sold=eq.false&order=created_at.desc&select=id,name,price,category,size,condition,occasions,colours,user_id,sold,status,image_url,images,created_at&limit=100`,
  );
  if (!candidates.length) { await stamp(s.id); return "no-new-listings"; }

  const f = s.filters || {};
  let matched = candidates.filter((l) => matches(l, f));
  if ((f as any).verified_only && verifiedIds) matched = matched.filter((l) => l.user_id && verifiedIds.has(l.user_id));
  if (!matched.length) { await stamp(s.id); return "no-match"; }

  // Honour unsubscribe; still advance the cursor so they don't accumulate.
  const prof = await getProfile(s.user_id);
  if (prof?.email_notifications === false) { await stamp(s.id); return "unsubscribed"; }
  const to = await emailForUser(s.user_id);
  if (!to) { await stamp(s.id); return "no-email"; }

  const sf = encodeFilters(f);
  const { subject, html } = await render("saved_search_alert", {
    name: s.name || undefined,
    summary: filterSummary(f),
    matchUrl: sf ? `${SITE_URL}/?sf=${sf}` : `${SITE_URL}/shop`,
    total: matched.length,
    listings: matched.slice(0, MAX_CARDS).map((l) => ({
      title: l.name,
      price: `£${l.price}`,
      image: thumb(l),
    })),
  }, s.user_id);

  const res = await sendViaResend(to, subject, html);
  await stamp(s.id);
  return res.ok ? "sent" : `send-failed:${res.error ?? "unknown"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const searches = await sbGet<SavedSearch>(
    `saved_searches?email_alerts=eq.true&select=id,user_id,name,filters,email_alerts,last_alerted_at&limit=1000`,
  );
  if (!searches.length) return json({ ok: true, searches: 0, results: {} });

  // Resolve verified sellers once if any saved search asks for verified-only.
  let verifiedIds: Set<string> | null = null;
  if (searches.some((s) => s.filters && (s.filters as any).verified_only)) {
    const verified = await sbGet<{ id: string }>(`profiles?verified=eq.true&select=id`);
    verifiedIds = new Set(verified.map((v) => v.id));
  }

  const tally: Record<string, number> = {};
  for (const s of searches) {
    let outcome = "error";
    try { outcome = await processSearch(s, verifiedIds); }
    catch (e) { outcome = `error:${(e as Error).message}`; console.error("saved-search-alerts failed for", s.id, e); }
    tally[outcome] = (tally[outcome] || 0) + 1;
  }

  return json({ ok: true, searches: searches.length, results: tally });
});
