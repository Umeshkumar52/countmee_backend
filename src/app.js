import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import { errorHandler } from "./common/middlewares/errorHandler.js";
import {
  sanitizeMongo,
  preventHpp,
} from "./common/middlewares/security.middleware.js";

// Import Feature Routers (New starting routes)
import authRouter from "./features/auth/auth.route.js";
import adminRouter from "./features/admin/admin.route.js";
import pdcRouter from "./features/pdc/pdc.route.js";
import dpRouter from "./features/deliveryPartner/dp.route.js";
import userRouter from "./features/users/users.route.js";
import paymentsRouter from "./features/payments/payments.route.js";
import trackingRouter from "./features/tracking/tracking.route.js";
import smsRouter from "./features/notifications/sms.route.js";
import authRoute from "./features/auth/auth.route.js";
import ordersRouter from "./features/orders/orders.route.js";
import { walletRouter } from "./features/payments/payments.route.js";
import { authenticate } from "./common/middlewares/auth.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

// 2. Global Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    xFrameOptions: { action: "deny" }, // Prevent Clickjacking attacks
    xContentTypeOptions: true, // Prevent MIME-type sniffing
    referrerPolicy: { policy: "same-origin" },
  }),
);

// 3. CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matching allowed list
      if (
        !origin ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  }),
);

// 4. Rate Limiting for API Endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in standard headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: {
    status: 429,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
  skip: (req) => !req.path.startsWith("/api"), // Only apply rate limits to API endpoints
});
app.use(apiLimiter);

// 5. Body Size Parsers (DoS Protection)
app.use(express.json({ limit: "100kb" })); // Limit body payload to 100KB
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// 5.5. Input Sanitization & Parameter Pollution Prevention
app.use(sanitizeMongo);
app.use(preventHpp);

// 6. Static File Serving
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// REST API routes under /api
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/pdc", pdcRouter);
app.use("/api/dp", dpRouter);
app.use("/api/order", authenticate, ordersRouter);
app.use("/api/payment", paymentsRouter);
app.use("/api/tracking", trackingRouter);
app.use("/api/wallet", authenticate, walletRouter);
app.use("/api", smsRouter);

// 8. Fallback 404 Route for all unresolved endpoints
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});
app.use(errorHandler);

export default app;
