import * as ordersRepository from './orders.repository.js';
import { User } from '../users/user.model.js';
import { Order } from './order.model.js';
import { OrderRequest } from './orderRequest.model.js';
import { DpDetail } from '../deliveryPartner/dpDetail.model.js';
import { PackageDetail } from './packageDetail.model.js';
import { Rating } from '../deliveryPartner/rating.model.js';
import { Notification } from '../notifications/notification.model.js';
import { uploadToCloudinary } from '../../common/services/cloudinary.service.js';
import mongoose from 'mongoose';

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

  const gstAmount = price * 0.05; // 5% GST
  const totalAmount = Math.ceil(price + gstAmount);

  return {
    base_price: deliverCharge.base_price,
    additional_km_price: additionalKmPrice,
    net_price: price,
    gst: Math.ceil(gstAmount),
    total: totalAmount
  };
};

export const getCharges = async (mode_of_transport, distance) => {
  const deliverCharge = await ordersRepository.findDeliverChargeByVehicle(mode_of_transport);
  if (!deliverCharge) {
    throw new Error(`Charge configuration for vehicle ${mode_of_transport} not found.`);
  }

  const calc = calculateFinalCharges(deliverCharge, distance);
  return {
    amount: calc.total,
    breakdown: {
      base_price: calc.base_price,
      additional_km: calc.additional_km_price,
      gst: calc.gst
    }
  };
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
    receiver_name,
    receiver_phone,
    how_to_reach_receiver_address,
    distance,
    product_description,
    product_weight,
    no_of_items,
    types_of_product,
    size_of_package
  } = orderData;

  // Upload images to Cloudinary
  let image1Url = null;
  let image2Url = null;
  let image3Url = null;

  if (files?.image1?.[0]) {
    const res = await uploadToCloudinary(files.image1[0].path, 'order_images');
    image1Url = res?.secure_url;
  }
  if (files?.image2?.[0]) {
    const res = await uploadToCloudinary(files.image2[0].path, 'order_images');
    image2Url = res?.secure_url;
  }
  if (files?.image3?.[0]) {
    const res = await uploadToCloudinary(files.image3[0].path, 'order_images');
    image3Url = res?.secure_url;
  }

  const deliverCharge = await ordersRepository.findDeliverChargeByVehicle(mode_of_transport);
  if (!deliverCharge) {
    throw new Error(`Vehicle transport type ${mode_of_transport} not found.`);
  }

  const calc = calculateFinalCharges(deliverCharge, Number(distance));

  // Generate OTPs
  const pickup_otp = Math.floor(1000 + Math.random() * 9000);
  const drop_otp = Math.floor(1000 + Math.random() * 9000);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await ordersRepository.createOrder([{
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
      receiver_name,
      receiver_phone,
      how_to_reach_receiver_address,
      distance: Number(distance),
      pickup_otp,
      drop_otp,
      charges: calc.total,
      delivery_type: 'direct',
      status: 0
    }], { session });

    const newOrder = order[0];

    const packageDetail = await ordersRepository.createPackageDetail([{
      user_id,
      order_id: newOrder._id,
      product_description,
      product_weight,
      no_of_items: Number(no_of_items),
      types_of_product,
      size_of_package,
      image1: image1Url,
      image2: image2Url,
      image3: image3Url
    }], { session });

    newOrder.package_id = packageDetail[0]._id;
    await newOrder.save({ session });

    // In-app notifications
    const admin = await User.findOne({ role: 'admin' });
    
    await Notification.create([{
      notifiable_type: 'customer',
      notifiable_id: user_id,
      title: 'Order Placed',
      message: `Your order of ID : ${newOrder._id} is placed`,
      order_id: newOrder._id
    }], { session });

    if (admin) {
      await Notification.create([{
        notifiable_type: 'admin',
        notifiable_id: admin._id,
        title: 'New Order Placed',
        message: ` has placed an order of ID : ${newOrder._id}`,
        order_id: newOrder._id
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    return { order: newOrder, packageDetails: packageDetail[0] };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const cancelOrder = async (order_id, cancel_order_reason) => {
  // Update OrderRequest status to 0
  await OrderRequest.updateMany({ order_id }, { status: 0 });

  const order = await Order.findById(order_id);
  if (order) {
    order.user_action = 1;
    order.status = 2; // Cancelled
    order.status_completed = 'cancelled';
    order.cancel_order_reason = cancel_order_reason;
    await order.save();
  } else {
    throw new Error('Order not found');
  }

  const admin = await User.findOne({ role: 'admin' });

  if (cancel_order_reason === 'Driver are not found') {
    await Notification.create({
      notifiable_type: 'customer',
      notifiable_id: order.user_id,
      title: 'Order Cancelled',
      message: 'Sorry, No Delivery partners are available this moment. Please try again later!',
      order_id: order._id
    });
    if (admin) {
      await Notification.create({
        notifiable_type: 'admin',
        notifiable_id: admin._id,
        title: 'Order Cancelled',
        message: `No Delivery partners are available for the order of ID: ${order._id}`,
        order_id: order._id
      });
    }
  } else {
    if (admin) {
      await Notification.create({
        notifiable_type: 'admin',
        notifiable_id: admin._id,
        title: 'Order Cancelled',
        message: `${order.sender_name} has cancelled the order`, // maps to customer name
        order_id: order._id
      });
    }
  }
  return true;
};

export const getOrderDetails = async (userId) => {
  const user = await User.findOne({ _id: userId, role: 'customer' });
  if (!user) {
    throw new Error('User details not found');
  }
  return await ordersRepository.findActiveOrdersByUserId(userId);
};

export const getTrackingDetails = async (userId, orderId) => {
  const user = await User.findOne({ _id: userId, role: 'customer' });
  if (!user) {
    throw new Error('User details not found');
  }

  const orderDoc = await Order.findById(orderId);
  let order_details = null;
  if (orderDoc) {
    const orderObj = orderDoc.toObject();
    const packageDetail = orderDoc.package_id ? await PackageDetail.findById(orderDoc.package_id) : null;
    const dpDetail = orderDoc.pickup_dp_id ? await DpDetail.findOne({ user_id: orderDoc.pickup_dp_id }) : null;
    orderObj.packageDetail = packageDetail ? packageDetail.toObject() : null;
    orderObj.dpDetail = dpDetail ? dpDetail.toObject() : null;
    order_details = orderObj;
  }

  const assignedDoc = await OrderRequest.findOne({ order_id: orderId })
    .sort({ created_at: -1 });
  let assigned = null;
  if (assignedDoc) {
    const assignedObj = assignedDoc.toObject();
    const dp = assignedDoc.accepted_by ? await User.findById(assignedDoc.accepted_by) : null;
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
    throw new Error('Order not found');
  }

  const order = orderDoc.toObject();
  const dpUser = orderDoc.pickup_dp_id ? await User.findById(orderDoc.pickup_dp_id) : null;
  const dpDetail = orderDoc.pickup_dp_id ? await DpDetail.findOne({ user_id: orderDoc.pickup_dp_id }) : null;
  order.dpUser = dpUser ? dpUser.toObject() : null;
  order.dpDetail = dpDetail ? dpDetail.toObject() : null;

  const orderAssignDoc = await OrderRequest.findOne({
    order_id: order._id,
    status: 1,
    complete_status: null,
    request_type: 'direct'
  });

  if (!orderAssignDoc) {
    throw new Error('Searching For DP');
  }

  const orderAssign = orderAssignDoc.toObject();
  const dp = orderAssignDoc.accepted_by ? await User.findById(orderAssignDoc.accepted_by) : null;
  const dpLocation = orderAssignDoc.accepted_by ? await DpDetail.findOne({ user_id: orderAssignDoc.accepted_by }) : null;
  orderAssign.dp = dp ? dp.toObject() : null;
  orderAssign.dpLocation = dpLocation ? dpLocation.toObject() : null;

  let avgRating = 0;
  const ratings = await Rating.find({ to_dp: orderAssign.accepted_by });
  if (ratings.length) {
    const sum = ratings.reduce((acc, curr) => acc + curr.stars, 0);
    avgRating = sum / ratings.length;
  }

  return {
    dpName: order.dpUser?.name || '',
    dpPhone: order.dpUser?.phone || '',
    dpProfile: order.dpDetail?.profile_img || '',
    dpLatitude: order.dpDetail?.latitude || null,
    dpLongitude: order.dpDetail?.longitude || null,
    customerLatitude: order.receiver_latitude,
    customerLongitude: order.receiver_longitude,
    avgRating,
    pickup_otp: order.pickup_otp
  };
};

export const notifyDp = async (orderId, packageDetailsId) => {
  const order = await Order.findById(orderId);
  if (!order || order.user_action === 1) {
    return null;
  }

  // Busy DPs who have already accepted another active order
  const activeRequests = await OrderRequest.find({
    status: 1,
    complete_status: null
  });
  const busyDpIds = activeRequests.map(r => r.accepted_by).filter(Boolean);

  // Find eligible online DPs
  const eligibleDps = await DpDetail.find({
    online: 1,
    document_approval: 'Approved',
    user_id: { $nin: busyDpIds }
  }).populate({
    path: 'dpDocument',
    match: { vehicle_type: order.mode_of_transport }
  });

  // Filter DPs where matching vehicle document exists
  const nearestDps = eligibleDps
    .filter(dp => dp.dpDocument) // Matches vehicle_type
    .map(dp => dp.user_id);

  // Prevent duplicate notifications
  const existingRequest = await OrderRequest.findOne({
    order_id: order._id,
    status: null,
    notified_ids: { $all: nearestDps }
  });

  if (!existingRequest && nearestDps.length > 0) {
    return await OrderRequest.create({
      order_id: order._id,
      requested_by: order.user_id,
      notified_ids: nearestDps,
      request_type: 'direct'
    });
  }

  return existingRequest;
};

export const getMyNotifications = async (userId) => {
  return await Notification.find({ notifiable_id: userId, read_at: null }).sort({ created_at: -1 });
};

export const getCustomerRating = async (userId) => {
  const customer = await User.findById(userId);
  if (!customer) {
    throw new Error('User not found');
  }

  const ratings = await Rating.find({ to_customer: userId }).populate('from_dp').sort({ created_at: -1 });
  const mappedRatings = ratings.map(r => {
    const obj = r.toObject();
    obj.fromDp = obj.from_dp;
    return obj;
  });
  const allRatings = await Rating.find({ to_customer: userId });
  const avgRating = allRatings.length ? (allRatings.reduce((acc, curr) => acc + curr.stars, 0) / allRatings.length) : 0;

  return { ratings: mappedRatings, avarageRating: avgRating };
};

export const rateDp = async (orderId, fromCustomer, toDp, stars, message = '') => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const customer = await User.findById(fromCustomer);
  const dp = await User.findById(toDp);

  if (!customer || !dp) {
    throw new Error('Customer or DP not found');
  }

  const existingRating = await Rating.findOne({
    order_id: orderId,
    from_customer: fromCustomer,
    to_dp: toDp
  });

  if (existingRating) {
    return { code: 200, message: 'You have already rated this customer.' };
  }

  const rating = await Rating.create({
    order_id: orderId,
    from_customer: fromCustomer,
    to_dp: toDp,
    stars,
    message
  });

  return {
    code: 200,
    rating,
    message: `You have rated ${dp.name} successfully.`
  };
};

