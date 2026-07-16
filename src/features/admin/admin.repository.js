import { User } from "../users/user.model.js";
import { Customer } from "../users/customer.model.js";
import {
  ROLES,
  ORDER_STATUS,
  ORDER_REQUEST_STATUS,
  ORDER_REQUEST_COMPLETE_STATUS,
} from "../../constants/index.js";
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
  return await User.findOne({ email, role }).select("+password +fcm_tokens");
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
  return await User.countDocuments({ role: ROLES.USER });
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

export const findAllDpDetails = async (page = 1, limit = 10, search = "") => {
  let userIds = [];
  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    }).select("_id");
    userIds = users.map((u) => u._id);
  }

  const query = {};
  if (search) {
    query.user_id = { $in: userIds };
  }

  const skip = (page - 1) * limit;

  const details = await DpDetail.find(query)
    .populate("user_id")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await DpDetail.countDocuments(query);
  const totalPages = Math.ceil(total / limit);

  const detailUserIds = details.map((d) => d.user_id._id || d.user_id);
  const dpDocuments = await DpDocument.find({ user_id: { $in: detailUserIds } });
  
  const dpDocMap = new Map();
  dpDocuments.forEach((doc) => {
    dpDocMap.set(doc.user_id.toString(), doc);
  });

  const dpList = details.map((d) => {
    const obj = d.toObject();
    obj.user = obj.user_id;
    
    const doc = dpDocMap.get((obj.user_id._id || obj.user_id).toString());
    if (doc) {
      obj.vehicle_type = doc.vehicle_type;
    }
    
    return obj;
  });

  return { dpList, total, page, totalPages };
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

export const findDpDocumentById = async (id) => {
  return await DpDocument.findById(id);
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

export const findAllCustomers = async (page = 1, limit = 10, search = "") => {
  const query = { role: ROLES.USER };
  
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(query);
  const totalPages = Math.ceil(total / limit);

  const customers = await Customer.find({});
  const customerMap = new Map(
    customers.map((c) => [c.user_id ? c.user_id.toString() : "", c]),
  );

  const customerList = users.map((user) => {
    const userObj = user.toObject();
    userObj.customer = customerMap.get(user._id.toString()) || null;
    return userObj;
  });

  return { customers: customerList, total, page, totalPages };
};

export const findAllCustomersUnpaginated = async (search = "") => {
  const query = { role: ROLES.USER };
  
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  const users = await User.find(query).sort({ createdAt: -1 });

  const customers = await Customer.find({});
  const customerMap = new Map(
    customers.map((c) => [c.user_id ? c.user_id.toString() : "", c]),
  );

  const customerList = users.map((user) => {
    const userObj = user.toObject();
    userObj.customer = customerMap.get(user._id.toString()) || null;
    return userObj;
  });

  return customerList;
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

export const findAllPdcs = async (page = 1, limit = 10, search = "") => {
  let userIds = [];
  if (search) {
    const users = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    }).select("_id");
    userIds = users.map((u) => u._id);
  }

  const query = {};
  if (search) {
    query.$or = [
      { city: { $regex: search, $options: "i" } },
      { user_id: { $in: userIds } },
    ];
  }

  const skip = (page - 1) * limit;

  const docs = await PdcDocument.find(query)
    .populate("user_id", "-password -otp -refreshToken -fcm_tokens -fcm_token")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await PdcDocument.countDocuments(query);
  const totalPages = Math.ceil(total / limit);

  const pdcs = docs.map((d) => {
    const obj = d.toObject();
    obj.userDetails = obj.user_id;
    obj.user_id = obj.user_id ? obj.user_id._id : null;
    return obj;
  });

  return { pdcs, total, page, totalPages };
};

export const findPdcDocumentByUserId = async (userId) => {
  const doc = await PdcDocument.findOne({ user_id: userId }).populate(
    "user_id",
    "-password -otp -refreshToken -fcm_tokens -fcm_token",
  );
  if (doc) {
    const obj = doc.toObject();
    obj.userDetails = obj.user_id;
    obj.user_id = obj.user_id ? obj.user_id._id : null;
    return obj;
  }
  return null;
};

