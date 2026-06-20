const CACHE_NAME = "survey-flow-jeddah-v1";
const APP_SHELL = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: always try the network (fresh data from Supabase),
// fall back to cache only if completely offline. This keeps survey data live.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Never cache Supabase API calls — always go to network
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
