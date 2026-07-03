import bcrypt from 'bcryptjs';
import * as pdcRepository from './pdc.repository.js';
import { User } from '../users/user.model.js';
import { PdcDocument } from './pdcDocument.model.js';
import { PdcPayout } from './pdcPayout.model.js';
import { PdcAssignedOrder } from './pdcAssignedOrder.model.js';
import { PdcPackage } from './pdcPackage.model.js';
import { Order } from '../orders/order.model.js';
import { OrderRequest } from '../orders/orderRequest.model.js';
import { Broadcast } from '../orders/broadcast.model.js';
import { PackageDetail } from '../orders/packageDetail.model.js';
import { Rating } from '../deliveryPartner/rating.model.js';
import { DpDetail } from '../deliveryPartner/dpDetail.model.js';
import { Notification } from '../notifications/notification.model.js';
import { uploadToCloudinary } from '../../common/services/cloudinary.service.js';
import { getLatLongFromAddress, distanceBetween } from '../tracking/maps.service.js';
import { sendNotification } from '../../common/utils/sendNotification.js';
import { ROLES, ORDER_STATUS, ORDER_REQUEST_STATUS } from '../../constants/index.js';
import * as dpService from '../deliveryPartner/dp.service.js';
import * as adminService from '../admin/admin.service.js';
import { getAgenda } from '../../common/services/agenda.service.js';

export const register = async (name, email, phone, password, fcmToken) => {
  const existingUser = await pdcRepository.findUserByPhone(phone);
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await pdcRepository.createUser({
    name,
    email,
    phone,
    password: hashedPassword,
    fcm_tokens: fcmToken ? [fcmToken] : []
  });

  const pdc = await pdcRepository.createPdcDocument({
    user_id: user._id,
    phone
  });

  await sendNotification({
    role: ROLES.ADMIN,
    title: 'New PDC Registered',
    message: `${name} has registered as a Pickup & Delivery Center`,
  });

  await sendNotification({
    role: ROLES.PDC,
    userId: user._id,
    title: 'Welcome to CountMee',
    message: 'Your PDC account has been registered successfully',
  });

  return { user, pdc };
};

export const login = async (phone, password, fcmToken) => {
  const user = await pdcRepository.findUserByPhone(phone);
  if (!user) {
    throw new Error('User not registered. Please register first.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid phone number or password');
  }

  if (fcmToken) {
    if (!user.fcm_tokens) user.fcm_tokens = [];
    if (!user.fcm_tokens.includes(fcmToken)) {
      user.fcm_tokens.push(fcmToken);
    }
    await user.save();
  }

  // Populate virtuals
  const userWithDoc = await pdcRepository.findUserById(user._id);
  return userWithDoc;
};

export const getPdcDocument = async (userId) => {
  return await pdcRepository.findPdcDocumentByUserId(userId);
};

export const getPdcDocumentById = async (id) => {
  return await pdcRepository.findPdcDocumentById(id);
};

export const updateInnerForm = async (userId, name, email, phone) => {
  const editUser = await pdcRepository.updateUser(userId, { name, email, phone });
  if (!editUser) {
    throw new Error('User not found');
  }

  let pdcDoc = await pdcRepository.findPdcDocumentByUserId(userId);
  const pdcUpdateData = { email, phone };

  if (!pdcDoc) {
    pdcDoc = await pdcRepository.createPdcDocument({
      user_id: userId,
      email,
      phone
    });
  } else {
    pdcDoc = await pdcRepository.updatePdcDocumentByUserId(userId, pdcUpdateData);
  }

  return pdcDoc;
};

