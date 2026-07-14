import * as dpService from "./dp.service.js";
import { TRAVEL_STATES } from "../../common/utils/constants.js";
import {
  ROLES,
  ORDER_STATUS,
  ORDER_REQUEST_STATUS,
  ORDER_REQUEST_COMPLETE_STATUS,
} from "../../constants/index.js";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { ApiResponse } from "../../common/utils/responseFormatter.js";
import { validate } from "../../common/utils/validationHelper.js";
import * as dpValidation from "./dp.validation.js";
import { ApiError } from "../../common/utils/ApiError.js";
import { Order } from "../orders/order.model.js";
import { DpDocument } from "./dpDocument.model.js";
import { DpDetail } from "./dpDetail.model.js";
import { Broadcast } from "../orders/broadcast.model.js";
import { getAgenda } from "../../common/services/agenda.service.js";
import { sendNotification } from "../../common/utils/sendNotification.js";
import * as mapsService from "../tracking/maps.service.js";
import { PdcDocument } from "../pdc/pdcDocument.model.js";
import { User } from "../users/user.model.js";
import mongoose from "mongoose";
import { OrderRequest } from "../orders/orderRequest.model.js";
import { Notification } from "../notifications/notification.model.js";

export const dpDetails = asyncHandler(async (req, res) => {
  const { gender, address } = validate(dpValidation.dpDetailsSchema, req.body);
  const user_id = req.user.id;
  const profileImgPath = req.file ? req.file.path : null;

  if (!profileImgPath) {
    throw new ApiError(400, "Profile image is required");
  }

  await dpService.saveDetails(user_id, gender, address, profileImgPath);
  return res.json(
    ApiResponse.success({ argumnet1: true }, "Dp Details submited"),
  );
});

export const getVehicleTypes = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const validTypes = [
    "By Hand",
    "Two Wheeler",
    "Three Wheeler",
    "Four Wheeler",
  ];

  if (type) {
    if (!validTypes.includes(type)) {
      throw new ApiError(400, "Invalid vehicle type");
    }
    const subcategories = await dpService.getVehicleSubcategories(type);
    return res.json(
      ApiResponse.success(
        { subcategories },
        "Vehicle subcategories fetched successfully",
      ),
    );
  }

  return res.json(
    ApiResponse.success(
      { vehicleTypes: validTypes },
      "Vehicle types fetched successfully",
    ),
  );
});

export const getTravelStates = asyncHandler(async (req, res) => {
  return res.json(
    ApiResponse.success(
      { states: TRAVEL_STATES },
      "Travel states fetched successfully",
    ),
  );
});

export const dpDocuments = asyncHandler(async (req, res) => {
  const user_id = req.user.id;
  await dpService.saveDocuments(user_id, req.body, req.files);
  return res.json(
    ApiResponse.success({ argumnet2: true }, "document submited"),
  );
});

export const dpReference = asyncHandler(async (req, res) => {
  validate(dpValidation.dpReferenceSchema, req.body);
  const user_id = req.user.id;
  await dpService.saveReference(user_id, req.body);
  return res.json(
    ApiResponse.success({ argumnet3: true }, "document submited"),
  );
});

export const dpDocumentStatus = asyncHandler(async (req, res) => {
  validate(dpValidation.dpDocumentStatusSchema, req.body);
  const user_id = req.user.id;
  const documentStatus = await dpService.getDocuments(user_id);
  return res.json(ApiResponse.success({ documentStatus }, "document status"));
});

export const documents = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const documents = await dpService.getDocuments(user_id);
  return res.json(ApiResponse.success({ documents }, "documents of the dp"));
});

export const documentsReupload = asyncHandler(async (req, res) => {
  const user_id = req.user.id;
  const success = await dpService.documentsReupload(user_id, req.files, req.body);
  if (success) {
    return res.json(ApiResponse.success(null, "documents uploaded"));
  }
  throw new ApiError(400, "session invalid");
});

export const new_order = asyncHandler(async (req, res) => {
  const { order_id } = req.params;
  const user_id = req.user.id || req.user._id;
  const data = await dpService.getNewOrderDetails(order_id, user_id);
  return res.json(ApiResponse.success(data, "Order Details"));
});

