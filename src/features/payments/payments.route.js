import { Router } from "express";
import * as paymentsController from "./payments.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();
// order payment routes
router.post("/create", paymentsController.initiateOrderPayment);
router.post("/verify", paymentsController.verifyOrderPayment);
router.post("/cashfree-webhook", paymentsController.cashfreeWebhookController);
export default router;

// wallet apis route
export const walletRouter = Router();

walletRouter.post("/recharge", paymentsController.recharge);
walletRouter.get("/balance/:user_id", paymentsController.getBalance);
walletRouter.get("/history/:user_id", paymentsController.getHistory);
