import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase';
import { api } from './api';

export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
};

const getVapidKey = () => String(import.meta.env.VITE_FCM_VAPID_KEY || '').trim();

export const getMessagingInstance = () => {
  try {
    if (isNotificationSupported()) {
      return getMessaging(app);
    }
  } catch (e) {
    console.warn('FCM não pôde ser inicializado neste navegador:', e);
  }
  return null;
};

export const saveTokenToFirestore = async (userId: string, token: string) => {
  try {
    await api.put(`/users/${userId}/fcm-token`, { token });
  } catch (err) {
    console.error('Erro ao salvar token FCM:', err);
    throw err;
  }
};

export const requestNotificationPermission = async (userId: string): Promise<string | null> => {
  if (!isNotificationSupported()) {
    console.warn('Notificações push não são suportadas neste navegador.');
    return null;
  }

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    console.error('VITE_FCM_VAPID_KEY não está configurada. O push web não pode gerar token sem a chave pública VAPID do Firebase.');
    return null;
  }

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessagingInstance();
    if (!messaging) return null;

    const serviceWorkerRegistration =
      await navigator.serviceWorker.getRegistration('/') ||
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    if (!token) {
      console.warn('Firebase não retornou token FCM para este dispositivo.');
      return null;
    }

    await saveTokenToFirestore(userId, token);
    return token;
  } catch (err) {
    console.error('Erro ao ativar notificações push:', err);
    return null;
  }
};

// Legado: notificações de processo entre empresa e candidato agora nascem no
// backend de ApplicationsService, onde a autorização e o push são confiáveis.
export const sendNotificationToUser = async (
  userId: string,
  title: string,
  message: string,
  type: 'status_update' | 'new_job',
  metadata: any = {},
) => {
  try {
    await api.post('/notifications', {
      userId,
      title,
      message,
      type,
      ...metadata,
    });
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
    await api.post('/notifications/new-job', {
      jobId,
      jobTitle,
      companyName,
      location,
    });
  } catch (err) {
    console.error('Erro ao disparar alerta de nova vaga:', err);
  }
};

export const setupForegroundFCMListener = (onMessageReceived: (payload: any) => void) => {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  try {
    return onMessage(messaging, (payload) => {
      onMessageReceived(payload);
    });
  } catch (err) {
    console.error('Erro ao ouvir notificações FCM em primeiro plano:', err);
  }
  return () => {};
};