export const order_accept = asyncHandler(async (req, res) => {
  const { order_id, status, user_id } = validate(
    dpValidation.orderAcceptSchema,
    req.body,
  );
  const result = await dpService.orderAccept(order_id, Number(status), user_id);
  return res.json(ApiResponse.success(null, result.message));
});

export const arrival = asyncHandler(async (req, res) => {
  const { order_id, location_type, latitude, longitude } = validate(
    dpValidation.dpArrivalSchema,
    req.body,
  );
  const user_id = req.user._id;
  const result = await dpService.markArrival(order_id, user_id, location_type, latitude, longitude);
  return res.json(ApiResponse.success(null, result.message));
});

export const cancelAssignment = asyncHandler(async (req, res) => {
  const { order_id, cancel_reason } = validate(
    dpValidation.cancelAssignmentSchema,
    req.body,
  );
  const user_id = req.user._id;
  const result = await dpService.cancelAssignment(
    order_id,
    user_id,
    cancel_reason,
  );
  return res.json(ApiResponse.success(null, result.message));
});

export const acceptedOrders = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const acceptedOrders = await dpService.acceptedOrders(user_id);
  return res.json(ApiResponse.success({ acceptedOrders }, "Accepted Orders"));
});

export const pickupOtp = asyncHandler(async (req, res) => {
  const { order_id, user_id, otp } = validate(
    dpValidation.pickupOtpSchema,
    req.body,
  );
  const result = await dpService.pickupOtp(order_id, user_id, otp);
  return res.json(
    ApiResponse.success({ otp_match: result.otp_match }, "otp Matched"),
  );
});

export const pickupOrderImageUpload = asyncHandler(async (req, res) => {
  const { order_id, user_id } = validate(
    dpValidation.pickupOrderImagesSchema,
    req.body,
  );
  const result = await dpService.pickupOrderImageUpload(
    order_id,
    user_id,
    req.files,
  );
  return res.json(
    ApiResponse.success(
      result,
      "Image Uploaded Successfully now You can start you delivery",
    ),
  );
});

export const minBroadcast = asyncHandler(async (req, res) => {
  const { order, lat, lon } = req.params;
  const orderObj = await Order.findById(order);

  if (orderObj) {
    const chkDistance = await mapsService.distanceBetween(
      orderObj.sender_latitude,
      orderObj.sender_longitude,
      Number(lat),
      Number(lon),
    );

    const distanceValue = parseFloat(chkDistance) || 0;

    return res.json(
      ApiResponse.success({
        result: 1,
        distance_km: distanceValue,
        distance_str: chkDistance,
      }),
    );
  }

  throw new ApiError(400, "this order doesn't exist", { result: 0 });
});

