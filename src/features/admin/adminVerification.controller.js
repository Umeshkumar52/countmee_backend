import * as adminVerificationService from './adminVerification.service.js';
import { validate } from '../../common/utils/validationHelper.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import * as adminValidation from './admin.validation.js';

export const postVerifyCredentials = async (req, res, next) => {
  try {
    const { email, password } = validate(adminValidation.verifyCredentialsSchema, req.body);
    const result = await adminVerificationService.verifyCredentials(req.user, email, password);
    return res.json(ApiResponse.success({ credentialsToken: result.credentialsToken }, 'Credentials verified. Please select a number for OTP.'));
  } catch (error) {
    next(error);
  }
};

export const postSendOtp = async (req, res, next) => {
  try {
    const { phone, action_type, amount, credentialsToken } = validate(adminValidation.sendOtpSchema, req.body);
    const result = await adminVerificationService.sendOtp(credentialsToken, phone, action_type, amount);
    return res.json(ApiResponse.success({ otpToken: result.otpToken }, `OTP sent successfully to ${phone}`));
  } catch (error) {
    next(error);
  }
};

export const postVerifyOtp = async (req, res, next) => {
  try {
    const { otp, otpToken } = validate(adminValidation.verifyOtpSchema, req.body);
    const result = await adminVerificationService.verifyOtp(otpToken, otp);
    return res.json(ApiResponse.success({ verificationToken: result.verificationToken }, 'OTP verified successfully.'));
  } catch (error) {
    next(error);
  }
};
