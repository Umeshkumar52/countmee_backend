import * as authRepository from "./auth.repository.js";
import {
  ROLES,
  ORDER_STATUS,
  ACTIVE_ORDER_STATUSES,
  ORDER_REQUEST_COMPLETE_STATUS,
} from "../../constants/index.js";
import { sendOTPViaSMS } from "../notifications/sms.service.js";
import { sendNotification } from "../../common/utils/sendNotification.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import { DpDocument } from "../deliveryPartner/dpDocument.model.js";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../common/middlewares/auth.middleware.js";
import mongoose from "mongoose";
import { OrderRequest } from "../orders/orderRequest.model.js";
import { Order } from "../orders/order.model.js";
import { WalletConfig } from "../payments/walletConfig.model.js";
import { Wallet } from "../payments/wallet.model.js";
import { WalletTransaction } from "../payments/walletTransaction.model.js";
import { deleteFromCloudinary } from "../../common/services/cloudinary.service.js";
import { getRedisClient } from "../../common/services/redis.service.js";
import { User } from "../users/user.model.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../../common/utils/ApiError.js";

const extractCloudinaryPublicId = (url) => {
  if (!url) return null;
  try {
    const parts = url.split("/");
    const filename = parts.pop().split(".")[0];
    const folder = parts.pop();
    return `${folder}/${filename}`;
  } catch (e) {
    return null;
  }
};

export const registerCustomer = async (name, phone, email, dob) => {
  const existingUser = await authRepository.findUserByEmailPhoneAndType(
    email,
    phone,
    ROLES.USER,
  );
  if (existingUser) {
    throw new ApiError(400, "Phone number or email already registered");
  }

  // Create user
  const newUser = await authRepository.createUser({
    role: ROLES.USER,
    name,
    phone,
    email,
    dob,
  });

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  await redisClient.setEx(`otp_login:${newUser._id}`, 300, otp);

  // Handle Joining Bonus
  try {
    const config = await WalletConfig.findOne();
    console.log("wallet", config);
    if (config && config.joining_bonus > 0) {
      const wallet = await Wallet.create({
        user_id: newUser._id,
        balance: config.joining_bonus,
      });

      await WalletTransaction.create({
        wallet_id: wallet._id,
        user_id: newUser._id,
        amount: config.joining_bonus,
        type: "credit",
        description: "Welcome Joining Bonus",
        transaction_type: "joining_bonus",
      });

      await sendNotification({
        role: ROLES.USER,
        userId: newUser._id,
        title: "Joining Bonus Credited!",
        message: `Your wallet has been credited with ₹${config.joining_bonus} as a welcome bonus.`,
      });
    }
  } catch (err) {
    console.error("Error applying joining bonus:", err);
  }

  // Send OTP
  const message = `Your CountMee Courier verification code is ${otp}`;
  sendOTPViaSMS(phone, message).catch((err) =>
    console.error("SMS Failed:", err.message),
  );

  // Send notifications
  await sendNotification({
    role: ROLES.ADMIN,
    title: "New Customer Registered",
    message: `${name} has registered`,
  });

  await sendNotification({
    role: ROLES.USER,
    userId: newUser._id,
    title: "Welcome to CountMee",
    message: "You have been registered successfully",
  });

  const token = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);
  newUser.refreshToken = refreshToken;
  await newUser.save();

  return { user: newUser, token };
};

