// Pip service worker — a deliberately small, hand-rolled offline shell.
// The whole game is client-side, so caching the shell + static assets makes
// Pip fully playable offline after the first visit. No build-tool coupling.
//
// Strategy:
//   - navigations: network-first, falling back to the cached shell ('/')
//   - hashed static assets (/_next/static, icons, venue art): cache-first
//   - everything else: straight to the network

// v2: purges v1 caches poisoned by a cached 404 (see the response.ok guards —
// v1 could permanently store a deploy-window 404 page as a hashed asset).
const CACHE = 'pip-v2'
const SHELL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const CACHE_FIRST = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/venues\//,
  /\.(?:png|jpg|svg|ico|woff2?)$/,
]

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // App navigations: try the network, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
          }
          return response
        })
        .catch(() => caches.match(SHELL)),
    )
    return
  }

  // Hashed/static assets: cache-first (immutable in practice).
  if (CACHE_FIRST.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            // Never cache errors: a 404 during a deploy's propagation window
            // must stay transient, not become the asset forever.
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
