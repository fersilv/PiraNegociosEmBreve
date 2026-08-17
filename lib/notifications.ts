import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase';
import { api } from './api';

// Helper to check if notifications are supported
export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
};

// Default VAPID key can be set here. Users can override in environment or setup.
const VAPID_KEY = "BD7p-Y9vB7p-Y9vB7p-Y9vB7p-Y9vB7p-Y9vB7"; // Placeholder, can be overridden

// Get FCM Messaging instance safely
export const getMessagingInstance = () => {
  try {
    if (isNotificationSupported()) {
      return getMessaging(app);
    }
  } catch (e) {
    console.warn("FCM is not supported or failed to initialize in this browser:", e);
  }
  return null;
};

// Save token to backend for the user
export const saveTokenToFirestore = async (userId: string, token: string) => {
  try {
    await api.put(`/users/${userId}/fcm-token`, { token });
    console.log("FCM Token saved to user profile via API.");
  } catch (err) {
    console.error("Error saving FCM Token via API:", err);
  }
};

// Request Notification Permission and return token
export const requestNotificationPermission = async (userId: string): Promise<string | null> => {
  if (!isNotificationSupported()) {
    console.warn("Notifications are not supported in this browser.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      const messaging = getMessagingInstance();
      if (messaging) {
        try {
          const serviceWorkerRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
            || await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FCM_VAPID_KEY || VAPID_KEY,
            serviceWorkerRegistration,
          });
          if (token) {
            await saveTokenToFirestore(userId, token);
            return token;
          } else {
            console.warn('No registration token available. Request permission to generate one.');
          }
        } catch (tokenErr) {
          console.warn("Failed to retrieve FCM Token (this is normal if no valid VAPID Key is configured yet):", tokenErr);
        }
      }
    } else {
      console.warn('Unable to get permission to notify.');
    }
  } catch (err) {
    console.error('Error during requesting permission:', err);
  }
  return null;
};

// Write a notification to backend
export const sendNotificationToUser = async (
  userId: string, 
  title: string, 
  message: string, 
  type: 'status_update' | 'new_job', 
  metadata: any = {}
) => {
  try {
    await api.post('/notifications', {
      userId,
      title,
      message,
      type,
      ...metadata
    });
    console.log(`Notification of type ${type} sent via API for user ${userId}`);
  } catch (err) {
    console.error("Failed to save notification via API:", err);
  }
};

// Notify all candidates about a new job
export const notifyCandidatesOfNewJob = async (
  jobId: string, 
  jobTitle: string, 
  companyName: string, 
  location: string
) => {
  try {
    await api.post('/notifications/new-job', {
      jobId,
      jobTitle,
      companyName,
      location
    });
    console.log(`Requested backend to notify candidates about new job ${jobTitle}`);
  } catch (err) {
    console.error("Error notifying candidates of new job via API:", err);
  }
};

// Listen to foreground FCM messages
export const setupForegroundFCMListener = (onMessageReceived: (payload: any) => void) => {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  try {
    return onMessage(messaging, (payload) => {
      console.log('Foreground message received in active tab: ', payload);
      onMessageReceived(payload);
    });
  } catch (err) {
    console.error("Error setting up active FCM listener:", err);
  }
  return () => {};
};
