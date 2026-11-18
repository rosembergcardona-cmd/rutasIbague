/* Service worker: keeps the app usable offline (street tiles and address search need internet). */
var CACHE = 'rutaibague-v1';
var SHELL = ['./', 'index.html', 'css/styles.css', 'js/data-bundle.js', 'js/gtfs.js', 'js/agent.js', 'js/map.js', 'js/app.js',
  'data/gtfs/stops.txt', 'data/gtfs/routes.txt', 'data/gtfs/trips.txt', 'data/gtfs/stop_times.txt', 'data/gtfs/frequencies.txt',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // tiles, fonts and geocoding go to the network
  // network first, cache as fallback, so new data files are picked up after a deploy
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
