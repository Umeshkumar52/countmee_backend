import * as ordersRepository from "./orders.repository.js";
import {
  ROLES,
  ORDER_STATUS,
  ORDER_REQUEST_STATUS,
  ORDER_REQUEST_COMPLETE_STATUS,
} from "../../constants/index.js";
import { User } from "../users/user.model.js";
import { Order } from "./order.model.js";
import { OrderRequest } from "./orderRequest.model.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import { PackageDetail } from "./packageDetail.model.js";
import { Rating } from "../deliveryPartner/rating.model.js";
import { sendNotification } from "../../common/utils/sendNotification.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../common/services/cloudinary.service.js";
import {
  distanceBetween,
  haversineGreatCircleDistance,
} from "../tracking/maps.service.js";
import { DpDocument } from "../deliveryPartner/dpDocument.model.js";
import { MinBroadcastDist } from "../tracking/minBroadcast.model.js";
import { sendNotificationToUser } from "../../common/services/socket.service.js";
import mongoose from "mongoose";
import { Notification } from "../notifications/notification.model.js";

/**
 * Calculates delivery charges with a hardcoded 5% GST
 */
export const calculateFinalCharges = (deliverCharge, distance) => {
  let price = 0;
  let additionalKmPrice = 0;

  if (distance <= deliverCharge.base_distance) {
    price = deliverCharge.base_price;
  } else {
    const additionalDistance = distance - deliverCharge.base_distance;
    additionalKmPrice = additionalDistance * deliverCharge.per_km_price;
    price = deliverCharge.base_price + additionalKmPrice;
  }

  // Ensure price is calculated exactly to 2 decimal places before applying GST
  const exactPrice = Math.round(price * 100) / 100;
  const exactGst = Math.round(exactPrice * 0.05 * 100) / 100; // 5% GST
  const totalAmount = exactPrice + exactGst;

  return {
    base_price: deliverCharge.base_price,
    additional_km_price: additionalKmPrice,
    net_price: exactPrice,
    gst: exactGst,
    total: totalAmount,
  };
};

export const getCharges = async (
  mode_of_transport,
  pickup_lat,
  pickup_lng,
  drop_lat,
  drop_lng,
  no_of_items,
) => {
  const deliverCharge =
    await ordersRepository.findDeliverChargeByVehicle(mode_of_transport);
  if (!deliverCharge) {
    throw new Error(
      `Charge configuration for vehicle ${mode_of_transport} not found.`,
    );
  }

  let googleMapMode = "driving";
  if (mode_of_transport === "By Hand") {
    googleMapMode = "walking";
  }

  const distanceText = await distanceBetween(
    pickup_lat,
    pickup_lng,
    drop_lat,
    drop_lng,
    googleMapMode,
  );
  const distanceValue = parseFloat(distanceText) || 0;

  const calc = calculateFinalCharges(deliverCharge, distanceValue);

  const itemsMultiplier = no_of_items || 1;
  const netPrice = calc.net_price * itemsMultiplier;
  const exactPrice = Math.round(netPrice * 100) / 100;
  const exactGst = Math.round(exactPrice * 0.05 * 100) / 100; // 5% GST
  const totalAmount = Math.round((exactPrice + exactGst) * 100) / 100;

  return {
    distance_text: distanceText,
    distance_value: distanceValue,
    amount: totalAmount,
    breakdown: {
      single_item_base_price: calc.base_price,
      single_item_additional_km: calc.additional_km_price,
      total_items_price: exactPrice,
      gst: exactGst,
    },
  };
};

