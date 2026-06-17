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
import rateLimit from "express-rate-limit";

// Rate limiting for security protection on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    status: 429,
    message: "Too many login or registration attempts, please try again after 15 minutes.",
  },
});

// Centralized Auth Router for new production starting route `/api/auth`
const router = Router();

// 1. Admin Auth
router.post("/admin/login", authLimiter, adminController.postLogin);

// 2. PDC Auth
router.post("/pdc/login", authLimiter, pdcController.login);
router.post("/pdc/register", authLimiter, pdcController.register);

// 3. DP Auth
router.post("/dp/login", authLimiter, loginDp);
router.post("/dp/register", authLimiter, registerDp);
router.post("/dp/otp", dpOtp);
router.get("/dp/resend-otp/:phone", resendOtp);

// 4. User / Customer Auth
router.post("/user/login", authLimiter, loginCustomer);
router.post("/user/otp", verifyOtp);
router.get("/user/resend-otp/:phone", resendOtp);
router.get("/user/delete-account/:phone", deleteAccount);

// 5. Shared Token Operations
router.post("/refresh", refreshToken);
router.post("/fcm-token", authenticate, updateFcmToken);

export default router;

// =========================================================================
// BACKWARD COMPATIBILITY EXPORTS (LEGACY ALIAS ROUTERS)
// =========================================================================
export const authRouter = Router();
authRouter.post("/refresh", refreshToken);
authRouter.post("/fcm-token", authenticate, updateFcmToken);

export const customerAuthRouter = Router();
customerAuthRouter.post("/registerCustomer", registerCustomer);
customerAuthRouter.post("/loginCustomer", loginCustomer);
customerAuthRouter.get("/deleteAccount/:phone", deleteAccount);
customerAuthRouter.post("/verify-otp", verifyOtp);
customerAuthRouter.get("/resendOtp/:phone", resendOtp);

export const dpAuthRouter = Router();
dpAuthRouter.post("/register", registerDp);
dpAuthRouter.post("/login", loginDp);
dpAuthRouter.get("/deleteAccount/:phone", deleteAccount);
dpAuthRouter.post("/otp", dpOtp);
dpAuthRouter.get("/resendOtp/:phone", resendOtp);
