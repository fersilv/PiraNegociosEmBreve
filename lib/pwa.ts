export function registerPwaServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(error => {
      console.warn('Não foi possível preparar o modo offline.', error);
    });
  }, { once: true });
}
