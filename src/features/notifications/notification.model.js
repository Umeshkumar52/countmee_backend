import mongoose from "mongoose";
import { User } from "../users/user.model.js";
import { ROLES } from "../../constants/index.js";
const { sendNotificationToUser } =
  await import("../../common/services/socket.service.js");
const { sendPushNotification } =
  await import("../../common/services/firebase.service.js");

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

notificationSchema.post("save", async function (doc) {
  try {
    console.log("notification save method has been called");
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
    sendNotificationToUser(doc.notifiable_id, payload);

    // 2. Send via Firebase Cloud Messaging (Background push notifications)
    const user = await User.findById(doc.notifiable_id);
    console.log("user finded", user);
    if (user && user.fcm_tokens && user.fcm_tokens.length > 0) {
      await sendPushNotification(user.fcm_tokens, doc.title, doc.message, {
        notification_id: doc._id.toString(),
        order_id: doc.order_id ? doc.order_id.toString() : "",
      });
    }

    console.log("notification sent succesfuly");
  } catch (error) {
    console.error(
      "[Notification Hook Error] Failed to broadcast notification:",
      error.message,
    );
  }
});

export const Notification = mongoose.model("Notification", notificationSchema);
