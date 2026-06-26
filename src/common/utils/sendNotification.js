import { Notification } from "../../features/notifications/notification.model.js";
import { User } from "../../features/users/user.model.js";
import { ROLES } from "../../constants/index.js";
import { ApiError } from "./ApiError.js";

/**
 * Send a notification to users based on role and optionally a specific user ID.
 * @param {Object} params
 * @param {string} params.role - The role of the user(s) (e.g. from ROLES constant).
 * @param {string} params.title - The notification title.
 * @param {string} params.message - The notification message body.
 * @param {string} [params.userId] - The specific user's ID to notify (Required for non-admin roles).
 * @param {string} [params.orderId] - Optional order ID associated with the notification.
 * @param {Object} [params.session] - Optional mongoose session for transactions.
 */
export const sendNotification = async ({ role, title, message, userId, orderId, session }) => {
  try {
    let usersToNotify = [];

    if (role === ROLES.ADMIN) {
      // Notification for all admins, ignore userId
      usersToNotify = await User.find({ role: ROLES.ADMIN }).select('_id');
    } else {
      // Notification for other roles requires an ID
      if (!userId) {
        throw new ApiError(400, `User ID is required when sending notification to role: ${role}`);
      }
      usersToNotify = [{ _id: userId }];
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
    console.error("[Notification Error] Failed to send notification:", error.message);
    throw error;
  }
};
