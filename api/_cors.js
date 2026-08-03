// Shared CORS for the app's own API routes.
//
// On the web these are called same-origin, so CORS never mattered. The native
// app (Capacitor) calls them cross-origin — its web layer runs at
// capacitor://localhost — which triggers a preflight the functions must answer,
// otherwise checkout fails with "Failed to fetch" inside the app.
//
// These endpoints carry no cookies/credentials and re-verify everything
// server-side (prices come from Supabase, not the client), so reflecting a known
// origin is safe. Files prefixed with "_" are ignored by Vercel's router, so this
// never becomes its own endpoint.
function applyCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed =
    origin === "capacitor://localhost" || // iOS native shell
    origin === "http://localhost" ||       // Android native shell / local dev
    origin === "https://localhost" ||
    origin === "https://stitchd.fit" ||
    origin === "https://www.stitchd.fit" ||
    origin.endsWith(".vercel.app");        // Vercel preview deployments
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "https://stitchd.fit");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Answer the preflight OPTIONS request immediately.
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { applyCors };
