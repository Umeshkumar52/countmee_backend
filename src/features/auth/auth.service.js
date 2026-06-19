import * as authRepository from "./auth.repository.js";
import { sendOTPViaSMS } from "../notifications/sms.service.js";
import { Notification } from "../notifications/notification.model.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import { DpDocument } from "../deliveryPartner/dpDocument.model.js";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../common/middlewares/auth.middleware.js";
import mongoose from "mongoose";

export const registerCustomer = async (name, phone, email, DOB) => {
  const existingUser = await authRepository.findUserByEmailPhoneAndType(
    email,
    phone,
    "customer",
  );
  if (existingUser) {
    throw new Error("Phone number or email already registered");
  }

  // Create user
  const newUser = await authRepository.createUser({
    role: "customer",
    name,
    phone,
    email,
    DOB,
  });

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  newUser.otp = otp;
  await newUser.save();

  // Send OTP
  const message = `Your CountMee Courier verification code is ${otp}`;
  await sendOTPViaSMS(phone, message);

  // Send notifications
  const admin = await authRepository.findAdminUser();
  if (admin) {
    await Notification.create({
      notifiable_type: "admin",
      notifiable_id: admin._id,
      title: "New Customer Registered",
      message: `${name} has registered`,
    });
  }

  await Notification.create({
    notifiable_type: "customer",
    notifiable_id: newUser._id,
    title: "Welcom to CountMee",
    message: "You have been registered successfully",
  });

  const token = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);
  newUser.refreshToken = refreshToken;
  await newUser.save();

  return { user: newUser, token, refreshToken };
};

export const loginCustomer = async (phone) => {
  const user = await authRepository.findUserByPhoneAndType(phone, "customer");
  if (!user) {
    throw new Error("Phone number not registered, Please register");
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  user.otp = otp;
  await authRepository.updateUserOtp(user._id, otp);

  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  await sendOTPViaSMS(phone, message);

  return user;
};

export const verifyOtp = async (userId, otp) => {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (otp === user.otp) {
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await authRepository.updateUserTokens(user._id, refreshToken);
    return { user, token };
  } else {
    throw new Error("Invalid OTP try again!");
  }
};

export const resendOtp = async (phone) => {
  const user = await User.findOne({ phone }); // Checks phone across types or customer/dp
  if (!user) {
    throw new Error("User not found");
  }
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  const isNewRegister = user.createdAt.getTime() === user.updatedAt.getTime();
  const message = isNewRegister
    ? `Your CountMee Courier verification code is ${otp}`
    : `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;

  await sendOTPViaSMS(user.phone, message);
  user.otp = otp;
  await user.save();

  return user;
};

export const registerDp = async (name, phone, email, DOB) => {
  const existingUser = await authRepository.findUserByEmailPhoneAndType(
    email,
    phone,
    "dp",
  );
  if (existingUser) {
    throw new Error("Dp already registered");
  }

  const newUser = await authRepository.createUser({
    role: "dp",
    name,
    phone,
    email,
    DOB,
  });

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  newUser.otp = otp;
  await newUser.save();

  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  await sendOTPViaSMS(phone, message);

  const admin = await authRepository.findAdminUser();
  if (admin) {
    await Notification.create({
      notifiable_type: "admin",
      notifiable_id: admin._id,
      title: "New Delivery Partner Registered",
      message: `${name}has registered as delivery partner`,
    });
  }

  await Notification.create({
    notifiable_type: "dp",
    notifiable_id: newUser._id,
    title: "Welcome to CountMee",
    message: "You have been registered successfully",
  });

  const token = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);
  newUser.refreshToken = refreshToken;
  await newUser.save();

  return {
    user: newUser,
    token,
    refreshToken,
  };
};

export const loginDp = async (phone) => {
  const dp = await authRepository.findUserByPhoneAndType(phone, "dp");
  if (!dp) {
    throw new Error("DP Not Fount Go to Register Page");
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  dp.otp = otp;
  await authRepository.updateUserOtp(dp._id, otp);

  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  await sendOTPViaSMS(dp.phone, message);

  return dp;
};

export const dpOtpVerification = async (userId, otp) => {
  const dp = await authRepository.findUserById(userId);
  if (!dp) {
    throw new Error("User not found");
  }

  if (otp !== dp.otp) {
    throw new Error("Invalid Otp");
  }

  // Generate tokens for all verified sessions so DPs can upload documents
  const token = generateAccessToken(dp);
  const refreshToken = generateRefreshToken(dp);
  dp.refreshToken = refreshToken;
  await authRepository.updateUserTokens(dp._id, refreshToken);

  let argumnet1 = false;
  let argumnet2 = false;
  let argumnet3 = false;
  let argumnet4 = false;

  const dpDetail = await DpDetail.findOne({ user_id: userId });
  const dpDocument = await DpDocument.findOne({ user_id: userId });

  if (!dpDetail || !dpDocument) {
    return {
      dp,
      argumnet1,
      argumnet2,
      argumnet3,
      argumnet4,
      message: "dp document or details are not submit yet",
      token,
      refreshToken,
    };
  }

  if (dpDetail.document_approval === "Approved") {
    return {
      dp,
      argumnet1: true,
      argumnet2: true,
      argumnet3: true,
      argumnet4: true,
      message: "go to home page",
      token,
      refreshToken,
    };
  }

  if (dpDetail.profile_img) {
    argumnet1 = true;
    if (dpDocument.vehicle_type) {
      argumnet2 = true;
      if (dpDocument.reference2_name) {
        argumnet3 = true;
      }
      if (dpDetail.document_approval === "Approved") {
        argumnet4 = true;
      }
    }
  }

  return {
    argumnet1,
    argumnet2,
    argumnet3,
    argumnet4,
    dp,
    message: "document verify page",
    token,
    refreshToken,
  };
};

export const deleteAccount = async (phone) => {
  const affected = await User.findOneAndUpdate(
    { phone },
    { phone: "", email: "" },
    { new: true },
  );

  if (affected) {
    return "User deleted successfully";
  } else {
    return "No user found with the given phone number";
  }
};

export const rotateRefreshToken = async (refreshToken) => {
  const jwt = await import("jsonwebtoken");
  const JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ||
    "supersecretjwtrefreshsecretkeyforrotationandrevocation";
  const User = mongoose.model("User");

  try {
    const decoded = jwt.default.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      throw new Error("Invalid refresh token");
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
};

export const updateFcmToken = async (userId, fcmToken) => {
  const User = mongoose.model("User");
  await User.findByIdAndUpdate(userId, { fcm_token: fcmToken });
};

import { User } from "../users/user.model.js";
