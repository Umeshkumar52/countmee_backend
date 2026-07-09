import mongoose from "mongoose";
import * as pdcService from "./pdc.service.js";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { ApiResponse } from "../../common/utils/responseFormatter.js";
import { Notification } from "../notifications/notification.model.js";
import { PdcDocument } from "./pdcDocument.model.js";
import { validate } from "../../common/utils/validationHelper.js";
import * as pdcValidation from "./pdc.validation.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { User } from "../users/user.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../common/middlewares/auth.middleware.js";

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, confirmPassword, fcmToken } = validate(
    pdcValidation.registerPdcSchema,
    req.body,
  );

  if (password !== confirmPassword) {
    throw new ApiError(400, "Password does not match");
  }

  const { user, pdc } = await pdcService.register(
    name,
    email,
    phone,
    password,
    fcmToken,
  );
  const token = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await User.findByIdAndUpdate(user._id, { refreshToken });

  const pdcDoc = await pdcService.getPdcDocument(user._id);

  const data = {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    pdcDocument: pdcDoc,
  };
  return res.json(ApiResponse.success(data, "Registration successful."));
});

export const login = asyncHandler(async (req, res) => {
  const { phone, password, fcmToken } = req.body;

  if (!phone || phone.length !== 10) {
    throw new ApiError(400, "Valid 10-digit phone number is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await pdcService.login(phone, password, fcmToken);
  const token = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await User.findByIdAndUpdate(user._id, { refreshToken });

  const pdcDoc = await pdcService.getPdcDocument(user._id);

  const data = {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    pdcDocument: pdcDoc,
  };

  return res.json(ApiResponse.success(data, "Login successful."));
});

export const submitdocuments = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pdc = await pdcService.getPdcDocument(userId);
  return res.json(ApiResponse.success({ pdc }));
});

export const pdc_inner_form = asyncHandler(async (req, res) => {
  const { pdcid } = req.params;
  const pdc = await pdcService.getPdcDocumentById(pdcid);
  return res.json(ApiResponse.success({ pdc }));
});

export const register_inner_form = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, phone, email } = req.body;

  try {
    const document = await pdcService.updateInnerForm(
      userId,
      name,
      email,
      phone
    );
    return res.json(
      ApiResponse.success({ document }, "Records Updated Successfully"),
    );
  } catch (error) {
    throw new ApiError(400, "Update failed: " + error.message);
  }
});

export const submit_pdc_documents = asyncHandler(async (req, res) => {
  const { pdcid } = req.params;
  const pdc = await pdcService.getPdcDocumentById(pdcid);
  return res.json(ApiResponse.success({ pdc }));
});

export const submit_pdc_documents_form = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    await pdcService.submitDocuments(userId, req.body, req.files);
    return res.json(
      ApiResponse.success(null, "Documents updated successfully"),
    );
  } catch (error) {
    throw new ApiError(400, "Failed to update documents: " + error.message);
  }
});

export const pdcDocumentStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const pdcDocument = await pdcService.getPdcDocument(userId);
  return res.json(ApiResponse.success({ pdcDocument }));
});

export const pdcProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const document = await pdcService.getPdcDocument(userId);
  return res.json(ApiResponse.success({ document }));
});

export const pdcHome = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const data = await pdcService.getDashboardData(userId);
  return res.json(ApiResponse.success(data));
});

export const earnings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const data = await pdcService.getEarnings(userId);
  return res.json(ApiResponse.success(data));
});

export const orderHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const orders = await pdcService.getOrderHistory(userId);
  return res.json(ApiResponse.success({ orders }));
});

export const readNotifications = asyncHandler(async (req, res) => {
  const id = req.body.id;
  const notification = await Notification.findByIdAndUpdate(
    id,
    { read_at: new Date() },
    { new: true },
  );

  if (notification) {
    return res.json(ApiResponse.success("notification_marked_as_read"));
  }
  throw new ApiError(404, "notification_not_found");
});

