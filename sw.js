// Offline: app shell cached first (build plan section 12).
// Bump CACHE on every content or code change. Older fc- caches are deleted on activate (other apps on the same origin are left alone).
const CACHE = 'fc-v2-pub7';
const ASSETS = [
  './',
  './css/app.css',
  './data/recipes.json',
  './data/seasonal.json',
  './data/vocab.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './index.html',
  './js/dates.js',
  './js/dom.js',
  './js/grocery.js',
  './js/main.js',
  './js/people.js',
  './js/planner.js',
  './js/rules.js',
  './js/screens/cook.js',
  './js/screens/done.js',
  './js/screens/family.js',
  './js/screens/grocery.js',
  './js/screens/need.js',
  './js/screens/recipes.js',
  './js/screens/settings.js',
  './js/screens/setup.js',
  './js/screens/swap.js',
  './js/screens/tonight.js',
  './js/screens/week.js',
  './js/share.js',
  './js/store.js',
  './js/swaplist.js',
  './js/timers.js',
  './js/view.js',
  './js/wakelock.js',
  './manifest.webmanifest',
];

// cache: 'reload' skips the browser's HTTP cache, so an update never re-caches an old file
// that the host said was still fresh (GitHub Pages sends max-age=600).
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fc-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin GET: cache first, then network. Cross-origin requests are not handled (there are none).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    }),
  );
});
