import admin from 'firebase-admin';
import mongoose from 'mongoose';

let isFirebaseConfigured = false;

try {
  // Option 1: Load from service account env string (JSON stringified)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isFirebaseConfigured = true;
    console.log('[Firebase] Initialized Admin SDK via env credentials.');
  }
  // Option 2: Load from default environment (e.g. Google Cloud run or default config)
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    isFirebaseConfigured = true;
    console.log('[Firebase] Initialized Admin SDK via application default credentials.');
  } else {
    console.warn('[Firebase] Warning: FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS not configured.');
    console.warn('[Firebase] Background push notifications (FCM) will be simulated in console.');
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Firebase Admin SDK:', error.message);
  console.warn('[Firebase] Running in fallback mode. FCM push notifications are disabled.');
}

/**
 * Send push notification to a device token via Firebase
 * @param {string} fcmToken 
 * @param {string} title 
 * @param {string} body 
 * @param {object} data - Optional key-value metadata payload
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return;

  // Format all data values to string as required by FCM SDK
  const formattedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      formattedData[key] = value.toString();
    }
  }

  if (!isFirebaseConfigured) {
    console.log(`[Firebase Simulated Push] To: ${fcmToken}`);
    console.log(`[Firebase Simulated Push] Title: ${title}`);
    console.log(`[Firebase Simulated Push] Body: ${body}`);
    console.log(`[Firebase Simulated Push] Data:`, formattedData);
    return;
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: formattedData
    };

    const response = await admin.messaging().send(message);
    console.log(`[Firebase] Push notification sent successfully. Message ID: ${response}`);
  } catch (error) {
    console.error(`[Firebase] Error sending push notification:`, error.message);
    
    // Auto-clean expired or invalid registration tokens from DB
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-argument'
    ) {
      console.warn(`[Firebase] Cleaning invalid FCM token from database: ${fcmToken}`);
      try {
        const User = mongoose.model('User');
        await User.updateOne({ fcm_token: fcmToken }, { fcm_token: null });
      } catch (dbErr) {
        console.error(`[Firebase] Failed to clean invalid FCM token from DB:`, dbErr.message);
      }
    }
  }
};
