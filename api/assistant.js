// Vercel serverless function: POST /api/assistant
// ---------------------------------------------------------------------------
// The Stitch'd AI shopping assistant. On each message it:
//   1. takes the shopper's message + a short chat history,
//   2. finds matching AVAILABLE listings in Supabase (keyword / size / price),
//   3. asks Claude to reply using ONLY those listings + the store policies,
//   4. captures an email for human follow-up when the shopper leaves one.
//
// SECRETS: the Anthropic key is read from process.env.ANTHROPIC_API_KEY and
// NEVER reaches the browser. Add it in Vercel → Settings → Environment
// Variables as  ANTHROPIC_API_KEY  (see the setup notes). The Supabase anon key
// is already public (it ships in the browser bundle) and can only read
// publicly-readable listing rows, so it is safe to reuse here — exactly as the
// Stripe functions in this folder already do.
//
// NOTE on the Anthropic call: we use a plain server-side `fetch` to the Messages
// API (rather than the SDK) to stay consistent with how every other function in
// this folder talks to its backend, and to avoid pinning an SDK version.

const { applyCors } = require("./_cors");
const { STORE_POLICIES } = require("./_store-policies");

const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Haiku is cheap + fast and ideal for grounded Q&A like this. To make the
// assistant smarter (at higher cost) set ASSISTANT_MODEL in Vercel to e.g.
// claude-sonnet-5-5 or claude-opus-5-5.
const MODEL = process.env.ASSISTANT_MODEL || "claude-haiku-5-5";

// --- basic in-memory rate limit -------------------------------------------
// Per-IP, best-effort. Serverless instances aren't shared, so this caps a
// single busy instance rather than being a global counter — enough to stop one
// visitor (or a stuck client) running up the API bill.
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_HITS = 20; // messages per window per IP
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
    }
  }
  return arr.length > MAX_HITS;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const STOP = new Set(
  "the a an and or of for to in on at with from my your i you is are be do does any have has want need looking show me please hi hello hey there im can could would like love buy sell about what which when how size sizes price prices cheap under over something anything".split(
    /\s+/
  )
);

// Pull simple price / size / keyword hints out of the shopper's message so we
// can fetch the most relevant available stock to ground the answer.
function parseFilters(msg) {
  const lower = (msg || "").toLowerCase();
  const f = { keywords: [] };
  let m;
  if ((m = lower.match(/(?:£?\s*)(\d+)\s*(?:-|to)\s*£?\s*(\d+)/))) {
    f.minPrice = Number(m[1]);
    f.maxPrice = Number(m[2]);
  }
  if ((m = lower.match(/(?:under|below|less than|up to|max(?:imum)?)\s*£?\s*(\d+)/)))
    f.maxPrice = Number(m[1]);
  if ((m = lower.match(/(?:over|above|more than|min(?:imum)?)\s*£?\s*(\d+)/)))
    f.minPrice = Number(m[1]);
  if ((m = lower.match(/\bsize\s*([a-z0-9]{1,4})\b/))) f.size = m[1];
  else if ((m = lower.match(/\b(xs|s|m|l|xl|xxl)\b/))) f.size = m[1];
  const words = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  f.keywords = Array.from(new Set(words)).slice(0, 4);
  return f;
}

async function sbGet(url) {
  try {
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (r.ok) return await r.json();
  } catch (_) {}
  return [];
}

async function fetchListings(f) {
  const base = `${SUPABASE_URL}/rest/v1/listings`;
  const common =
    "sold=eq.false&select=id,name,price,currency,size,condition,category,brand,colours&order=created_at.desc&limit=40";
  let rows = [];
  if (f.keywords.length) {
    const ors = [];
    for (const k of f.keywords) {
      ors.push(
        `name.ilike.*${k}*`,
        `category.ilike.*${k}*`,
        `brand.ilike.*${k}*`,
        `description.ilike.*${k}*`
      );
    }
    rows = await sbGet(`${base}?${common}&or=(${ors.join(",")})`);
  }
  // No keyword hits (or no keywords) → fall back to recent available stock so
  // the assistant always has real items to talk about.
  if (!rows.length) rows = await sbGet(`${base}?${common}`);

  rows = (rows || []).filter((x) => {
    const st = (x.status || "").toLowerCase();
    return st === "" || st === "active";
  });
  if (f.minPrice != null) rows = rows.filter((x) => Number(x.price) >= f.minPrice);
  if (f.maxPrice != null) rows = rows.filter((x) => Number(x.price) <= f.maxPrice);
  if (f.size)
    rows = rows.filter((x) => (x.size || "").toLowerCase().includes(f.size.toLowerCase()));
  return rows.slice(0, 12);
}

