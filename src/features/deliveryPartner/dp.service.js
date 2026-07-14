import * as dpRepository from "./dp.repository.js";
import {
  ROLES,
  ORDER_STATUS,
  ORDER_REQUEST_STATUS,
  ORDER_REQUEST_COMPLETE_STATUS,
  ACTIVE_ORDER_STATUSES,
  USER_ACTION_STATUS,
} from "../../constants/index.js";
import { User } from "../users/user.model.js";
import { Order } from "../orders/order.model.js";
import { OrderWaitCharge } from "../orders/orderWaitCharge.model.js";
import { OrderRequest } from "../orders/orderRequest.model.js";
import { DpDetail } from "./dpDetail.model.js";
import { DpDocument } from "./dpDocument.model.js";
import { VehicleSubcategory } from "./vehicleSubcategory.model.js";
import { OrderBundle } from "../orders/orderBundle.model.js";
import { broadcastToAdmins } from "../../common/services/socket.service.js";
import { Wallet } from "../payments/wallet.model.js";
import { WalletTransaction } from "../payments/walletTransaction.model.js";
import { DpPayout } from "./dpPayout.model.js";
import { Travel } from "../orders/travel.model.js";
import { Rating } from "./rating.model.js";
import { Broadcast } from "../orders/broadcast.model.js";
import { PackageDetail } from "../orders/packageDetail.model.js";
import { PdcDocument } from "../pdc/pdcDocument.model.js";
import { PdcPackage } from "../pdc/pdcPackage.model.js";
import { PdcPayout } from "../pdc/pdcPayout.model.js";
import * as adminService from "../admin/admin.service.js";
import { sendNotification } from "../../common/utils/sendNotification.js";
import { DeliverCharge } from "../orders/deliverCharge.model.js";
import { uploadToCloudinary } from "../../common/services/cloudinary.service.js";
import { sendOTPViaSMS } from "../../common/utils/sendSms.js";
import * as mapsService from "../tracking/maps.service.js";
import mongoose from "mongoose";

export const findTravelByOrderAndUser = async (order_id, user_id) => {
  return await dpRepository.findTravelByOrderAndUser(order_id, user_id);
};

export const getDPById = async (id) => {
  const user = await User.findById(id);
  if (user) {
    const userObj = user.toObject();
    userObj.dpDetail = await DpDetail.findOne({ user_id: id });
    return userObj;
  }
  return null;
};

export const saveDetails = async (
  user_id,
  gender,
  address,
  profileImgLocalPath,
) => {
  let profileImgUrl = null;

  if (profileImgLocalPath) {
    const uploadResult = await uploadToCloudinary(
      profileImgLocalPath,
      "dp_profiles",
    );
    if (uploadResult) {
      profileImgUrl = uploadResult.secure_url;
    }
  }

  let dp = await DpDetail.findOne({ user_id });

  if (!dp) {
    await DpDetail.create({
      user_id,
      gender,
      address,
      profile_img: profileImgUrl,
    });
    // Initialize empty document
    await DpDocument.create({ user_id });
  } else {
    dp.gender = gender;
    dp.address = address;
    if (profileImgUrl) {
      dp.profile_img = profileImgUrl;
    }
    await dp.save();
  }

  return true;
};

export const getVehicleSubcategories = async (vehicleType) => {
  const subcategories = await VehicleSubcategory.find({
    vehicle_type: vehicleType,
    is_active: true,
    status: DOCUMENT_APPROVAL_STATUS.APPROVED,
  })
    .select("sub_vehicle_type")
    .lean();

  const subCategoryList = subcategories.map((s) => s.sub_vehicle_type);
  if (!subCategoryList.includes("Other")) {
    subCategoryList.push("Other");
  }
  return subCategoryList;
};

export const saveDocuments = async (user_id, docData, files) => {
  const fileFields = [
    "aadhar_imgfront",
    "aadhar_imgback",
    "rc_imgfront",
    "rc_imgback",
    "dl_imgfront",
    "dl_imgback",
    "bank_imagefront",
    "bank_imageback",
    "residence_img",
    "vehicle_img",
    "insurance_document",
    "emission_certificate_document",
    "permit_document",
  ];

  const uploadResults = {};

  for (const field of fileFields) {
    if (files?.[field]?.[0]) {
      const uploadResult = await uploadToCloudinary(
        files[field][0].path,
        "dp_documents",
      );
      if (uploadResult) {
        uploadResults[field] = uploadResult.secure_url;
      }
    }
  }

  let parsedStates = [];
  if (docData.travel_permit_states) {
    try {
      parsedStates = JSON.parse(docData.travel_permit_states);
    } catch (e) {
      if (typeof docData.travel_permit_states === "string") {
        parsedStates = docData.travel_permit_states
          .split(",")
          .map((s) => s.trim());
      } else if (Array.isArray(docData.travel_permit_states)) {
        parsedStates = docData.travel_permit_states;
      }
    }
  }

  await DpDocument.findOneAndUpdate(
    { user_id },
    {
      vehicle_type: docData.vehicle_type,
      sub_vehicle_type: docData.sub_vehicle_type,
      other_vehicle_details: docData.other_vehicle_details,
      vehicle_min_capacity: docData.vehicle_min_capacity,
      vehicle_max_capacity: docData.vehicle_max_capacity,
      insurance_expiry_date: docData.insurance_expiry_date,
      emission_expiry_date: docData.emission_expiry_date,
      is_new_vehicle: docData.is_new_vehicle,
      vehicle_registration_date: docData.vehicle_registration_date,
      travel_permit_states: parsedStates.length > 0 ? parsedStates : undefined,
      aadhar_number: docData.aadhar_number,
      rc_number: docData.rc_number,
      dl_number: docData.dl_number,
      dl_expiry_date: docData.dl_expiry_date,
      bank_name: docData.bank_name,
      bank_acc_number: docData.bank_acc_number,
      bank_ifsc: docData.bank_ifsc,
      vehicle_number: docData.vehicle_number,
      ...uploadResults,
    },
    { new: true },
  );

  if (docData.sub_vehicle_type === "Other" && docData.other_vehicle_details) {
    const existing = await VehicleSubcategory.findOne({
      vehicle_type: docData.vehicle_type,
      sub_vehicle_type: {
        $regex: new RegExp(`^${docData.other_vehicle_details}$`, "i"),
      },
    });

    if (!existing) {
      await VehicleSubcategory.create({
        vehicle_type: docData.vehicle_type,
        sub_vehicle_type: docData.other_vehicle_details,
        is_active: false,
        status: ORDER_REQUEST_STATUS.PENDING,
        requested_by: user_id,
      });

      await sendNotification({
        role: ROLES.ADMIN,
        title: "New Vehicle Subcategory Request",
        message: `A Delivery Partner requested a new vehicle subcategory: ${docData.other_vehicle_details}`,
      });
    }
  }

  return true;
};

export const updateBankDetail = async (user_id, bankData, files) => {
  let bank_imagefront = null;
  let bank_imageback = null;

  if (files?.bank_imagefront?.[0]) {
    const uploadResult = await uploadToCloudinary(
      files.bank_imagefront[0].path,
      "dp_documents",
    );
    bank_imagefront = uploadResult?.secure_url;
  }
  if (files?.bank_imageback?.[0]) {
    const uploadResult = await uploadToCloudinary(
      files.bank_imageback[0].path,
      "dp_documents",
    );
    bank_imageback = uploadResult?.secure_url;
  }

  const updateFields = {
    bank_name: bankData.bank_name,
    bank_acc_number: bankData.bank_acc_number,
    bank_ifsc: bankData.bank_ifsc,
  };

  if (bank_imagefront) updateFields.bank_imagefront = bank_imagefront;
  if (bank_imageback) updateFields.bank_imageback = bank_imageback;

  await DpDocument.findOneAndUpdate({ user_id }, updateFields);
  return true;
};

export const saveReference = async (user_id, refData) => {
  await DpDocument.findOneAndUpdate(
    { user_id },
    {
      reference1_name: refData.reference1_name,
      reference1_phone: refData.reference1_phone,
      reference2_name: refData.reference2_name,
      reference2_phone: refData.reference2_phone,
    },
  );
  return true;
};

export const documentsReupload = async (user_id, files) => {
  const dp = await User.findById(user_id);
  if (!dp) return false;

  const doc = await DpDocument.findOne({ user_id });
  if (!doc) return false;

  const fileFields = {
    aadhar_imgfront: "adhar_status",
    aadhar_imgback: "adhar_status",
    rc_imgfront: "rc_status",
    rc_imgback: "rc_status",
    dl_imgfront: "dl_status",
    dl_imgback: "dl_status",
    bank_imagefront: "bank_status",
    bank_imageback: "bank_status",
    residence_img: "rv_status",
    vehicle_img: "rv_status",
  };

  for (const [field, statusField] of Object.entries(fileFields)) {
    if (files?.[field]?.[0]) {
      const uploadResult = await uploadToCloudinary(
        files[field][0].path,
        "dp_documents",
      );
      if (uploadResult) {
        doc[field] = uploadResult.secure_url;
        doc[statusField] = null; // Reset status to pending
      }
    }
  }

  await doc.save();
  return true;
};

