/**
 * Service Worker — منظومة الاستبيانات
 * Strategy: Cache-first for static shell, Network-first for API calls
 * Supabase API calls always go to network — never cached
 */

const CACHE_NAME = 'survey-jeddah-v1';
const SHELL_CACHE = 'shell-v1';

// Static shell assets to pre-cache (filled at build time by Vite)
// These are injected by vite-plugin-pwa or listed manually
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// URLs that must NEVER be served from cache
const NETWORK_ONLY_PATTERNS = [
  'supabase.co',
  'green-api.com',
  'api.qrserver.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some(p => url.includes(p));
}

function isShellRequest(url) {
  const u = new URL(url);
  // Same origin navigations → serve shell
  return u.origin === self.location.origin;
}

// ── Install ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      // Pre-cache shell assets — failures are non-fatal
      return Promise.allSettled(
        SHELL_ASSETS.map(asset =>
          cache.add(asset).catch(e => console.warn('[SW] Pre-cache failed:', asset, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== SHELL_CACHE)
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Network-only: Supabase, external APIs
  if (isNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests → App Shell (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache fresh navigation response
          const clone = response.clone();
          caches.open(SHELL_CACHE).then(c => c.put(request, clone));
          return response;
        })
        .catch(() =>
          // Offline: serve cached shell
          caches.match('/index.html') ||
          caches.match('/') ||
          new Response('<h1>غير متصل بالإنترنت</h1>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        )
    );
    return;
  }

  // Static assets: Cache-first, fallback to network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache successful same-origin responses
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Return empty 204 for non-critical assets
        return new Response('', { status: 204 });
      });
    })
  );
});

// ── Background Sync placeholder ─────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-responses') {
    // Future: sync pending offline responses
    console.log('[SW] Background sync triggered');
  }
});

// ── Push Notifications placeholder ─────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'منظومة الاستبيانات', {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    dir: 'rtl',
    lang: 'ar',
  });
});

