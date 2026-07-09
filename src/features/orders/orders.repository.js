import { Order } from "./order.model.js";
import { ORDER_STATUS, ACTIVE_ORDER_STATUSES } from "../../constants/index.js";
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

export const createOrder = async (orderData, options) => {
  return await Order.create(orderData, options);
};

export const createPackageDetail = async (packageData, options) => {
  return await PackageDetail.create(packageData, options);
};

export const updateOrder = async (id, updateData) => {
  return await Order.findByIdAndUpdate(id, updateData, { new: true });
};

export const findActiveOrdersByUserId = async (user_id) => {
  const orders = await Order.find({
    user_id,
    status: { $in: ACTIVE_ORDER_STATUSES },
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
    status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] },
  }).sort({ created_at: -1 });

  const result = [];
  for (const order of orders) {
    const orderObj = order.toObject();
    const packageDetail = order.package_id
      ? await PackageDetail.findById(order.package_id)
      : null;
    const dpimages = await DeliveryPartnerImage.find({ order_id: order._id });
    const rating = await Rating.findOne({ order_id: order._id });
    const { OrderWaitCharge } = await import("./orderWaitCharge.model.js");
    const waitCharge = await OrderWaitCharge.findOne({ order_id: order._id });

    orderObj.packageDetail = packageDetail ? packageDetail.toObject() : null;
    orderObj.dpimages = dpimages.map((img) => img.toObject());
    orderObj.rating = rating ? rating.toObject() : null;
    orderObj.waiting_charge = waitCharge ? waitCharge.total_waiting_charge : 0;
    orderObj.waiting_charge_paid = waitCharge ? (waitCharge.payment_status === "paid") : false;
    result.push(orderObj);
  }
  return result;
};

export const findCancelledOrdersByUserId = async (user_id) => {
  const orders = await Order.find({
    user_id,
    status: ORDER_STATUS.CANCELLED,
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
