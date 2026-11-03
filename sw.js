// Offline support: try the network first so updates arrive right away; fall back to the cached copy offline.
// Bump CACHE when files change.
const CACHE = "rejections-v9";
const SHELL = ["/", "/index.html", "/app.css", "/library.js", "/app.js", "/extras.js", "/nav.js", "/tour.js", "/manifest.webmanifest", "/icon-192.png", "/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const same = new URL(req.url).origin === location.origin, font = req.url.includes("fonts.g");
  if (!same && !font) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("/index.html") : Response.error()))));
});
