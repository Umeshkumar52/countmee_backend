import { Router } from 'express';
import { sendOTPViaSMS } from '../../common/utils/sendSms.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiError } from '../../common/utils/ApiError.js';

const router = Router();

router.get('/sendOtp/:phone/:otp', asyncHandler(async (req, res) => {
  const { phone, otp } = req.params;
  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  sendOTPViaSMS(phone, message).catch((err) => console.error("SMS Failed:", err.message));
  return res.json(ApiResponse.success({ status: 200, message: 'OTP sending initiated' }));
}));

export default router;