export const findPdcDocumentById = async (id) => {
  const doc = await PdcDocument.findById(id).populate(
    "user_id",
    "-password -otp -refreshToken -fcm_tokens -fcm_token",
  );
  if (doc) {
    const obj = doc.toObject();
    obj.userDetails = obj.user_id;
    obj.user_id = obj.user_id ? obj.user_id._id : null;
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

// Assigned dp of schedule order bundle at the final step
export const assignDpToOrder = async (order_id, dp_id, customer_id) => {
  let customerObjId = customer_id?._id || customer_id;
  if (!customerObjId) {
    const rawOrder = await Order.findById(order_id).select("user_id").lean();
    customerObjId = rawOrder?.user_id;
  }
  const session = await Order.startSession();
  session.startTransaction();
  try {
    // 1. Update Order
    await Order.updateOne(
      { _id: order_id },
      {
        pickup_dp_id: dp_id,
        status_completed: "order accepted",
        status: ORDER_STATUS.ACCEPTED,
        dp_accept_time: new Date(),
      },
      { session },
    );

    // 2. Cancel active uncompleted OrderRequests for this order to prevent conflicts
    await OrderRequest.updateMany(
      { order_id, complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING },
      { status: ORDER_REQUEST_STATUS.REJECTED },
      { session },
    );

    // 3. Create active OrderRequest for this assigned DP
    await OrderRequest.create(
      [
        {
          order_id,
          requested_by: customerObjId,
          notified_ids: [dp_id],
          status: ORDER_REQUEST_STATUS.ACCEPTED,
          request_type: "direct",
          accepted_by: dp_id,
        },
      ],
      { session, ordered: true },
    );

    // Lock the DP by adding this order to their active array
    await DpDetail.findOneAndUpdate(
      { user_id: dp_id },
      { $addToSet: { active_order_ids: order_id } },
      { session },
    );

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const sendTargetedRequest = async (order_id, dp_id, customer_id) => {
  let customerObjId = customer_id?._id || customer_id;
  if (!customerObjId) {
    const rawOrder = await Order.findById(order_id).select("user_id").lean();
    customerObjId = rawOrder?.user_id;
  }
  const session = await Order.startSession();
  session.startTransaction();
  try {
    // Ensure Order is in PENDING state (clear any old pickup_dp_id)
    await Order.updateOne(
      { _id: order_id },
      {
        $set: { status: ORDER_STATUS.PENDING },
      },
      { session },
    );

    // Cancel active uncompleted OrderRequests for this order to prevent conflicts
    await OrderRequest.updateMany(
      { order_id, complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING },
      { status: ORDER_REQUEST_STATUS.REJECTED },
      { session },
    );

    // Create a targeted PENDING OrderRequest for this DP
    await OrderRequest.create(
      [
        {
          order_id,
          requested_by: customerObjId,
          notified_ids: [dp_id],
          status: ORDER_REQUEST_STATUS.PENDING, // pending acceptance
          request_type: "direct",
        },
      ],
      { session, ordered: true },
    );

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getOverallStats = async () => {
  return await MinBroadcastDist.find();
};

export const getMinBroadcast = async () => {
  return await MinBroadcastDist.find();
};

export const updateMinBroadcast = async (role, distance) => {
  return await MinBroadcastDist.updateOne(
    { role },
    { role, minimum_broadcast_distance: distance },
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
    status: ORDER_REQUEST_STATUS.ACCEPTED,
    complete_status: ORDER_REQUEST_COMPLETE_STATUS.PENDING,
  });
  const orderIds = intransitReqs.map((req) => req.order_id);
  return await populateOrder(Order.find({ _id: { $in: orderIds } }));
};

export const findDeliveredOrders = async () => {
  return await populateOrder(Order.find({ status: ORDER_STATUS.DELIVERED }));
};

export const findBroadcastedOrders = async () => {
  return await populateOrder(Order.find({ broadcast_id: { $ne: null } }));
};

export const findCustomerCancelledOrders = async () => {
  return await populateOrder(Order.find({ status: ORDER_STATUS.CANCELLED }));
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
    .populate("package_id")
    .populate("payment_id")
    .populate("wallet_transaction_id");
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

export const findPaginatedRatings = async (query, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const total = await Rating.countDocuments(query);
  const ratings = await Rating.find(query)
    .populate("order_id")
    .populate("from_customer")
    .populate("from_dp")
    .populate("from_pdc")
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);

  return {
    ratings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const findOrdersInDateRange = async (startDate, endDate) => {
  return await Order.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)),
    },
  })
    .populate("user_id")
    .populate({ path: "pdc_id", strictPopulate: false });
};

export const findUsersInDateRange = async (startDate, endDate) => {
  return await User.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)),
    },
  });
};

export const findRatingsInDateRange = async (startDate, endDate) => {
  return await Rating.find({
    created_at: {
      $gte: new Date(startDate),
      $lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)),
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

export const findAllWallets = async () => {
  return await Wallet.find({});
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
  }).populate({
    path: "wallet_id",
    populate: { path: "user_id" },
  });
};

export const createMassCreditLog = async (data) => {
  return await MassCreditLog.create(data);
};

export const findMassCreditLogs = async () => {
  return await MassCreditLog.find()
    .populate("credited_by")
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

export const findPaginatedOrders = async (query, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("user_id")
    .populate("pickup_dp_id")
    .populate("delivery_dp_id")
    .populate("package_id")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const findDpTravelPermits = async (state, aip_only) => {
  const query = {};
  query.travel_permit_states = { $exists: true, $not: { $size: 0 } };

  if (aip_only) {
    query.travel_permit_states = "All India Permit (AIP)";
  } else if (state) {
    query.travel_permit_states = { $in: [state, "All India Permit (AIP)"] };
  }

  return await DpDocument.find(query).populate("user_id", "name phone email");
};
