/* Firebase Cloud Messaging background handler.
 *
 * IMPORTANT: this worker intentionally does not intercept fetch/navigation.
 * The application server is responsible for SPA routing. Keeping FCM and
 * application-shell caching in the same worker caused route navigations such
 * as /user/perfil to fail when a network fetch was rejected.
 */

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('piranegocios-')).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
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
  const target = event.notification.data?.url || '/user';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const existing = windows.find(windowClient => new URL(windowClient.url).origin === self.location.origin);
      if (existing) {
        existing.navigate(target).catch(() => undefined);
        return existing.focus();
      }
      return clients.openWindow(target);
    }),
  );
});
