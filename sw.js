/* VELAR public shell only. NEVER cache authenticated API responses or personal lyrics here. ES5 compatible. */
'use strict';
var CACHE_PREFIX = 'velar-public-shell-';
var CACHE_NAME = CACHE_PREFIX + 'v7';
var ASSETS = [
  './', './index.html', './app/', './app/index.html',
  './style.css', './style.css?v=7', './main.js', './manifest.webmanifest',
  './favicon.svg', './favicon.svg?v=2', './assets/velardream-crystal.png', './assets/velardream-symbol.svg', './assets/velardream-app-icon-192.png', './assets/velardream-app-icon-512.png'
];
function isPublicAsset(url) {
  var allowed = false;
  ASSETS.forEach(function (path) {
    if (new URL(path, self.registration.scope).href === url) allowed = true;
  });
  return allowed;
}
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(ASSETS);
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (key) {
      if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) {
        return caches.delete(key);
      }
    }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin || !isPublicAsset(url.href)) return;
  if (req.mode === 'navigate' || url.pathname.slice(-10) === '/style.css') {
    // Network-first for public HTML and stylesheets; cached fallback when disconnected.
    event.respondWith(fetch(req).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
          return cache.put(req, copy);
        }));
      }
      return response;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  event.respondWith(caches.match(req).then(function (cached) {
    return cached || fetch(req).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
          return cache.put(req, copy);
        }));
      }
      return response;
    });
  }));
});
