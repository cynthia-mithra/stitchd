// Vercel serverless function: POST /api/assistant
// ---------------------------------------------------------------------------
// The Stitch'd AI shopping assistant. On each message it:
//   1. takes the shopper's message + a short chat history,
//   2. finds matching AVAILABLE listings in Supabase (keyword / size / price),
//   3. asks Google Gemini (free tier) to reply using ONLY those listings +
//      the store policies,
//   4. captures an email for human follow-up when the shopper leaves one.
//
// SECRETS: the Gemini key is read from process.env.GEMINI_API_KEY and NEVER
// reaches the browser. Add it in Vercel → Settings → Environment Variables as
//   GEMINI_API_KEY   (get a free key at https://aistudio.google.com/apikey).
// The Supabase anon key is already public (it ships in the browser bundle) and
// can only read publicly-readable listing rows, so it is safe to reuse here.
//
// NOTE: we call the Gemini REST API with a plain server-side `fetch`, matching
// how every other function in this folder talks to its backend.

const { applyCors } = require("./_cors");
const { STORE_POLICIES } = require("./_store-policies");

const SUPABASE_URL = "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";

// Google Gemini free tier. Flash-Lite is fast, cheap and has the best free-tier
// availability (the newest full Flash model is often overloaded). The "…-latest"
// alias auto-tracks the current version. Override with the ASSISTANT_MODEL env var.
const GEMINI_MODEL = process.env.ASSISTANT_MODEL || "gemini-flash-lite-latest";
const geminiUrl = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;

// Call Gemini, retrying a few times on transient overload/rate errors (the free
// tier returns 503 "high demand" and 429 fairly often). Backoff stays well
// within the serverless timeout.
async function callGemini(url, bodyStr) {
  const BACKOFF = [0, 600, 1500]; // ms before each attempt
  let last = null;
  for (let i = 0; i < BACKOFF.length; i++) {
    if (BACKOFF[i]) await new Promise((r) => setTimeout(r, BACKOFF[i]));
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      if (r.ok) return r;
      last = r;
      if (![429, 500, 502, 503, 504].includes(r.status)) return r; // non-transient
    } catch (e) {
      last = null; // network blip — let the loop retry
    }
  }
  return last;
}

// --- basic in-memory rate limit -------------------------------------------
// Per-IP, best-effort (serverless instances aren't shared). Enough to stop one
// visitor or a stuck client from burning through the free quota.
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return res
      .status(500)
      .json({ reply: "The assistant isn't available right now — please try again later." });

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

  // 3. Ask Gemini, grounded in the listings + policies.
  //    Gemini uses roles "user"/"model" and a separate system_instruction.
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const geminiBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt(listingsText) }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    });
    // Try the configured model, then lighter/alias fallbacks — handles both a
    // retired model (404) and a busy one (503) on the free tier.
    const candidates = [
      GEMINI_MODEL,
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      "gemini-3.8-flash",
    ].filter((v, i, a) => v && a.indexOf(v) === i);
    let r = null;
    for (const model of candidates) {
      const resp = await callGemini(geminiUrl(model, apiKey), geminiBody);
      if (resp && resp.ok) {
        r = resp;
        break;
      }
      r = resp;
      // Stop early on a definite non-transient, non-model error (e.g. bad key).
      if (resp && ![404, 429, 500, 502, 503, 504].includes(resp.status)) break;
    }
    if (!r) {
      return res.status(502).json({
        reply:
          "Sorry — I'm having trouble reaching the assistant right now. Please try again in a moment.",
      });
    }
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("Gemini error", r.status, t.slice(0, 500));
      return res.status(502).json({
        reply:
          "Sorry — I'm having trouble right now. Please try again in a moment, or leave your email and the team will help.",
      });
    }
    const data = await r.json();
    const cand = (data.candidates || [])[0];
    let reply = "";
    if (cand && cand.content && Array.isArray(cand.content.parts)) {
      reply = cand.content.parts.map((p) => p.text || "").join("").trim();
    }
    if (!reply) {
      const block = data.promptFeedback && data.promptFeedback.blockReason;
      reply = block
        ? "Sorry, I can't help with that one — try asking about our listings, sizes, or how things work."
        : "Sorry, I didn't quite catch that — could you rephrase?";
    }
    return res.status(200).json({ reply });
  } catch (e) {
    console.error("assistant fail", e && e.message);
    return res
      .status(502)
      .json({ reply: "Sorry — I'm having trouble right now. Please try again in a moment." });
  }
};
