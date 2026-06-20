/* Докога? service worker — app-shell cache + network-first.
   A fetch handler is required for installability on Android/Chrome. */
const CACHE = "dokoga-v1";
const SHELL = ["/", "/report", "/index.html", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png"];

// Never cache API responses — they must always be fresh.
const API_PREFIXES = ["/auth", "/reports", "/authorities", "/chat", "/predict", "/analyze", "/health"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // tiles / cross-origin API
  if (API_PREFIXES.some((p) => url.pathname.startsWith(p))) return;  // live data only

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("/index.html")))
  );
});