export const getNewOrderDetails = async (order_id, dp_id) => {
  let isAuthorized = false;
  let authorizedReq = null;
  let isPdcBroadcast = false;
  let authorizedBundle = null;

  // 1. Check for standard OrderRequests
  const reqs = await OrderRequest.find({
    order_id: order_id,
    status: ORDER_REQUEST_STATUS.PENDING,
  }).lean();

  if (reqs && reqs.length > 0) {
    for (const r of reqs) {
      if (
        r.rejected_by &&
        r.rejected_by.map((id) => id.toString()).includes(dp_id.toString())
      ) {
        continue;
      }
      if (
        r.notified_ids &&
        r.notified_ids.map((id) => id.toString()).includes(dp_id.toString())
      ) {
        isAuthorized = true;
        authorizedReq = r;
        break;
      }
      if (r.request_type === "broadcast_pdc") {
        isPdcBroadcast = true;
        authorizedReq = r;
      }
    }

    if (!isAuthorized && isPdcBroadcast) {
      // Dynamic radius check for PDC broadcasts
      const dpLocation = await DpDetail.findOne({ user_id: dp_id }).lean();
      if (dpLocation) {
        const distanceConfig = await adminService.getBroadcastDistance();
        const maxDistanceInKm = distanceConfig?.distancesByRole?.pdc || 10;
        const broadcast = await Broadcast.findById(
          authorizedReq.broadcast_id,
        ).lean();
        if (broadcast) {
          const dist = await mapsService.distanceBetween(
            dpLocation.latitude,
            dpLocation.longitude,
            broadcast.pickup_latitude,
            broadcast.pickup_longitude,
          );
          if (parseFloat(dist) <= maxDistanceInKm) {
            isAuthorized = true;
          }
        }
      }
    }
  }

  // 2. If not authorized via OrderRequest, check if order is part of an active OrderBundle
  if (!isAuthorized) {
    const bundle = await OrderBundle.findOne({
      orders: order_id,
      status: BROADCAST_STATUS.BROADCASTING,
    }).lean();

    if (
      bundle &&
      bundle.notified_dps.map((id) => id.toString()).includes(dp_id.toString())
    ) {
      isAuthorized = true;
      authorizedBundle = bundle;
    }
  }

  if (!isAuthorized) {
    throw new Error(
      "You are not authorized to view this order or it is no longer available.",
    );
  }

  // 3. Construct the response for this single order
  const order = await Order.findById(order_id).lean();
  if (!order) throw new Error("Order not found");

  const packageDetail = order.package_id
    ? await PackageDetail.findById(order.package_id).lean()
    : null;
  let broadcastObj = null;

  if (authorizedReq && authorizedReq.broadcast_id) {
    const broadcast = await Broadcast.findById(
      authorizedReq.broadcast_id,
    ).lean();
    if (broadcast) {
      broadcastObj = { ...broadcast };
      const broadcaster = await User.findById(broadcast.broadcasted_by).lean();
      broadcastObj.broadcaster = broadcaster || null;
    }
  }

  const jsonOrder = { ...order };
  jsonOrder.packageDetail = packageDetail;
  jsonOrder.broadcast = broadcastObj;

  jsonOrder.pickup_name =
    jsonOrder.broadcast?.broadcaster?.name || order.sender_name;
  jsonOrder.pickup_loc =
    jsonOrder.broadcast?.pickup_location || order.pickup_location;
  jsonOrder.pickup_lat =
    jsonOrder.broadcast?.pickup_latitude || order.sender_latitude;
  jsonOrder.pickup_lon =
    jsonOrder.broadcast?.pickup_longitude || order.sender_longitude;
  jsonOrder.dist = jsonOrder.broadcast?.distance || `${order.distance} km`;

  // Earnings logic
  const chargeConfig = await DeliverCharge.findOne({
    vehicle_type: order.mode_of_transport,
  }).lean();
  const percentage =
    chargeConfig && chargeConfig.dp_commission != null
      ? chargeConfig.dp_commission / 100
      : 0.7;
  const totalDpPot = Math.round(order.charges * percentage * 100) / 100;

  const dpPayouts = await DpPayout.find({ order_id: order_id }).lean();
  const sumEarnings = dpPayouts.reduce((acc, curr) => acc + curr.earnings, 0);
  const remainingPot = Math.max(0, totalDpPot - sumEarnings);

  jsonOrder.estimated_earnings = remainingPot;

  let remaining_distance = order.distance;
  if (broadcastObj) {
    const mode = order.mode_of_transport === "By Hand" ? "walking" : "driving";
    const distToReceiver =
      parseFloat(
        await mapsService.distanceBetween(
          jsonOrder.pickup_lat,
          jsonOrder.pickup_lon,
          order.receiver_latitude,
          order.receiver_longitude,
          mode,
        ),
      ) || 0;
    remaining_distance = Math.round(distToReceiver * 1000) / 1000;
  }

  jsonOrder.remaining_distance = remaining_distance;
  jsonOrder.per_km_amount =
    remaining_distance > 0
      ? Math.round((remainingPot / remaining_distance) * 100) / 100
      : 0;

  if (jsonOrder._id) jsonOrder._id = jsonOrder._id.toString();

  // Adding Geofence radius to payload
  jsonOrder.pickup_geofence_radius =
    chargeConfig?.pickup_geofence_radius || 100;

  return jsonOrder;
};

export const getNewOrders = async (user_id) => {
  // Check if active accepted orders leg exists
  const activeLeg = await OrderRequest.findOne({
    accepted_by: user_id,
    complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
  });

  if (activeLeg) {
    throw new Error("Please complete your current orders");
  }

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000); // 1 minute window for direct orders
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 minute window for broadcasts

  // Find requests notifying this DP (direct) OR any active PDC broadcast
  const allReqs = await OrderRequest.find({
    status: ORDER_REQUEST_STATUS.PENDING,
    rejected_by: { $ne: user_id },
    $or: [
      { notified_ids: user_id, created_at: { $gte: oneMinuteAgo } },
      { request_type: "broadcast_pdc" },
    ],
  }).lean();

  const dpLocation = await DpDetail.findOne({ user_id }).lean();

  // 1. Fetch all broadcast PDC requirements at once to solve N+1
  const broadcastIds = allReqs
    .filter((req) => req.request_type === "broadcast_pdc" && req.broadcast_id)
    .map((req) => req.broadcast_id);

  const uniqueBroadcastIds = [...new Set(broadcastIds)];
  let broadcasts = [];
  let distancesByRole = null;

  if (uniqueBroadcastIds.length > 0) {
    broadcasts = await Broadcast.find({
      _id: { $in: uniqueBroadcastIds },
      status: BROADCAST_STATUS.BROADCASTING,
      updatedAt: { $gte: tenMinutesAgo },
    }).lean();

    // Fetch dynamic radius from Admin Settings only once
    const distanceConfig = await adminService.getBroadcastDistance();
    distancesByRole = distanceConfig?.distancesByRole;
  }

  const broadcastMap = new Map(broadcasts.map((b) => [b._id.toString(), b]));
  const maxDistanceInKm = distancesByRole?.pdc || 10;

  // Parallelize the map distance checks for the PDC broadcasts
  const validBroadcasts = new Set();

  if (dpLocation && broadcasts.length > 0) {
    const distancePromises = broadcasts.map(async (broadcast) => {
      const dist = await mapsService.distanceBetween(
        dpLocation.latitude,
        dpLocation.longitude,
        broadcast.pickup_latitude,
        broadcast.pickup_longitude,
      );
      if (parseFloat(dist) <= maxDistanceInKm) {
        validBroadcasts.add(broadcast._id.toString());
      }
    });
    await Promise.all(distancePromises);
  }

  const reqs = [];
  for (const req of allReqs) {
    if (req.request_type === "broadcast_pdc") {
      // If we can't determine DP location, they should not see the broadcast
      if (!dpLocation) continue;

      const broadcast = broadcastMap.get(req.broadcast_id?.toString());
      if (!broadcast) continue;

      if (!validBroadcasts.has(broadcast._id.toString())) continue;
    }
    reqs.push(req);
  }

  const orderIds = reqs.map((r) => r.order_id);
  const orders = await Order.find({ _id: { $in: orderIds } }).lean();

  // 2. Pre-fetch all related data to prevent N+1 in the orders loop
  const packageIds = orders.map((o) => o.package_id).filter(Boolean);
  const broadcastIdsForOrders = orders
    .map((o) => o.broadcast_id)
    .filter(Boolean);

  const [packages, allCharges, dpPayouts, orderBroadcasts] = await Promise.all([
    PackageDetail.find({ _id: { $in: packageIds } }).lean(),
    DeliverCharge.find({}).lean(),
    DpPayout.find({ order_id: { $in: orderIds }, dp_auth_id: user_id }).lean(),
    Broadcast.find({ _id: { $in: broadcastIdsForOrders } }).lean(),
  ]);

  const packageMap = new Map(packages.map((p) => [p._id.toString(), p]));
  const chargeMap = new Map(allCharges.map((c) => [c.vehicle_type, c]));

  const payoutMap = new Map();
  for (const p of dpPayouts) {
    const oId = p.order_id?.toString();
    if (oId) {
      if (!payoutMap.has(oId))
        payoutMap.set(oId, { earnings: 0, waiting_charge_earning: 0 });
      const entry = payoutMap.get(oId);
      entry.earnings += p.earnings;
      entry.waiting_charge_earning += p.waiting_charge_earning || 0;
    }
  }

  const broadcastOrderMap = new Map(
    orderBroadcasts.map((b) => [b._id.toString(), b]),
  );

  const broadcasterIds = orderBroadcasts
    .map((b) => b.broadcasted_by)
    .filter(Boolean);
  const broadcasters = await User.find({ _id: { $in: broadcasterIds } }).lean();
  const broadcasterMap = new Map(
    broadcasters.map((u) => [u._id.toString(), u]),
  );

  // 3. Construct the response concurrently
  const ordersWithPickupPromises = orders.map(async (order) => {
    const jsonOrder = { ...order };
    const packageDetail = packageMap.get(order.package_id?.toString()) || null;
    const broadcast =
      broadcastOrderMap.get(order.broadcast_id?.toString()) || null;

    let broadcastObj = null;
    if (broadcast) {
      broadcastObj = { ...broadcast };
      const broadcaster =
        broadcasterMap.get(broadcast.broadcasted_by?.toString()) || null;
      broadcastObj.broadcaster = broadcaster;
    }

    jsonOrder.packageDetail = packageDetail;
    jsonOrder.broadcast = broadcastObj;

    jsonOrder.pickup_name =
      jsonOrder.broadcast?.broadcaster?.name || order.sender_name;
    jsonOrder.pickup_loc =
      jsonOrder.broadcast?.pickup_location || order.pickup_location;
    jsonOrder.pickup_lat =
      jsonOrder.broadcast?.pickup_latitude || order.sender_latitude;
    jsonOrder.pickup_lon =
      jsonOrder.broadcast?.pickup_longitude || order.sender_longitude;
    jsonOrder.dist = jsonOrder.broadcast?.distance || `${order.distance} km`;

    const chargeConfig = chargeMap.get(order.mode_of_transport);
    const percentage =
      chargeConfig && chargeConfig.dp_commission != null
        ? chargeConfig.dp_commission / 100
        : 0.7;

    const totalDpPot = Math.round(order.charges * percentage * 100) / 100;
    const payoutEntry = payoutMap.get(order._id?.toString()) || {
      earnings: 0,
      waiting_charge_earning: 0,
    };
    const sumEarnings = payoutEntry.earnings;
    const remainingPot = Math.max(0, totalDpPot - sumEarnings);

    jsonOrder.estimated_earnings = remainingPot;
    // Waiting charge earned by this DP for this order (100% of their phase: pickup or drop)
    jsonOrder.waiting_charge_earning = payoutEntry.waiting_charge_earning;
    // Total earnings = base delivery commission + waiting charge earned
    jsonOrder.total_earnings =
      Math.round((remainingPot + payoutEntry.waiting_charge_earning) * 100) /
      100;

    let remaining_distance = order.distance;

    if (broadcast) {
      const mode =
        order.mode_of_transport === "By Hand" ? "walking" : "driving";
      const distToReceiver =
        parseFloat(
          await mapsService.distanceBetween(
            jsonOrder.pickup_lat,
            jsonOrder.pickup_lon,
            order.receiver_latitude,
            order.receiver_longitude,
            mode,
          ),
        ) || 0;
      remaining_distance = Math.round(distToReceiver * 1000) / 1000;
    }

    jsonOrder.remaining_distance = remaining_distance;
    jsonOrder.per_km_amount =
      remaining_distance > 0
        ? Math.round((remainingPot / remaining_distance) * 100) / 100
        : 0;

    // Convert _id objects to string for final output like .toJSON() did
    // Convert _id objects to string for final output like .toJSON() did
    if (jsonOrder._id) jsonOrder._id = jsonOrder._id.toString();

    return jsonOrder;
  });

  const ordersWithPickup = await Promise.all(ordersWithPickupPromises);

  // Fetch pending OrderBundles for this DP
  const activeBundles = await OrderBundle.find({
    status: BROADCAST_STATUS.BROADCASTING,
    notified_dps: user_id,
    accepted_dps: { $ne: user_id },
    rejected_dps: { $ne: user_id },
  })
    .populate({
      path: "orders",
      populate: { path: "package_id" },
    })
    .lean();

  const formattedBundles = activeBundles.map((bundle) => ({
    type: "bundle",
    bundle_id: bundle.bundle_id,
    created_at: bundle.created_at,
    orders: bundle.orders.map((order) => ({
      order_id: order._id,
      pickup_location: order.pickup_location,
      drop_location: order.drop_location,
      charges: order.charges?.toString() || "0",
      distance: order.distance?.toString() || "0",
      product_description: order.package_id?.product_description || "",
      no_of_items: order.package_id?.no_of_items?.toString() || "1",
    })),
  }));

  return [...ordersWithPickup, ...formattedBundles];
};