export const submitDocuments = async (userId, bodyData, files) => {
  const pdc = await pdcRepository.findPdcDocumentByUserId(userId);
  if (!pdc) {
    throw new Error('PDC record not found');
  }

  const fileFields = [
    'gst_doc',
    'aadhar_front_image',
    'aadhar_back_image',
    'pancard_image',
    'passbook_image',
    'profile_image',
    'shop_image'
  ];

  const uploadResults = {};

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      const uploadResult = await uploadToCloudinary(fileObj.path, 'pdc_documents');
      if (uploadResult) {
        uploadResults[field] = uploadResult.secure_url;
      }
    }
  }

  // Strictly require latitude and longitude from the frontend
  let latitude = pdc.latitude;
  let longitude = pdc.longitude;

  // Check if address changed
  const addressChanged =
    bodyData.address_changed === '1' ||
    bodyData.address !== pdc.address ||
    bodyData.city !== pdc.city ||
    bodyData.district !== pdc.district ||
    bodyData.state !== pdc.state ||
    bodyData.pincode !== pdc.pincode;

  if (addressChanged || !latitude || !longitude) {
    const fullAddressParts = [
      bodyData.address?.trim(),
      bodyData.city?.trim(),
      bodyData.district?.trim(),
      bodyData.state?.trim(),
      bodyData.pincode?.trim()
    ].filter(Boolean);

    const fullAddress = fullAddressParts.join(', ');
    
    if (fullAddress) {
      const [newLat, newLng] = await getLatLongFromAddress(fullAddress);
      if (newLat !== null && newLng !== null) {
        latitude = newLat;
        longitude = newLng;
      }
    }
  }

  // Final check to make sure we have some coordinates
  if (!latitude || !longitude) {
    if (bodyData.latitude && bodyData.longitude) {
      latitude = Number(bodyData.latitude);
      longitude = Number(bodyData.longitude);
    } else {
      throw new Error('Could not calculate exact location from address. Please ensure your address is accurate.');
    }
  }

  const updateData = {
    gst_no: bodyData.gst_no || null,
    aadhar_card_no: bodyData.aadhar_card_no || null,
    pan_card_no: bodyData.pan_card_no || null,
    account_no: bodyData.account_no || null,
    ifsc: bodyData.ifsc || null,
    pincode: bodyData.pincode || null,
    city: bodyData.city || null,
    district: bodyData.district || null,
    state: bodyData.state || null,
    address: bodyData.address || null,
    latitude,
    longitude,
    geo_location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
    ...uploadResults
  };

  console.log("==== DEBUG: SUBMIT DOCUMENTS ====");
  console.log("Received bodyData:", bodyData);
  console.log("Received uploadResults:", uploadResults);
  console.log("Final updateData to save:", updateData);

  await pdcRepository.updatePdcDocumentByUserId(userId, { $set: updateData });
  return true;
};

