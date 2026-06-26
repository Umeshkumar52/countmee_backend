import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import mongoose from "mongoose";
import { User } from "../../features/users/user.model.js";
let isFirebaseConfigured = false;

try {
  // Option 1: Load from individual service account env vars
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
    initializeApp({
      credential: cert(serviceAccount),
    });
    isFirebaseConfigured = true;
    console.log("[Firebase] Initialized Admin SDK via env credentials.");
  }
  // Option 2: Load from default environment (e.g. Google Cloud run or default config)
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({
      credential: applicationDefault(),
    });
    isFirebaseConfigured = true;
    console.log(
      "[Firebase] Initialized Admin SDK via application default credentials.",
    );
  } else {
    console.warn(
      "[Firebase] Warning: FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS not configured.",
    );
    console.warn(
      "[Firebase] Background push notifications (FCM) will be simulated in console.",
    );
  }
} catch (error) {
  console.error(
    "[Firebase] Failed to initialize Firebase Admin SDK:",
    error.message,
  );
  console.warn(
    "[Firebase] Running in fallback mode. FCM push notifications are disabled.",
  );
}

/**
 * Send push notification to a device token via Firebase
 * @param {string} fcmToken
 * @param {string} title
 * @param {string} body
 * @param {object} data - Optional key-value metadata payload
 */
export const sendPushNotification = async (
  fcmTokens,
  title,
  body,
  data = {},
) => {
  if (!fcmTokens || (Array.isArray(fcmTokens) && fcmTokens.length === 0))
    return;

  const tokensArray = Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens];

  // Format all data values to string as required by FCM SDK
  const formattedData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined) {
      formattedData[key] = value.toString();
    }
  }

  if (!isFirebaseConfigured) {
    console.log(`[Firebase Simulated Push] To: ${tokensArray.join(", ")}`);
    console.log(`[Firebase Simulated Push] Title: ${title}`);
    console.log(`[Firebase Simulated Push] Body: ${body}`);
    console.log(`[Firebase Simulated Push] Data:`, formattedData);
    return;
  }

  try {
    const message = {
      tokens: tokensArray,
      notification: {
        title,
        body,
      },
      data: formattedData,
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log(
      `[Firebase] Push notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`,
    );

    // Auto-clean expired or invalid registration tokens from DB
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error.code === "messaging/registration-token-not-registered" ||
            error.code === "messaging/invalid-argument"
          ) {
            failedTokens.push(tokensArray[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        console.warn(
          `[Firebase] Cleaning invalid FCM tokens from database: ${failedTokens.join(", ")}`,
        );
        try {
          await User.updateMany(
            { fcm_tokens: { $in: failedTokens } },
            { $pull: { fcm_tokens: { $in: failedTokens } } },
          );
        } catch (dbErr) {
          console.error(
            `[Firebase] Failed to clean invalid FCM tokens from DB:`,
            dbErr.message,
          );
        }
      }
    }
  } catch (error) {
    console.error(`[Firebase] Error sending push notification:`, error.message);
  }
};