export const cancelAssignment = async (order_id, user_id, cancel_reason) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(order_id).session(session);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.dp_pickup_time) {
      throw new Error(
        "Cannot cancel assignment after picking up the order. Please contact support.",
      );
    }

    const orderRequest = await OrderRequest.findOne({
      order_id,
      accepted_by: user_id,
      status: ORDER_REQUEST_STATUS.ACCEPTED,
    }).session(session);
    if (!orderRequest) {
      throw new Error("Active assignment not found");
    }

    // Revert OrderRequest
    orderRequest.status = ORDER_REQUEST_STATUS.REJECTED; // REJECTED
    orderRequest.accepted_by = null;
    orderRequest.rejected_by.push(user_id);
    await orderRequest.save({ session });

    // Unlock the DP by removing this order from their active array
    await DpDetail.findOneAndUpdate(
      { user_id },
      { $pull: { active_order_ids: order_id } },
      { session },
    );

    // Revert Order fields
    order.pickup_dp_id = null;
    order.dp_accept_time = null;
    order.status_completed = null;
    order.status = ORDER_STATUS.PENDING;
    await order.save({ session });

    // Revert Broadcast if it was a broadcast
    if (orderRequest.broadcast_id) {
      await Broadcast.findByIdAndUpdate(
        orderRequest.broadcast_id,
        { pickup_dp_id: null, status: ORDER_REQUEST_STATUS.PENDING },
        { session },
      );
    }

    // Clean up any preemptive Travel or DpPayout records created during orderAccept (for broadcast orders)
    await Travel.deleteMany({ order_id, user_id }).session(session);
    await DpPayout.deleteMany({ order_id, dp_auth_id: user_id }).session(
      session,
    );

    // Notify Admin
    const dpUser = await User.findById(user_id).session(session);
    await sendNotification({
      role: ROLES.ADMIN,
      title: "Assignment Cancelled",
      message: `Delivery Partner ${dpUser ? dpUser.name : "Unknown"} has cancelled their assignment for order ID: ${order_id}. Reason: ${cancel_reason || "None provided"}`,
      orderId: order_id,
      session,
    });

    await session.commitTransaction();
    session.endSession();
    return { message: "Order assignment cancelled successfully" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const markArrival = async (
  order_id,
  user_id,
  location_type,
  lat,
  lng,
) => {
  const order = await Order.findById(order_id);
  if (!order) throw new Error("Order not found");

  const deliverCharge = await DeliverCharge.findOne({
    vehicle_type: order.mode_of_transport,
  });
  if (!deliverCharge) throw new Error("DeliverCharge config not found");

  let targetLat, targetLng;
  if (location_type === "pickup") {
    if (order.dp_pickup_arrival_time)
      throw new Error("Pickup arrival already marked");
    const broadcast = order.broadcast_id
      ? await Broadcast.findById(order.broadcast_id)
      : null;
    targetLat = broadcast ? broadcast.pickup_latitude : order.sender_latitude;
    targetLng = broadcast ? broadcast.pickup_longitude : order.sender_longitude;
  } else {
    if (order.dp_drop_arrival_time)
      throw new Error("Drop arrival already marked");
    targetLat = order.receiver_latitude;
    targetLng = order.receiver_longitude;
  }

  const distanceInMeters = await mapsService.haversineGreatCircleDistance(
    lat,
    lng,
    targetLat,
    targetLng,
  );

  if (distanceInMeters > deliverCharge.pickup_geofence_radius) {
    throw new Error(
      `You are too far (${Math.round(distanceInMeters)}m) from the location to mark arrival. Must be within ${deliverCharge.pickup_geofence_radius}m.`,
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (location_type === "pickup") {
      order.dp_pickup_arrival_time = new Date();
      sendOTPViaSMS(
        order.sender_phone,
        `Your Delivery Partner has arrived at the pickup location. Please handover the parcel. Waiting charges apply after ${deliverCharge.grace_period} mins.`,
      ).catch((err) => console.error("SMS Failed:", err.message));

      await OrderWaitCharge.findOneAndUpdate(
        { order_id },
        {
          $set: {
            order_id,
            user_id: order.user_id,
            pickup_dp_id: user_id,
            pickup_arrival_time: order.dp_pickup_arrival_time,
          },
        },
        { upsert: true, session },
      );
    } else {
      order.dp_drop_arrival_time = new Date();
      sendOTPViaSMS(
        order.receiver_phone,
        `Your Delivery Partner has arrived at the drop location. Please collect the parcel. Waiting charges apply after ${deliverCharge.grace_period} mins.`,
      ).catch((err) => console.error("SMS Failed:", err.message));

      await OrderWaitCharge.findOneAndUpdate(
        { order_id },
        {
          $set: {
            order_id,
            user_id: order.user_id,
            delivery_dp_id: user_id,
            drop_arrival_time: order.dp_drop_arrival_time,
          },
        },
        { upsert: true, session },
      );
    }

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();
    return { message: "Arrival marked successfully" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const orderAccept = async (orderIds, status, user_id) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const order_id of orderIds) {
      const orderRequest = await OrderRequest.findOne({
        order_id,
        status: ORDER_REQUEST_STATUS.PENDING,
      }).session(session);

      if (!orderRequest) {
        // Check if this specific user has already accepted this order
        const alreadyAccepted = await OrderRequest.findOne({
          order_id,
          status: ORDER_REQUEST_STATUS.ACCEPTED,
          accepted_by: user_id,
        }).session(session);

        if (alreadyAccepted) {
          throw new Error(`You have already accepted order ${order_id}`);
        }
        throw new Error(`Sorry, you have missed order ${order_id}`);
      }

      if (status) {
        const order = await Order.findById(order_id).session(session);
        if (!order) {
          throw new Error("Order not found");
        }

        if (order.user_action === USER_ACTION_STATUS.CANCELLED) {
          throw new Error("Sorry this order cancelled by customer");
        }

        orderRequest.status = ORDER_REQUEST_STATUS.ACCEPTED;
        orderRequest.accepted_by = user_id;
        await orderRequest.save({ session });

        // Lock the DP by adding this order to their active array
        await DpDetail.findOneAndUpdate(
          { user_id },
          { $addToSet: { active_order_ids: order_id } },
          { session },
        );
        // Payout allocation settings
        const chargeConfig = await DeliverCharge.findOne({
          vehicle_type: order.mode_of_transport,
        }).session(session);
        const percentage =
          chargeConfig && chargeConfig.dp_commission != null
            ? chargeConfig.dp_commission / 100
            : 0.7;
        const totalDpPot = Math.round(order.charges * percentage * 100) / 100;

        if (orderRequest.request_type === "direct") {
          order.status_completed = "order accepted";
          order.status = ORDER_STATUS.ACCEPTED;
          order.pickup_dp_id = user_id;
          order.dp_accept_time = new Date();
          await order.save({ session });

          // SMS drop OTP to receiver
          const message2 = `Your CountMee Courier verification code is ${order.drop_otp}`;
          sendOTPViaSMS(order.receiver_phone, message2).catch((err) => console.error("SMS Failed:", err.message));
        } else if (
          orderRequest.request_type === "broadcast_dp" ||
          orderRequest.request_type === "broadcast_pdc"
        ) {
          order.status_completed = "broadcast accepted";
          order.status = ORDER_STATUS.ACCEPTED;
          order.delivery_type = "broadcast";
          await order.save({ session });

          // Previous segment leg payout
          const oldOrderRequest = await OrderRequest.findOne({
            order_id: order._id,
          })
            .sort({ created_at: -1 })
            .skip(1)
            .session(session);
          // Previous segment leg payout - ONLY recalculate for direct DP-to-DP handovers
          // For broadcast_pdc, the PDC drop-off already locked in the exact PDC coordinates
          if (orderRequest.request_type === "broadcast_dp") {
            let travel = oldOrderRequest
              ? await Travel.findOne({
                  order_id: order._id,
                  user_id: oldOrderRequest.accepted_by,
                })
                  .sort({ created_at: -1 })
                  .session(session)
              : null;

            if (!travel && oldOrderRequest) {
              let prevLat = order.sender_latitude;
              let prevLon = order.sender_longitude;
              let prevLoc = order.pickup_location;

              if (
                oldOrderRequest.request_type !== "direct" &&
                oldOrderRequest.broadcast_id
              ) {
                const prevBroadcast = await Broadcast.findById(
                  oldOrderRequest.broadcast_id,
                ).session(session);
                if (prevBroadcast) {
                  prevLat = prevBroadcast.pickup_latitude;
                  prevLon = prevBroadcast.pickup_longitude;
                  prevLoc = prevBroadcast.pickup_location;
                }
              }

              const newTravels = await Travel.create(
                [
                  {
                    order_id: order._id,
                    order_cost: order.charges,
                    user_id: oldOrderRequest.accepted_by,
                    pickup_location: prevLoc,
                    pickup_latitude: prevLat,
                    pickup_longitude: prevLon,
                  },
                ],
                { session },
              );
              travel = newTravels[0];
            }

            let distance = 0;

            const oldDpDetail = oldOrderRequest
              ? await DpDetail.findOne({
                  user_id: oldOrderRequest.accepted_by,
                }).session(session)
              : null;

            if (travel && oldOrderRequest && oldDpDetail) {
              const mode =
                order.mode_of_transport === "By Hand" ? "walking" : "driving";
              const chkDistance = await mapsService.distanceBetween(
                travel.pickup_latitude,
                travel.pickup_longitude,
                oldDpDetail.latitude,
                oldDpDetail.longitude,
                mode,
              );
              distance = parseFloat(chkDistance) || 0;
              const distToReceiver =
                parseFloat(
                  await mapsService.distanceBetween(
                    oldDpDetail.latitude,
                    oldDpDetail.longitude,
                    order.receiver_latitude,
                    order.receiver_longitude,
                    mode,
                  ),
                ) || 0;

              const fraction =
                distance + distToReceiver > 0
                  ? distance / (distance + distToReceiver)
                  : 0;
              const cappedFraction = Math.min(fraction, 1);

              const alreadyDistributed = await DpPayout.find({
                order_id: order._id,
              }).session(session);

              const sumEarnings = alreadyDistributed
                .filter((p) => String(p.travel_id) !== String(travel._id))
                .reduce((acc, curr) => acc + curr.earnings, 0);

              const remainingPot = Math.max(0, totalDpPot - sumEarnings);
              const earnings =
                Math.round(remainingPot * cappedFraction * 100) / 100;

              travel.drop_location = oldDpDetail.location;
              travel.drop_latitude = oldDpDetail.latitude;
              travel.drop_longitude = oldDpDetail.longitude;
              travel.distance = Math.round(distance * 1000) / 1000;
              travel.earnings = earnings;
              await travel.save({ session });

              await DpPayout.findOneAndUpdate(
                { travel_id: travel._id },
                {
                  dp_auth_id: travel.user_id,
                  order_id: travel.order_id,
                  broadcast_id: oldOrderRequest.broadcast_id || null,
                  earnings,
                },
                { upsert: true, session },
              );
            }

            // Current DP payout leg segment allocation
            const distributedDpAmount = await DpPayout.find({
              order_id: order._id,
            }).session(session);
            const sumEarnings = distributedDpAmount.reduce(
              (acc, curr) => acc + curr.earnings,
              0,
            );
            const remainingPot = Math.max(0, totalDpPot - sumEarnings);

            const mode =
              order.mode_of_transport === "By Hand" ? "walking" : "driving";
            const activeBroadcast = await Broadcast.findById(
              orderRequest.broadcast_id,
            ).session(session);

            const pickupLatitude =
              activeBroadcast?.pickup_latitude || order.sender_latitude;
            const pickupLongitude =
              activeBroadcast?.pickup_longitude || order.sender_longitude;
            const pickupLocation =
              activeBroadcast?.pickup_location || order.pickup_location;

            const distToReceiver =
              parseFloat(
                await mapsService.distanceBetween(
                  pickupLatitude,
                  pickupLongitude,
                  order.receiver_latitude,
                  order.receiver_longitude,
                  mode,
                ),
              ) || 0;

            const pickupToDrop = parseFloat(activeBroadcast?.distance) || 0;
            const fraction =
              pickupToDrop + distToReceiver > 0
                ? pickupToDrop / (pickupToDrop + distToReceiver)
                : 0.5;
            const currentDpEarnings =
              Math.round(remainingPot * Math.min(fraction, 1) * 100) / 100;

            // Check if travel log exists, else create it
            let currentTravel = await Travel.findOne({
              order_id: order._id,
              user_id,
              pickup_latitude: pickupLatitude,
              pickup_longitude: pickupLongitude,
            }).session(session);

            if (!currentTravel) {
              currentTravel = await Travel.create(
                [
                  {
                    order_id: order._id,
                    user_id,
                    pickup_latitude: pickupLatitude,
                    pickup_longitude: pickupLongitude,
                    order_cost: order.charges,
                    pickup_location: pickupLocation,
                    earnings: currentDpEarnings,
                  },
                ],
                { session },
              );
              currentTravel = currentTravel[0];
            }

            await DpPayout.findOneAndUpdate(
              { travel_id: currentTravel._id },
              {
                dp_auth_id: user_id,
                order_id: order._id,
                broadcast_id: orderRequest.broadcast_id,
                earnings: currentDpEarnings,
              },
              { upsert: true, session },
            );

            if (orderRequest.broadcast_id) {
              await Broadcast.findByIdAndUpdate(
                orderRequest.broadcast_id,
                { pickup_dp_id: user_id, status: ORDER_REQUEST_STATUS.ACCEPTED },
                { session },
              );

              if (orderRequest.request_type === "broadcast_pdc") {
                const broadcastDoc = await Broadcast.findById(
                  orderRequest.broadcast_id,
                ).session(session);
                if (broadcastDoc && broadcastDoc.broadcasted_by) {
                  await sendNotification({
                    role: ROLES.PDC,
                    userId: broadcastDoc.broadcasted_by,
                    title: "Broadcast Accepted",
                    message: `Order #${order_id} has been accepted by Delivery Partner ${user_id}.`,
                    orderId: order_id,
                    session,
                  });
                }
              }
            }
          }
        }

        // Trigger notifications
        const admin = await User.findOne({ role: ROLES.ADMIN }).session(
          session,
        );
        const dpUser = await User.findById(user_id).session(session);

        await sendNotification({
          role: ROLES.ADMIN,
          title:
            orderRequest.request_type === "direct"
              ? "Order Accepted"
              : "Broadcast Accepted",
          message: `The order of ID : ${order_id} has been accepted by ${dpUser.name}`,
          orderId: order_id,
          session,
        });

        await sendNotification({
          role: ROLES.DP,
          userId: user_id,
          title: "Order Accepted",
          message: `You have accpeted the order of ID : ${order_id}`,
          orderId: order_id,
          session,
        });

        if (orderRequest.request_type === "direct") {
          await sendNotification({
            role: ROLES.USER,
            userId: order.user_id,
            title: "Order Update",
            message: `Your order of ID : ${order_id} is accepted by ${dpUser.name}`,
            orderId: order_id,
            session,
          });
        }
      } else {
        // Reject Order request logic
        orderRequest.rejected_by.push(user_id);
        await orderRequest.save({ session });

        const allNotified = [...orderRequest.notified_ids].sort();
        const allRejected = [...orderRequest.rejected_by].sort();

        if (JSON.stringify(allNotified) === JSON.stringify(allRejected)) {
          if (
            orderRequest.request_type !== "broadcast_pdc" &&
            orderRequest.request_type !== "broadcast_dp"
          ) {
            orderRequest.status = ORDER_REQUEST_STATUS.REJECTED; // Rejected by all DPs
          }
          await orderRequest.save({ session });
        }

        const admin = await User.findOne({ role: ROLES.ADMIN }).session(
          session,
        );
        const dpUser = await User.findById(user_id).session(session);

        await sendNotification({
          role: ROLES.ADMIN,
          title: "Order Rejected",
          message: `The order of ID : ${order_id} has been rejected by ${dpUser.name}`,
          orderId: order_id,
          session,
        });

        await sendNotification({
          role: ROLES.DP,
          userId: user_id,
          title: "Order Rejected",
          message: `You have rejected the order of ID : ${order_id}`,
          orderId: order_id,
          session,
        });
      }
    } // End of for loop

    await session.commitTransaction();
    session.endSession();
    return { message: status ? "Orders Accepted" : "Orders Rejected" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const acceptedOrders = async (user_id) => {
  const reqs = await OrderRequest.find({
    accepted_by: user_id,
    status: ORDER_REQUEST_STATUS.ACCEPTED,
    complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
  });

  const orderIds = reqs.map((r) => r.order_id);
  const orders = await Order.find({ _id: { $in: orderIds } });

  const ordersWithPickup = [];
  for (const order of orders) {
    const jsonOrder = order.toJSON();
    const packageDetail = order.package_id
      ? await PackageDetail.findById(order.package_id)
      : null;
    const broadcast = order.broadcast_id
      ? await Broadcast.findById(order.broadcast_id)
      : null;

    let broadcastObj = null;
    if (broadcast) {
      broadcastObj = broadcast.toJSON();
      const broadcaster = broadcast.broadcasted_by
        ? await User.findById(broadcast.broadcasted_by)
        : null;
      broadcastObj.broadcaster = broadcaster ? broadcaster.toJSON() : null;
    }

    jsonOrder.packageDetail = packageDetail ? packageDetail.toJSON() : null;
    jsonOrder.broadcast = broadcastObj;

    jsonOrder.pickup_name =
      jsonOrder.broadcast?.broadcaster?.name || order.sender_name;
    jsonOrder.pickup_phone =
      jsonOrder.broadcast?.broadcaster?.phone || order.sender_phone;
    jsonOrder.pickup_loc =
      jsonOrder.broadcast?.pickup_location || order.pickup_location;
    jsonOrder.pickup_lat =
      jsonOrder.broadcast?.pickup_latitude || order.sender_latitude;
    jsonOrder.pickup_lon =
      jsonOrder.broadcast?.pickup_longitude || order.sender_longitude;
    jsonOrder.dist = jsonOrder.broadcast?.distance || `${order.distance} km`;
    ordersWithPickup.push(jsonOrder);
  }

  return ordersWithPickup;
};

export const pickupOtp = async (order_id, user_id, otp) => {
  const orderRequest = await OrderRequest.findOne({
    order_id,
    accepted_by: user_id,
  }).sort({ created_at: -1 });
  if (!orderRequest) {
    throw new Error(
      "Order not found or has not been accepted by this Delivery Partner",
    );
  }

  const order = await Order.findById(order_id);
  if (!order) {
    throw new Error("Order not found");
  }
  const broadcast = order.broadcast_id
    ? await Broadcast.findById(order.broadcast_id)
    : null;
  let expectedOtp;

  if (orderRequest.request_type === "direct") {
    expectedOtp = order.pickup_otp;
  } else {
    expectedOtp = broadcast?.pickup_otp;
  }

  if (Number(otp) === Number(expectedOtp)) {
    const oldOrderRequest = await OrderRequest.findOne({ order_id })
      .sort({ created_at: -1 })
      .skip(1);

    if (oldOrderRequest) {
      oldOrderRequest.complete_status = ORDER_REQUEST_COMPLETE_STATUS.COMPLETED;
      await oldOrderRequest.save();
    }

    if (broadcast) {
      broadcast.status = "1";
      broadcast.status = BROADCAST_STATUS.COMPLETED;
      await broadcast.save();
    }

    return { otp_match: true };
  }

  return { otp_match: false };
};

export const pickupOrderImageUpload = async (order_id, user_id, files) => {
  let image1 = null;
  let image2 = null;
  let image3 = null;

  if (files?.image1?.[0]) {
    const res = await uploadToCloudinary(files.image1[0].path, "dp_pickups");
    image1 = res?.secure_url;
  }
  if (files?.image2?.[0]) {
    const res = await uploadToCloudinary(files.image2[0].path, "dp_pickups");
    image2 = res?.secure_url;
  }
  if (files?.image3?.[0]) {
    const res = await uploadToCloudinary(files.image3[0].path, "dp_pickups");
    image3 = res?.secure_url;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(order_id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      throw new Error("Order not found");
    }

    const broadcast = order.broadcast_id
      ? await Broadcast.findById(order.broadcast_id).session(session)
      : null;

    // Save DP images
    await mongoose.model("DeliveryPartnerImage").create(
      [
        {
          order_id,
          delivery_partner_id: user_id,
          image1,
          image2,
          image3,
        },
      ],
      { session },
    );

    const orderRequest = await OrderRequest.findOne({ order_id })
      .sort({ created_at: -1 })
      .session(session);

    const deliverCharge = await DeliverCharge.findOne({
      vehicle_type: order.mode_of_transport,
    }).session(session);
    if (order.dp_pickup_arrival_time && deliverCharge) {
      const waitTimeMins = Math.floor(
        (new Date() - order.dp_pickup_arrival_time) / 60000,
      );
      const gracePeriod = deliverCharge.grace_period || 0;
      let extraMins = 0;
      let waitingCharge = 0;

      if (waitTimeMins > gracePeriod) {
        extraMins = waitTimeMins - gracePeriod;
        waitingCharge = extraMins * (deliverCharge.extra_min_charge || 0);
      }

      await OrderWaitCharge.findOneAndUpdate(
        { order_id },
        {
          $set: {
            order_id,
            user_id: order.user_id,
            pickup_dp_id: user_id,
            pickup_otp_verified_time: new Date(),
            pickup_grace_period: gracePeriod,
            pickup_total_wait_mins: waitTimeMins,
            pickup_extra_mins: extraMins,
            pickup_rate_per_min: deliverCharge.extra_min_charge || 0,
            pickup_waiting_charge: waitingCharge,
          },
        },
        { upsert: true, session },
      );

      // Credit 100% of pickup waiting charge to this DP's payout (use $inc to safely accumulate)
      if (waitingCharge > 0) {
        await DpPayout.findOneAndUpdate(
          { order_id: order._id, dp_auth_id: user_id },
          { $inc: { waiting_charge_earning: waitingCharge } },
          { upsert: false, session },
        );
      }
    }

    if (orderRequest.request_type === "direct") {
      let travel = await Travel.findOne({
        order_id: order._id,
        user_id,
        pickup_latitude: order.sender_latitude,
        pickup_longitude: order.sender_longitude,
      }).session(session);

      if (!travel) {
        await Travel.create(
          [
            {
              order_id: order._id,
              order_cost: order.charges,
              user_id,
              pickup_location: order.pickup_location,
              pickup_latitude: order.sender_latitude,
              pickup_longitude: order.sender_longitude,
            },
          ],
          { session },
        );
      }

      order.pickup_dp_id = user_id;
      order.dp_pickup_time = new Date();
      order.status_completed = "parcel collected";
      order.status = ORDER_STATUS.OUT_FOR_DELIVERY;
      await order.save({ session });
    } else if (
      ["broadcast_dp", "broadcast_pdc"].includes(orderRequest.request_type)
    ) {
      const pickupLat = broadcast?.pickup_latitude || order.sender_latitude;
      const pickupLon = broadcast?.pickup_longitude || order.sender_longitude;
      const pickupLoc = broadcast?.pickup_location || order.pickup_location;

      await Travel.findOneAndUpdate(
        {
          order_id: order._id,
          user_id,
          pickup_latitude: pickupLat,
          pickup_longitude: pickupLon,
        },
        {
          order_cost: order.charges,
          pickup_location: pickupLoc,
        },
        { upsert: true, session },
      );

      if (orderRequest.request_type === "broadcast_pdc") {
        const latestBroadcast = await Broadcast.findOne({ order_id: order._id })
          .sort({ created_at: -1 })
          .session(session);
        if (latestBroadcast) {
          latestBroadcast.status = "1";
          latestBroadcast.status = BROADCAST_STATUS.COMPLETED;
          latestBroadcast.save({ session });
        }
      } else {
        const previousBroadcast = await Broadcast.findOne({
          order_id: order._id,
        })
          .sort({ created_at: -1 })
          .skip(1)
          .session(session);

        if (previousBroadcast) {
          previousBroadcast.status = "1";
          previousBroadcast.status = BROADCAST_STATUS.COMPLETED;
          previousBroadcast.save({ session });
        }

        // Industrial Optimization: Unlock the previous DP who broadcasted this order
        if (broadcast && broadcast.broadcasted_by) {
          await DpDetail.findOneAndUpdate(
            { user_id: broadcast.broadcasted_by },
            { $pull: { active_order_ids: order._id } },
            { session },
          );
        }
      }

      order.status_completed = "parcel collected";
      order.status = ORDER_STATUS.OUT_FOR_DELIVERY;
      await order.save({ session });
    }

    // Notifications logs
    const admin = await User.findOne({ role: ROLES.ADMIN }).session(session);
    let type = "CUSTOMER";
    if (orderRequest.request_type === "direct") {
      await sendNotification({
        role: ROLES.ADMIN,
        title: "Order Update",
        message: `The order of ID : ${order_id} is in transit`,
        orderId: order_id,
        session,
      });
    } else {
      type = "delivery partner";
      await sendNotification({
        role: ROLES.ADMIN,
        title: "Order Update",
        message: `The order of ID : ${order_id} is broadcasted with ID : ${order.broadcast_id}`,
        orderId: order_id,
        session,
      });
    }

    await sendNotification({
      role: ROLES.DP,
      userId: user_id,
      title: "Order Collected",
      message: `You have collected the package from ${type}`,
      orderId: order_id,
      session,
    });

    if (orderRequest.request_type === "direct") {
      await sendNotification({
        role: ROLES.USER,
        userId: order.user_id,
        title: "Order Update",
        message: `Your order of ID : ${order_id} is in transit`,
        orderId: order_id,
        session,
      });
    }

    await session.commitTransaction();
    session.endSession();
    return order;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const dropOrderToCustomer = async (order_id, user_id, drop_otp) => {
  const order = await Order.findById(order_id);
  if (!order) {
    throw new Error("Order not found");
  }

  if (Number(drop_otp) !== Number(order.drop_otp)) {
    throw new Error("Wrong Otp Try Again");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const deliverCharge = await DeliverCharge.findOne({
      vehicle_type: order.mode_of_transport,
    }).session(session);
    let dropWaitingCharge = 0;
    if (order.dp_drop_arrival_time && deliverCharge) {
      const waitTimeMins = Math.floor(
        (new Date() - order.dp_drop_arrival_time) / 60000,
      );
      const gracePeriod = deliverCharge.grace_period || 0;
      let extraMins = 0;

      if (waitTimeMins > gracePeriod) {
        extraMins = waitTimeMins - gracePeriod;
        dropWaitingCharge = extraMins * (deliverCharge.extra_min_charge || 0);
      }

      await OrderWaitCharge.findOneAndUpdate(
        { order_id },
        {
          $set: {
            order_id,
            user_id: order.user_id,
            delivery_dp_id: user_id,
            drop_otp_verified_time: new Date(),
            drop_grace_period: gracePeriod,
            drop_total_wait_mins: waitTimeMins,
            drop_extra_mins: extraMins,
            drop_rate_per_min: deliverCharge.extra_min_charge || 0,
            drop_waiting_charge: dropWaitingCharge,
          },
        },
        { upsert: true, session },
      );

      // Credit 100% of drop waiting charge to THIS drop DP's payout (use $inc to safely accumulate)
      if (dropWaitingCharge > 0) {
        await DpPayout.findOneAndUpdate(
          { order_id: order._id, dp_auth_id: user_id },
          { $inc: { waiting_charge_earning: dropWaitingCharge } },
          { upsert: false, session },
        );
      }
    }

    // Process Wallet Deduction and Payment Status
    const waitChargeDoc = await OrderWaitCharge.findOne({ order_id }).session(
      session,
    );
    if (waitChargeDoc) {
      const totalCharge =
        (waitChargeDoc.pickup_waiting_charge || 0) +
        (waitChargeDoc.drop_waiting_charge || 0);
      waitChargeDoc.total_waiting_charge = totalCharge;

      if (totalCharge > 0) {
        const userWallet = await Wallet.findOne({
          user_id: order.user_id,
        }).session(session);
        if (userWallet && userWallet.balance >= totalCharge) {
          userWallet.balance -= totalCharge;
          await userWallet.save({ session });

          await WalletTransaction.create(
            [
              {
                wallet_id: userWallet._id,
                amount: totalCharge,
                type: "debit",
                description: `Auto-deducted waiting charges for Order #${order._id}`,
                transaction_type: "waiting_charge",
                reference_id: order._id,
                status: PAYOUT_STATUS.COMPLETED,
              },
            ],
            { session },
          );

          waitChargeDoc.payment_status = "paid";
          waitChargeDoc.payment_method = "wallet";
        } else {
          waitChargeDoc.payment_status = "unpaid";
          waitChargeDoc.payment_method = null;
        }
      } else {
        waitChargeDoc.payment_status = "paid";
      }
      await waitChargeDoc.save({ session });
    }

    order.delivery_dp_id = user_id;
    order.status_completed = ORDER_STATUS.DELIVERED;
    order.status = ORDER_STATUS.DELIVERED;
    order.dp_deliver_time = new Date();
    await order.save({ session });

    const broadcast = order.broadcast_id
      ? await Broadcast.findById(order.broadcast_id).session(session)
      : null;
    if (broadcast) {
      broadcast.status = "1";
      broadcast.status = BROADCAST_STATUS.COMPLETED;
      await broadcast.save({ session });
    }

    const newInstanceOfOrder = await Order.findById(order._id).session(session);

    // Update DpDetail location to final destination
    await DpDetail.findOneAndUpdate(
      { user_id },
      {
        location: order.drop_location,
        latitude: order.receiver_latitude,
        longitude: order.receiver_longitude,
        geo_location: {
          type: "Point",
          coordinates: [order.receiver_longitude, order.receiver_latitude],
        },
      },
      { session },
    );

    const orderRequest = await OrderRequest.findOne({
      order_id: order._id,
      status: ORDER_REQUEST_STATUS.ACCEPTED,
    })
      .sort({ created_at: -1 })
      .session(session);
    orderRequest.complete_status = ORDER_REQUEST_COMPLETE_STATUS.COMPLETED;
    await orderRequest.save({ session });

    // Unlock the DP by removing this order from their active array
    await DpDetail.findOneAndUpdate(
      { user_id },
      { $pull: { active_order_ids: order_id } },
      { session },
    );

    const travel = await Travel.findOne({ order_id, user_id })
      .sort({ created_at: -1 })
      .session(session);

    if (travel) {
      const chargeConfig = await DeliverCharge.findOne({
        vehicle_type: order.mode_of_transport,
      }).session(session);
      const mode =
        order.mode_of_transport === "By Hand" ? "walking" : "driving";
      const distance = await mapsService.distanceBetween(
        travel.pickup_latitude,
        travel.pickup_longitude,
        order.receiver_latitude,
        order.receiver_longitude,
        mode,
      );
      const distanceValue = parseFloat(distance) || 0;

      let earning = 0;

      if (orderRequest.request_type === "direct") {
        const perKmPrice =
          chargeConfig && chargeConfig.dp_commission != null
            ? chargeConfig.dp_commission
            : 70;
        earning = Math.round(order.charges * (perKmPrice / 100) * 100) / 100;
      } else {
        const percentage =
          chargeConfig && chargeConfig.dp_commission != null
            ? chargeConfig.dp_commission / 100
            : 0.7;
        const totalDpPot = Math.round(order.charges * percentage * 100) / 100;

        const previousPayouts = await DpPayout.find({
          order_id: order._id,
        }).session(session);
        const sumPrev = previousPayouts
          .filter((p) => p.travel_id !== travel._id)
          .reduce((acc, curr) => acc + curr.earnings, 0);

        earning = Math.max(0, Math.round((totalDpPot - sumPrev) * 100) / 100);
      }

      travel.drop_location = order.drop_location;
      travel.drop_latitude = order.receiver_latitude;
      travel.drop_longitude = order.receiver_longitude;
      travel.distance = Math.round(distanceValue * 1000) / 1000;
      travel.earnings = earning;
      await travel.save({ session });

      await DpPayout.findOneAndUpdate(
        { travel_id: travel._id },
        {
          dp_auth_id: travel.user_id,
          order_id: order._id,
          broadcast_id: order.broadcast_id || null,
          earnings: earning,
        },
        { upsert: true, session },
      );
    }

    // PDC Payout Split calculation
    const pdcChargeConfig = await DeliverCharge.findOne({
      vehicle_type: order.mode_of_transport,
    }).session(session);
    const pdcPercentage =
      pdcChargeConfig && pdcChargeConfig.pdc_commission != null
        ? pdcChargeConfig.pdc_commission / 100
        : 0.05;
    const totalPdcPot = Math.round(order.charges * pdcPercentage * 100) / 100;

    const pdcPackages = await PdcPackage.find({ order_id: order._id }).session(
      session,
    );
    const pkgPdcIds = pdcPackages.map((p) => p.pdc_id);

    const broadcasts = await Broadcast.find({ order_id: order._id }).session(
      session,
    );
    const broadcastPdcIds = broadcasts
      .filter((b) => b.broadcasted_by)
      .map((b) => b.broadcasted_by);

    const uniquePdcIds = Array.from(
      new Set([...pkgPdcIds, ...broadcastPdcIds]),
    );
    // Exclude DPs/Customers if they accidentally appear as broadcaster
    const validPdcUsers = await User.find({
      _id: { $in: uniquePdcIds },
      role: ROLES.PDC,
    }).session(session);
    const validPdcIds = validPdcUsers.map((u) => u._id);

    const pdcCount = validPdcIds.length;

    if (pdcCount > 0) {
      const sharePerPdc = Math.round((totalPdcPot / pdcCount) * 100) / 100;
      let distributed = 0;

      for (let i = 0; i < pdcCount; i++) {
        const pdcId = validPdcIds[i];
        const isLast = i === pdcCount - 1;
        const thisShare = isLast
          ? Math.round((totalPdcPot - distributed) * 100) / 100
          : sharePerPdc;

        await PdcPackage.findOneAndUpdate(
          { order_id: order._id, pdc_id: pdcId },
          { earnings: thisShare },
          { upsert: true, session },
        );

        await PdcPayout.findOneAndUpdate(
          { order_id: order._id, pdc_auth_id: pdcId }, // key fields
          {
            pdc_auth_id: pdcId,
            earnings: thisShare,
            pdc_package_id: order.package_id,
            broadcast_id: order.broadcast_id || null,
          },
          { upsert: true, session },
        );

        distributed += thisShare;
      }
    }

    const latestLeg = await OrderRequest.findOne({ order_id: order._id })
      .sort({ created_at: -1 })
      .session(session);
    if (latestLeg) {
      latestLeg.complete_status = ORDER_REQUEST_COMPLETE_STATUS.COMPLETED;
      await latestLeg.save({ session });
    }

    // Notifications
    const admin = await User.findOne({ role: ROLES.ADMIN }).session(session);

    await sendNotification({
      role: ROLES.USER,
      userId: order.user_id,
      title: "Order Delivered",
      message: `Successfully delivered the order number ${order._id} to ${order.receiver_name}`,
      orderId: order._id,
      session,
    });

    await sendNotification({
      role: ROLES.ADMIN,
      title: `Order Id ${order._id} Delivered`,
      message: `Successfully delivered the order number ${order._id} to ${order.receiver_name}`,
      orderId: order._id,
      session,
    });

    await sendNotification({
      role: ROLES.DP,
      userId: user_id,
      title: "Order Delivered",
      message: `You Delivered the order number ${order._id} to ${order.receiver_name}`,
      orderId: order._id,
      session,
    });

    await session.commitTransaction();
    session.endSession();
    return { message: "order Delivered successfully to the receiver" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getOrderHistory = async (user_id) => {
  const reqs = await OrderRequest.find({
    $or: [
      {
        accepted_by: user_id,
        complete_status: ORDER_REQUEST_COMPLETE_STATUS.COMPLETED,
      },
      { rejected_by: user_id },
    ],
  });

  const orderIds = Array.from(new Set(reqs.map((r) => r.order_id)));

  const orders = await Order.find({ _id: { $in: orderIds } });

  const ordersWithEarning = [];
  for (const order of orders) {
    const payout = await DpPayout.findOne({
      order_id: order._id,
      dp_auth_id: user_id,
    });
    const jsonOrder = order.toJSON();
    const packageDetail = order.package_id
      ? await PackageDetail.findById(order.package_id)
      : null;
    jsonOrder.packageDetail = packageDetail ? packageDetail.toJSON() : null;
    // Base delivery commission earned by this DP
    jsonOrder.my_earning = payout ? payout.earnings : 0;
    // 100% waiting charge earned by this DP for this order (pickup wait or drop wait, or both if same DP)
    jsonOrder.waiting_charge_earning = payout
      ? payout.waiting_charge_earning || 0
      : 0;
    // Total = base + waiting
    jsonOrder.total_earning =
      jsonOrder.my_earning + jsonOrder.waiting_charge_earning;

    // Explicitly separate settlement statuses for DP visibility
    jsonOrder.base_settled = payout
      ? payout.settled === PAYOUT_STATUS.COMPLETED || payout.settled === 1
      : false;
    jsonOrder.waiting_charge_settled = payout
      ? payout.waiting_charge_settled === PAYOUT_STATUS.COMPLETED ||
        payout.waiting_charge_settled === 1
      : false;

    ordersWithEarning.push(jsonOrder);
  }

  return ordersWithEarning;
};

export const getTotalOrdersCount = async (user_id) => {
  const acceptorder = await OrderRequest.countDocuments({
    accepted_by: user_id,
    status: ORDER_REQUEST_STATUS.ACCEPTED,
  });
  const rejectorder = await OrderRequest.countDocuments({
    rejected_by: user_id,
  });
  const totalorder = acceptorder + rejectorder;

  const payouts = await DpPayout.find({ dp_auth_id: user_id });
  const totalEarning = payouts.reduce((acc, curr) => acc + curr.earnings, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayPayouts = await DpPayout.find({
    dp_auth_id: user_id,
    created_at: { $gte: todayStart, $lte: todayEnd },
  });
  const todayEarning = todayPayouts.reduce(
    (acc, curr) => acc + curr.earnings,
    0,
  );

  const lastPayout = await DpPayout.findOne({
    dp_auth_id: user_id,
    earnings: { $gt: 0 },
  }).sort({ created_at: -1 });

  return {
    acceptorder,
    rejectorder,
    totalorder,
    totalearning: Math.round(totalEarning * 100) / 100,
    todayearning: Math.round(todayEarning * 100) / 100,
    lastearning: lastPayout ? lastPayout.earnings : 0,
  };
};

export const getEarningHistory = async (userId) => {
  const payouts = await DpPayout.find({ dp_auth_id: userId }).sort({
    created_at: -1,
  });

  const totalEarning = payouts.reduce((acc, curr) => acc + curr.earnings, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayEarning = payouts
    .filter((p) => p.created_at >= todayStart && p.created_at <= todayEnd)
    .reduce((acc, curr) => acc + curr.earnings, 0);

  const payoutDetails = [];

  for (const payout of payouts) {
    const order = await Order.findById(payout.order_id);
    let jsonOrder = { my_role: "unknown" };

    if (order) {
      jsonOrder = order.toJSON();
      const packageDetail = order.package_id
        ? await PackageDetail.findById(order.package_id)
        : null;
      jsonOrder.packageDetail = packageDetail ? packageDetail.toJSON() : null;
      if (String(order.delivery_dp_id) === String(userId)) {
        jsonOrder.my_role = "delivery";
      } else if (String(order.pickup_dp_id) === String(userId)) {
        jsonOrder.my_role = "pickup";
      } else {
        jsonOrder.my_role = "broadcast_partner";
      }
    }
    jsonOrder.my_earning = payout.earnings;

    const travel = await Travel.findOne({
      order_id: payout.order_id,
      user_id: userId,
    });
    if (travel) {
      jsonOrder.pickup_location = travel.pickup_location;
      jsonOrder.sender_latitude = travel.pickup_latitude;
      jsonOrder.sender_longitude = travel.pickup_longitude;
      jsonOrder.drop_location = travel.drop_location;
      jsonOrder.receiver_latitude = travel.drop_latitude;
      jsonOrder.receiver_longitude = travel.drop_longitude;
      jsonOrder.distance = travel.distance;
    }

    payoutDetails.push({
      order_id: payout.order_id,
      payout_id: payout._id,
      travel_id: payout.travel_id,
      created_at: payout.created_at,
      earnings: payout.earnings,
      order: jsonOrder,
      my_role: jsonOrder.my_role,
    });
  }

  return {
    totalEarning: Math.round(totalEarning * 100) / 100,
    todayEarning: Math.round(todayEarning * 100) / 100,
    orderFromDpPayout: payoutDetails,
  };
};

export const toggleOnlineStatus = async (
  user_id,
  online,
  location,
  latitude,
  longitude,
) => {
  await DpDetail.findOneAndUpdate(
    { user_id },
    {
      online,
      location: location || "",
      latitude,
      longitude,
      geo_location: { type: "Point", coordinates: [longitude, latitude] },
    },
  );
  return true;
};

export const editDpProfile = async (user_id, address, profileImgLocalPath) => {
  let profileImgUrl = null;

  if (profileImgLocalPath) {
    const uploadResult = await uploadToCloudinary(
      profileImgLocalPath,
      "dp_profiles",
    );
    profileImgUrl = uploadResult?.secure_url;
  }

  const dpProfile = await DpDetail.findOne({ user_id });
  if (!dpProfile) {
    throw new Error("DP Profile not found");
  }

  dpProfile.address = address;
  if (profileImgUrl) {
    dpProfile.profile_img = profileImgUrl;
  }
  await dpProfile.save();

  return dpProfile;
};

export const rateUser = async (
  order_id,
  from_dp,
  to_user,
  stars,
  message = "",
) => {
  const order = await Order.findById(order_id);
  if (!order) throw new Error("Order not found");

  const user = await User.findById(to_user);
  if (!user) throw new Error("User not found");

  let existingRating = null;
  const ratingData = {
    stars,
    from_dp,
    order_id,
    message,
  };

  if (user.role === ROLES.USER) {
    existingRating = await Rating.findOne({
      order_id: order._id,
      from_dp,
      to_customer: user._id,
    });
    ratingData.to_customer = user._id;
  } else if (user.role === ROLES.PDC) {
    existingRating = await Rating.findOne({
      order_id: order._id,
      from_dp,
      to_pdc: user._id,
    });
    ratingData.to_pdc = user._id;
  } else if (user.role === ROLES.DP) {
    existingRating = await Rating.findOne({
      order_id: order._id,
      from_dp,
      to_dp: user._id,
    });
    ratingData.to_dp = user._id;
  }

  if (!existingRating) {
    const rating = await Rating.create(ratingData);
    return {
      code: 200,
      rating,
      message: `You have rated ${user.name} successfully.`,
    };
  }

  return { code: 200, message: "You have already rated this customer." };
};

export const getDocuments = async (user_id) => {
  const doc = await DpDocument.findOne({ user_id }).lean();

  if (!doc) {
    return {
      adhar_status: DOCUMENT_APPROVAL_STATUS.PENDING,
      adhar_reject_reason: null,
      rc_status: DOCUMENT_APPROVAL_STATUS.PENDING,
      rc_reject_reason: null,
      dl_status: DOCUMENT_APPROVAL_STATUS.PENDING,
      dl_reject_reason: null,
      bank_status: DOCUMENT_APPROVAL_STATUS.PENDING,
      bank_reject_reason: null,
      rv_status: DOCUMENT_APPROVAL_STATUS.PENDING,
      rv_reject_reason: null,
    };
  }

  return {
    adhar_status: doc.adhar_status || DOCUMENT_APPROVAL_STATUS.PENDING,
    adhar_reject_reason: doc.adhar_reject_reason || null,
    rc_status: doc.rc_status || DOCUMENT_APPROVAL_STATUS.PENDING,
    rc_reject_reason: doc.rc_reject_reason || null,
    dl_status: doc.dl_status || DOCUMENT_APPROVAL_STATUS.PENDING,
    dl_reject_reason: doc.dl_reject_reason || null,
    bank_status: doc.bank_status || DOCUMENT_APPROVAL_STATUS.PENDING,
    bank_reject_reason: doc.bank_reject_reason || null,
    rv_status: doc.rv_status || DOCUMENT_APPROVAL_STATUS.PENDING,
    rv_reject_reason: doc.rv_reject_reason || null,
  };
};

export const getDocumentVerificationStatus = async (dp_id) => {
  const dp = await User.findById(dp_id);
  const dpDetail = await DpDetail.findOne({ user_id: dp_id });
  const dpDocument = await DpDocument.findOne({ user_id: dp_id });

  // Fetch detailed document statuses
  const documentStatus = await getDocuments(dp_id);

  if (!dpDetail || !dpDocument) {
    return {
      status: 400,
      dp,
      argumnet1: false,
      argumnet2: false,
      argumnet3: false,
      argumnet4: false,
      message: "dp document or details are not submit yet",
      document_status: documentStatus,
    };
  }

  if (dpDetail.document_approval === DOCUMENT_APPROVAL_STATUS.APPROVED) {
    return {
      status: 200,
      dp,
      argumnet1: true,
      argumnet2: true,
      argumnet3: true,
      argumnet4: true,
      message: "go to home page",
      document_status: documentStatus,
    };
  }

  let argumnet1 = false;
  let argumnet2 = false;
  let argumnet3 = false;
  let argumnet4 = false;

  if (dpDetail.profile_img) {
    argumnet1 = true;
    if (dpDocument.vehicle_type) {
      argumnet2 = true;
      if (dpDocument.reference2_name) {
        argumnet3 = true;
      }
      if (dpDetail.document_approval === DOCUMENT_APPROVAL_STATUS.APPROVED) {
        argumnet4 = true;
      }
    }
  }

  return {
    status: 200,
    argumnet1,
    argumnet2,
    argumnet3,
    argumnet4,
    dp,
    message: "document verify page",
    document_status: documentStatus,
  };
};

export const getDropOtpDetails = async (orderId) => {
  const order = await Order.findById(orderId).select("drop_otp receiver_phone");
  if (!order) throw new Error("Order not found");
  return order;
};

export const respondToBundle = async (dp_id, bundle_id, response) => {
  const bundle = await OrderBundle.findOne({ bundle_id });
  if (!bundle) throw new Error("Bundle not found");
  const dpExist = await User.findOne({ _id: dp_id, role: ROLES.DP });
  if (!dpExist) throw new Error("Delivery partner not found");
  if (bundle.status !== BROADCAST_STATUS.BROADCASTING) {
    throw new Error(`Cannot respond because bundle status is ${bundle.status}`);
  }
  if (bundle.rejected_dps.includes(dp_id)) {
    throw new Error("You have already rejected this bundle.");
  }

  if (bundle.accepted_dps.includes(dp_id)) {
    throw new Error("You have already accepted this bundle.");
  }

  if (response === "accept" && bundle.notified_dps.includes(dp_id)) {
    bundle.accepted_dps.push(dp_id);
  } else if (response === "reject" && bundle.notified_dps.includes(dp_id)) {
    bundle.rejected_dps.push(dp_id);
  } else {
    throw new Error("Invalid response");
  }

  await bundle.save();

  // Notify admin real-time
  broadcastToAdmins("BUNDLE_DP_RESPONDED", {
    bundle_id,
    dp_id,
    response,
  });

  return { message: `Successfully ${response}ed the bundle` };
};

export const resendPickupOtp = async (orderId, dpId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const orderRequest = await OrderRequest.findOne({
    order_id: orderId,
    accepted_by: dpId,
  }).sort({ created_at: -1 });
  if (!orderRequest) {
    throw new Error("Not authorized to resend OTP for this order");
  }

  const newOtp = Math.floor(1000 + Math.random() * 9000);

  if (orderRequest.request_type === "direct") {
    order.pickup_otp = newOtp;
    await order.save();
  } else {
    const broadcast = await Broadcast.findById(orderRequest.broadcast_id);
    if (!broadcast) throw new Error("Broadcast not found");
    broadcast.pickup_otp = newOtp;
    await broadcast.save();
  }

  const message = `Your CountMee pickup OTP for Order #${order._id} is ${newOtp}`;
  sendOTPViaSMS(order.sender_phone, message).catch((err) => console.error("SMS Failed:", err.message));

  return { message: "Pickup OTP resent to sender" };
};

export const resendReceiverOtp = async (orderId, dpId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const orderRequest = await OrderRequest.findOne({
    order_id: orderId,
    accepted_by: dpId,
  }).sort({ created_at: -1 });
  if (!orderRequest) {
    throw new Error("Not authorized to resend OTP for this order");
  }

  const newOtp = Math.floor(1000 + Math.random() * 9000);
  order.drop_otp = newOtp;
  await order.save();

  const message = `Your CountMee delivery verification code is ${newOtp}`;
  sendOTPViaSMS(order.receiver_phone, message).catch((err) => console.error("SMS Failed:", err.message));

  return { message: "Delivery OTP resent to receiver" };
};

export const findNearestPdc = async (
  latitude,
  longitude,
  order,
  maxDistanceKm,
) => {
  const pdcs = await PdcDocument.find({ online: true });
  if (!pdcs || pdcs.length === 0) {
    return [];
  }

  const origin = `${latitude},${longitude}`;
  const destination = `${order.receiver_latitude},${order.receiver_longitude}`;
  const maxRadiusMeters = maxDistanceKm * 1000;

  const pdcsAlongRoute = await mapsService.pdcAlongWay(
    pdcs,
    origin,
    destination,
    maxRadiusMeters,
  );

  if (typeof pdcsAlongRoute === "string") {
    console.error("pdcAlongWay error:", pdcsAlongRoute);
    return [];
  }

  const results = [];
  for (const pdc of pdcsAlongRoute) {
    const distanceText = await mapsService.distanceBetween(
      latitude,
      longitude,
      pdc.latitude,
      pdc.longitude,
    );
    results.push({
      ...pdc.toObject(),
      distance: distanceText,
    });
  }

  results.sort((a, b) => {
    const distA = parseFloat(a.distance) || 0;
    const distB = parseFloat(b.distance) || 0;
    return distA - distB;
  });

  return results;
};

export const checkNearbyDps = async (radius, broadcastId, userId) => {
  const broadcast = await Broadcast.findById(broadcastId);
  if (!broadcast) return [];

  const order = await Order.findById(broadcast.order_id);
  if (!order) return [];

  // 1. Get old broadcasts to exclude those DPs immediately
  const oldBroadcasts = await Broadcast.find({ order_id: order._id });
  const oldDpsArray = oldBroadcasts
    .map((b) => b.broadcasted_by?.toString())
    .filter(Boolean);
  oldDpsArray.push(userId.toString()); // Exclude the PDC broadcasting it

  // Convert old DP strings to ObjectIds for the MongoDB $nin aggregation
  const excludedObjectIds = oldDpsArray.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // 2. Perform ultra-fast single aggregation pipeline
  const nearestDpsAgg = await DpDetail.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [broadcast.pickup_longitude, broadcast.pickup_latitude],
        },
        distanceField: "distance_meters",
        maxDistance: radius,
        spherical: true,
      },
    },
    {
      $match: {
        online: true,
        user_id: { $nin: excludedObjectIds },
        $or: [
          { active_order_ids: { $exists: false } },
          { active_order_ids: { $size: 0 } },
        ], // Industrial Optimization: O(1) busy check (handles legacy docs too)
      },
    },
    // 3. Lookup vehicle type natively in DB
    {
      $lookup: {
        from: "dpdocuments",
        localField: "user_id",
        foreignField: "user_id",
        as: "dpDocument",
      },
    },
    { $unwind: { path: "$dpDocument", preserveNullAndEmptyArrays: false } },
    {
      $match: {
        "dpDocument.vehicle_type": order.mode_of_transport,
      },
    },
  ]);

  return nearestDpsAgg.map((dp) => dp.user_id);
};

export const findPdcInRouteService = async (
  pickup_lat,
  pickup_lng,
  drop_lat,
  drop_lng,
) => {
  // Padding of 0.05 degrees is roughly 5.5km padding around the bounding box
  const padding = 0.05;
  const minLng = Math.min(Number(pickup_lng), Number(drop_lng)) - padding;
  const maxLng = Math.max(Number(pickup_lng), Number(drop_lng)) + padding;
  const minLat = Math.min(Number(pickup_lat), Number(drop_lat)) - padding;
  const maxLat = Math.max(Number(pickup_lat), Number(drop_lat)) + padding;

  // Ultra-fast MongoDB $geoWithin bounding box query
  const warehouses = await PdcDocument.find({
    online: true,
    geo_location: {
      $geoWithin: {
        $box: [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
      },
    },
  });

  const warehousesInRoute = [];
  const totalRouteDistance =
    mapsService.haversineGreatCircleDistance(
      Number(pickup_lat),
      Number(pickup_lng),
      Number(drop_lat),
      Number(drop_lng),
    ) / 1000;

  for (const pdc of warehouses) {
    // Only proceed if latitude and longitude exist
    if (!pdc.latitude || !pdc.longitude) continue;

    const distanceToPickup =
      mapsService.haversineGreatCircleDistance(
        Number(pickup_lat),
        Number(pickup_lng),
        pdc.latitude,
        pdc.longitude,
      ) / 1000;

    const distanceToDrop =
      mapsService.haversineGreatCircleDistance(
        Number(drop_lat),
        Number(drop_lng),
        pdc.latitude,
        pdc.longitude,
      ) / 1000;

    const threshold = 1.0; // 1km threshold deviation
    if (
      Math.abs(distanceToPickup + distanceToDrop - totalRouteDistance) <
      threshold
    ) {
      warehousesInRoute.push(pdc);
    }
  }

  return warehousesInRoute;
};
