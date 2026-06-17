import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as adminRepository from './admin.repository.js';
import { sendOTPViaSMS } from '../notifications/sms.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtsecretkeyforsecurityandhashing';

export const verifyCredentials = async (currentUser, email, password) => {
  if (!currentUser || currentUser.email !== email) {
    throw new Error('The entered email does not match the currently logged-in admin.');
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@countmee.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let verified = false;

  if (email === adminEmail && password === adminPassword) {
    verified = true;
  } else {
    const user = await adminRepository.findUserByEmailAndType(email, 'admin');
    if (user && user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        verified = true;
      }
    }
  }

  if (verified) {
    const credentialsToken = jwt.sign(
      { email, action: 'wallet_recharge_credentials_verified' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { credentialsToken };
  }

  throw new Error('Invalid password. Please try again.');
};

export const sendOtp = async (credentialsToken, phone, actionType, amount) => {
  if (!credentialsToken) {
    throw new Error('Credentials verification token is required.');
  }

  let decodedCredentials;
  try {
    decodedCredentials = jwt.verify(credentialsToken, JWT_SECRET);
    if (decodedCredentials.action !== 'wallet_recharge_credentials_verified') {
      throw new Error();
    }
  } catch (err) {
    throw new Error('Invalid or expired credentials verification token.');
  }

  const allowedNumbers = ['7411199281', '9900160707'];
  if (!allowedNumbers.includes(phone)) {
    throw new Error('Invalid phone number selected for OTP.');
  }

  const otp = Math.floor(1000 + Math.random() * 9000);
  const type = actionType || 'Wallet Operation';
  const amt = amount || '0';

  const adminUser = await adminRepository.findUserByEmailAndType(decodedCredentials.email, 'admin');
  const adminName = adminUser ? adminUser.name : 'Admin';

  const message = `Admin ${adminName} is processing ${type} of Rs. ${amt}. Wallet OTP is ${otp}. - CountMe`;

  console.log(`[VERIFICATION SERVICE] Sending OTP to ${phone}: ${message}`);

  const sent = await sendOTPViaSMS(phone, message);

  if (sent) {
    const otpHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
    const otpToken = jwt.sign(
      { phone, otpHash, action_type: type, amount: Number(amt), action: 'wallet_recharge_otp_sent' },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { otpToken };
  }

  throw new Error('Failed to send OTP. Please try again.');
};

export const verifyOtp = async (otpToken, otp) => {
  if (!otpToken) {
    throw new Error('OTP token is required.');
  }

  let decodedOtp;
  try {
    decodedOtp = jwt.verify(otpToken, JWT_SECRET);
    if (decodedOtp.action !== 'wallet_recharge_otp_sent') {
      throw new Error();
    }
  } catch (err) {
    throw new Error('Invalid or expired OTP token.');
  }

  const inputHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');

  if (inputHash === decodedOtp.otpHash) {
    const verificationToken = jwt.sign(
      {
        phone: decodedOtp.phone,
        action_type: decodedOtp.action_type,
        amount: decodedOtp.amount,
        action: 'wallet_recharge_otp_verified'
      },
      JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { verificationToken };
  }

  throw new Error('Invalid OTP. Please try again.');
};
