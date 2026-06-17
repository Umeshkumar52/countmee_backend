import * as authService from "./auth.service.js";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { ApiResponse } from "../../common/utils/responseFormatter.js";
import { validate } from "../../common/utils/validationHelper.js";
import * as authValidation from "./auth.validation.js";
import { ApiError } from "../../common/utils/ApiError.js";

export const registerCustomer = asyncHandler(async (req, res) => {
  const { name, phone, email, DOB } = validate(
    authValidation.registerCustomerSchema,
    req.body,
  );
  const result = await authService.registerCustomer(name, phone, email, DOB);
  const data = {
    user: {
      id: result.user._id,
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      role: "customer",
      user_type: "customer",
    },
    token: result.token,
    refreshToken: result.refreshToken,
  };
  return res.json(ApiResponse.success(data, "Registration successful"));
});

export const loginCustomer = asyncHandler(async (req, res) => {
  const { phone } = validate(authValidation.loginCustomerSchema, req.body);
  const result = await authService.loginCustomer(phone);
  console.log("result", result);
  const data = {
    user: {
      id: result._id,
      name: result.name,
      email: result.email,
      phone: result.phone,
      role: result.role,
    },
    token: result.token,
  };
  return res.json(
    ApiResponse.success(data, `Welcome to CountMee, ${result.name}`),
  );
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { user_id, otp } = validate(authValidation.verifyOtpSchema, req.body);
  const result = await authService.verifyOtp(user_id, otp);
  return res.json(ApiResponse.success(result, "OTP verified successfully"));
});

export const resendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.params;
  await authService.resendOtp(phone);
  return res.json(ApiResponse.success(null, "OTP Resent successfully"));
});

export const registerDp = asyncHandler(async (req, res) => {
  const { name, phone, email, DOB } = validate(
    authValidation.registerDpSchema,
    req.body,
  );
  const result = await authService.registerDp(name, phone, email, DOB);
  return res.json(
    ApiResponse.success(result, "Dp Register Successfully... document page"),
  );
});

export const loginDp = asyncHandler(async (req, res) => {
  const { phone } = validate(authValidation.loginDpSchema, req.body);
  const result = await authService.loginDp(phone);
  return res.json(ApiResponse.success(result, "dp is exist go to otp page"));
});

export const dpOtp = asyncHandler(async (req, res) => {
  const { user_id, otp } = validate(authValidation.verifyOtpSchema, req.body);
  const result = await authService.dpOtpVerification(user_id, otp);
  return res.json(ApiResponse.success(result, result.message));
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const { phone } = req.params;
  const message = await authService.deleteAccount(phone);
  return res.type("text/plain").send(message);
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is required");
  }
  const result = await authService.rotateRefreshToken(refreshToken);
  return res.json(ApiResponse.success(result, "Token rotated successfully"));
});

export const updateFcmToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { fcmToken } = req.body;
  await authService.updateFcmToken(userId, fcmToken);
  return res.json(ApiResponse.success(null, "FCM token updated successfully"));
});