export const reloadPartial = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const notifications = await Notification.find({
    notifiable_id: userId,
  }).sort({ created_at: -1 }).limit(100);
  return res.json(ApiResponse.success({ notifications }));
});

export const updatePdcStatus = asyncHandler(async (req, res) => {
  const { id, accept_status } = req.params;
  await pdcService.updatePdcStatus(id, accept_status);
  return res.json(ApiResponse.success(null, "status updated successfully"));
});

export const online = asyncHandler(async (req, res) => {
  const { id, online } = req.params;
  const isOnline = online === "true";
  await pdcService.toggleOnlineStatus(id, isOnline);
  return res.json(
    ApiResponse.success(
      { online: isOnline },
      "Online status updated successfully",
    ),
  );
});

export const locationUpdate = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  if (!req.body.pdcAuthId && userId) {
    req.body.pdcAuthId = String(userId);
  }
  const validatedBody = validate(
    pdcValidation.pdcLocationUpdateSchema,
    req.body,
  );
  const success = await pdcService.updateLocation(userId, validatedBody);
  if (success) {
    return res.json(ApiResponse.success(null, "Location Updated"));
  }
  throw new ApiError(400, "Something went wrong");
});

export const rateDp = asyncHandler(async (req, res) => {
  const { order_id, from_pdc, to_dp, stars, message } = validate(
    pdcValidation.pdcRateDpSchema,
    req.body,
  );

  if (!stars || isNaN(stars) || Number(stars) < 1 || Number(stars) > 5) {
    throw new ApiError(
      400,
      "Stars rating is required and must be between 1 and 5",
    );
  }

  try {
    const dpName = await pdcService.rateDp(
      order_id,
      from_pdc,
      to_dp,
      Number(stars),
      message,
    );
    return res.json(
      ApiResponse.success(null, "Rated " + dpName + " successfully"),
    );
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const logout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { fcmToken } = req.body || {};
  if (userId) {
    await PdcDocument.findOneAndUpdate({ user_id: userId }, { online: false });
    if (fcmToken) {
      await User.findByIdAndUpdate(userId, { $pull: { fcm_tokens: fcmToken } });
    }
  }
  return res.json(ApiResponse.success(null, "Logout successful"));
});

// ==================== NEW PDC API ENDPOINTS ====================

// 1. PDC Accept/Reject API
export const actionDrop = asyncHandler(async (req, res) => {
  const { order_id, action } = req.body;
  const pdcId = req.user.id || req.user._id;

  if (!['accept', 'reject'].includes(action)) {
    throw new ApiError(400, "Invalid action. Use 'accept' or 'reject'.");
  }

  try {
    const message = await pdcService.processActionDrop(order_id, pdcId, action);
    return res.json(ApiResponse.success(null, message));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

// 2. Manual Broadcast API
export const broadcastOrder = asyncHandler(async (req, res) => {
  const { order_id } = req.body;
  const pdcId = req.user.id || req.user._id;

  try {
    const nearByDpsCount = await pdcService.triggerManualBroadcast(order_id, pdcId);

    if (nearByDpsCount === 0) {
      return res.json(ApiResponse.success(null, "Broadcast started! The 10-minute window is open. Waiting for delivery partners to come online or drive nearby."));
    }

    return res.json(ApiResponse.success(null, `Broadcast started! Notified ${nearByDpsCount} nearby partners. The window will remain open for 10 minutes.`));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

// 3. PDC Ratings API
export const myRatings = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;

  // console.log("==== DEBUG PDC RATINGS ====");
  // console.log("Logged in PDC User ID from Token:", userId);

  const ratings = await pdcService.findRatingsForPdc(userId);
  const avgRating = await pdcService.getPdcAverageRating(userId);
  // console.log("Calculated Average:", avgRating);

  return res.json(
    ApiResponse.success({ averageRating: avgRating, ratings }, "PDC Ratings"),
  );
});
