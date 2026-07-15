const CACHE_NAME = "groomly-pwa-v53";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/favicon.png",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/default-dog.jpg",
  "/icons/top-client-paw.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate" || APP_SHELL.includes(url.pathname)) {
    event.respondWith(fetchAndCache(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetchAndCache(event.request)));
});

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}