export const brodcastForFindDp = asyncHandler(async (req, res) => {
  const {
    order_id,
    user_id,
    radius,
    location,
    latitude,
    longitude,
    broadcast_id,
  } = validate(dpValidation.broadcastFindDpSchema, req.body);

  if (broadcast_id) {
    const orderRequestCheck = await OrderRequest.findOne({
      order_id: order_id,
      broadcast_id: broadcast_id,
      status: ORDER_REQUEST_STATUS.ACCEPTED,
    });

    if (orderRequestCheck) {
      const dp = orderRequestCheck.accepted_by
        ? await User.findById(orderRequestCheck.accepted_by)
        : null;
      const dpLocation = orderRequestCheck.accepted_by
        ? await DpDetail.findOne({ user_id: orderRequestCheck.accepted_by })
        : null;
      const broadcastObj = await Broadcast.findById(broadcast_id);
      const avgRating = await dpService.getDpAverageRating(
        orderRequestCheck.accepted_by,
      );

      const data = {
        dp_detail: {
          latitude: dpLocation?.latitude || null,
          longitude: dpLocation?.longitude || null,
          profile_img: dpLocation?.profile_img || "",
        },
        dp: {
          name: dp?.name || "",
          phone: dp?.phone || "",
        },
        otp: broadcastObj?.pickup_otp || null,
        ratings: avgRating,
        status: DOCUMENT_APPROVAL_STATUS.APPROVED,
      };

      return res.json(
        ApiResponse.success(data, "Nearby delivery partner found"),
      );
    } else {
      return res.json(
        ApiResponse.success(
          { status: ORDER_REQUEST_STATUS.PENDING },
          "No drivers have accepted yet. Please wait...",
        ),
      );
    }
  }

  // If broadcast_id is not provided, create a new broadcast point (Legacy logic restored)
  const order = await Order.findById(order_id);
    if (!order) throw new ApiError(404, "Order not found");

    if (order.status_completed === "delivered to pdc") {
      throw new ApiError(400, "Already Delivered to PDC");
    }

    const travel = await dpService.findTravelByOrderAndUser(order_id, user_id);

    let broadcastObj = await Broadcast.findOne({ order_id: order_id }).sort({
      created_at: -1,
    });

    if (!broadcastObj) {
      const distance =
        (await mapsService.haversineGreatCircleDistance(
          Number(latitude),
          Number(longitude),
          order.receiver_latitude,
          order.receiver_longitude,
        )) / 1000;

      broadcastObj = await Broadcast.create({
        order_id,
        broadcasted_by: user_id,
        status: "Broadcasting", // Fix: Visibility bug (was Pending)
        pickup_location: location,
        pickup_latitude: Number(latitude),
        pickup_longitude: Number(longitude),
        drop_location: order.drop_location,
        drop_latitude: order.receiver_latitude,
        drop_longitude: order.receiver_longitude,
        distance,
        pickup_otp: Math.floor(1000 + Math.random() * 9000),
        drop_otp: Math.floor(1000 + Math.random() * 9000),
      });
    } else {
      // Fix: Visibility bug when reusing after a cancellation
      broadcastObj.status = BROADCAST_STATUS.BROADCASTING;
      await broadcastObj.save();
    }

    const minBroadcast = await mongoose
      .model("MinBroadcastDist")
      .findOne({ role: "DP" });
    const searchRadius = minBroadcast
      ? minBroadcast.minimum_broadcast_distance * 1000
      : Number(radius) || 1000;

    // This calls the highly optimized checkNearbyDps function we just built
    const nearestDps = await dpService.checkNearbyDps(
      searchRadius,
      broadcastObj._id,
      user_id,
    );

    if (!nearestDps.length) {
      return res.json(
        ApiResponse.success({ status: ORDER_REQUEST_STATUS.PENDING }, "no dp found in this area"),
      );
    }

    let orderReq = await OrderRequest.findOne({
      order_id: order_id,
      request_type: "broadcast_dp",
      broadcast_id: broadcastObj._id,
      notified_ids: { $all: nearestDps },
    });

    if (!orderReq) {
      orderReq = await OrderRequest.create({
        order_id: order_id,
        requested_by: user_id,
        notified_ids: nearestDps,
        request_type: "broadcast_dp",
        broadcast_id: broadcastObj._id,
      });

      order.delivery_type = "broadcast";
      order.broadcast_id = broadcastObj._id;
      order.status_completed = "broadcasted";
      order.status = ORDER_STATUS.ACCEPTED;
      await order.save();
    }

    const dps = await DpDetail.find({ user_id: { $in: nearestDps } });

    // Schedule Agenda job to expire this broadcast in 10 minutes
    const agenda = getAgenda();
    if (agenda) {
      // Prevent Race Condition: Cancel any previous expiration timers for this specific broadcast
      await agenda.cancel({ 
        name: "expire-broadcast", 
        "data.broadcast_id": broadcastObj._id.toString() 
      });

      await agenda.schedule("in 10 minutes", "expire-broadcast", {
        broadcast_id: broadcastObj._id.toString(),
        order_id: order_id.toString(),
        pdc_id: user_id.toString(), // DP who triggered the broadcast
      });
    }

    const data = {
      dp: dps,
      broadcast_id: broadcastObj._id,
      broadcast: broadcastObj,
      orderRequest: orderReq,
      status: ORDER_REQUEST_STATUS.PENDING,
    };

    return res.json(ApiResponse.success(data, "dp"));
  });

export const getMinBroadcastPoint = asyncHandler(async (req, res) => {
  const result = await dpService.getMinBroadcastPoint();
  return res.json(ApiResponse.success(result));
});

