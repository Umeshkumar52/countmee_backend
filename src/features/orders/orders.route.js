import { Router } from "express";
import * as ordersController from "./orders.controller.js";
import { uploadFields } from "../../common/middlewares/upload.middleware.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();

// Define Multer fields for Order Images
const orderImagesUpload = uploadFields([
  { name: "image1", maxCount: 1 },
  { name: "image2", maxCount: 1 },
  { name: "image3", maxCount: 1 },
]);

router.use(authenticate);
router.post("/createOrder", orderImagesUpload, ordersController.createOrder);
router.post("/cancelOrder", ordersController.cancelOrder);
// router.get("/my-dues", ordersController.myDues);
router.get("/order_details/:id", ordersController.order_details);
router.post("/orderDetails", ordersController.tracking);
router.get("/orderHistory/:id", ordersController.orderHistory);
router.get("/cancelledOrder/:id", ordersController.cancelledOrder);
router.post("/charges", ordersController.charges);
router.get("/assignedStatus/:orderId", ordersController.assignedStatus);
router.post("/notifyDp", ordersController.notifyDp);
router.get("/myNotifications/:user_id", ordersController.myNotifications);
router.get("/rating/:user_id", ordersController.rating);
router.post("/ratedp", ordersController.rateDp);

export default router;
