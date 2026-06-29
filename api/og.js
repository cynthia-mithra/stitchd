// Vercel serverless function: GET /api/og?id=<listingId>
// ------------------------------------------------------
// Rich link previews for shared listings. Stitch'd is a client-rendered React
// app, so social scrapers (WhatsApp, iMessage, Facebook, Twitter/X, LinkedIn,
// Slack, Discord, Telegram, Pinterest, Google) - which don't run JavaScript -
// would otherwise only ever see the generic site-wide Open Graph card baked into
// index.html. vercel.json routes scraper user-agents hitting /listing/:id here
// instead; this fetches the listing and returns a tiny HTML document whose OG /
// Twitter tags describe that exact item (photo, name, price). Real browsers are
// never routed here - they keep getting the React app - but as a safety net this
// page also redirects a human straight to the listing if one lands on it.
//
// Uses the public anon key (read-only, RLS-guarded) - the same key the browser
// already ships - so no extra secret is required. Env overrides are honoured if
// set: SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL.

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";
const SITE_URL = (process.env.SITE_URL || "https://stitchd.fit").replace(/\/$/, "");
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;

// Escape for safe interpolation into HTML attributes / text.
function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstImage(l) {
  if (l.image_url) return l.image_url;
  const imgs = l.images;
  if (Array.isArray(imgs) && imgs.length) {
    return typeof imgs[0] === "string" ? imgs[0] : imgs[0] && imgs[0].url;
  }
  return null;
}

// Build "Saree · Size M · Excellent · Sabyasachi" style summary line.
function summary(l) {
  const parts = [];
  if (l.category) parts.push(l.category);
  if (l.size) parts.push(`Size ${l.size}`);
  if (l.condition) parts.push(l.condition);
  if (l.brand) parts.push(l.brand);
  return parts.join(" · ");
}

function page({ title, description, image, url, canonical }) {
  // Meta refresh + JS redirect so a human who somehow hits this endpoint lands
  // on the real listing; scrapers read the OG tags and ignore the redirect.
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<link rel="canonical" href="${esc(canonical)}"/>
<meta property="og:type" content="product"/>
<meta property="og:site_name" content="Stitch'd"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:url" content="${esc(canonical)}"/>
<meta property="og:image" content="${esc(image)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="1200"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(image)}"/>
<meta http-equiv="refresh" content="0; url=${esc(url)}"/>
<script>window.location.replace(${JSON.stringify(url)});</script>
</head><body>
<p>Redirecting to <a href="${esc(url)}">${esc(title)}</a>…</p>
</body></html>`;
}

module.exports = async (req, res) => {
  const id = (req.query && req.query.id) || "";
  const listingUrl = id ? `${SITE_URL}/listing/${encodeURIComponent(id)}` : SITE_URL;

  // Generic fallback used when the id is missing or the listing can't be loaded.
  const generic = {
    title: "Stitch'd - Pre-loved South Asian Fashion",
    description:
      "Buy & resell South Asian fashion - sarees, lehengas, sherwanis & more. Real measurements, buyer protection, UK delivery.",
    image: FALLBACK_IMAGE,
    url: listingUrl,
    canonical: listingUrl,
  };

  let view = generic;
  try {
    if (id) {
      const q =
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}` +
        `&select=name,price,category,size,condition,brand,image_url,images,sold,status&limit=1`;
      const r = await fetch(q, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (r.ok) {
        const rows = await r.json();
        const l = Array.isArray(rows) && rows[0];
        if (l && l.name) {
          const price = l.price != null ? `£${l.price}` : "";
          const soldTag = l.sold ? " (Sold)" : "";
          const sum = summary(l);
          view = {
            title: `${l.name}${price ? ` · ${price}` : ""} | Stitch'd`,
            description: `${price ? `${price}${soldTag} · ` : ""}${sum ? `${sum} · ` : ""}Pre-loved South Asian fashion on Stitch'd, with real measurements and buyer protection.`,
            image: firstImage(l) || FALLBACK_IMAGE,
            url: listingUrl,
            canonical: listingUrl,
          };
        }
      }
    }
  } catch {
    /* fall back to generic preview */
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache at the edge: previews can be a little stale, and this keeps repeated
  // scraper hits off the database.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(page(view));
};
