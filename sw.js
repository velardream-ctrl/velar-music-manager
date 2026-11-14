/* VELAR public shell only. NEVER cache authenticated API responses or personal lyrics here. ES5 compatible. */
'use strict';
var CACHE_PREFIX = 'velar-public-shell-';
var CACHE_NAME = CACHE_PREFIX + 'v45';
/* Only private studio SOURCE FILES are cached. Never cache Firestore, Drive files,
   authenticated responses, user lyrics or audio through this Service Worker. */
var STUDIO_PREFIX='velar-studio-shell-';
var STUDIO_CACHE=STUDIO_PREFIX+'v45';
var STUDIO_ASSETS=[
  './studio/','./studio/index.html','./studio/studio.css?v=28','./studio/artist-choices.js?v=1','./studio/artist-track-links.js?v=1','./studio/artist-image-editor.js?v=1','./studio/title-language.js?v=2', './studio/landing-merge.js?v=1',
  './studio/song-distribution.js?v=2','./studio/landing-editor.js?v=32',
  './studio/recordings.css?v=12','./studio/offline-admin.js?v=1','./studio/offline-lyrics-sync.js?v=1','./studio/studio.js?v=11',
  './studio/import.js?v=1','./studio/workflows.js?v=7',
  './studio/lyrics-tools.js?v=4','./studio/print-export.js?v=1',
  './studio/offline-repertoire.js?v=3','./studio/offline-cloud-sync.js?v=1','./studio/recordings.js?v=12',
  './studio/firebase-config.js'
];
var SDK_ASSETS=[
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
];
function allowStudioStatic(url){
  return STUDIO_ASSETS.some(function(path){
    return new URL(path,self.registration.scope).href===url;
  });
}
function allowFirebaseSdk(url){return SDK_ASSETS.indexOf(url)!==-1;}
function studioNavigation(url){
  var base=new URL('./studio/',self.registration.scope);
  return url.origin===base.origin&&(url.pathname===base.pathname||url.pathname===base.pathname+'index.html');
}
var ASSETS = [
  './', './index.html', './artist.html', './artist-detail.css?v=1', './artist-detail.js?v=1', './app/', './app/index.html',
  './style.css', './style.css?v=36', './main.js', './landing-schema.js?v=19', './public-offline.js?v=1', './landing-public.js?v=21', './universe.js?v=5', './public-song-ui.js?v=8', './albums-public.js?v=2', './languages-public.js?v=3', './topics-public.js?v=3', './velar-faq-engine.js?v=3', './velar-assistant.js?v=11', './living-art.js?v=2', './manifest.webmanifest',
  './favicon.svg', './favicon.svg?v=2', './assets/velardream-crystal.png', './assets/velardream-symbol.svg', './assets/velardream-app-icon-192.png', './assets/velardream-app-icon-512.png','./assets/dj-velar-expressions.jpg'
];
function isPublicAsset(url) {
  var allowed = false;
  ASSETS.forEach(function (path) {
    if (new URL(path, self.registration.scope).href === url) allowed = true;
  });
  return allowed;
}
self.addEventListener('install', function (event) {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME).then(function(cache){return cache.addAll(ASSETS);}),
    caches.open(STUDIO_CACHE).then(function(cache){
      return Promise.all(STUDIO_ASSETS.concat(SDK_ASSETS).map(function(asset){
        return cache.add(asset).catch(function(){return null;});
      }));
    })
  ]).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (key) {
      if ((key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) ||
          (key.indexOf(STUDIO_PREFIX) === 0 && key !== STUDIO_CACHE)) {
        return caches.delete(key);
      }
    }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (allowStudioStatic(url.href) || allowFirebaseSdk(url.href) || studioNavigation(url)) {
    // Only exact allowlisted source URLs. Never cache Google Drive/Firestore
    // responses, authenticated APIs, dynamic data or uploaded audio.
    event.respondWith(caches.open(STUDIO_CACHE).then(function(cache){
      if(req.mode==='navigate'){
        return fetch(req).then(function(response){
          if(response&&response.ok){var copy=response.clone();event.waitUntil(cache.put(req,copy));}
          return response;
        }).catch(function(){return cache.match(req).then(function(found){
          return found||cache.match(new URL('./studio/',self.registration.scope).href);
        });});
      }
      return cache.match(req).then(function(found){
        return found||fetch(req).then(function(response){
          if(response&&response.ok){var copy=response.clone();event.waitUntil(cache.put(req,copy));}
          return response;
        });
      });
    }));
    return;
  }
  var artistShell=new URL('./artist.html',self.registration.scope);
  var artistPage=url.origin===artistShell.origin && url.pathname===artistShell.pathname && req.mode==='navigate';
  if (url.origin !== self.location.origin || (!isPublicAsset(url.href) && !artistPage)) return;
  if(artistPage){
    // Query URLs share a single approved public shell. No Firestore response is cached.
    event.respondWith(fetch(req).catch(function(){return caches.match(artistShell.href);}));
    return;
  }
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
