import { User } from "../users/user.model.js";
import { Customer } from "../users/customer.model.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import { DpDocument } from "../deliveryPartner/dpDocument.model.js";
import { PdcDocument } from "../pdc/pdcDocument.model.js";
import { Order } from "../orders/order.model.js";
import { OrderRequest } from "../orders/orderRequest.model.js";
import { Rating } from "../deliveryPartner/rating.model.js";
import { DeliverCharge } from "../orders/deliverCharge.model.js";
import { MinBroadcastDist } from "../tracking/minBroadcast.model.js";
import { BroadcastPoint } from "../tracking/broadcastPoint.model.js";
import { Wallet } from "../payments/wallet.model.js";
import { WalletTransaction } from "../payments/walletTransaction.model.js";
import {
  WalletConfig,
  WalletConfigHistory,
} from "../payments/walletConfig.model.js";
import { MassCreditLog } from "../payments/massCreditLog.model.js";
import { AdminPayout } from "../payments/adminPayout.model.js";

export const findUserByEmailAndType = async (email, role) => {
  return await User.findOne({ email, role });
};

export const findUserByPhoneAndType = async (phone, role) => {
  return await User.findOne({ phone, role });
};

export const findUserById = async (id) => {
  return await User.findById(id);
};

export const createUser = async (userData) => {
  return await User.create(userData);
};

export const deleteUser = async (id) => {
  return await User.deleteOne({ _id: id });
};

export const countCustomers = async () => {
  return await User.countDocuments({ role: "customer" });
};

export const countDeliveryPartners = async () => {
  return await DpDetail.countDocuments();
};

export const countOrders = async () => {
  return await Order.countDocuments();
};

export const countPdcs = async () => {
  return await PdcDocument.countDocuments();
};

export const findRecentOrders = async (limit) => {
  return await Order.find().sort({ createdAt: -1 }).limit(limit);
};

export const findAllDpDetails = async () => {
  const details = await DpDetail.find().populate("user_id");

  return details.map((d) => {
    const obj = d.toObject();
    obj.user = obj.user_id;
    return obj;
  });
};

export const findDpDetailById = async (id) => {
  const detail = await DpDetail.findById(id).populate("user_id");
  if (detail) {
    const obj = detail.toObject();
    obj.user = obj.user_id;
    return obj;
  }
  return null;
};

export const findDpDetailByUserId = async (userId) => {
  return await DpDetail.findOne({ user_id: userId });
};

export const createDpDetail = async (data) => {
  return await DpDetail.create(data);
};

export const updateDpDetail = async (id, updateData) => {
  return await DpDetail.updateOne({ _id: id }, updateData);
};

export const deleteDpDetail = async (id) => {
  return await DpDetail.deleteOne({ _id: id });
};

export const findDpDocumentByUserId = async (userId) => {
  return await DpDocument.findOne({ user_id: userId });
};

export const createDpDocument = async (data) => {
  return await DpDocument.create(data);
};

export const updateDpDocument = async (userId, updateData) => {
  return await DpDocument.updateOne({ user_id: userId }, updateData);
};

export const deleteDpDocumentByUserId = async (userId) => {
  return await DpDocument.deleteOne({ user_id: userId });
};

export const findAllCustomers = async () => {
  const users = await User.find({ role: "customer" });
  const customers = await Customer.find({});
  const customerMap = new Map(
    customers.map((c) => [c.user_id ? c.user_id.toString() : "", c]),
  );

  return users.map((user) => {
    const userObj = user.toObject();
    userObj.customer = customerMap.get(user._id.toString()) || null;
    return userObj;
  });
};

export const findCustomerByUserId = async (userId) => {
  return await Customer.findOne({ user_id: userId });
};

export const createCustomerDetails = async (data) => {
  return await Customer.create(data);
};

export const updateCustomerDetails = async (userId, updateData) => {
  return await Customer.updateOne({ user_id: userId }, updateData);
};

export const deleteCustomerDetails = async (userId) => {
  return await Customer.deleteOne({ user_id: userId });
};

export const findAllPdcs = async () => {
  const docs = await PdcDocument.find().populate("user_id");
  return docs.map((d) => {
    const obj = d.toObject();
    obj.userDetails = obj.user_id;
    return obj;
  });
};

export const findPdcDocumentByUserId = async (userId) => {
  const doc = await PdcDocument.findOne({ user_id: userId }).populate(
    "user_id",
  );
  if (doc) {
    const obj = doc.toObject();
    obj.userDetails = obj.user_id;
    return obj;
  }
  return null;
};

export const findPdcDocumentById = async (id) => {
  const doc = await PdcDocument.findById(id).populate("user_id");
  if (doc) {
    const obj = doc.toObject();
    obj.userDetails = obj.user_id;
    return obj;
  }
  return null;
};

export const createPdcDocument = async (data) => {
  return await PdcDocument.create(data);
};

export const updatePdcDocument = async (userId, updateData) => {
  return await PdcDocument.updateOne({ user_id: userId }, updateData);
};

export const deletePdcDocument = async (userId) => {
  return await PdcDocument.deleteOne({ user_id: userId });
};

export const findMinBroadcast = async () => {
  return await MinBroadcastDist.findOne();
};

