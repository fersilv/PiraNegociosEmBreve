/* PWA application shell + Firebase Cloud Messaging background handler. */
const CACHE_NAME = 'piranegocios-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('piranegocios-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg'))) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })),
  );
});

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: 'piranegocios',
  appId: '1:899635907304:web:dfa759c3e4e66c798d575d',
  apiKey: 'AIzaSyDdmJrsBmFxWLyIcZFKMczsh1oedpXAnG4',
  authDomain: 'piranegocios.firebaseapp.com',
  storageBucket: 'piranegocios.firebasestorage.app',
  messagingSenderId: '899635907304',
});

firebase.messaging().onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  const title = notification.title || 'PiraNegócios';
  self.registration.showNotification(title, {
    body: notification.body || 'Você recebeu uma nova atualização.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(windowClient => new URL(windowClient.url).origin === self.location.origin);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