export const loginCustomer = async (phone) => {
  const user = await authRepository.findUserByPhoneAndType(phone, ROLES.USER);
  if (!user) {
    throw new ApiError(404, "Phone number not registered, Please register");
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  await redisClient.setEx(`otp_login:${user._id}`, 300, otp);

  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  sendOTPViaSMS(phone, message).catch((err) =>
    console.error("SMS Failed:", err.message),
  );

  return user;
};

export const verifyOtp = async (userId, otp) => {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  
  const storedOtp = await redisClient.get(`otp_login:${userId}`);
  
  if (!storedOtp) {
    throw new ApiError(400, "OTP has expired or does not exist");
  }

  if (otp === storedOtp) {
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await authRepository.updateUserTokens(user._id, refreshToken);
    
    await redisClient.del(`otp_login:${userId}`);
    return { user, token };
  } else {
    throw new ApiError(400, "Invalid OTP try again!");
  }
};

export const resendOtp = async (phone) => {
  const user = await User.findOne({ phone }); // Checks phone across types or customer/dp
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  const isNewRegister = user.createdAt.getTime() === user.updatedAt.getTime();
  const message = isNewRegister
    ? `Your CountMee Courier verification code is ${otp}`
    : `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;

  await sendOTPViaSMS(user.phone, message);
  
  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  await redisClient.setEx(`otp_login:${user._id}`, 300, otp);

  return user;
};

export const registerDp = async (name, phone, email, dob) => {
  const existingUser = await authRepository.findUserByEmailPhoneAndType(
    email,
    phone,
    ROLES.DP,
  );
  if (existingUser) {
    throw new ApiError(400, "Dp already registered");
  }

  const newUser = await authRepository.createUser({
    role: ROLES.DP,
    name,
    phone,
    email,
    dob,
  });

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  
  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  await redisClient.setEx(`otp_login:${newUser._id}`, 300, otp);

  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  sendOTPViaSMS(phone, message).catch((err) =>
    console.error("SMS Failed:", err.message),
  );

  await sendNotification({
    role: ROLES.ADMIN,
    title: "New Delivery Partner Registered",
    message: `${name} has registered as delivery partner`,
  });

  await sendNotification({
    role: ROLES.DP,
    userId: newUser._id,
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
  const dp = await authRepository.findUserByPhoneAndType(phone, ROLES.DP);
  if (!dp) {
    throw new ApiError(404, "DP Not Found Go to Register Page");
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  
  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  await redisClient.setEx(`otp_login:${dp._id}`, 300, otp);

  const message = `Welcome to CountMee, your OTP for the login is ${otp} to the CountMee.`;
  sendOTPViaSMS(dp.phone, message).catch((err) =>
    console.error("SMS Failed:", err.message),
  );

  return dp;
};

export const dpOtpVerification = async (userId, otp) => {
  const dp = await authRepository.findUserById(userId);
  if (!dp) {
    throw new ApiError(404, "User not found");
  }

  const redisClient = getRedisClient();
  if (!redisClient) throw new ApiError(500, "Redis cache unavailable");
  
  const storedOtp = await redisClient.get(`otp_login:${userId}`);
  
  if (!storedOtp) {
    throw new ApiError(400, "OTP has expired or does not exist");
  }

  if (otp !== storedOtp) {
    throw new ApiError(400, "Invalid Otp");
  }

  await redisClient.del(`otp_login:${userId}`);

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

export const deleteAccount = async (userId) => {
  const user = await User.findById(userId);
  let message = "";

  if (!user) {
    throw new Error("No user found with the given ID");
  }

  // Check for active orders before allowing deletion
  if (user.role === ROLES.USER) {
    message = "Your customer account has been deleted.";
    const activeOrders = await Order.countDocuments({
      user_id: user._id,
      status: { $in: ACTIVE_ORDER_STATUSES },
    });
    if (activeOrders > 0) {
      throw new Error(
        "You have active orders. Please complete or cancel them before deleting your account.",
      );
    }
  } else if (user.role === ROLES.DP) {
    message = "Your delivery partner account has been deleted.";
    const activeRequests = await OrderRequest.countDocuments({
      accepted_by: user._id,
      complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
    });
    if (activeRequests > 0) {
      throw new Error(
        "You have active delivery legs. Please complete them before deleting your account.",
      );
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete Cloudinary assets for DP
    if (user.role === ROLES.DP) {
      const dpDetail = await DpDetail.findOne({ user_id: user._id });
      const dpDocument = await DpDocument.findOne({ user_id: user._id });

      const imageUrlsToClean = [];

      if (dpDetail && dpDetail.profile_img) {
        imageUrlsToClean.push(dpDetail.profile_img);
      }

      if (dpDocument) {
        const docFields = [
          "aadhar_imgfront",
          "aadhar_imgback",
          "rc_imgfront",
          "rc_imgback",
          "dl_imgfront",
          "dl_imgback",
          "bank_imagefront",
          "bank_imgeback",
          "residence_img",
          "vehicle_img",
        ];
        docFields.forEach((field) => {
          if (dpDocument[field]) imageUrlsToClean.push(dpDocument[field]);
        });
      }

      // We do not await in the transaction loop to save time, but map them to Promises
      const deletePromises = imageUrlsToClean.map((url) => {
        const publicId = extractCloudinaryPublicId(url);
        if (publicId) return deleteFromCloudinary(publicId).catch(() => {});
        return Promise.resolve();
      });
      await Promise.all(deletePromises);

      // Delete associated DP records
      await DpDetail.deleteOne({ user_id: user._id }).session(session);
      await DpDocument.deleteOne({ user_id: user._id }).session(session);
    }

    // Delete the actual user record
    await User.deleteOne({ _id: user._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    return "User deleted successfully";
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Failed to delete account: ${error.message}`);
  }
};

export const rotateRefreshToken = async (refreshToken) => {
  const JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ||
    "supersecretjwtrefreshsecretkeyforrotationandrevocation";

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
  // const User = mongoose.model("User");
  await User.findByIdAndUpdate(userId, { $addToSet: { fcm_tokens: fcmToken } });
};

export const forgotPassword = async (identifier) => {
  const isPhone = /^\d+$/.test(identifier);
  let query = {};
  if (isPhone) {
    query.phone = identifier;
  } else {
    query.email = identifier;
  }

  const user = await User.findOne(query);
  if (!user) {
    throw new Error("User with this identifier not found");
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  const redisClient = getRedisClient();
  if (redisClient) {
    await redisClient.setEx(`password_reset_otp:${user._id}`, 600, otp);
  } else {
    throw new Error("Internal server error: Redis cache unavailable");
  }

  const message = `Your CountMee Courier password reset code is ${otp}`;

  if (user.phone) {
    sendOTPViaSMS(user.phone, message).catch((e) =>
      console.error("SMS error:", e),
    );
  }
  if (user.email) {
    sendEmailUtil({
      to: user.email,
      subject: "CountMee - Password Reset OTP",
      text: message,
    }).catch((e) => console.error("Email error:", e));
  }

  return { message: "OTP sent successfully" };
};

export const resetPassword = async (identifier, otp, newPassword) => {
  const isPhone = /^\d+$/.test(identifier);
  let query = {};
  if (isPhone) {
    query.phone = identifier;
  } else {
    query.email = identifier;
  }

  const user = await User.findOne(query);
  if (!user) {
    throw new Error("User not found");
  }

  const redisClient = getRedisClient();
  if (!redisClient) {
    throw new Error("Internal server error: Redis cache unavailable");
  }

  const storedOtp = await redisClient.get(`password_reset_otp:${user._id}`);

  if (!storedOtp) {
    throw new Error("OTP has expired or does not exist");
  }
  if (storedOtp !== otp) {
    throw new Error("Invalid OTP");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  user.password = hashedPassword;
  await user.save();

  await redisClient.del(`password_reset_otp:${user._id}`);

  return { message: "Password reset successful" };
};
