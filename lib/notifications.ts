import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, getDocs, limit } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db, auth, app } from './firebase';

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

// Save token to Firestore for the user
export const saveTokenToFirestore = async (userId: string, token: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    // Store in an array or a separate field on the user profile
    await updateDoc(userRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString()
    });
    console.log("FCM Token saved to user profile.");
  } catch (err) {
    console.error("Error saving FCM Token to Firestore:", err);
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
          const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FCM_VAPID_KEY || VAPID_KEY });
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

// Write a notification to Firestore
export const sendNotificationToUser = async (
  userId: string, 
  title: string, 
  message: string, 
  type: 'status_update' | 'new_job', 
  metadata: any = {}
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      createdAt: new Date().toISOString(),
      read: false,
      ...metadata
    });
    console.log(`Notification of type ${type} written to Firestore for user ${userId}`);
  } catch (err) {
    console.error("Failed to save notification to Firestore:", err);
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
    const q = query(collection(db, 'users'), where('type', '==', 'CANDIDATE'));
    const snap = await getDocs(q);
    
    // Batch notifications or individual writes
    const promises = snap.docs.map(docSnap => {
      const candidateId = docSnap.id;
      return sendNotificationToUser(
        candidateId,
        'Nova Vaga Compatível!',
        `A empresa "${companyName}" publicou uma nova vaga de "${jobTitle}" em "${location}".`,
        'new_job',
        { jobId, jobTitle, companyName, location }
      );
    });
    
    await Promise.all(promises);
    console.log(`Notified ${promises.length} candidates about new job ${jobTitle}`);
  } catch (err) {
    console.error("Error notifying candidates of new job:", err);
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

// Real-time listener for user notifications in Firestore (fallback & in-app alerts)
export const setupFirestoreNotificationListener = (
  userId: string, 
  onNewNotification: (notification: any) => void
) => {
  const q = query(
    collection(db, 'notifications'), 
    where('userId', '==', userId),
    where('read', '==', false)
  );

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const notif = { id: change.doc.id, ...change.doc.data() } as any;
        
        // Show native browser notification if app is in background or permission is granted
        if (Notification.permission === 'granted') {
          try {
            new Notification(notif.title, {
              body: notif.message,
              icon: '/logo.png' // fallback icon
            });
          } catch (e) {
            console.warn("Could not fire background Notification:", e);
          }
        }
        
        onNewNotification(notif);
      }
    });
  });
};