export const getDashboardData = async (userId) => {
  // 1. Orders relevant to this PDC (Notified OR Already Accepted)
  const orderRequests = await OrderRequest.find({
    $or: [
      { notified_ids: userId },
      { accepted_by: userId }
    ],
    status: { $in: [ORDER_REQUEST_STATUS.PENDING, ORDER_REQUEST_STATUS.REJECTED, ORDER_REQUEST_STATUS.ACCEPTED, '0', '1'] }
  });

  const orderRelevantIds = Array.from(new Set(orderRequests.map(r => r.order_id.toString())));

  // IDs of ALL orders ever broadcasted by THIS PDC
  const broadcasts = await Broadcast.find({ broadcasted_by: userId });
  const allBroadcastedIds = broadcasts.map(b => b.order_id.toString());

  // IDs of orders currently being broadcasted (waiting for DP, status Active, Broadcasting, or Pending)
  const currentlyBroadcastingIds = broadcasts
    .filter(b => b.status === "Pending" || b.status === "Active" || b.status === "Broadcasting")
    .map(b => b.order_id.toString());

  // Orders To Receive = Relevant minus ANY that have been broadcasted
  const ordersToReceiveIds = orderRelevantIds.filter(id => !allBroadcastedIds.includes(id));

  const ordersReceive = await Order.find({ _id: { $in: ordersToReceiveIds } });

  const ordersToReceive = [];
  for (const order of ordersReceive) {
    const customer = order.user_id ? await User.findById(order.user_id) : null;
    const packageDetail = order.package_id ? await PackageDetail.findById(order.package_id) : null;
    const broadcast = order.broadcast_id ? await Broadcast.findById(order.broadcast_id) : null;

    const allRequests = await OrderRequest.find({ order_id: order._id })
      .sort({ created_at: -1 });

    const allRequestsPopulated = [];
    for (const req of allRequests) {
      const reqObj = req.toObject();
      const reqDp = req.accepted_by ? await User.findById(req.accepted_by) : null;
      const reqDpLocation = req.accepted_by ? await DpDetail.findOne({ user_id: req.accepted_by }) : null;
      const reqBroadcast = req.broadcast_id ? await Broadcast.findById(req.broadcast_id) : null;

      reqObj.dp = reqDp ? reqDp.toObject() : null;
      reqObj.dpLocation = reqDpLocation ? reqDpLocation.toObject() : null;
      reqObj.broadcast = reqBroadcast ? reqBroadcast.toObject() : null;
      allRequestsPopulated.push(reqObj);
    }

    let targetReq = null;
    const customerId = order.user_id;

    for (const req of allRequestsPopulated) {
      if (req.accepted_by && req.accepted_by.toString() !== customerId.toString() && req.accepted_by.toString() !== userId.toString()) {
        targetReq = req;
        break;
      }
      if (req.requested_by && req.requested_by.toString() !== customerId.toString() && req.requested_by.toString() !== userId.toString()) {
        targetReq = req;
        break;
      }
    }

    if (!targetReq) {
      targetReq = allRequestsPopulated[0] || null;
    }

    let effectiveDp = null;
    let effectiveDpLoc = null;
    if (targetReq) {
      if (targetReq.accepted_by) {
        effectiveDp = targetReq.dp;
        effectiveDpLoc = targetReq.dpLocation;
      } else {
        effectiveDp = await User.findById(targetReq.requested_by);
        effectiveDpLoc = await DpDetail.findOne({ user_id: targetReq.requested_by });
      }
    }

    const dpProfileImg = (effectiveDpLoc && effectiveDpLoc.profile_img) ? effectiveDpLoc.profile_img : '1740041839_order_image1.jpg';

    let stars = 0;
    if (effectiveDp) {
      const ratingAvg = await Rating.aggregate([
        { $match: { to_dp: effectiveDp._id } },
        { $group: { _id: null, avgStars: { $avg: "$stars" } } }
      ]);
      stars = (ratingAvg.length > 0) ? ratingAvg[0].avgStars : 0;
    }

    const fullStars = Math.floor(stars);
    const halfStar = (stars - fullStars) > 0 ? 1 : 0;
    const blankStars = 5 - fullStars - halfStar;

    const jsonOrder = order.toJSON();
    jsonOrder.customer = customer ? customer.toJSON() : null;
    jsonOrder.packageDetail = packageDetail ? packageDetail.toJSON() : null;
    jsonOrder.broadcast = broadcast ? broadcast.toJSON() : null;
    jsonOrder.orderReq = targetReq;
    jsonOrder.effectiveDp = effectiveDp ? (effectiveDp.toJSON ? effectiveDp.toJSON() : effectiveDp) : null;
    jsonOrder.effectiveDpLoc = effectiveDpLoc ? (effectiveDpLoc.toJSON ? effectiveDpLoc.toJSON() : effectiveDpLoc) : null;
    jsonOrder.dpProfileImg = dpProfileImg;
    jsonOrder.stars = stars;
    jsonOrder.fullStars = fullStars;
    jsonOrder.halfStar = halfStar;
    jsonOrder.blankstars = blankStars; // Match lower case used in some templates
    console.log(`[DEBUG Dashboard] Order ${order._id}: effectiveDp = ${jsonOrder.effectiveDp ? 'EXISTS' : 'NULL'}, effectiveDpLoc = ${jsonOrder.effectiveDpLoc ? 'EXISTS' : 'NULL'}`);
    ordersToReceive.push(jsonOrder);
  }

  // 2. Orders already broadcasted by this PDC (waiting for another DP)
  const ordersBroadcast = await Order.find({ _id: { $in: currentlyBroadcastingIds } });

  const broadcastedOrders = [];
  for (const order of ordersBroadcast) {
    const customer = order.user_id ? await User.findById(order.user_id) : null;
    const packageDetail = order.package_id ? await PackageDetail.findById(order.package_id) : null;
    const pdcBroadcast = await Broadcast.findOne({
      order_id: order._id,
      broadcasted_by: userId
    }).sort({ created_at: -1 });

    if (pdcBroadcast) {
      const dpIds = [];
      if (pdcBroadcast.pickup_dp_id) {
        dpIds.push(pdcBroadcast.pickup_dp_id);
      }

      const acceptedReqs = await OrderRequest.find({
        order_id: order._id,
        broadcast_id: pdcBroadcast._id,
        status: ORDER_REQUEST_STATUS.ACCEPTED
      });

      acceptedReqs.forEach(req => {
        if (req.accepted_by) {
          dpIds.push(req.accepted_by);
        }
      });

      const uniqueDpIds = Array.from(new Set(dpIds)).filter(id => id !== userId && id !== order.user_id);

      const dpUsers = await User.find({ _id: { $in: uniqueDpIds } });
      const dpDetails = await DpDetail.find({ user_id: { $in: uniqueDpIds } });

      const dpUsersList = [];
      for (const dpUser of dpUsers) {
        const dpDetail = dpDetails.find(d => d.user_id.toString() === dpUser._id.toString()) || null;
        const dpProfileImg = (dpDetail && dpDetail.profile_img) ? dpDetail.profile_img : 'deliverypartner.jpg';

        let stars = 0;
        const ratingAvg = await Rating.aggregate([
          { $match: { to_dp: dpUser._id } },
          { $group: { _id: null, avgStars: { $avg: "$stars" } } }
        ]);
        stars = (ratingAvg.length > 0) ? ratingAvg[0].avgStars : 0;

        const fullStars = Math.floor(stars);
        const halfStar = (stars - fullStars) > 0 ? 1 : 0;
        const blankStars = 5 - fullStars - halfStar;

        const userJson = dpUser.toJSON();
        userJson.dpDetail = dpDetail ? dpDetail.toJSON() : null;
        userJson.dpProfileImg = dpProfileImg;
        userJson.stars = stars;
        userJson.fullStars = fullStars;
        userJson.halfStar = halfStar;
        userJson.blankStars = blankStars;
        dpUsersList.push(userJson);
      }

      const jsonBroadcast = pdcBroadcast.toJSON();
      jsonBroadcast.dpUsersList = dpUsersList;

      const jsonOrder = order.toJSON();
      jsonOrder.customer = customer ? customer.toJSON() : null;
      jsonOrder.packageDetail = packageDetail ? packageDetail.toJSON() : null;
      jsonOrder.broadcast = jsonBroadcast;
      broadcastedOrders.push(jsonOrder);
    }
  }

  // Count metrics
  const totalOrders = await OrderRequest.countDocuments({
    accepted_by: userId
  });

  const pendingOrders = ordersToReceive.length + broadcastedOrders.length;

  const pdcPayouts = await PdcPayout.find({ pdc_auth_id: userId })
    .populate('order_id')
    .sort({ created_at: -1 });

  // Group payouts by order_id
  const groupedPayouts = {};
  pdcPayouts.forEach(p => {
    const obj = p.toObject();
    obj.order = obj.order_id;
    if (obj.order_id && obj.order_id._id) {
      obj.order_id = obj.order_id._id;
    }
    const key = obj.order_id.toString();
    if (!groupedPayouts[key]) {
      groupedPayouts[key] = [];
    }
    groupedPayouts[key].push(obj);
  });

  return {
    ordersToReceive,
    broadcastedOrders,
    totalOrders,
    pendingOrders,
    pdcPayouts: groupedPayouts
  };
};