export const updateMinBroadcast = async (distance) => {
  return await MinBroadcastDist.updateOne(
    {},
    { minimum_broadcast_distance: distance },
    { upsert: true },
  );
};

export const findAllBroadcastPoints = async () => {
  return await BroadcastPoint.find();
};

export const createBroadcastPoint = async (data) => {
  return await BroadcastPoint.create(data);
};

export const findOrders = async (query) => {
  return await Order.find(query)
    .populate("user_id")
    .populate("pickup_dp_id")
    .populate("delivery_dp_id")
    .populate("package_id");
};

const populateOrder = (query) =>
  query
    .populate("user_id")
    .populate("pickup_dp_id")
    .populate("delivery_dp_id")
    .populate("package_id");

export const findPendingOrders = async () => {
  const reqs = await OrderRequest.find();
  const reqOrderIds = reqs.map((r) => r.order_id);
  return await populateOrder(
    Order.find({
      _id: { $nin: reqOrderIds },
      user_action: null,
      status_completed: null,
      broadcast_id: null,
    }),
  );
};

export const findAssignedOrders = async () => {
  return await populateOrder(
    Order.find({ pickup_dp_id: { $ne: null }, delivery_dp_id: null }),
  );
};

export const findInTransitOrders = async () => {
  const intransitReqs = await OrderRequest.find({
    status: 1,
    complete_status: null,
  });
  const orderIds = intransitReqs.map((req) => req.order_id);
  return await populateOrder(Order.find({ _id: { $in: orderIds } }));
};

export const findDeliveredOrders = async () => {
  return await populateOrder(Order.find({ status_completed: "delivered" }));
};

export const findBroadcastedOrders = async () => {
  return await populateOrder(Order.find({ broadcast_id: { $ne: null } }));
};

export const findCustomerCancelledOrders = async () => {
  return await populateOrder(Order.find({ user_action: 1 }));
};

export const findDpCancelledOrders = async () => {
  const rejectedReqs = await OrderRequest.find({ rejected_by: { $ne: null } });
  const orderIds = rejectedReqs.map((req) => req.order_id);
  return await populateOrder(Order.find({ _id: { $in: orderIds } }));
};

export const findOrderById = async (id) => {
  return await Order.findById(id)
    .populate("user_id")
    .populate("pickup_dp_id")
    .populate("delivery_dp_id")
    .populate("package_id");
};

export const updateOrder = async (id, updateData) => {
  return await Order.updateOne({ _id: id }, updateData);
};

export const findAllRatings = async () => {
  return await Rating.find()
    .populate("order_id")
    .populate("from_customer")
    .populate("from_dp")
    .populate("from_pdc");
};

export const findOrdersInDateRange = async (startDate, endDate) => {
  return await Order.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  })
    .populate("user_id")
    .populate("pdc_id");
};

export const findUsersInDateRange = async (startDate, endDate) => {
  return await User.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  });
};

export const findRatingsInDateRange = async (startDate, endDate) => {
  return await Rating.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  })
    .populate("from_customer")
    .populate("from_dp")
    .populate("from_pdc");
};

export const findDeliverCharge = async (vehicle_type) => {
  if (vehicle_type) {
    return await DeliverCharge.findOne({ vehicle_type });
  }
  return await DeliverCharge.findOne();
};

export const findAllDeliverCharges = async () => {
  return await DeliverCharge.find();
};

export const updateDeliverCharge = async (vehicle_type, updateData) => {
  return await DeliverCharge.updateOne({ vehicle_type }, updateData, {
    upsert: true,
  });
};

export const findWalletById = async (id) => {
  return await Wallet.findById(id).populate("user_id");
};

export const findWalletByUserId = async (userId) => {
  return await Wallet.findOne({ user_id: userId });
};

export const createWallet = async (data) => {
  return await Wallet.create(data);
};

export const createWalletTransaction = async (data) => {
  return await WalletTransaction.create(data);
};

export const findWalletTransactionsByWalletId = async (walletId) => {
  return await WalletTransaction.find({ wallet_id: walletId }).sort({
    created_at: -1,
  });
};

export const findWalletTransactionsByLogId = async (logId) => {
  return await WalletTransaction.find({
    transaction_type: "mass_credit",
    reference_id: logId,
  }).populate("user_id");
};

export const createMassCreditLog = async (data) => {
  return await MassCreditLog.create(data);
};

export const findMassCreditLogs = async () => {
  return await MassCreditLog.find()
    .populate("admin_id")
    .sort({ created_at: -1 });
};

export const findWalletConfig = async () => {
  return await WalletConfig.findOne();
};

export const createWalletConfig = async (data) => {
  return await WalletConfig.create(data);
};

export const findWalletConfigHistory = async () => {
  return await WalletConfigHistory.find()
    .populate("changed_by")
    .sort({ created_at: -1 });
};

export const createWalletConfigHistory = async (data) => {
  return await WalletConfigHistory.create(data);
};

export const createAdminPayout = async (data) => {
  return await AdminPayout.create(data);
};

export const findAdminPayouts = async (query = {}) => {
  return await AdminPayout.find(query)
    .populate("user_id")
    .sort({ created_at: -1 });
};
