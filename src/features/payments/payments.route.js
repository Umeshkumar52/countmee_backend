import { Router } from "express";
import * as paymentsController from "./payments.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();

// Cashfree Webhook (Unauthenticated)
router.post("/cashfree-webhook", paymentsController.cashfreeWebhookController);
router.use(authenticate);
// Wallet endpoints under `/api/payment` prefix
// router.get("/wallet/balance/:user_id", paymentsController.getBalance);
// router.get("/wallet/history/:user_id", paymentsController.getHistory);
// router.post("/wallet/pay-order", paymentsController.payOrder);
// router.post("/wallet/recharge", paymentsController.recharge);
// router.post("/wallet/initiate", paymentsController.initiateCashfreePayment);
// router.post("/wallet/verify", paymentsController.verifyCashfreePayment);


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
