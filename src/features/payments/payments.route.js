import { Router } from "express";
import * as paymentsController from "./payments.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();
// order payment routes
router.post("/create", authenticate, paymentsController.initiateOrderPayment);
router.post("/verify", authenticate, paymentsController.verifyOrderPayment);
router.post("/cashfree-webhook", paymentsController.cashfreeWebhookController);
export default router;

export const walletRouter = Router();
walletRouter.get(
  "/balance/:user_id",
  authenticate,
  paymentsController.getBalance,
);
walletRouter.get(
  "/history/:user_id",
  authenticate,
  paymentsController.getHistory,
);