export const broadcastOrderToNearbyDPs = async (order, packageDetail) => {
  try {
    // 1. Get minimum broadcast distance for DP
    const minBroadcast = await MinBroadcastDist.findOne({
      role: { $regex: /^dp$/i },
    });
    const maxDistanceKm = minBroadcast
      ? minBroadcast.minimum_broadcast_distance
      : 5;
    const maxDistanceMeters = maxDistanceKm * 1000;

    // 2. Fetch DP Commission logic for the given vehicle type
    const deliverCharge = await ordersRepository.findDeliverChargeByVehicle(
      order.mode_of_transport,
    );
    if (!deliverCharge) {
      console.warn(
        `[Broadcast] No deliver charge found for ${order.mode_of_transport}`,
      );
      return;
    }

    // 3. Calculate DP Earning exactly
    const dp_earning = (
      order.charges *
      (deliverCharge.dp_commission / 100)
    ).toFixed(2);

    // 4. Find Active DPs whose vehicle matches
    const activeDps = await DpDetail.find({
      online: true,
      document_approval: "Approved",
    });
    console.log("active dp", activeDps);
    const activeDpUserIds = activeDps.map((dp) => dp.user_id);

    const matchingDocuments = await DpDocument.find({
      user_id: { $in: activeDpUserIds },
      vehicle_type: order.mode_of_transport,
    });

    const matchedUserIds = new Set(
      matchingDocuments.map((doc) => doc.user_id.toString()),
    );
    const targetDps = activeDps.filter((dp) =>
      matchedUserIds.has(dp.user_id.toString()),
    );

    let sentCount = 0;
    // 5. Geo-filter and Broadcast
    for (const dp of targetDps) {
      if (dp.latitude && dp.longitude) {
        const distanceMeters = haversineGreatCircleDistance(
          order.sender_latitude,
          order.sender_longitude,
          dp.latitude,
          dp.longitude,
        );
        console.log("distance", distanceMeters, maxDistanceMeters);
        if (distanceMeters <= maxDistanceMeters) {
          // Fire Socket notification
          sendNotificationToUser(dp.user_id, {
            type: "NEW_ORDER_BROADCAST",
            order_id: order._id,
            pickup_location: order.pickup_location,
            drop_location: order.drop_location,
            distance: order.distance,
            dp_earning: Number(dp_earning),
            product_description: packageDetail.product_description,
            no_of_items: packageDetail.no_of_items,
          });
          sentCount++;
        }
      }
    }

    console.log(
      `[Broadcast] Order ${order._id} broadcasted to ${sentCount} nearby DPs`,
    );
  } catch (error) {
    console.error("[Broadcast] Error broadcasting to DPs:", error.message);
  }
};

