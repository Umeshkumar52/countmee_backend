import express from "express";
import authRouter from "../features/auth/auth.route.js";
import adminRouter from "../features/admin/admin.route.js";
import pdcRouter from "../features/pdc/pdc.route.js";
import dpRouter from "../features/deliveryPartner/dp.route.js";
import userRouter from "../features/users/users.route.js";
import paymentsRouter from "../features/payments/payments.route.js";
import trackingRouter from "../features/tracking/tracking.route.js";
import smsRouter from "../features/notifications/sms.route.js";
import authRoute from "../features/auth/auth.route.js";
import ordersRouter from "../features/orders/orders.route.js";
import { walletRouter } from "../features/payments/payments.route.js";
import { authenticate } from "../common/middlewares/auth.middleware.js";
const router = express.Router();

// REST API routes under /api
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/admin", adminRouter);
router.use("/pdc", pdcRouter);
router.use("/dp", dpRouter);
router.use("/order", authenticate, ordersRouter);
router.use("/payment", paymentsRouter);
router.use("/tracking", trackingRouter);
router.use("/wallet", authenticate, walletRouter);
router.use("/sms", smsRouter);

export default router;
