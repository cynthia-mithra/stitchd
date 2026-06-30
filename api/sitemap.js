// Vercel serverless function: GET /sitemap.xml  (routed here via vercel.json)
// ---------------------------------------------------------------------------
// The static public/sitemap.xml only listed fixed pages, so search engines
// never discovered individual listings. This generates a fresh sitemap on every
// crawl: the fixed marketing/legal pages plus every live (unsold, active)
// listing as https://stitchd.fit/listing/<id>. Real browsers still get the SPA;
// only /sitemap.xml is routed here. Read-only anon key, same as /api/og.

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://zhstooqgkyuzxseylsbk.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoc3Rvb3Fna3l1enhzZXlsc2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzM3MzQsImV4cCI6MjA5NjE0OTczNH0.mW5GB1VzSfRBMWZRlU7OfQ0RqoT1wEBVBoai6dJ6eQs";
const SITE_URL = (process.env.SITE_URL || "https://stitchd.fit").replace(/\/$/, "");

// Fixed pages, mirroring the old static sitemap.
const STATIC = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/tailors", changefreq: "weekly", priority: "0.7" },
  { loc: "/selling-tips", changefreq: "monthly", priority: "0.6" },
  { loc: "/about", changefreq: "monthly", priority: "0.6" },
  { loc: "/returns", changefreq: "yearly", priority: "0.3" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
];

const xmlEscape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function urlTag({ loc, lastmod, changefreq, priority }) {
  return (
    `  <url><loc>${xmlEscape(SITE_URL + loc)}</loc>` +
    (lastmod ? `<lastmod>${lastmod}</lastmod>` : "") +
    (changefreq ? `<changefreq>${changefreq}</changefreq>` : "") +
    (priority ? `<priority>${priority}</priority>` : "") +
    `</url>`
  );
}

module.exports = async (req, res) => {
  let listings = [];
  try {
    const q =
      `${SUPABASE_URL}/rest/v1/listings?sold=eq.false&status=neq.inactive` +
      `&select=id,created_at,updated_at&order=created_at.desc&limit=5000`;
    const r = await fetch(q, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (r.ok) listings = await r.json();
  } catch {
    /* fall back to static-only sitemap */
  }

  const rows = [
    ...STATIC.map(urlTag),
    ...listings
      .filter((l) => l && l.id)
      .map((l) => {
        const ts = l.updated_at || l.created_at;
        const lastmod = ts ? new Date(ts).toISOString().slice(0, 10) : undefined;
        return urlTag({
          loc: `/listing/${encodeURIComponent(l.id)}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.8",
        });
      }),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    rows.join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Cache at the edge for an hour - crawlers don't need second-by-second freshness.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
};
