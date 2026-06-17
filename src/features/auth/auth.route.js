import { Router } from "express";
import {
  loginCustomer,
  registerCustomer,
  updateFcmToken,
  refreshToken,
  deleteAccount,
  dpOtp,
  verifyOtp,
  resendOtp,
  loginDp,
  registerDp,
} from "./auth.controller.js";
import * as adminController from "../admin/admin.controller.js";
import * as pdcController from "../pdc/pdc.controller.js";
import { authenticate } from "../../common/middlewares/auth.middleware.js";

const router = Router();

// 1. Admin Auth
router.post("/admin/login", adminController.postLogin);

// 2. PDC Auth
router.post("/pdc/login", pdcController.login);
router.post("/pdc/register", pdcController.register);

// 3. DP Auth
router.post("/dp/login", loginDp);
router.post("/dp/register", registerDp);
router.post("/dp/otp", dpOtp);
router.get("/dp/resend-otp/:phone", resendOtp);
router.get("/dp/deleteAccount/:phone", deleteAccount);

// 4. User / Customer Auth
router.post("/user/register", registerCustomer);
router.post("/user/login", loginCustomer);
router.get("/user/resend-otp/:phone", resendOtp);
router.get("/user/delete-account/:phone", deleteAccount);
router.post("/user/verify-otp", verifyOtp);

// 5. Shared Token Operations
router.post("/refresh", refreshToken);
router.post("/fcm-token", authenticate, updateFcmToken);

export default router;