export const broadcastDeliver = asyncHandler(async (req, res) => {
  const { broadcastId } = req.params;
  const broadcast = await Broadcast.findById(broadcastId);
  if (broadcast) {
    if (broadcast.status === BROADCAST_STATUS.COMPLETED) {
      return res.json(
        ApiResponse.success({ status: BROADCAST_STATUS.COMPLETED }, "Order Delivered"),
      );
    } else {
      return res.json(
        ApiResponse.success({ status: ORDER_REQUEST_STATUS.PENDING }, "Order not delivered yet."),
      );
    }
  }
  throw new ApiError(500, "Something went wrong");
});

export const showNearbyPdc = asyncHandler(async (req, res) => {
  const { user_id, order_id, location, latitude, longitude, max_distance } =
    validate(dpValidation.showNearbyPdcSchema, req.body);

  const dp = await DpDetail.findOne({ user_id: user_id });
  if (!dp) throw new ApiError(404, "DP details not found");

  const order = await Order.findById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  await dp.updateOne({
    location,
    latitude: Number(latitude),
    longitude: Number(longitude),
  });

  const nearestPdcs = await dpService.findNearestPdc(
    Number(latitude),
    Number(longitude),
    order,
    Number(max_distance) || 10,
  );

  return res.json(ApiResponse.success(nearestPdcs));
});

export const activeOrder = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const orders = await dpService.getActiveOrders(user_id);
  return res.json(ApiResponse.success(orders));
});

export const historyOrder = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const orders = await dpService.getHistoryOrders(user_id);
  return res.json(ApiResponse.success(orders));
});

export const dropOrderToPdc = asyncHandler(async (req, res) => {
  const { order_id, user_id, pdc_id } = validate(
    dpValidation.dropPdcSchema,
    req.body,
  );

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(order_id).session(session);
    if (!order) throw new ApiError(404, "Order not found");

    const travel = await dpService.findTravelByOrderAndUser(order_id, user_id);
    if (!travel) throw new ApiError(404, "Travel record not found");

    const chargeConfig = await mongoose
      .model("DeliverCharge")
      .findOne({ vehicle_type: order.mode_of_transport })
      .session(session);
    const percentage =
      chargeConfig && chargeConfig.dp_commission != null
        ? chargeConfig.dp_commission / 100
        : 0.7;
    const totalDpPot = Math.round(order.charges * percentage * 100) / 100;

    const pdcObj = await PdcDocument.findOne({ user_id: pdc_id }).session(
      session,
    );

    const mode = order.mode_of_transport === "By Hand" ? "walking" : "driving";
    const distance = await mapsService.distanceBetween(
      travel.pickup_latitude,
      travel.pickup_longitude,
      pdcObj.latitude,
      pdcObj.longitude,
      mode,
    );
    const distanceValue = parseFloat(distance) || 0;

    const distToReceiver = await mapsService.distanceBetween(
      pdcObj.latitude,
      pdcObj.longitude,
      order.receiver_latitude,
      order.receiver_longitude,
      mode,
    );
    const distToReceiverValue = parseFloat(distToReceiver) || 0;

    const allPayouts = await mongoose
      .model("DpPayout")
      .find({ order_id: order._id })
      .session(session);
    const sumPrev = allPayouts
      .filter((p) => String(p.travel_id) !== String(travel._id))
      .reduce((acc, curr) => acc + curr.earnings, 0);

    const fraction =
      distanceValue + distToReceiverValue > 0
        ? distanceValue / (distanceValue + distToReceiverValue)
        : 0;
    const cappedFraction = Math.min(fraction, 1);
    const remainingPot = Math.max(0, totalDpPot - sumPrev);
    const earning = Math.round(remainingPot * cappedFraction * 100) / 100;

    travel.drop_location = pdcObj.address;
    travel.drop_latitude = pdcObj.latitude;
    travel.drop_longitude = pdcObj.longitude;
    travel.distance = Math.round(distanceValue * 1000) / 1000;
    travel.earnings = earning;
    await travel.save({ session });

    await dpService.createPayout({
      dp_auth_id: user_id,
      order_id: order._id,
      broadcast_id: order.broadcast_id || null,
      travel_id: travel._id,
      earnings: earning,
    });

    const admin = await User.findOne({ role: ROLES.ADMIN }).session(session);
    const dpUser = await User.findById(user_id).session(session);

    await sendNotification({
      role: ROLES.ADMIN,
      title: "Order Status Update",
      message: `The order of ID : ${order_id} is reached at PDC`,
      orderId: order_id,
      session,
    });

    await sendNotification({
      role: ROLES.DP,
      userId: user_id,
      title: "Order Delivered",
      message: `Successfully delivered the order of ID : ${order_id} to PDC`,
      orderId: order_id,
      session,
    });

    await sendNotification({
      role: ROLES.USER,
      userId: order.user_id,
      title: "Order Status Update",
      message: `Your order of ID : ${order_id} is reached at PDC`,
      orderId: order_id,
      session,
    });

    await sendNotification({
      role: ROLES.PDC,
      userId: pdc_id,
      title: "New Package Received",
      message: `You received package for Order #${order_id}`,
      orderId: order_id,
      session,
    });

    await DpDetail.findOneAndUpdate(
      { user_id },
      {
        location: pdcObj.address,
        latitude: pdcObj.latitude,
        longitude: pdcObj.longitude,
        geo_location: {
          type: "Point",
          coordinates: [pdcObj.longitude, pdcObj.latitude],
        },
      },
      { session },
    );

    const orderRequest = await OrderRequest.findOne({
      order_id,
      status: ORDER_REQUEST_STATUS.ACCEPTED,
    })
      .sort({ created_at: -1 })
      .session(session);
    orderRequest.complete_status = ORDER_REQUEST_COMPLETE_STATUS.COMPLETED;
    await orderRequest.save({ session });

    const nextBroadcast = await Broadcast.create(
      [
        {
          order_id,
          broadcasted_by: pdc_id,
          pickup_location: pdcObj.address,
          pickup_latitude: pdcObj.latitude,
          pickup_longitude: pdcObj.longitude,
          distance: distToReceiverValue,
          pickup_otp: Math.floor(1000 + Math.random() * 9000),
          drop_otp: Math.floor(1000 + Math.random() * 9000),
        },
      ],
      { session },
    );

    order.broadcast_id = nextBroadcast[0]._id;
    order.delivery_type = "broadcast_pdc";
    order.status_completed = "delivered to pdc";
    order.status = ORDER_STATUS.ACCEPTED;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json(ApiResponse.success(null, "Parcel Delivered to PDC"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const dropOrderToCustomer = asyncHandler(async (req, res) => {
  const { order_id, user_id, drop_otp } = validate(
    dpValidation.dropOrderToCustomerSchema,
    req.body,
  );
  const result = await dpService.dropOrderToCustomer(
    order_id,
    user_id,
    drop_otp,
  );
  return res.json(ApiResponse.success(null, result.message));
});

export const order_history = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const orders = await dpService.getOrderHistory(user_id);
  return res.json(
    ApiResponse.success(
      { orders_history: orders },
      "all orders that are delivered",
    ),
  );
});

export const totalorder = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const result = await dpService.getTotalOrdersCount(user_id);
  return res.json(
    ApiResponse.success(
      result,
      "for home cards acceptorder rejectorder totalorder totalearning",
    ),
  );
});

