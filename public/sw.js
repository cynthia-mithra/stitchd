/* Stitch'd service worker — makes the app installable + work offline.
   Hand-written (no Workbox) so it has no build dependency and predictable caching.

   Strategy:
     • Navigations: network-first, falling back to the cached app shell when
       offline — so online users always get the latest build, offline users
       still get the app.
     • Hashed build assets (/static/*) and same-origin icons: cache-first (their
       filenames change every deploy, so cached copies are always safe).
     • Listing images (Supabase storage): stale-while-revalidate, capped.
     • Everything else cross-origin (Supabase REST, Stripe, auth): passthrough —
       never cached, so private/authenticated data is always fresh.
   Bump VERSION to retire old caches. */
const VERSION = "stitchd-v4";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const IMAGES = `${VERSION}-images`;
const MAX_IMAGES = 200;
const SHELL_URLS = ["/", "/index.html", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Cross-origin: only cache image files (e.g. Supabase storage); pass through
  // everything else (REST/auth/Stripe) so authenticated data is never cached.
  if (url.origin !== self.location.origin) {
    const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname) || url.pathname.includes("/storage/");
    if (isImage) event.respondWith(staleWhileRevalidate(request, IMAGES, MAX_IMAGES));
    return;
  }

  // App navigations: network-first, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  // Hashed build assets + same-origin icons/fonts: cache-first.
  if (url.pathname.startsWith("/static/") || /\.(png|jpe?g|svg|webp|woff2?|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  // Default: network, fall back to any cached copy.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) {
        cache.put(request, res.clone());
        trim(cache, max);
      }
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) cache.delete(keys[i]);
}

// ── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Stitch'd";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { try { await c.navigate(url); } catch (e) { /* ignore */ } return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
