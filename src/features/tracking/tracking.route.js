import { Router } from "express";
import * as ordersController from "../orders/orders.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();

// Order tracking endpoint
router.post("/", authenticate, ordersController.tracking);

export default router;
