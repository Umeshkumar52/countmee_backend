import { Router } from "express";
import * as usersController from "./users.controller.js";
import { uploadAny } from "../../common/middlewares/upload.middleware.js";
import ordersRouter from "../orders/orders.route.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";
import * as ordersController from "../orders/orders.controller.js";
const router = Router();

// Ensure all user profile/address operations require authentication
router.use(authenticate);

// Profile and Address Endpoints
router.post(
  "/editProfile",
  uploadAny(),
  usersController.editProfile,
);
router.get("/my-dues", ordersController.myDues);
router.post("/createAddress", usersController.createAddress);
router.get("/myAddress/:customer_id", usersController.myAddress);
router.get("/myNotifications/:user_id", ordersController.myNotifications);
router.post("/recommend-vehicle", usersController.recommendVehicle);
router.delete("/deleteAddress/:address_id", usersController.deleteAddress);

export default router;
