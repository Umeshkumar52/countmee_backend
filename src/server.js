import "dotenv/config";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/database.js";
import { init as initSocket } from "./common/services/socket.service.js";
import { initAgenda } from "./common/services/agenda.service.js";
import { initRedis } from "./common/services/redis.service.js";
import { initDocumentCron } from "./common/utils/documentCron.js";

const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || "development";

process.on("uncaughtException", (error) => {
  console.error("[CRITICAL] Uncaught Exception:", {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  // Crash the process immediately so process manager (Docker, PM2, K8s) can restart the instance
  process.exit(1);
});

let server;

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "[CRITICAL] Unhandled Promise Rejection at:",
    promise,
    "reason:",
    reason,
  );
  if (server) {
    gracefulShutdown("Unhandled Rejection");
  } else {
    process.exit(1);
  }
});

/**
 * 3. Graceful Shutdown Handlers
 */
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log("[SHUTDOWN] HTTP server closed. Active requests finished.");
      closeDBConnection();
    });
  } else {
    closeDBConnection();
  }

  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error(
      "[SHUTDOWN] Forcefully shutting down because graceful shutdown timed out.",
    );
    process.exit(1);
  }, 10000);
};

const closeDBConnection = () => {
  mongoose.connection
    .close()
    .then(() => {
      console.log("[SHUTDOWN] MongoDB connection closed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[SHUTDOWN] Error closing MongoDB connection:", err);
      process.exit(1);
    });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const startServer = async () => {
  try {
    await connectDB();
    await initRedis();
    await initAgenda();
    initDocumentCron();

    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${NODE_ENV} mode.`);
    });

    // Initialize real-time socket connections server
    initSocket(server);

    /**
     * 5. Keep-Alive and Headers Timeout Tuning
     * Prevents sporadic 502 Bad Gateway errors when deploying behind Cloud Load Balancers (like AWS ALB or Nginx).
     * Server timeout must be slightly greater than the proxy's Keep-Alive timeout (default ALB is 60s).
     */
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds
  } catch (error) {
    console.error("[CRITICAL] Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
