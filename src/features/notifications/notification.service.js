import { Notification } from "./notification.model.js";
import { User } from "../users/user.model.js";

/**
 * Trigger a notification to users based on role and optionally a specific user ID.
 * @param {Object} params
 * @param {string} params.role - The role of the user(s) (e.g. from ROLES constant).
 * @param {string} params.title - The notification title.
 * @param {string} params.message - The notification message body.
 * @param {string} [params.userId] - The specific user's ID to notify. If omitted, notifies all users with the role.
 * @param {string} [params.orderId] - Optional order ID associated with the notification.
 * @param {Object} [params.session] - Optional mongoose session for transactions.
 */
export const triggerNotification = async ({ role, title, message, userId, orderId, session }) => {
  try {
    let usersToNotify = [];

    if (userId) {
      // Notification for a specific user
      usersToNotify = [{ _id: userId }]; // We just need the ID to create the notification
    } else {
      // Notification for all users of a specific role (e.g. all admins)
      usersToNotify = await User.find({ role }).select('_id');
    }

    if (usersToNotify.length === 0) {
      console.warn(`[Notification] No users found to notify for role: ${role}`);
      return;
    }

    const notifications = usersToNotify.map(user => ({
      notifiable_type: role,
      notifiable_id: user._id,
      title,
      message,
      order_id: orderId || null
    }));

    // Notification.create will automatically trigger the 'save' hooks for Socket & FCM
    await Notification.create(notifications, session ? { session } : undefined);

    console.log(`[Notification] Successfully dispatched ${usersToNotify.length} notifications for role: ${role}.`);
  } catch (error) {
    console.error("[Notification Error] Failed to trigger notification:", error.message);
  }
};
