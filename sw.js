// Bump CACHE_VERSION whenever any app file changes.
const CACHE_VERSION = "v1";
const CACHE_NAME = `beeboop-${CACHE_VERSION}`;

const APP_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/main.js",
  "js/db.js",
  "js/audio.js",
  "js/ui.js",
  "js/backup.js",
  "js/storage.js",
  "js/palette.js",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

// No skipWaiting: a new version takes over on the next launch, so a running
// session never gets mixed old and new files.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: "reload" bypasses the HTTP cache so a new version is never built from stale files.
      cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