export const postRespondToBundle = asyncHandler(async (req, res) => {
  const { bundle_id, response } = req.body;
  const dp_id = req.user.id || req.user._id;

  if (!bundle_id || !response) {
    throw new ApiError(400, "bundle_id and response are required");
  }

  const result = await dpService.respondToBundle(dp_id, bundle_id, response);
  return res.json(ApiResponse.success(result, result.message));
});

export const earning_history = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await dpService.getEarningHistory(userId);
  return res.json(ApiResponse.success(result, "Earnings loaded"));
});

export const online = asyncHandler(async (req, res) => {
  const { user_id, online, location, latitude, longitude } = validate(
    dpValidation.dpOnlineToggleSchema,
    req.body,
  );
  await dpService.toggleOnlineStatus(
    user_id,
    online,
    location,
    Number(latitude),
    Number(longitude),
  );

  const message = online ? "You Are Now Online" : "You Are Offline Now";
  return res.json(ApiResponse.success(null, message));
});

export const updateBankDetail = asyncHandler(async (req, res) => {
  validate(dpValidation.dpBankDetailsSchema, req.body);
  const user_id = req.user.id;
  await dpService.updateBankDetail(user_id, req.body, req.files);
  return res.json(ApiResponse.success(null, "bank details updated"));
});

