var VERZIA = 'ander-v3';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERZIA).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERZIA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERZIA).then(function (c) { c.put('index.html', copy); });
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }
  var url = new URL(req.url);
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(VERZIA).then(function (c) { c.put(req, copy); });
        return res;
      });
      return hit || net;
    }));
  }
});

function uloz(b) {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('ander', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('brifingy', { keyPath: 'datum' }); };
    r.onerror = function () { rej(r.error); };
    r.onsuccess = function () {
      var tx = r.result.transaction('brifingy', 'readwrite');
      tx.objectStore('brifingy').put(b);
      tx.oncomplete = function () { res(); };
      tx.onerror = function () { rej(tx.error); };
    };
  });
}

function riadokCisel(b) {
  var casti = [];
  if (typeof b.odberatelia === 'number') casti.push(b.odberatelia.toLocaleString('sk-SK') + ' odberateľov');
  if (typeof b.za_tyzden === 'number') casti.push((b.za_tyzden >= 0 ? '+' : '') + b.za_tyzden + ' za týždeň');
  if (typeof b.skip === 'number') casti.push('skip ' + Math.round(b.skip) + ' %');
  return casti.join(' · ');
}

self.addEventListener('push', function (e) {
  var p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { t: 'test', body: e.data ? e.data.text() : '' }; }
  var title = 'Ander', body = p.body || 'Ranný brífing je tu.';
  var kroky = [];
  if (p.t === 'brifing' && p.d && p.d.datum) {
    title = 'Dnes urob';
    body = [p.d.dnes || 'Ranný brífing je tu.', riadokCisel(p.d)].filter(Boolean).join('\n');
    kroky.push(uloz(p.d).catch(function () {}));
  } else if (p.title) {
    title = p.title;
  }
  var ukaz = Promise.all(kroky).then(function () {
    return self.registration.showNotification(title, {
      body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'ander-brifing', data: { url: './' }
    });
  }).then(function () {
    if (self.navigator && self.navigator.setAppBadge) return self.navigator.setAppBadge(1).catch(function () {});
  }).then(function () {
    return self.clients.matchAll({ type: 'window' }).then(function (cl) { cl.forEach(function (c) { c.postMessage({ type: 'novy' }); }); });
  });
  e.waitUntil(ukaz);
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
    for (var i = 0; i < cl.length; i++) { if ('focus' in cl[i]) return cl[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
