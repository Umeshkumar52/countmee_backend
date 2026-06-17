import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtsecretkeyforsecurityandhashing';

// Map of userId string -> Set of socketIds
const userSockets = new Map();
let ioInstance = null;

export const init = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*', // Allow all origins for dev/production flexibility
      methods: ['GET', 'POST']
    }
  });

  ioInstance.use((socket, next) => {
    try {
      // Access token can be in auth.token or headers or query params
      const token = socket.handshake.auth?.token || 
                    socket.handshake.headers?.authorization?.split(' ')[1] ||
                    socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const userId = socket.user.id || socket.user._id;
    if (userId) {
      const userIdStr = userId.toString();
      if (!userSockets.has(userIdStr)) {
        userSockets.set(userIdStr, new Set());
      }
      userSockets.get(userIdStr).add(socket.id);
      console.log(`[Socket] User ${userIdStr} connected (Socket ID: ${socket.id}). Total users: ${userSockets.size}`);
    }

    socket.on('disconnect', () => {
      if (userId) {
        const userIdStr = userId.toString();
        const socketsSet = userSockets.get(userIdStr);
        if (socketsSet) {
          socketsSet.delete(socket.id);
          if (socketsSet.size === 0) {
            userSockets.delete(userIdStr);
          }
        }
        console.log(`[Socket] User ${userIdStr} disconnected (Socket ID: ${socket.id}). Total users: ${userSockets.size}`);
      }
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized. Please call init(server) first.');
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
      ioInstance.to(socketId).emit('notification:received', payload);
    }
    console.log(`[Socket] Sent notification to user ${userIdStr} across ${socketIds.size} socket(s)`);
    return true;
  }
  
  console.log(`[Socket] User ${userIdStr} is offline. Notification saved only in DB.`);
  return false;
};
