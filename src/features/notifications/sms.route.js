import { Router } from 'express';
import { sendOTPViaSMS } from './sms.service.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiError } from '../../common/utils/ApiError.js';

const router = Router();

router.get('/sendOtp/:phone/:otp', asyncHandler(async (req, res) => {
  const { phone, otp } = req.params;
  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  const success = await sendOTPViaSMS(phone, message);
  if (success) {
    return res.json(ApiResponse.success({ status: 200, message: 'OTP sent successfully' }));
  }
  throw new ApiError(500, 'Failed to send OTP');
}));

export default router;