export const getEarnings = async (userId) => {
  const payouts = await PdcPayout.find({ pdc_auth_id: userId, settled: 0 });
  const totalEarning = payouts.reduce((acc, curr) => acc + curr.earnings, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayEarningsRaw = await PdcPayout.find({
    pdc_auth_id: userId,
    settled: 0,
    created_at: { $gte: todayStart, $lte: todayEnd }
  });

  const todayEarnings = [];
  for (const payout of todayEarningsRaw) {
    const dpDoc = await OrderRequest.findOne({
      order_id: payout.order_id,
      request_type: 'deliver to pdc',
      accepted_by: userId
    }).sort({ created_at: -1 });

    let dpObj = null;
    if (dpDoc) {
      dpObj = dpDoc.toObject();
      const requestedUser = dpDoc.requested_by ? await User.findById(dpDoc.requested_by) : null;
      dpObj.requestedUser = requestedUser ? requestedUser.toObject() : null;
    }
    
    const broadcastDoc = await Broadcast.findOne({
      _id: payout.broadcast_id
    });

    let broadcastObj = null;
    if (broadcastDoc) {
      broadcastObj = broadcastDoc.toJSON();
      const dpUser = broadcastDoc.pickup_dp_id ? await User.findById(broadcastDoc.pickup_dp_id) : null;
      broadcastObj.dpUser = dpUser ? dpUser.toJSON() : null;
    }
    
    const payoutJson = payout.toJSON();
    const payoutOrder = payout.order_id ? await Order.findById(payout.order_id) : null;
    if (payoutOrder) {
      const orderObj = payoutOrder.toJSON();
      const packageDetail = payoutOrder.package_id ? await PackageDetail.findById(payoutOrder.package_id) : null;
      orderObj.packageDetail = packageDetail ? packageDetail.toJSON() : null;
      payoutJson.order = orderObj;
    } else {
      payoutJson.order = null;
    }

    payoutJson.dp = dpObj;
    payoutJson.broadcast = broadcastObj;
    todayEarnings.push(payoutJson);
  }

  const pdcPayLast = await PdcPayout.findOne({ pdc_auth_id: userId })
    .sort({ created_at: -1 });

  let pdcPayLastJson = null;
  if (pdcPayLast) {
    pdcPayLastJson = pdcPayLast.toJSON();

    const payoutOrder = pdcPayLast.order_id ? await Order.findById(pdcPayLast.order_id) : null;
    if (payoutOrder) {
      const orderObj = payoutOrder.toJSON();
      const packageDetail = payoutOrder.package_id ? await PackageDetail.findById(payoutOrder.package_id) : null;
      orderObj.packageDetail = packageDetail ? packageDetail.toJSON() : null;
      pdcPayLastJson.order = orderObj;
    } else {
      pdcPayLastJson.order = null;
    }

    let lastDropDp = null;
    let lastBroadcast = null;
    if (pdcPayLastJson.order) {
      const lastDropDpDoc = await OrderRequest.findOne({
        order_id: pdcPayLast.order_id,
        request_type: 'deliver to pdc',
        accepted_by: userId
      }).sort({ created_at: -1 });

      if (lastDropDpDoc) {
        const dpObj = lastDropDpDoc.toObject();
        const requestedUser = lastDropDpDoc.requested_by ? await User.findById(lastDropDpDoc.requested_by) : null;
        dpObj.requestedUser = requestedUser ? requestedUser.toObject() : null;
        lastDropDp = dpObj;
      }

      if (pdcPayLast.broadcast_id) {
        const lastBroadcastDoc = await Broadcast.findOne({
          _id: pdcPayLast.broadcast_id
        });
        if (lastBroadcastDoc) {
          const bObj = lastBroadcastDoc.toJSON();
          const dpUser = lastBroadcastDoc.pickup_dp_id ? await User.findById(lastBroadcastDoc.pickup_dp_id) : null;
          bObj.dpUser = dpUser ? dpUser.toJSON() : null;
          lastBroadcast = bObj;
        }
      }
    }

    pdcPayLastJson.lastDropDp = lastDropDp;
    pdcPayLastJson.broadcast = lastBroadcast;
  }

  return {
    totalEarning: Math.round(totalEarning * 100) / 100,
    todayEarnings,
    lastEarning: pdcPayLastJson ? Math.round((pdcPayLastJson.earnings || 0) * 100) / 100 : 0,
    pdcPayLast: pdcPayLastJson
  };
};

export const getOrderHistory = async (userId) => {
  const reqs = await OrderRequest.find({ accepted_by: userId });
  const acceptedOrderIds = reqs.map(r => r.order_id);

  // According to the new flow: Only show orders in history if the PDC has successfully 
  // broadcasted them and another DP has accepted the broadcast (status != 'Pending' and status != 'Active' and status != 'Broadcasting').
  const successfulBroadcasts = await Broadcast.find({
    broadcasted_by: userId,
    order_id: { $in: acceptedOrderIds },
    status: { $nin: ['Pending', 'Active', 'Broadcasting'] } // Pending/Broadcasting means not yet accepted
  });

  const broadcastedOrderIds = successfulBroadcasts.map(b => b.order_id.toString());

  // We also include orders that might have been completed directly at the PDC 
  const completedOrders = await Order.find({
    _id: { $in: acceptedOrderIds },
    status_completed: "delivered"
  });

  const validOrderIds = [...new Set([...broadcastedOrderIds, ...completedOrders.map(o => o._id.toString())])];

  const orders = await Order.find({ _id: { $in: validOrderIds } })
    .sort({ created_at: -1 });

  const ordersWithEarning = [];
  for (const order of orders) {
    const packageDetail = order.package_id ? await PackageDetail.findById(order.package_id) : null;
    const payout = await PdcPayout.findOne({ pdc_auth_id: userId, order_id: order._id });
    
    // Find delivery partner who delivered to PDC
    const deliveryDpRequest = await OrderRequest.findOne({
      order_id: order._id,
      accepted_by: userId
    });
    
    let deliveryDp = null;
    let deliveryDpLoc = null;
    if (deliveryDpRequest) {
      deliveryDp = deliveryDpRequest.requested_by ? await User.findById(deliveryDpRequest.requested_by) : null;
      if (deliveryDp) {
        deliveryDpLoc = await DpDetail.findOne({ user_id: deliveryDp._id });
      }
    }
    
    // Find delivery partner who picked up from PDC
    const pickupDpRequest = await OrderRequest.findOne({
      order_id: order._id,
      requested_by: userId
    });
    
    let pickupDp = null;
    let pickupDpLoc = null;
    if (pickupDpRequest) {
      pickupDp = pickupDpRequest.accepted_by ? await User.findById(pickupDpRequest.accepted_by) : null;
      if (pickupDp) {
        pickupDpLoc = await DpDetail.findOne({ user_id: pickupDp._id });
      }
    }

    const jsonOrder = order.toJSON();
    jsonOrder.packageDetail = packageDetail ? packageDetail.toJSON() : null;
    jsonOrder.pdcEarning = payout ? [payout] : [];
    jsonOrder.deliveryDp = deliveryDp ? deliveryDp.toJSON() : null;
    jsonOrder.deliveryDpLoc = deliveryDpLoc ? deliveryDpLoc.toJSON() : null;
    jsonOrder.pickupDp = pickupDp ? pickupDp.toJSON() : null;
    jsonOrder.pickupDpLoc = pickupDpLoc ? pickupDpLoc.toJSON() : null;
    
    ordersWithEarning.push(jsonOrder);
  }

  return ordersWithEarning;
};

export const updatePdcStatus = async (id, acceptStatus) => {
  const updateFields = { status: acceptStatus };
  if (acceptStatus === "Approved") {
    updateFields.otp = String(Math.floor(1000 + Math.random() * 9000));
  }

  await PdcAssignedOrder.findByIdAndUpdate(id, updateFields);
  return true;
};

export const toggleOnlineStatus = async (id, online) => {
  await PdcDocument.findByIdAndUpdate(id, { online });
  return true;
};

export const updateLocation = async (userId, locationData) => {
  const pdc = await PdcDocument.findOne({ user_id: userId });
  if (pdc) {
    await PdcDocument.findOneAndUpdate(
      { user_id: userId },
      {
        address: locationData.address || pdc.address,
        city: locationData.city || pdc.city,
        state: locationData.state || pdc.state,
        pincode: locationData.pincode || pdc.pincode,
        latitude: locationData.latitude ? Number(locationData.latitude) : pdc.latitude,
        longitude: locationData.longitude ? Number(locationData.longitude) : pdc.longitude,
        district: locationData.district || pdc.district,
        geo_location: { 
          type: 'Point', 
          coordinates: [
            locationData.longitude ? Number(locationData.longitude) : pdc.longitude, 
            locationData.latitude ? Number(locationData.latitude) : pdc.latitude
          ] 
        }
      }
    );
    return true;
  }
  return false;
};

export const rateDp = async (orderId, fromPdc, toDp, stars, message = '') => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order could not be found');
  }

  const dp = await User.findById(toDp);
  const pdc = await User.findById(fromPdc);

  if (!dp || !pdc) {
    throw new Error('Dp or PDC could not be found');
  }

  const existingRating = await Rating.findOne({
    order_id: orderId,
    from_pdc: fromPdc,
    to_dp: toDp
  });

  if (existingRating) {
    throw new Error('You have already rated ' + dp.name);
  }

  await Rating.create({
    order_id: orderId,
    from_pdc: fromPdc,
    to_dp: toDp,
    stars,
    message
  });

  return dp.name;
};