export const customerLocation = asyncHandler(async (req, res) => {
  const { order_id } = req.params;
  const orderDetail = await Order.findById(order_id);

  const data = {
    sender_latitude: orderDetail?.sender_latitude || null,
    sender_longitude: orderDetail?.sender_longitude || null,
    receiver_latitude: orderDetail?.receiver_latitude || null,
    receiver_longitude: orderDetail?.receiver_longitude || null,
  };

  return res.json(ApiResponse.success(data, "customer lat and long"));
});

export const findPdcInRoute = asyncHandler(async (req, res) => {
  const { pickup_lat, pickup_lng, drop_lat, drop_lng } = req.body;

  const warehousesInRoute = await dpService.findPdcInRouteService(
    pickup_lat,
    pickup_lng,
    drop_lat,
    drop_lng,
  );

  return res.json(ApiResponse.success(warehousesInRoute));
});

export const editProfile = asyncHandler(async (req, res) => {
  const { address } = validate(dpValidation.editProfileSchema, req.body);
  const user_id = req.user.id;
  const profileImgPath = req.file ? req.file.path : null;

  const profile = await dpService.editDpProfile(
    user_id,
    address,
    profileImgPath,
  );

  return res.json(
    ApiResponse.success({ profile }, "Profile Updated Successfully"),
  );
});

export const myRatings = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const ratings = await dpService.findRatingsForDp(user_id);
  const avgRating = await dpService.getDpAverageRating(user_id);

  return res.json(
    ApiResponse.success({ avarageRating: avgRating, ratings }, "Dp Ratings"),
  );
});

export const myNotifications = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const notifications = await Notification.find({
    notifiable_id: userId,
    read_at: null,
  }).sort({ created_at: -1 });

  return res.json(
    ApiResponse.success({ notifications }, "Delivery Partner notifications"),
  );
});

export const rateUser = asyncHandler(async (req, res) => {
  const { order_id, from_dp, to_user, stars, message } = validate(
    dpValidation.rateUserSchema,
    req.body,
  );
  const result = await dpService.rateUser(
    order_id,
    from_dp,
    to_user,
    Number(stars),
    message,
  );
  return res.json(ApiResponse.success(result));
});

export const documentVerificationStatus = asyncHandler(async (req, res) => {
  const { dp_id } = req.params;
  const result = await dpService.getDocumentVerificationStatus(dp_id);
  // Match legacy PHP flat response structure
  return res.json(result);
});

export const cancelBroadcast = asyncHandler(async (req, res) => {
  return res.json(
    ApiResponse.success(null, "Broadcast cancelled successfully"),
  );
});

export const resendPickupOtp = asyncHandler(async (req, res) => {
  const { orderId } = validate(dpValidation.resendOtpSchema, req.body);
  const dpId = req.user._id;
  const result = await dpService.resendPickupOtp(orderId, dpId);
  return res.json(ApiResponse.success(null, result.message));
});

export const resendReceiverOtp = asyncHandler(async (req, res) => {
  const { orderId } = validate(dpValidation.resendOtpSchema, req.body);
  const dpId = req.user._id;
  const result = await dpService.resendReceiverOtp(orderId, dpId);
  return res.json(ApiResponse.success(null, result.message));
});

export const requestType = asyncHandler(async (req, res) => {
  return res.json(ApiResponse.success(null, "request_type route called"));
});

