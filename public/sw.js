// CineStream Service Worker
// Strategy: Fast Network-first with timeout for HTML, Cache-first for static + images
// CACHE_VERSION is updated to bust previous worker cache.
const CACHE_VERSION = 'v4';
const CACHE_NAME = `cinestream-${CACHE_VERSION}`;
const IMAGE_CACHE = `cinestream-images-${CACHE_VERSION}`;
const STATIC_CACHE = `cinestream-static-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/', '/manifest.json', '/favicon.svg'];

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

  // FAST NETWORK-FIRST WITH 2.5S TIMEOUT & AUTOMATIC HTML CACHING FOR NAVIGATIONS
  // Prevents mobile tabs from hanging when reopening on sleeping/reconnecting mobile networks
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = (await cache.match(request)) || (await cache.match('/'));

        // 2.5s timeout for slow/reconnecting mobile networks
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve(null), 2500);
        });

        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (response && response.ok) {
          return response;
        }

        // Return cached page or cached root shell instantly if network is slow/offline
        if (cachedResponse) {
          return cachedResponse;
        }

        const fallback = await fetchPromise;
        return fallback || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })()
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