export const createOrder = async (orderData, files) => {
  const {
    user_id,
    pickup_location,
    sender_latitude,
    sender_longitude,
    drop_location,
    receiver_latitude,
    receiver_longitude,
    mode_of_transport,
    sender_name,
    sender_phone,
    how_to_reach_sender_location,
    sender_pin_code,
    sender_address,
    secondary_sender_phone,
    receiver_name,
    receiver_phone,
    how_to_reach_receiver_address,
    receiver_address,
    secondary_receiver_phone,
    receiver_pin_code,
    distance,
    product_description,
    product_weight,
    no_of_items,
    types_of_product,
    size_of_package,
    product_height,
    product_length,
    product_width,
    different_dimantion,
    dimension_unit,
    dimensions_list,
    charges,
    order_type = "normal",
    schedule_date,
    schedule_time,
  } = orderData;

  // Upload images to Cloudinary
  let image1Url = null;
  let image2Url = null;
  let image3Url = null;
  const uploadedCloudinaryIds = [];

  if (files?.image1?.[0]) {
    const res = await uploadToCloudinary(files.image1[0].path, "order_images");
    if (res) {
      image1Url = res.secure_url;
      uploadedCloudinaryIds.push(res.public_id);
    }
  }
  if (files?.image2?.[0]) {
    const res = await uploadToCloudinary(files.image2[0].path, "order_images");
    if (res) {
      image2Url = res.secure_url;
      uploadedCloudinaryIds.push(res.public_id);
    }
  }
  if (files?.image3?.[0]) {
    const res = await uploadToCloudinary(files.image3[0].path, "order_images");
    if (res) {
      image3Url = res.secure_url;
      uploadedCloudinaryIds.push(res.public_id);
    }
  }

  // Generate OTPs
  const pickup_otp = Math.floor(1000 + Math.random() * 9000);
  const drop_otp = Math.floor(1000 + Math.random() * 9000);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await ordersRepository.createOrder(
      [
        {
          user_id,
          pickup_location,
          sender_latitude: Number(sender_latitude),
          sender_longitude: Number(sender_longitude),
          drop_location,
          receiver_latitude: Number(receiver_latitude),
          receiver_longitude: Number(receiver_longitude),
          mode_of_transport,
          sender_name,
          sender_phone,
          how_to_reach_sender_location,
          sender_pin_code,
          sender_address,
          secondary_sender_phone,
          receiver_name,
          receiver_phone,
          how_to_reach_receiver_address,
          receiver_address,
          secondary_receiver_phone,
          receiver_pin_code,
          distance: Number(distance),
          pickup_otp,
          drop_otp,
          charges: Number(charges),
          delivery_type: "direct",
          order_type,
          schedule_date,
          schedule_time,

          status: order_type === "scheduled" ? ORDER_STATUS.SCHEDULED : ORDER_STATUS.CREATED,
        },
      ],
      { session, ordered: true },
    );

    const newOrder = order[0];

    const packageDetail = await ordersRepository.createPackageDetail(
      [
        {
          user_id,
          order_id: newOrder._id,
          product_description,
          product_weight,
          no_of_items: Number(no_of_items),
          types_of_product,
          size_of_package,
          product_height,
          product_length,
          product_width,
          dimension_unit,
          different_dimantion,
          dimensions_list,
          image1: image1Url,
          image2: image2Url,
          image3: image3Url,
        },
      ],
      { session, ordered: true },
    );

    newOrder.package_id = packageDetail[0]._id;
    await newOrder.save({ session });

    // In-app notifications
    await sendNotification({
      role: ROLES.USER,
      userId: user_id,
      title: "Order Placed",
      message: `Your order of ID : ${newOrder._id} is placed`,
      orderId: newOrder._id,
      session,
    });

    await sendNotification({
      role: ROLES.ADMIN,
      title: "New Order Placed",
      message: ` has placed an order of ID : ${newOrder._id}`,
      orderId: newOrder._id,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    // Fire-and-forget broadcast ONLY if it's a normal order
    if (newOrder.order_type === "normal") {
      broadcastOrderToNearbyDPs(newOrder, packageDetail[0]).catch((err) =>
        console.error("[Broadcast] Background execution failed:", err),
      );
    }

    return { order: newOrder, packageDetails: packageDetail[0] };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Rollback Cloudinary uploads
    if (uploadedCloudinaryIds && uploadedCloudinaryIds.length > 0) {
      for (const publicId of uploadedCloudinaryIds) {
        await deleteFromCloudinary(publicId).catch((err) => {
          console.warn(
            "Failed to delete orphaned Cloudinary image:",
            publicId,
            err.message,
          );
        });
      }
    }

    throw error;
  }
};

export const cancelOrder = async (order_id, cancel_order_reason) => {
  // Update OrderRequest status to 0
  await OrderRequest.updateMany(
    { order_id },
    { status: ORDER_REQUEST_STATUS.REJECTED },
  );

  const order = await Order.findById(order_id);
  if (order) {
    order.user_action = 1;
    order.status = ORDER_STATUS.CANCELLED;
    order.cancel_order_reason = cancel_order_reason;
    await order.save();

    if (cancel_order_reason === "Driver are not found") {
      await sendNotification({
        role: ROLES.USER,
        userId: order.user_id,
        title: "Order Cancelled",
        message:
          "Sorry, No Delivery partners are available this moment. Please try again later!",
        orderId: order._id,
      });

      await sendNotification({
        role: ROLES.ADMIN,
        title: "Order Cancelled",
        message: `No Delivery partners are available for the order of ID: ${order._id}`,
        orderId: order._id,
      });
    } else {
      await sendNotification({
        role: ROLES.ADMIN,
        title: "Order Cancelled",
        message: `${order.sender_name} has cancelled the order`, // maps to customer name
        orderId: order._id,
      });
    }
    return true;
  } else {
    throw new Error("Order not found");
  }
};

export const getOrderDetails = async (userId) => {
  const user = await User.findOne({ _id: userId, role: ROLES.USER });
  if (!user) {
    throw new Error("User details not found");
  }
  return await ordersRepository.findActiveOrdersByUserId(userId);
};

export const getTrackingDetails = async (userId, orderId) => {
  const user = await User.findOne({ _id: userId, role: ROLES.USER });
  if (!user) {
    throw new Error("User details not found");
  }

  const orderDoc = await Order.findById(orderId);
  let order_details = null;
  if (orderDoc) {
    const orderObj = orderDoc.toObject();
    const packageDetail = orderDoc.package_id
      ? await PackageDetail.findById(orderDoc.package_id)
      : null;
    const dpDetail = orderDoc.pickup_dp_id
      ? await DpDetail.findOne({ user_id: orderDoc.pickup_dp_id })
      : null;
    orderObj.packageDetail = packageDetail ? packageDetail.toObject() : null;
    orderObj.dpDetail = dpDetail ? dpDetail.toObject() : null;
    order_details = orderObj;
  }

  const assignedDoc = await OrderRequest.findOne({ order_id: orderId }).sort({
    created_at: -1,
  });
  let assigned = null;
  if (assignedDoc) {
    const assignedObj = assignedDoc.toObject();
    const dp = assignedDoc.accepted_by
      ? await User.findById(assignedDoc.accepted_by)
      : null;
    assignedObj.dp = dp ? dp.toObject() : null;
    assigned = assignedObj;
  }

  let dpAvgRating = 0;
  if (assigned?.dp_user_id) {
    const ratings = await Rating.find({ to_dp: assigned.dp_user_id });
    if (ratings.length) {
      const sum = ratings.reduce((acc, curr) => acc + curr.stars, 0);
      dpAvgRating = sum / ratings.length;
    }
  }

  return { order_details, assigned_order: assigned, dpAvgRating };
};

export const getOrderHistory = async (userId) => {
  return await ordersRepository.findOrderHistoryByUserId(userId);
};

export const getCancelledOrders = async (userId) => {
  return await ordersRepository.findCancelledOrdersByUserId(userId);
};

export const getAssignedStatus = async (orderId) => {
  const orderDoc = await Order.findById(orderId);
  if (!orderDoc) {
    throw new Error("Order not found");
  }

  const order = orderDoc.toObject();
  const dpUser = orderDoc.pickup_dp_id
    ? await User.findById(orderDoc.pickup_dp_id)
    : null;
  const dpDetail = orderDoc.pickup_dp_id
    ? await DpDetail.findOne({ user_id: orderDoc.pickup_dp_id })
    : null;
  order.dpUser = dpUser ? dpUser.toObject() : null;
  order.dpDetail = dpDetail ? dpDetail.toObject() : null;

  const orderAssignDoc = await OrderRequest.findOne({
    order_id: order._id,
    status: ORDER_REQUEST_STATUS.ACCEPTED,
    complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
    request_type: "direct",
  });

  if (!orderAssignDoc) {
    throw new Error("Searching For DP");
  }

  const orderAssign = orderAssignDoc.toObject();
  const dp = orderAssignDoc.accepted_by
    ? await User.findById(orderAssignDoc.accepted_by)
    : null;
  const dpLocation = orderAssignDoc.accepted_by
    ? await DpDetail.findOne({ user_id: orderAssignDoc.accepted_by })
    : null;
  orderAssign.dp = dp ? dp.toObject() : null;
  orderAssign.dpLocation = dpLocation ? dpLocation.toObject() : null;

  let avgRating = 0;
  const ratings = await Rating.find({ to_dp: orderAssign.accepted_by });
  if (ratings.length) {
    const sum = ratings.reduce((acc, curr) => acc + curr.stars, 0);
    avgRating = sum / ratings.length;
  }

  return {
    dpName: order.dpUser?.name || "",
    dpPhone: order.dpUser?.phone || "",
    dpProfile: order.dpDetail?.profile_img || "",
    dpLatitude: order.dpDetail?.latitude || null,
    dpLongitude: order.dpDetail?.longitude || null,
    customerLatitude: order.receiver_latitude,
    customerLongitude: order.receiver_longitude,
    avgRating,
    pickup_otp: order.pickup_otp,
  };
};

export const notifyDp = async (orderId, packageDetailsId) => {
  const order = await Order.findById(orderId);
  if (!order || order.user_action === 1) {
    return null;
  }

  // Busy DPs who have already accepted another active order
  const activeRequests = await OrderRequest.find({
    status: ORDER_REQUEST_STATUS.ACCEPTED,
    complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
  });
  const busyDpIds = activeRequests.map((r) => r.accepted_by).filter(Boolean);

  // Find eligible online DPs
  const eligibleDps = await DpDetail.find({
    online: true,
    document_approval: "Approved",
    user_id: { $nin: busyDpIds },
  }).populate({
    path: "dpDocument",
    match: { vehicle_type: order.mode_of_transport },
  });

  // Filter DPs where matching vehicle document exists
  const nearestDps = eligibleDps
    .filter((dp) => dp.dpDocument) // Matches vehicle_type
    .map((dp) => dp.user_id);

  // Prevent duplicate notifications
  const existingRequest = await OrderRequest.findOne({
    order_id: order._id,
    status: null,
    notified_ids: { $all: nearestDps },
  });

  if (!existingRequest && nearestDps.length > 0) {
    return await OrderRequest.create({
      order_id: order._id,
      requested_by: order.user_id,
      notified_ids: nearestDps,
      request_type: "direct",
    });
  }

  return existingRequest;
};

export const getMyNotifications = async (userId) => {
  return await Notification.find({ notifiable_id: userId, read_at: null }).sort(
    { created_at: -1 },
  );
};

export const getCustomerRating = async (userId) => {
  const customer = await User.findById(userId);
  if (!customer) {
    throw new Error("User not found");
  }

  const ratings = await Rating.find({ to_customer: userId })
    .populate("from_dp")
    .sort({ created_at: -1 });
  const mappedRatings = ratings.map((r) => {
    const obj = r.toObject();
    obj.fromDp = obj.from_dp;
    return obj;
  });
  const allRatings = await Rating.find({ to_customer: userId });
  const avgRating = allRatings.length
    ? allRatings.reduce((acc, curr) => acc + curr.stars, 0) / allRatings.length
    : 0;

  return { ratings: mappedRatings, avarageRating: avgRating };
};

export const rateDp = async (
  orderId,
  fromCustomer,
  toDp,
  stars,
  message = "",
) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const customer = await User.findById(fromCustomer);
  const dp = await User.findById(toDp);

  if (!customer || !dp) {
    throw new Error("Customer or DP not found");
  }

  const existingRating = await Rating.findOne({
    order_id: orderId,
    from_customer: fromCustomer,
    to_dp: toDp,
  });

  if (existingRating) {
    return { code: 200, message: "You have already rated this customer." };
  }

  const rating = await Rating.create({
    order_id: orderId,
    from_customer: fromCustomer,
    to_dp: toDp,
    stars,
    message,
  });

  return {
    code: 200,
    rating,
    message: `You have rated ${dp.name} successfully.`,
  };
};