export const processActionDrop = async (orderId, pdcId, action) => {
  const orderRequest = await OrderRequest.findOne({
    order_id: orderId,
    notified_ids: pdcId,
    request_type: "deliver to pdc",
    status: { $in: [null, "Pending"] }
  });

  if (!orderRequest) {
    throw new Error("Pending drop-off request not found or already processed.");
  }

  // Cancel the agenda job
  const agenda = getAgenda();
  if (agenda) {
    await agenda.cancel({ name: 'auto-accept-pdc', 'data.order_request_id': orderRequest._id.toString() });
  }

  if (action === 'accept') {
    orderRequest.status = ORDER_REQUEST_STATUS.ACCEPTED; // 1
    orderRequest.accepted_by = pdcId;
    await orderRequest.save();

    await sendNotification({
      role: ROLES.DP,
      userId: orderRequest.requested_by,
      title: "Drop-off Accepted",
      message: "The PDC has accepted your drop-off request.",
      orderId: orderId
    });

    return "Drop-off request accepted successfully";
  } else {
    // action === 'reject'
    orderRequest.status = "Rejected"; // rejected/cancelled
    await orderRequest.save();

    await sendNotification({
      role: ROLES.DP,
      userId: orderRequest.requested_by,
      title: "Drop-off Rejected",
      message: "The selected PDC rejected your drop-off. Please select a different PDC.",
      orderId: orderId
    });

    return "Drop-off request rejected successfully";
  }
};

