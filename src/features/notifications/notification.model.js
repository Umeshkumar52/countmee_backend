import mongoose from "mongoose";
import { User } from "../users/user.model.js";
import { ROLES } from "../../constants/index.js";
import { sendNotificationToUser } from "../../common/services/socket.service.js";
import { sendPushNotification } from "../../common/services/firebase.service.js";

const notificationSchema = new mongoose.Schema(
  {
    notifiable_type: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    notifiable_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read_at: { type: Date, default: null },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// TTL Index to automatically delete documents after 30 days (2592000 seconds)
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 2592000 });

notificationSchema.post("save", function (doc) {
  try {
    // 1. Send via Socket.io (Real-time online users)
    const payload = {
      id: doc._id,
      _id: doc._id,
      notifiable_type: doc.notifiable_type,
      notifiable_id: doc.notifiable_id,
      title: doc.title,
      message: doc.message,
      read_at: doc.read_at,
      order_id: doc.order_id,
      created_at: doc.createdAt || doc.created_at,
    };
    // sendNotificationToUser(doc.notifiable_id, payload);

    // 2. Send via Firebase Cloud Messaging (Background push notifications)
    // Fire and forget without blocking the event loop
    User.findById(doc.notifiable_id)
      .select("+fcm_tokens")
      .lean()
      .then((user) => {
        if (user && user.fcm_tokens && user.fcm_tokens.length > 0) {
          sendPushNotification(user.fcm_tokens, doc.title, doc.message, {
            notification_id: doc._id.toString(),
            order_id: doc.order_id ? doc.order_id.toString() : "",
          }).catch((err) =>
            console.error("[FCM Push Background Error]:", err.message),
          );
        }
      })
      .catch((err) => console.error("[FCM User Lookup Error]:", err.message));
  } catch (error) {
    console.error(
      "[Notification Hook Error] Failed to broadcast notification:",
      error.message,
    );
  }
});

export const Notification = mongoose.model("Notification", notificationSchema);
