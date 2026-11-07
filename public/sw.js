/* THE SHOP BD — Service Worker (PWA অফলাইন + পুশ নোটিফিকেশন) */
 

const CACHE = 'tsb-v3';
const SHELL = ['/', '/shop', '/cart', '/wishlist', '/offline.html'];
const IMG_DIRS = ['/products/', '/brands/', '/icons/', '/payments/', '/logo.svg', '/uploads/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase ইত্যাদি বাদ
  if (url.pathname.startsWith('/admin')) return;   // অ্যাডমিন সবসময় নেটওয়ার্ক

  // ছবি: cache-first
  if (IMG_DIRS.some((d) => url.pathname.startsWith(d))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            return res;
          })
      )
    );
    return;
  }

  // Next.js স্ট্যাটিক বিল্ড ফাইল: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            return res;
          })
      )
    );
    return;
  }

  // পেজ/অন্য সব: network-first, ফেল করলে ক্যাশ/অফলাইন পেজ
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.headers.get('accept')?.includes('text/html')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('/offline.html').then((off) => off || Response.error()))
      )
  );
});

// ── পুশ নোটিফিকেশন ──
self.addEventListener('push', (event) => {
  let title = 'THE SHOP BD';
  let body = 'নতুন আপডেট এসেছে — দেখুন!';
  let url = '/';
  try {
    const data = event.data ? event.data.json() : {};
    title = (data.notification && data.notification.title) || data.title || title;
    body = (data.notification && data.notification.body) || data.body || body;
    url = data.data && data.data.url ? data.data.url : url;
  } catch (e) {
    if (event.data) {
      body = event.data.text() || body;
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
