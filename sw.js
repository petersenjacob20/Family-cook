// Offline: app shell cached first (build plan section 12).
// Bump CACHE on every content or code change. Older fc- caches are deleted on activate (other apps on the same origin are left alone).
const CACHE = 'fc-v2-pub8';
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
  './js/screens/credits.js',
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
  './photos/apple-pork-chops.webp',
  './photos/baked-bean-and-cheese-tostadas.webp',
  './photos/baked-chicken-parmesan-spaghetti.webp',
  './photos/baked-chicken-taquitos.webp',
  './photos/baked-pizza-pinwheels.webp',
  './photos/baked-potato-bar.webp',
  './photos/baked-sweet-and-sour-chicken.webp',
  './photos/bbq-chicken-sliders.webp',
  './photos/beef-and-broccoli-brown-rice.webp',
  './photos/brats-and-peppers.webp',
  './photos/breakfast-burritos.webp',
  './photos/breakfast-for-dinner.webp',
  './photos/broccoli-cheddar-chicken-rice.webp',
  './photos/broccoli-tortellini-alfredo.webp',
  './photos/buffalo-chicken-dip.webp',
  './photos/build-your-own-tacos.webp',
  './photos/cheeseburger-pasta-sneaky-carrots.webp',
  './photos/cheesy-quesadillas.webp',
  './photos/chicken-and-corn-chowder.webp',
  './photos/chicken-and-egg-rice-bowls.webp',
  './photos/chicken-black-bean-enchilada-bake.webp',
  './photos/chicken-broccoli-stuffed-sweet-potatoes.webp',
  './photos/chicken-burrito-bowls.webp',
  './photos/chicken-fried-rice.webp',
  './photos/chicken-noodle-soup.webp',
  './photos/chicken-pot-pie.webp',
  './photos/chicken-tortilla-soup.webp',
  './photos/chicken-veggie-lo-mein.webp',
  './photos/corn-dog-muffins-and-fries.webp',
  './photos/crispy-oven-wings.webp',
  './photos/crispy-tenders-and-fries.webp',
  './photos/drumsticks-and-potatoes.webp',
  './photos/easy-baked-ziti.webp',
  './photos/easy-chicken-alfredo.webp',
  './photos/fall-squash-mac.webp',
  './photos/french-bread-pizzas.webp',
  './photos/game-day-chili.webp',
  './photos/grilled-cheese-tomato-soup.webp',
  './photos/ham-and-cheese-sliders.webp',
  './photos/ham-and-pea-alfredo-bowties.webp',
  './photos/homemade-chicken-nuggets.webp',
  './photos/homemade-pizza-night.webp',
  './photos/honey-garlic-chicken.webp',
  './photos/italian-chicken-white-bean-skillet.webp',
  './photos/lasagna-roll-ups.webp',
  './photos/loaded-sheet-pan-nachos.webp',
  './photos/meatballs-and-butter-noodles.webp',
  './photos/mediterranean-chicken-chickpea-quinoa-bowls.webp',
  './photos/mild-yogurt-chicken-curry.webp',
  './photos/mini-meatloaves.webp',
  './photos/oven-french-toast-sticks.webp',
  './photos/philly-cheesesteak-sliders.webp',
  './photos/pigs-in-a-blanket.webp',
  './photos/pizza-dip.webp',
  './photos/pizza-quesadillas.webp',
  './photos/pull-apart-pizza-bites.webp',
  './photos/ranch-turkey-burgers-and-fries.webp',
  './photos/sheet-pan-cheeseburger-sliders.webp',
  './photos/sheet-pan-chicken-fajitas.webp',
  './photos/sheet-pan-lemon-chicken-pitas.webp',
  './photos/sheet-pan-pizza.webp',
  './photos/sheet-pan-pork-tenderloin.webp',
  './photos/shepherds-pie.webp',
  './photos/sloppy-joes.webp',
  './photos/sneaky-cauliflower-alfredo.webp',
  './photos/sneaky-veggie-meatball-subs.webp',
  './photos/spaghetti-meat-sauce.webp',
  './photos/stovetop-mac-and-cheese.webp',
  './photos/stuffed-shells.webp',
  './photos/taco-bake.webp',
  './photos/teriyaki-chicken-bowls.webp',
  './photos/tomato-tortellini-soup.webp',
  './photos/turkey-cheese-pinwheels.webp',
  './photos/turkey-egg-roll-in-a-bowl.webp',
  './photos/turkey-pizza-stuffed-peppers.webp',
  './photos/turkey-sweet-potato-breakfast-hash.webp',
  './photos/veggie-egg-muffins-and-toast.webp',
  './photos/veggie-pasta-primavera.webp',
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
