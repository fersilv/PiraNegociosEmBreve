importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0465682201",
  appId: "1:134676301094:web:76cfc5832e87bdae656de7",
  apiKey: "AIzaSyDXavrzxJGYbSYI7XePahPffmFD5LlToG4",
  authDomain: "gen-lang-client-0465682201.firebaseapp.com",
  storageBucket: "gen-lang-client-0465682201.firebasestorage.app",
  messagingSenderId: "134676301094"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title || 'PiraNegócios';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png' // default fallback icon if any
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
