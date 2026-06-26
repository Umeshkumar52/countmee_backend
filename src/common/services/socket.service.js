import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Order } from "../../features/orders/order.model.js";

const JWT_SECRET = process.env.JWT_SECRET;

// Map of userId string -> Set of socketIds
const userSockets = new Map();
let ioInstance = null;

export const init = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all origins for dev/production flexibility
      methods: ["GET", "POST"],
    },
  });

  ioInstance.use((socket, next) => {
    try {
      // Access token can be in auth.token or headers or query params
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1] ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error("Invalid or expired token"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.user.id || socket.user._id;
    if (userId) {
      const userIdStr = userId.toString();
      if (!userSockets.has(userIdStr)) {
        userSockets.set(userIdStr, new Set());
      }
      userSockets.get(userIdStr).add(socket.id);

      socket.on("create-order", (data) => {
        socket.to().emit("new-order", data);
      });
      console.log(
        `[Socket] User ${userIdStr} connected (Socket ID: ${socket.id}). Total users: ${userSockets.size}`,
      );
    }

    // Tracking Events
    socket.on("order:join", ({ orderId }) => {
      if (orderId) {
        socket.join(`order_${orderId}`);
        console.log(
          `[Socket] Socket ${socket.id} joined room order_${orderId}`,
        );
      }
    });

    socket.on("order:leave", ({ orderId }) => {
      if (orderId) {
        socket.leave(`order_${orderId}`);
        console.log(`[Socket] Socket ${socket.id} left room order_${orderId}`);
      }
    });

    socket.on("location:update", async ({ orderId, lat, lng }) => {
      if (orderId && lat != null && lng != null) {
        // Broadcast location to anyone in this order's room
        ioInstance
          .to(`order_${orderId}`)
          .emit("location:updated", { lat, lng });

        // Asynchronously save to DB
        try {
          await Order.findByIdAndUpdate(orderId, {
            current_lat: lat,
            current_lng: lng,
          });
        } catch (err) {
          console.error(
            `[Socket] Error saving location for order ${orderId}:`,
            err,
          );
        }
      }
    });

    socket.on("disconnect", () => {
      if (userId) {
        const userIdStr = userId.toString();
        const socketsSet = userSockets.get(userIdStr);
        if (socketsSet) {
          socketsSet.delete(socket.id);
          if (socketsSet.size === 0) {
            userSockets.delete(userIdStr);
          }
        }
        console.log(
          `[Socket] User ${userIdStr} disconnected (Socket ID: ${socket.id}). Total users: ${userSockets.size}`,
        );
      }
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error(
      "Socket.io not initialized. Please call init(server) first.",
    );
  }
  return ioInstance;
};

/**
 * Send real-time notification to a specific user
 * @param {string|ObjectId} userId
 * @param {object} payload - Notification data
 */
export const sendNotificationToUser = (userId, payload) => {
  if (!ioInstance) return false;

  const userIdStr = userId.toString();
  const socketIds = userSockets.get(userIdStr);

  if (socketIds && socketIds.size > 0) {
    for (const socketId of socketIds) {
      ioInstance.to(socketId).emit("notification:received", payload);
    }
    console.log(
      `[Socket] Sent notification to user ${userIdStr} across ${socketIds.size} socket(s)`,
    );
    return true;
  }

  console.log(
    `[Socket] User ${userIdStr} is offline. Notification saved only in DB.`,
  );
  return false;
};
