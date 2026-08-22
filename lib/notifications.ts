import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase';
import { api } from './api';

const DEFAULT_VAPID_KEY = 'BIM7-GieuppzyimIzQu9EWFUuK80-O3OGeJLzXz3RhumaANEpkCfeWSNP_sOj62HHbeNhfdnwW_MBezFOjVjiGA';
const INSTALLATION_STORAGE_KEY = 'piranegocios_push_installation_id';

export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
};

const getVapidKey = () => String(import.meta.env.VITE_FCM_VAPID_KEY || DEFAULT_VAPID_KEY).trim();

export const getMessagingInstance = () => {
  try {
    if (isNotificationSupported()) return getMessaging(app);
  } catch (e) {
    console.warn('FCM não pôde ser inicializado neste navegador:', e);
  }
  return null;
};

const browserPlatform = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || nav.platform || null;
};

const getLocalInstallationId = () => {
  let id = window.localStorage.getItem(INSTALLATION_STORAGE_KEY);
  if (id) return id;
  id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(INSTALLATION_STORAGE_KEY, id);
  return id;
};

export const saveInstallationToServer = async (installationId: string, token: string) => {
  await api.put('/notifications/push-installation', {
    installationId,
    token,
    platform: browserPlatform(),
    userAgent: navigator.userAgent || null,
  });
};

const getMessagingServiceWorker = async () => {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing && existing.active?.scriptURL.includes('/firebase-messaging-sw.js')) return existing;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  await navigator.serviceWorker.ready;
  return registration;
};

/**
 * Ativa o Web Push neste navegador. Cada navegador recebe um identificador
 * local estável e o token FCM pode ser renovado sem criar dispositivos duplicados.
 */
export const requestNotificationPermission = async (_userId?: string): Promise<string | null> => {
  if (!isNotificationSupported()) {
    console.warn('Notificações push não são suportadas neste navegador.');
    return null;
  }

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    console.error('A chave pública VAPID do Firebase não está configurada.');
    return null;
  }

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessagingInstance();
    if (!messaging) return null;
    const serviceWorkerRegistration = await getMessagingServiceWorker();
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
    if (!token) {
      console.warn('Firebase não retornou token FCM para este dispositivo.');
      return null;
    }

    const installationId = getLocalInstallationId();
    await saveInstallationToServer(installationId, token);
    return installationId;
  } catch (err) {
    console.error('Erro ao ativar notificações push:', err);
    return null;
  }
};

export const getPushStatus = async (): Promise<{ enabled: boolean; activeInstallations: number }> => {
  try {
    const response = await api.get('/notifications/push-status');
    return {
      enabled: Boolean(response.data?.enabled),
      activeInstallations: Number(response.data?.activeInstallations || 0),
    };
  } catch {
    return { enabled: false, activeInstallations: 0 };
  }
};

export const sendPushTest = async () => api.post('/notifications/push-test');

// Legado: notificações de processo entre empresa e candidato agora nascem no
// backend, onde autorização, persistência e push são confiáveis.
export const sendNotificationToUser = async (
  userId: string,
  title: string,
  message: string,
  type: 'status_update' | 'new_job',
  metadata: any = {},
) => {
  try {
    await api.post('/notifications', { userId, title, message, type, ...metadata });
  } catch (err) {
    console.debug('Notificação direta não enviada; fluxos de processo são tratados pelo backend.', err);
  }
};

export const notifyCandidatesOfNewJob = async (
  jobId: string,
  jobTitle: string,
  companyName: string,
  location: string,
) => {
  try {
    await api.post('/notifications/new-job', { jobId, jobTitle, companyName, location });
  } catch (err) {
    console.error('Erro ao disparar alerta de nova vaga:', err);
  }
};

export const setupForegroundFCMListener = (onMessageReceived: (payload: any) => void) => {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  try {
    return onMessage(messaging, payload => onMessageReceived(payload));
  } catch (err) {
    console.error('Erro ao ouvir notificações FCM em primeiro plano:', err);
  }
  return () => {};
};
