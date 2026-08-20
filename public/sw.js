// CineStream Service Worker
// Strategy: Fast Network-first with timeout for HTML, Cache-first for static + images
// CACHE_VERSION is updated to bust previous worker cache.
const CACHE_VERSION = 'v30-no-home-fallback-fix';
const CACHE_NAME = `cinestream-${CACHE_VERSION}`;
const IMAGE_CACHE = `cinestream-images-${CACHE_VERSION}`;
const STATIC_CACHE = `cinestream-static-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/manifest.json', '/favicon.svg?v=23', '/logo-icon.svg?v=23'];

// Install — pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean ALL old caches (anything not matching current CACHE_VERSION)
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

  // Network-first for HTML page navigations — NEVER fallback to '/' home page on sub-routes!
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          const matched = await cache.match(request);
          if (matched) return matched;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Cache-first for media images (TMDB, AniList, MAL, HiAnime, AniPub, Tatakai)
  const isImageDomain =
    url.hostname === 'image.tmdb.org' ||
    url.hostname === 's4.anilist.co' ||
    url.hostname.includes('myanimelist.net') ||
    url.hostname.includes('hianime') ||
    url.hostname.includes('anipub') ||
    url.hostname.includes('tatakai');

  if (isImageDomain) {
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

  // Never cache API responses in the service worker — let the CDN/server handle it.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for all other requests with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

