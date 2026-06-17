import { Router } from "express";
import * as paymentsController from "./payments.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();

// Apply auth middleware to all payments/wallet endpoints
router.use(authenticate);

// Wallet endpoints under `/api/payment` prefix
router.get("/wallet/balance/:user_id", paymentsController.getBalance);
router.get("/wallet/history/:user_id", paymentsController.getHistory);
router.post("/wallet/pay-order", paymentsController.payOrder);
router.post("/wallet/recharge", paymentsController.recharge);
router.post("/wallet/initiate", paymentsController.initiateCashfreePayment);
router.post("/wallet/verify", paymentsController.verifyCashfreePayment);

// Standard Payment (Razorpay) under `/api/payment` prefix
router.post("/razorpay", paymentsController.processRazorpayPayment);

export default router;

// =========================================================================
// BACKWARD COMPATIBILITY EXPORTS (LEGACY NAMED ROUTERS)
// =========================================================================
export const walletRouter = Router();
walletRouter.get("/balance/:user_id", paymentsController.getBalance);
walletRouter.get("/history/:user_id", paymentsController.getHistory);
walletRouter.post("/pay-order", paymentsController.payOrder);
walletRouter.post("/recharge", paymentsController.recharge);
walletRouter.post("/initiate", paymentsController.initiateCashfreePayment);
walletRouter.post("/verify", paymentsController.verifyCashfreePayment);

export const customerPaymentRouter = Router();
customerPaymentRouter.post("/payment", paymentsController.processRazorpayPayment);