export const triggerManualBroadcast = async (orderId, pdcId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  if (order.status_completed !== "delivered to pdc") {
    throw new Error("Order must be delivered to PDC before broadcasting");
  }

  // Find the pending broadcast created when DP dropped off at PDC
  let broadcast = await Broadcast.findOne({ order_id: orderId, broadcasted_by: pdcId, status: "Pending" });

  if (!broadcast) {
    throw new Error("Pending broadcast not found for this order.");
  }

  const pdcDoc = await PdcDocument.findOne({ user_id: pdcId });

  // Fetch dynamic radius from Admin Settings
  const { distancesByRole } = await adminService.getBroadcastDistance();
  let maxDistance = 10000; // default 10km
  if (distancesByRole && distancesByRole['pdc']) {
    maxDistance = distancesByRole['pdc'] * 1000;
  }

  // Use the highly-optimized MongoDB $geoNear engine to find closest DPs
  let nearByDps = await dpService.checkNearbyDps(maxDistance, broadcast._id, pdcId);

  // Optional: Limit to closest 15 DPs for industrial standard (Uber-style dispatch)
  if (nearByDps.length > 15) {
    nearByDps = nearByDps.slice(0, 15);
  }

  // We NO LONGER return 0 if nearByDps is empty. 
  // We must open the 10-minute broadcasting window regardless!

  // Update status to Broadcasting and generate the pickup OTP for the DP
  broadcast.status = "Broadcasting";
  broadcast.pickup_otp = Math.floor(1000 + Math.random() * 9000);
  await broadcast.save();

  // Send real-time socket notification to update PDC Dashboard UI
  await sendNotification({
    role: ROLES.PDC,
    userId: pdcId,
    title: "Broadcasting Started",
    message: `Order #${orderId} is now broadcasting to nearby Delivery Partners.`,
    orderId: orderId
  });

  // Schedule Agenda job to expire this broadcast in 10 minutes
  const agenda = getAgenda();
  if (agenda) {
    await agenda.schedule('in 10 minutes', 'expire-broadcast', {
      broadcast_id: broadcast._id.toString(),
      order_id: orderId.toString(),
      pdc_id: pdcId.toString()
    });
  }
  // Create or Update OrderRequest
  let pdcBroadcastOrderRequest = await OrderRequest.findOne({
    order_id: order._id,
    broadcast_id: broadcast._id,
    request_type: "broadcast_pdc"
  });

  let newDpsToNotify = [];

  if (!pdcBroadcastOrderRequest) {
    newDpsToNotify = nearByDps;
    await OrderRequest.create({
      order_id: order._id,
      requested_by: pdcId,
      notified_ids: nearByDps,
      request_type: "broadcast_pdc",
      broadcast_id: broadcast._id,
    });
  } else {
    // It exists from a previous 10-minute broadcast run. Find who is new!
    const existingNotified = pdcBroadcastOrderRequest.notified_ids.map(id => id.toString());
    newDpsToNotify = nearByDps.filter(dpId => !existingNotified.includes(dpId.toString()));

    if (newDpsToNotify.length > 0) {
      pdcBroadcastOrderRequest.notified_ids.push(...newDpsToNotify);
      await pdcBroadcastOrderRequest.save();
    }
  }

  // Send push notifications ONLY to newly discovered DPs
  for (const dpId of newDpsToNotify) {
    await sendNotification({
      role: ROLES.DP,
      userId: dpId,
      title: "New Pickup Available!",
      message: `A new parcel (Order #${order._id}) is ready for pickup at a nearby PDC hub.`,
      orderId: order._id
    });
  }

  return nearByDps.length;
};
