const CACHE = "quran-arabic-learning-community-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=0.2.0-community",
  "./app.js?v=0.2.0-community",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./data/course-data.js?v=0.2.0-community",
  "./data/alphabet-data.js?v=0.2.0-community",
  "./data/pronunciation-data.js?v=0.2.0-community",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.destination === "audio") {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))));
});