function listingsToText(rows) {
  if (!rows.length) return "No matching items are currently available.";
  return rows
    .map((x, i) => {
      const cur = (x.currency || "GBP").toUpperCase() === "GBP" ? "£" : "";
      const price = `${cur}${Number(x.price).toFixed(2)}`;
      const bits = [
        x.size ? `size ${x.size}` : null,
        x.condition || null,
        x.brand || null,
        x.category || null,
      ]
        .filter(Boolean)
        .join(", ");
      return `${i + 1}. ${x.name} — ${price}${bits ? ` (${bits})` : ""}`;
    })
    .join("\n");
}

function systemPrompt(listingsText) {
  return `You are the Stitch'd shopping assistant — a warm, friendly, concise helper for Stitch'd, a UK marketplace for pre-loved South Asian fashion (sarees, lehengas, sherwanis, salwar kameez and more).

HOW TO ANSWER
- Be friendly and brief (2–4 short sentences). Use British English and £ for prices.
- Answer ONLY using the AVAILABLE ITEMS and STORE POLICIES below. Do NOT invent, guess or estimate stock, prices, sizes, measurements or policies. If something isn't in the data below, say you don't have that detail.
- When you mention items, use their exact names and prices from the list. Never make up an item that isn't listed.
- If nothing matches what they want, say so kindly and suggest they browse the site or adjust what they're after.

WHEN TO HAND OFF TO THE TEAM
- For anything about a specific order, payment, refund, dispute, account, or any sensitive/personal matter, do NOT try to resolve it yourself. Say the Stitch'd team will follow up personally, and offer to take their email so the team can get back to them.
- If you're unsure, or the shopper clearly needs a human, do the same.
- If the shopper gives an email address, thank them and confirm the team will be in touch.

AVAILABLE ITEMS (the only items you may reference):
${listingsText}

STORE POLICIES:
${STORE_POLICIES}`;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ reply: "The assistant isn't set up yet — please try again later." });

  const ip =
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "anon";
  if (rateLimited(ip))
    return res.status(429).json({
      reply:
        "You've sent a lot of messages in a short time — please try again in a minute.",
    });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (_) {
    return res.status(400).json({ error: "Bad request" });
  }

  const message = String(body.message || "").slice(0, 1000).trim();
  if (!message) return res.status(400).json({ error: "Empty message" });

  const history = Array.isArray(body.history)
    ? body.history
        .slice(-6)
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) }))
    : [];

  // 1. Find matching available listings to ground the reply.
  let listingsText = "No matching items are currently available.";
  try {
    listingsText = listingsToText(await fetchListings(parseFilters(message)));
  } catch (_) {}

  // 2. If the shopper left an email, log a handoff for the team (best-effort).
  const email = (message.match(EMAIL_RE) || [])[0];
  if (email) {
    const transcript = [...history, { role: "user", content: message }]
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 2000);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/assistant_handoffs`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ email, question: transcript }),
      });
    } catch (_) {}
  }

  // 3. Ask Claude, grounded in the listings + policies.
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt(listingsText),
        messages: [...history, { role: "user", content: message }],
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("Anthropic error", r.status, t.slice(0, 500));
      let detail = "";
      try {
        detail = (JSON.parse(t).error || {}).message || "";
      } catch (_) {}
      // TEMPORARY setup-diagnostic: surface the real reason in the reply so we
      // can see why the AI call is failing on the preview. Remove before launch.
      return res.status(502).json({
        reply:
          "⚠️ Setup check — the AI service returned an error:\n\n" +
          `[${r.status}] ${detail || t.slice(0, 180) || "(no detail)"}` +
          "\n\n(This note is temporary while we get the assistant working.)",
      });
    }
    const data = await r.json();
    const reply =
      (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim() || "Sorry, I didn't quite catch that — could you rephrase?";
    return res.status(200).json({ reply });
  } catch (e) {
    console.error("assistant fail", e && e.message);
    return res
      .status(502)
      .json({ reply: "Sorry — I'm having trouble right now. Please try again in a moment." });
  }
};