export const deliverPdc = asyncHandler(async (req, res) => {
  const { pdcAuthId, orderId, dpAuthId } = validate(
    dpValidation.deliverPdcSchema,
    req.body,
  );

  const user = await User.findById(dpAuthId);
  if (!user) throw new ApiError(404, "Delivery partner not found");
  const dpObj = user.toObject();
  dpObj.dpDetail = await DpDetail.findOne({ user_id: dpAuthId });
  if (!dpObj.dpDetail)
    throw new ApiError(404, "Delivery partner details not found");

  let pdc = await PdcDocument.findOne({ user_id: pdcAuthId });
  if (!pdc) {
    pdc = await PdcDocument.findById(pdcAuthId);
  }
  if (!pdc || !pdc.latitude)
    throw new ApiError(404, "PDC details/location missing");

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let orderRequest = await OrderRequest.findOne({
      order_id: order._id,
      notified_ids: pdcAuthId,
      status: ORDER_REQUEST_STATUS.ACCEPTED,
      request_type: "deliver to pdc",
      complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
    }).session(session);

    if (!orderRequest) {
      orderRequest = await OrderRequest.create(
        [
          {
            order_id: order._id,
            requested_by: dpAuthId,
            notified_ids: [pdc.user_id],
            request_type: "deliver to pdc",
          },
        ],
        { session },
      );

      const distance = await mapsService.distanceBetween(
        dpObj.dpDetail.latitude,
        dpObj.dpDetail.longitude,
        pdc.latitude,
        pdc.longitude,
      );
      const distanceValue = parseFloat(distance) || 0;

      const broadcast = await Broadcast.create(
        [
          {
            order_id: order._id,
            broadcasted_by: dpAuthId,
            pickup_location: dpObj.dpDetail.location,
            pickup_latitude: dpObj.dpDetail.latitude,
            pickup_longitude: dpObj.dpDetail.longitude,
            drop_location: pdc.address,
            drop_latitude: pdc.latitude,
            drop_longitude: pdc.longitude,
            distance: `${distanceValue} km`,
            drop_otp: Math.floor(1000 + Math.random() * 9000),
          },
        ],
        { session },
      );

      order.broadcast_id = broadcast[0]._id;
      order.delivery_type = "pdc";
      order.status_completed = "delivering to pdc";
      order.status = ORDER_STATUS.ACCEPTED;
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Send a real-time socket notification to the PDC so their "Orders To Receive" tab updates automatically
    await sendNotification({
      role: ROLES.PDC,
      userId: pdc.user_id,
      title: "New Drop-off Request",
      message:
        "A Delivery Partner is heading to your PDC to drop off a package.",
      orderId: order._id,
    });

    const agenda = getAgenda();
    if (agenda && orderRequest) {
      await agenda.schedule("in 5 minutes", "auto-accept-pdc", {
        order_id: order._id.toString(),
        order_request_id: orderRequest[0]
          ? orderRequest[0]._id.toString()
          : orderRequest._id.toString(),
      });
    }

    return res.json(
      ApiResponse.success({ pdc, orderId: order._id }, "request success"),
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const pdcDeliveryOtp = asyncHandler(async (req, res) => {
  const { otp, order_id } = validate(
    dpValidation.pdcDeliveryOtpSchema,
    req.body,
  );
  const order = await Order.findById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  const broadcast = await Broadcast.findById(order.broadcast_id);
  if (!broadcast) throw new ApiError(404, "Broadcast record not found");

  if (Number(otp) !== broadcast.drop_otp) {
    throw new ApiError(400, "OTP does not match");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    broadcast.status = BROADCAST_STATUS.COMPLETED;
    await broadcast.save({ session });

    const orderRequests = await OrderRequest.find({ order_id: order._id })
      .sort({ created_at: -1 })
      .session(session);

    const pdcOrderRequest =
      orderRequests.find((r) => r.request_type === "deliver to pdc") ||
      orderRequests[0];
    const orderRequest =
      orderRequests.find((r) => r.request_type !== "deliver to pdc") ||
      orderRequests[1];

    if (pdcOrderRequest) {
      if (orderRequest) {
        orderRequest.complete_status = ORDER_REQUEST_COMPLETE_STATUS.COMPLETED;
        await orderRequest.save({ session });
      }

      pdcOrderRequest.status = ORDER_REQUEST_STATUS.ACCEPTED;
      if (
        !pdcOrderRequest.accepted_by &&
        pdcOrderRequest.notified_ids &&
        pdcOrderRequest.notified_ids.length > 0
      ) {
        pdcOrderRequest.accepted_by = pdcOrderRequest.notified_ids[0];
      }
      await pdcOrderRequest.save({ session });

      const pdcUserId = pdcOrderRequest.accepted_by;

      const pdc = await PdcDocument.findOne({
        user_id: pdcUserId,
      }).session(session);

      if (orderRequest && orderRequest.accepted_by) {
        const dpDetail = await DpDetail.findOne({
          user_id: orderRequest.accepted_by,
        }).session(session);
        if (dpDetail && pdc) {
          dpDetail.location = pdc.address;
          dpDetail.latitude = pdc.latitude;
          dpDetail.longitude = pdc.longitude;
          dpDetail.geo_location = {
            type: "Point",
            coordinates: [pdc.longitude, pdc.latitude],
          };
          // Industrial Optimization: Unlock DP when they drop package at PDC
          if (dpDetail.active_order_ids) {
            dpDetail.active_order_ids.pull(order._id);
          }
          await dpDetail.save({ session });
        }
      }

      const travel = await mongoose
        .model("Travel")
        .findOne({ order_id: order._id })
        .sort({ created_at: -1 })
        .session(session);

      if (travel && pdc) {
        const distanceMeters = mapsService.haversineGreatCircleDistance(
          travel.pickup_latitude,
          travel.pickup_longitude,
          pdc.latitude,
          pdc.longitude,
        );
        const distanceKm = distanceMeters / 1000;

        const vehicleCharge = await mongoose
          .model("DeliverCharge")
          .findOne({ vehicle_type: order.mode_of_transport })
          .session(session);

        const deliveryChargePerKm =
          vehicleCharge && vehicleCharge.dp_commission != null
            ? vehicleCharge.dp_commission
            : 0;
        const vehicleChargePerKm = vehicleCharge
          ? vehicleCharge.per_km_price
          : 0;

        const earning =
          Math.round(
            (Math.round(distanceKm * 1000) / 1000) *
            vehicleChargePerKm *
            (deliveryChargePerKm / 100) *
            100,
          ) / 100;

        travel.drop_location = pdc.address;
        travel.drop_latitude = pdc.latitude;
        travel.drop_longitude = pdc.longitude;
        travel.distance = Math.round(distanceKm * 1000) / 1000;
        travel.earnings = earning;
        await travel.save({ session });

        await mongoose.model("DpPayout").create(
          [
            {
              dp_auth_id: travel.user_id,
              order_id: order._id,
              broadcast_id: order.broadcast_id,
              travel_id: travel._id,
              earnings: earning,
            },
          ],
          { session },
        );

        const packageDetail = await mongoose
          .model("PackageDetail")
          .findById(order.package_id)
          .session(session);
        const noOfItems = packageDetail ? packageDetail.no_of_items : 0;

        await mongoose.model("PdcPackage").create(
          [
            {
              pdc_id: pdc.user_id,
              order_id: order._id,
              package_id: order.package_id,
              package_count: noOfItems,
              date_of_order: order.created_at,
            },
          ],
          { session },
        );

        let nextBroadcast = await Broadcast.findOne({
          order_id: order._id,
          broadcasted_by: pdc.user_id,
          status: ORDER_REQUEST_STATUS.PENDING,
        }).session(session);

        if (!nextBroadcast) {
          const broadcastDistance = await mapsService.distanceBetween(
            pdc.latitude,
            pdc.longitude,
            order.receiver_latitude,
            order.receiver_longitude,
          );
          const broadcastDistanceVal = parseFloat(broadcastDistance) || 0;

          const createdBroadcast = await Broadcast.create(
            [
              {
                order_id: order._id,
                broadcasted_by: pdc.user_id,
                pickup_location: pdc.address,
                pickup_latitude: pdc.latitude,
                pickup_longitude: pdc.longitude,
                drop_location: order.drop_location,
                drop_latitude: order.receiver_latitude,
                drop_longitude: order.receiver_longitude,
                distance: `${broadcastDistanceVal} km`,
                status: ORDER_REQUEST_STATUS.PENDING,
              },
            ],
            { session },
          );
          nextBroadcast = createdBroadcast[0];
        }

        order.broadcast_id = nextBroadcast._id;
        order.delivery_type = "broadcast_pdc";
        order.status_completed = "delivered to pdc";
        order.status = ORDER_STATUS.ACCEPTED;
        await order.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Send real-time socket notification to the PDC so their UI auto-refreshes
    const pdcOrderReq = await OrderRequest.findOne({
      order_id: order._id,
      request_type: "deliver to pdc",
    }).sort({ created_at: -1 });
    if (pdcOrderReq && pdcOrderReq.accepted_by) {
      await sendNotification({
        role: ROLES.PDC,
        userId: pdcOrderReq.accepted_by,
        title: "Order Arrived at PDC",
        message: `Package for Order #${order._id} has been delivered.`,
        orderId: order._id,
      });
    }

    return res.json(ApiResponse.success(null, "Parcel Delivered to PDC"));
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
