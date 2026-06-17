import { Order } from "./order.model.js";
import { PackageDetail } from "./packageDetail.model.js";
import { OrderRequest } from "./orderRequest.model.js";
import { DeliverCharge } from "./deliverCharge.model.js";
import { Rating } from "../deliveryPartner/rating.model.js";
import { Broadcast } from "./broadcast.model.js";
import { User } from "../users/user.model.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import { DeliveryPartnerImage } from "./dpImage.model.js";

export const findOrderById = async (id) => {
  const order = await Order.findById(id);
  if (!order) return null;
  const orderObj = order.toObject();

  const packageDetail = order.package_id
    ? await PackageDetail.findById(order.package_id)
    : null;
  const broadcast = order.broadcast_id
    ? await Broadcast.findById(order.broadcast_id)
    : null;
  const dpUser = order.pickup_dp_id
    ? await User.findById(order.pickup_dp_id)
    : null;
  const dpDetail = order.pickup_dp_id
    ? await DpDetail.findOne({ user_id: order.pickup_dp_id })
    : null;

  orderObj.packageDetail = packageDetail ? packageDetail.toObject() : null;
  orderObj.broadcast = broadcast ? broadcast.toObject() : null;
  orderObj.dpUser = dpUser ? dpUser.toObject() : null;
  orderObj.dpDetail = dpDetail ? dpDetail.toObject() : null;

  return orderObj;
};

export const createOrder = async (orderData) => {
  return await Order.create(orderData);
};

export const createPackageDetail = async (packageData) => {
  return await PackageDetail.create(packageData);
};

export const updateOrder = async (id, updateData) => {
  return await Order.findByIdAndUpdate(id, updateData, { new: true });
};

export const findActiveOrdersByUserId = async (user_id) => {
  const orders = await Order.find({
    user_id,
    status: 1,
    user_action: null,
    $or: [
      { status_completed: { $ne: "delivered" } },
      { status_completed: null },
    ],
  }).sort({ created_at: -1 });

  const result = [];
  for (const order of orders) {
    const orderObj = order.toObject();
    const dpUser = order.pickup_dp_id
      ? await User.findById(order.pickup_dp_id)
      : null;
    const dpDetail = order.pickup_dp_id
      ? await DpDetail.findOne({ user_id: order.pickup_dp_id })
      : null;

    orderObj.dpUser = dpUser ? dpUser.toObject() : null;
    orderObj.dpDetail = dpDetail ? dpDetail.toObject() : null;
    result.push(orderObj);
  }
  return result;
};

export const findOrderHistoryByUserId = async (user_id) => {
  const orders = await Order.find({
    user_id,
    $or: [{ user_action: 1 }, { status_completed: "delivered" }],
  }).sort({ created_at: -1 });

  const result = [];
  for (const order of orders) {
    const orderObj = order.toObject();
    const packageDetail = order.package_id
      ? await PackageDetail.findById(order.package_id)
      : null;
    const dpimages = await DeliveryPartnerImage.find({ order_id: order._id });
    const rating = await Rating.findOne({ order_id: order._id });

    orderObj.packageDetail = packageDetail ? packageDetail.toObject() : null;
    orderObj.dpimages = dpimages.map((img) => img.toObject());
    orderObj.rating = rating ? rating.toObject() : null;
    result.push(orderObj);
  }
  return result;
};

export const findCancelledOrdersByUserId = async (user_id) => {
  const orders = await Order.find({
    user_id,
    user_action: 1,
  }).sort({ created_at: -1 });

  const result = [];
  for (const order of orders) {
    const orderObj = order.toObject();
    const packageDetail = order.package_id
      ? await PackageDetail.findById(order.package_id)
      : null;
    orderObj.packageDetail = packageDetail ? packageDetail.toObject() : null;
    result.push(orderObj);
  }
  return result;
};

export const findDeliverChargeByVehicle = async (vehicle_type) => {
  return await DeliverCharge.findOne({ vehicle_type });
};

export const findLatestOrderRequest = async (order_id) => {
  const orderRequest = await OrderRequest.findOne({ order_id }).sort({
    created_at: -1,
  });

  if (!orderRequest) return null;
  const orderRequestObj = orderRequest.toObject();
  const dp = orderRequest.accepted_by
    ? await User.findById(orderRequest.accepted_by)
    : null;
  orderRequestObj.dp = dp ? dp.toObject() : null;
  return orderRequestObj;
};

export const findOrderRequestCount = async (order_id) => {
  return await OrderRequest.countDocuments({ order_id });
};

export const createOrderRequest = async (requestData) => {
  return await OrderRequest.create(requestData);
};
