import { Router } from "express";
import * as usersController from "./users.controller.js";
import { uploadSingle } from "../../common/middlewares/upload.middleware.js";
import ordersRouter from "../orders/orders.route.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();

// Ensure all user profile/address operations require authentication
router.use(authenticate);

// Profile and Address Endpoints
router.post(
  "/editProfile",
  uploadSingle("profile_pic"),
  usersController.editProfile,
);
router.post("/createAddress", usersController.createAddress);
router.get("/myAddress/:customer_id", usersController.myAddress);

// Sub-route for user orders
router.use("/orders", ordersRouter);

export default router;
