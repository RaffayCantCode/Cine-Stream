// CineStream Service Worker
// Strategy: Network-first for API/auth, Cache-first for static + images

const CACHE_NAME = 'cinestream-v1';
const IMAGE_CACHE = 'cinestream-images-v1';
const STATIC_CACHE = 'cinestream-static-v1';

const STATIC_ASSETS = ['/', '/manifest.json', '/favicon.svg'];

// Install — pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_NAME, IMAGE_CACHE, STATIC_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept auth, API writes, or external embeds
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/watch-history') ||
    url.hostname.includes('youtube') ||
    url.hostname.includes('vidsrc') ||
    url.hostname.includes('embed')
  ) {
    return;
  }

  // Cache-first for TMDB images (they never change for a given path)
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Cache-first for Next.js static assets (_next/static)
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Network-first for TMDB API calls (stale-while-revalidate style)
  if (url.pathname.startsWith('/api/tmdb')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(request);
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Network-first for all other requests with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
