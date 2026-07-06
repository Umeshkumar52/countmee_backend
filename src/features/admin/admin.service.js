import bcrypt from "bcryptjs";
import * as adminRepository from "./admin.repository.js";
import { normalizeOrder } from "../../common/utils/orderNormalization.js";
import { ROLES } from "../../constants/index.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../common/middlewares/auth.middleware.js";
import { uploadToCloudinary } from "../../common/services/cloudinary.service.js";
import { getLatLongFromAddress } from "../tracking/maps.service.js";

export const loginAdmin = async (email, password, fcmToken) => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@countmee.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  let adminUser = null;
  let isAuthenticated = false;

  if (email === adminEmail && password === adminPassword) {
    isAuthenticated = true;
    adminUser = await adminRepository.findUserByEmailAndType(
      email,
      ROLES.ADMIN,
    );
    if (!adminUser) {
      adminUser = await adminRepository.createUser({
        name: "Admin",
        email,
        password: "env",
        role: ROLES.ADMIN,
      });
    }
  } else {
    const user = await adminRepository.findUserByEmailAndType(
      email,
      ROLES.ADMIN,
    );
    if (user && user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        isAuthenticated = true;
        adminUser = user;
      }
    }
  }

  if (isAuthenticated && adminUser) {
    const token = generateAccessToken(adminUser);
    const refreshToken = generateRefreshToken(adminUser);
    adminUser.refreshToken = refreshToken;
    if (fcmToken) {
      if (!adminUser.fcm_tokens) adminUser.fcm_tokens = [];
      if (!adminUser.fcm_tokens.includes(fcmToken)) {
        adminUser.fcm_tokens.push(fcmToken);
      }
    }
    await adminUser.save();

    return {
      token,
      refreshToken,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    };
  }

  throw new Error("Invalid email or password");
};

export const getDashboardStats = async () => {
  const customersCount = await adminRepository.countCustomers();
  const deliveryPartnerCount = await adminRepository.countDeliveryPartners();
  const ordersCount = await adminRepository.countOrders();
  const recentOrders = await adminRepository.findRecentOrders(2);
  const pdcCount = await adminRepository.countPdcs();

  return {
    ordersCount,
    customersCount,
    deliveryPartnerCount,
    rec_orders: recentOrders,
    pdcCount,
  };
};

export const getDpList = async () => {
  const dpList = await adminRepository.findAllDpDetails();
  return { dpList };
};

export const getDpDetails = async (id) => {
  const dpDetail = await adminRepository.findDpDetailById(id);
  if (!dpDetail) throw new Error("DP not found");

  const dpDocument = await adminRepository.findDpDocumentByUserId(
    dpDetail.user_id._id || dpDetail.user_id,
  );
  return { dpDetail, dpDocument };
};

export const updateDpDocumentStatus = async (
  document_id,
  document_type,
  status,
  reason,
) => {
  const DpDocument = await adminRepository.findDpDocumentByUserId(document_id); // Wait, in the controller: doc = await DpDocument.findById(document_id);
  const mongoose = await import("mongoose");
  const DpDocModel = mongoose.default.model("DpDocument");
  const DpDetailModel = mongoose.default.model("DpDetail");

  const doc = await DpDocModel.findById(document_id);
  if (!doc) throw new Error("Document not found");

  const fieldMap = {
    aadhar: "adhar_status",
    dl: "dl_status",
    bank: "bank_status",
    rc: "rc_status",
    rv: "rv_status",
  };

  const rejectFieldMap = {
    aadhar: "adhar_reject_reason",
    dl: "dl_reject_reason",
    bank: "bank_reject_reason",
    rc: "rc_reject_reason",
    rv: "rv_reject_reason",
  };

  const statusField = fieldMap[document_type];
  const rejectField = rejectFieldMap[document_type];

  if (!statusField) throw new Error("Invalid document type");

  doc[statusField] = status;
  if (status === "Reject") {
    doc[rejectField] = reason || "";
  } else {
    doc[rejectField] = null;
  }

  await doc.save();

  // Re-verify overall DP status
  const allFields = [
    "adhar_status",
    "rc_status",
    "dl_status",
    "bank_status",
    "rv_status",
  ];
  let allVerified = true;
  let atLeastOneRejected = false;
  let anyPending = false;

  for (const f of allFields) {
    if (doc[f] !== "Accept") allVerified = false;
    if (doc[f] === "Reject") atLeastOneRejected = true;
    if (doc[f] === null || doc[f] === undefined) anyPending = true;
  }

  let overallStatus = "Pending";
  if (atLeastOneRejected) overallStatus = "Rejected";
  else if (allVerified) overallStatus = "Verified";
  else if (anyPending) overallStatus = "Pending";

  await DpDetailModel.updateOne(
    { user_id: doc.user_id },
    { status: overallStatus },
  );

  return { message: "Document status updated successfully" };
};

export const updateDpDocumentApproval = async (userId, document_approval) => {
  const mongoose = await import("mongoose");
  const DpDetailModel = mongoose.default.model("DpDetail");
  await DpDetailModel.findByIdAndUpdate(userId, { document_approval });
  return { message: `Approval status updated to ${document_approval}` };
};

export const addDp = async (body, files) => {
  const {
    name,
    phone,
    email,
    dob,
    gender,
    address,
    vehicle_type,
    aadhar_number,
    rc_number,
    dl_number,
    bank_name,
    bank_acc_number,
    bank_ifsc,
    vehicle_number,
    reference1_name,
    reference1_phone,
  } = body;

  const existing = await adminRepository.findUserByPhoneAndType(
    phone,
    ROLES.DP,
  );
  if (existing) {
    throw new Error("Delivery Partner Already Exists");
  }

  const newUser = await adminRepository.createUser({
    name,
    phone,
    email,
    dob,
    role: ROLES.DP,
  });

  const uploadResults = {};
  const fileFields = [
    "profile_img",
    "aadhar_imgfront",
    "aadhar_imgback",
    "rc_imgfront",
    "rc_imgback",
    "dl_imgfront",
    "dl_imgback",
    "residence_img",
    "vehicle_img",
    "bank_imagefront",
    "bank_imageback",
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      const folder = field === "profile_img" ? "dp_profiles" : "dp_documents";
      const uploadResult = await uploadToCloudinary(fileObj.path, folder);
      if (uploadResult) {
        uploadResults[field] = uploadResult.secure_url;
      }
    }
  }

  await adminRepository.createDpDetail({
    user_id: newUser._id,
    dob,
    gender,
    address,
    profile_img: uploadResults.profile_img || null,
    online: false,
    document_approval: "Approved",
    status: "Verified",
  });

  await adminRepository.createDpDocument({
    user_id: newUser._id,
    vehicle_type,
    aadhar_number,
    aadhar_imgfront: uploadResults.aadhar_imgfront || null,
    aadhar_imgback: uploadResults.aadhar_imgback || null,
    rc_number,
    rc_imgfront: uploadResults.rc_imgfront || null,
    rc_imgback: uploadResults.rc_imgback || null,
    dl_number,
    dl_imgfront: uploadResults.dl_imgfront || null,
    dl_imgback: uploadResults.dl_imgback || null,
    bank_name,
    bank_acc_number,
    bank_ifsc,
    bank_imagefront: uploadResults.bank_imagefront || null,
    bank_imageback: uploadResults.bank_imageback || null,
    vehicle_number,
    residence_img: uploadResults.residence_img || null,
    vehicle_img: uploadResults.vehicle_img || null,
    reference1_name,
    reference1_phone,
  });

  return { message: "Delivery Partner registered successfully" };
};

export const editDp = async (id, body, files) => {
  const detail = await adminRepository.findDpDetailById(id);
  if (!detail) throw new Error("DP not found");

  const {
    name,
    phone,
    email,
    dob,
    gender,
    address,
    vehicle_type,
    aadhar_number,
    rc_number,
    dl_number,
    bank_name,
    bank_acc_number,
    bank_ifsc,
    vehicle_number,
    reference1_name,
    reference1_phone,
  } = body;

  const mongoose = await import("mongoose");
  const UserModel = mongoose.default.model("User");
  await UserModel.updateOne(
    { _id: detail.user_id },
    { name, phone, email, dob },
  );

  const docUpdate = {
    vehicle_type,
    aadhar_number,
    rc_number,
    dl_number,
    bank_name,
    bank_acc_number,
    bank_ifsc,
    vehicle_number,
    reference1_name,
    reference1_phone,
  };

  const uploadResults = {};
  const fileFields = [
    "profile_img",
    "aadhar_imgfront",
    "aadhar_imgback",
    "rc_imgfront",
    "rc_imgback",
    "dl_imgfront",
    "dl_imgback",
    "residence_img",
    "vehicle_img",
    "bank_imagefront",
    "bank_imageback",
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      const folder = field === "profile_img" ? "dp_profiles" : "dp_documents";
      const uploadResult = await uploadToCloudinary(fileObj.path, folder);
      if (uploadResult) {
        uploadResults[field] = uploadResult.secure_url;
      }
    }
  }

  if (uploadResults.profile_img) {
    detail.profile_img = uploadResults.profile_img;
  }

  const dpUpdate = {
    gender,
    address,
  };
  if (detail.profile_img) {
    dpUpdate.profile_img = detail.profile_img;
  }

  await adminRepository.updateDpDetail(id, dpUpdate);

  // Map remaining file fields to docUpdate
  const remainingFileFields = [
    "aadhar_imgfront",
    "aadhar_imgback",
    "rc_imgfront",
    "rc_imgback",
    "dl_imgfront",
    "dl_imgback",
    "residence_img",
    "vehicle_img",
    "bank_imagefront",
    "bank_imageback",
  ];
  for (const f of remainingFileFields) {
    if (uploadResults[f]) {
      docUpdate[f] = uploadResults[f];
    }
  }

  await adminRepository.updateDpDocument(detail.user_id, docUpdate);

  return { message: "Delivery partner details updated successfully" };
};

export const deleteDp = async (id) => {
  const detail = await adminRepository.findDpDetailById(id);
  if (!detail) throw new Error("DP details not found");

  await adminRepository.deleteDpDocumentByUserId(detail.user_id);
  await adminRepository.deleteUser(detail.user_id);
  await adminRepository.deleteDpDetail(id);

  return { message: "Delivery Partner Deleted Successfully" };
};

export const getCustomersList = async () => {
  const customers = await adminRepository.findAllCustomers();
  return { customers };
};

export const editCustomer = async (id, body, file) => {
  const user = await adminRepository.findUserById(id);
  if (!user) throw new Error("Customer not found");

  let customer = await adminRepository.findCustomerByUserId(user._id);
  if (!customer) {
    customer = await adminRepository.createCustomerDetails({
      user_id: user._id,
    });
  }

  if (file) {
    customer.profile_pic = file.filename;
  }

  user.name = body.name;
  user.email = body.email;
  user.phone = body.phone;
  customer.address = body.address;

  await user.save();
  await customer.save();

  return { message: "Customer updated successfully" };
};

export const deleteCustomer = async (id) => {
  await adminRepository.deleteUser(id);
  await adminRepository.deleteCustomerDetails(id);
  return { message: "Customer Deleted Successfully" };
};

export const getPdcList = async () => {
  const pdcs = await adminRepository.findAllPdcs();
  return { pdcs };
};

export const getPdcDetails = async (pdcid) => {
  const pdc = await adminRepository.findPdcDocumentByUserId(pdcid);
  if (!pdc) throw new Error("PDC not found");
  return { pdc };
};

export const addPdc = async (body, files) => {
  const {
    name,
    email,
    phone,
    address,
    aadhar,
    gst,
    pan,
    bank_name,
    bank_ifsc,
    bank_acc_no,
    password,
    confirmPassword,
  } = body;

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const existing = await adminRepository.findUserByPhoneAndType(
    phone,
    ROLES.PDC,
  );
  if (existing) {
    throw new Error("PDC Already Exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await adminRepository.createUser({
    name,
    email,
    phone,
    password: hashedPassword,
    role: ROLES.PDC,
  });

  const uploadResults = {};
  const fileFields = [
    "gst_doc",
    "aadhar_front_image",
    "aadhar_back_image",
    "pancard_image",
    "passbook_image",
    "profile_image",
    "shop_image",
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      const folder =
        field === "profile_image" ? "pdc_profiles" : "pdc_documents";
      const uploadResult = await uploadToCloudinary(fileObj.path, folder);
      if (uploadResult) {
        uploadResults[field] = uploadResult.secure_url;
      }
    }
  }

  await adminRepository.createPdcDocument({
    user_id: newUser._id,
    name,
    phone,
    address,
    aadhar_card_no: aadhar,
    gst_no: gst,
    pan_card_no: pan,
    bank_name,
    ifsc: bank_ifsc,
    account_no: bank_acc_no,
    gst_doc: uploadResults.gst_doc || null,
    aadhar_front_image: uploadResults.aadhar_front_image || null,
    aadhar_back_image: uploadResults.aadhar_back_image || null,
    pancard_image: uploadResults.pancard_image || null,
    passbook_image: uploadResults.passbook_image || null,
    profile_image: uploadResults.profile_image || null,
    shop_image: uploadResults.shop_image || null,
    status: "Approved",
    aadhar_status: "Accept",
    pan_status: "Accept",
    pancard_status: "Accept",
    gst_status: "Accept",
    bank_status: "Accept",
  });

  return { message: "PDC Added Successfully" };
};

export const editPdc = async (pdcid, body, files) => {
  const pdc = await adminRepository.findPdcDocumentByUserId(pdcid);
  if (!pdc) throw new Error("PDC not found");

  const {
    name,
    email,
    phone,
    address,
    aadhar,
    gst,
    pan,
    bank_name,
    bank_ifsc,
    bank_acc_no,
    shop_name,
  } = body;

  const mongoose = await import("mongoose");
  const UserModel = mongoose.default.model("User");
  await UserModel.updateOne({ _id: pdcid }, { name, email, phone });

  const docUpdate = {
    address,
    aadhar_card_no: aadhar,
    gst_no: gst,
    pan_card_no: pan,
    bank_name,
    ifsc: bank_ifsc,
    account_no: bank_acc_no,
    shop_name,
  };

  const uploadResults = {};
  const fileFields = [
    "gst_doc",
    "aadhar_front_image",
    "aadhar_back_image",
    "pancard_image",
    "passbook_image",
    "profile_image",
    "shop_image",
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      const folder =
        field === "profile_image" ? "pdc_profiles" : "pdc_documents";
      const uploadResult = await uploadToCloudinary(fileObj.path, folder);
      if (uploadResult) {
        uploadResults[field] = uploadResult.secure_url;
      }
    }
  }

  for (const f of fileFields) {
    if (uploadResults[f]) {
      docUpdate[f] = uploadResults[f];
    }
  }

  await adminRepository.updatePdcDocument(pdcid, docUpdate);

  return { message: "PDC updated successfully" };
};

export const deletePdc = async (id) => {
  await adminRepository.deleteUser(id);
  await adminRepository.deletePdcDocument(id);
  return { message: "PDC Deleted Successfully" };
};

export const activatePdc = async (id) => {
  await adminRepository.updatePdcDocument(id, {
    status: "Approved",
    aadhar_status: "Accept",
    pan_status: "Accept",
    pancard_status: "Accept",
    gst_status: "Accept",
    bank_status: "Accept",
  });
  return { message: "PDC Activated Successfully" };
};

export const deactivatePdc = async (id) => {
  await adminRepository.updatePdcDocument(id, {
    status: "Pending",
    aadhar_status: "Reject",
    pan_status: "Reject",
    pancard_status: "Reject",
    gst_status: "Reject",
    bank_status: "Reject",
  });
  return { message: "PDC Deactivated Successfully" };
};

export const updatePdcLocation = async (pdc_id, latitude, longitude) => {
  await adminRepository.updatePdcDocument(pdc_id, { latitude, longitude });
  return { message: "Location updated successfully" };
};

export const updatePdcDocStatus = async (user, field, value) => {
  const updates = { [field]: value };

  if (field === "aadhar_status" && value === "Accept") {
    updates.aadhar_reject_reason = null;
  } else if (field === "aadhar_reject_reason") {
    updates.aadhar_status = "Reject";
  } else if (field === "pan_status") {
    updates.pancard_status = value;
    if (value === "Accept") {
      updates.pan_reject_reason = null;
    }
  } else if (field === "pancard_status") {
    updates.pan_status = value;
    if (value === "Accept") {
      updates.pan_reject_reason = null;
    }
  } else if (field === "pan_reject_reason") {
    updates.pan_status = "Reject";
    updates.pancard_status = "Reject";
  } else if (field === "gst_status" && value === "Accept") {
    updates.gst_reject_reason = null;
  } else if (field === "gst_reject_reason") {
    updates.gst_status = "Reject";
  } else if (field === "bank_status" && value === "Accept") {
    updates.bank_reject_reason = null;
  } else if (field === "bank_reject_reason") {
    updates.bank_status = "Reject";
  }

  await adminRepository.updatePdcDocument(user, updates);
  return { message: "Status updated" };
};

export const getBroadcastDistance = async () => {
  const minBroadcasts = await adminRepository.getMinBroadcast();

  const distancesByRole = {};
  if (minBroadcasts && minBroadcasts.length > 0) {
    minBroadcasts.forEach((mb) => {
      distancesByRole[mb.role] = mb.minimum_broadcast_distance;
    });
  }

  return { distancesByRole };
};

export const updateMinBroadcastDistance = async (role, distance) => {
  await adminRepository.updateMinBroadcast(role, distance);
  return { message: "Minimum broadcast distance updated for " + role };
};

export const getOrders = async (statusList) => {
  const query = statusList ? { status: { $in: statusList } } : {};
  const orders = await adminRepository.findOrders(query);
  return { orders };
};

export const getPaginatedOrders = async (
  statusList,
  page,
  limit,
  orderType,
  search,
  scheduleDate,
  pickupPin,
  deliveryPin,
  vehicleType
) => {
  const query = {};
  if (statusList) {
    query.status = { $in: statusList };
  }
  if (orderType) {
    query.order_type = orderType;
  }
  if (search) {
    query.$or = [
      { pickup_location: { $regex: search, $options: "i" } },
      { drop_location: { $regex: search, $options: "i" } },
      { sender_pin_code: { $regex: search, $options: "i" } },
      { receiver_pin_code: { $regex: search, $options: "i" } },
    ];
  }
  if (scheduleDate) {
    query.schedule_date = scheduleDate;
  }
  if (pickupPin) {
    query.sender_pin_code = pickupPin;
  }
  if (deliveryPin) {
    query.receiver_pin_code = deliveryPin;
  }
  if (vehicleType) {
    query.mode_of_transport = vehicleType;
  }

  return await adminRepository.findPaginatedOrders(query, page, limit);
};

export const getPendingOrders = async () => {
  return await getOrders(["pending", "created"]);
};

export const getScheduledOrderStats = async () => {
  const Order = (await import("../orders/order.model.js")).Order;
  const today = new Date();
  
  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDisplayDate = (date) => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); // e.g. "15 Jun 2026"
  };

  const todayDate = new Date(today);
  const todayStr = formatDate(todayDate);

  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatDate(tomorrowDate);

  const dayAfterDate = new Date(today);
  dayAfterDate.setDate(dayAfterDate.getDate() + 2);
  const dayAfterStr = formatDate(dayAfterDate);

  const [totalCount, todayCount, tomorrowCount, dayAfterCount] = await Promise.all([
    Order.countDocuments({ order_type: "scheduled" }),
    Order.countDocuments({ order_type: "scheduled", schedule_date: todayStr }),
    Order.countDocuments({ order_type: "scheduled", schedule_date: tomorrowStr }),
    Order.countDocuments({ order_type: "scheduled", schedule_date: dayAfterStr }),
  ]);

  return {
    total: totalCount,
    today: { count: todayCount, date: todayStr, display: getDisplayDate(todayDate) },
    tomorrow: { count: tomorrowCount, date: tomorrowStr, display: getDisplayDate(tomorrowDate) },
    dayAfter: { count: dayAfterCount, date: dayAfterStr, display: getDisplayDate(dayAfterDate) }
  };
};

export const getScheduledFilters = async () => {
  const Order = (await import("../orders/order.model.js")).Order;
  const filterQuery = { order_type: "scheduled" };
  
  const [pickupPins, deliveryPins, vehicleTypes] = await Promise.all([
    Order.distinct('sender_pin_code', filterQuery),
    Order.distinct('receiver_pin_code', filterQuery),
    Order.distinct('mode_of_transport', filterQuery)
  ]);

  return {
    pickupPins: pickupPins.filter(pin => pin !== null && pin !== "").sort(),
    deliveryPins: deliveryPins.filter(pin => pin !== null && pin !== "").sort(),
    vehicleTypes: vehicleTypes.filter(type => type !== null && type !== "").sort()
  };
};

export const getAssignedOrders = async () => {
  return await getOrders(["assigned"]);
};

export const getInTransitOrders = async () => {
  return await getOrders(["intransit"]);
};

export const getDeliveredOrders = async () => {
  return await getOrders(["delivered"]);
};

export const getBroadcastedOrders = async () => {
  return await getOrders(["broadcasted"]);
};

export const getCustomerCancelledOrders = async () => {
  const orders = await adminRepository.findCustomerCancelledOrders();
  return { orders };
};

export const getDpCancelledOrders = async () => {
  const orders = await adminRepository.findDpCancelledOrders();
  return { orders };
};

export const getAssignOrdersSelect = async (orderId) => {
  const User = await import("../users/user.model.js");
  const dps = await User.User.find({ role: ROLES.DP });
  return { orderId, dps };
};

export const assignDeliveryboy = async (order_id, dp_id) => {
  const order = await adminRepository.findOrderById(order_id);
  if (!order) throw new Error("Order not found");

  await adminRepository.assignDpToOrder(order_id, dp_id, order.user_id);
  return { message: "Order assigned successfully" };
};

export const getParticularOrder = async (order_id) => {
  const order = await adminRepository.findOrderById(order_id);
  if (!order) throw new Error("Order not found");
  return { order: normalizeOrder(order) };
};

export const getFeedbacks = async (role, page = 1, limit = 10) => {
  const query = {};
  if (role === 'User') {
    query.from_customer = { $exists: true, $ne: null };
  } else if (role === 'Delivery Partner') {
    query.from_dp = { $exists: true, $ne: null };
  } else if (role === 'PDC') {
    query.from_pdc = { $exists: true, $ne: null };
  }
  
  return await adminRepository.findPaginatedRatings(query, page, limit);
};

export const getPendingPayments = async (type, startDate, endDate) => {
  const mongoose = await import("mongoose");
  const DpPayout = mongoose.default.model("DpPayout");
  const PdcPayout = mongoose.default.model("PdcPayout");
  const DpDocument = mongoose.default.model("DpDocument");
  const PdcDocument = mongoose.default.model("PdcDocument");
  const User = mongoose.default.model("User");

  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T23:59:59.999Z");

  if (type === ROLES.DP) {
    const payouts = await DpPayout.find({
      settled: 0,
      created_at: { $gte: start, $lte: end },
    }).populate("order_id");

    const groups = {};
    for (const p of payouts) {
      const dpId = p.dp_auth_id.toString();
      if (!groups[dpId]) {
        groups[dpId] = {
          dp_auth_id: dpId,
          name: "",
          total_orders: 0,
          amount_to_pay: 0,
          bank_name: "",
          bank_acc_number: "",
          bank_ifsc: "",
          payout_ids: [],
          order_ids: [],
          orders: [],
        };
      }
      const g = groups[dpId];
      g.amount_to_pay += p.earnings;
      g.total_orders += 1;
      g.payout_ids.push(p._id);
      if (p.order_id) {
        g.order_ids.push(p.order_id._id);
        g.orders.push({
          id: p.order_id._id,
          order_number: p.order_id._id,
          pickup_address: p.order_id.pickup_location,
          delivery_address: p.order_id.drop_location,
          amount: p.earnings,
        });
      }
    }

    const resultList = [];
    for (const dpId of Object.keys(groups)) {
      const g = groups[dpId];
      const user = await User.findById(dpId);
      if (user) {
        g.name = user.name;
      }
      const doc = await DpDocument.findOne({ user_id: dpId });
      if (doc) {
        g.bank_name = doc.bank_name || "";
        g.bank_acc_number = doc.bank_acc_number || "";
        g.bank_ifsc = doc.bank_ifsc || "";
      }
      resultList.push(g);
    }
    return resultList;
  } else {
    const payouts = await PdcPayout.find({
      settled: 0,
      created_at: { $gte: start, $lte: end },
    }).populate("order_id");

    const groups = {};
    for (const p of payouts) {
      const pdcId = p.pdc_auth_id.toString();
      if (!groups[pdcId]) {
        groups[pdcId] = {
          pdc_auth_id: pdcId,
          name: "",
          total_orders: 0,
          amount_to_pay: 0,
          account_no: "",
          ifsc: "",
          bank_name: "",
          payout_ids: [],
          order_ids: [],
          orders: [],
        };
      }
      const g = groups[pdcId];
      g.amount_to_pay += p.earnings;
      g.total_orders += 1;
      g.payout_ids.push(p._id);
      if (p.order_id) {
        g.order_ids.push(p.order_id._id);
        g.orders.push({
          id: p.order_id._id,
          order_number: p.order_id._id,
          pickup_address: p.order_id.pickup_location,
          delivery_address: p.order_id.drop_location,
          amount: p.earnings,
        });
      }
    }

    const resultList = [];
    for (const pdcId of Object.keys(groups)) {
      const g = groups[pdcId];
      const user = await User.findById(pdcId);
      if (user) {
        g.name = user.name;
      }
      const doc = await PdcDocument.findOne({ user_id: pdcId });
      if (doc) {
        g.account_no = doc.account_no || doc.bank_acc_no || "";
        g.ifsc = doc.ifsc || doc.bank_ifsc_code || "";
        g.bank_name = doc.bank_name || "";
      }
      resultList.push(g);
    }
    return resultList;
  }
};

export const settlePayments = async (ids, payable, settlementAmount) => {
  const mongoose = await import("mongoose");
  const DpPayout = mongoose.default.model("DpPayout");
  const PdcPayout = mongoose.default.model("PdcPayout");
  const User = mongoose.default.model("User");
  const Order = mongoose.default.model("Order");

  const user = await User.findById(payable);
  if (!user) {
    throw new Error("User not found");
  }

  let orderIds = [];
  if (user.role === ROLES.DP) {
    await DpPayout.updateMany({ _id: { $in: ids } }, { settled: 1 });
    const payouts = await DpPayout.find({ _id: { $in: ids } });
    orderIds = payouts.map((p) => p.order_id).filter(Boolean);
  } else if (user.role === ROLES.PDC) {
    await PdcPayout.updateMany({ _id: { $in: ids } }, { settled: 1 });
    const payouts = await PdcPayout.find({ _id: { $in: ids } });
    orderIds = payouts.map((p) => p.order_id).filter(Boolean);
  }

  if (orderIds.length > 0) {
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { payment_settled: true },
    );
  }

  await adminRepository.createAdminPayout({
    user_id: payable,
    order_id: orderIds,
    settled_amount: Number(settlementAmount),
  });

  return { message: "Settlement completed successfully" };
};

export const getPastPayments = async (userId, onlySpecificOrder = false) => {
  if (onlySpecificOrder) {
    const query = { status: "Delivered" };
    if (userId) {
      query.user_id = userId;
    }
    const orders = await adminRepository.findOrders(query);
    return { orders };
  }

  const query = {};
  if (userId) {
    query.user_id = userId;
  }
  const payouts = await adminRepository.findAdminPayouts(query);

  const formattedPayouts = payouts.map((p) => ({
    id: p._id,
    user_name: p.user_id?.name || "Unknown",
    role: p.user_id?.role || ROLES.DP,
    settled_amount: p.settled_amount,
    order_id: p.order_id || [],
    created_at: p.created_at
      ? new Date(p.created_at).toISOString().split("T")[0]
      : "N/A",
  }));

  return formattedPayouts;
};

export const getReportData = async (report_type, start_date, end_date) => {
  let reportData = [];
  if (report_type === "order") {
    const orders = await adminRepository.findOrdersInDateRange(
      start_date,
      end_date,
    );
    reportData = orders.map((o) => ({
      id: o._id,
      order_number: o.order_id || o._id,
      customer_name: o.user_id?.name || o.sender_name || "N/A",
      pdc_name: o.pdc_id?.shop_name || "Direct",
      pickup_address: o.pickup_address || o.pickup_location,
      delivery_address: o.drop_location || o.receiver_address || "N/A",
      transport_mode: o.mode_of_transport,
      created_at: o.createdAt
        ? new Date(o.createdAt).toISOString().split("T")[0]
        : "N/A",
      amountWithoutGst: o.charges ? Math.round((o.charges / 1.05) * 100) / 100 : 0,
      gstAmount: o.charges ? Math.round((o.charges - (o.charges / 1.05)) * 100) / 100 : 0,
      status: o.status,
    }));
  } else if (report_type === "user") {
    const users = await adminRepository.findUsersInDateRange(
      start_date,
      end_date,
    );
    reportData = users.map((u) => ({
      id: u._id,
      role: u.role,
      name: u.name,
      phone: u.phone,
      email: u.email,
      registered_at: u.createdAt
        ? new Date(u.createdAt).toISOString().split("T")[0]
        : "N/A",
    }));
  } else if (report_type === "feedback") {
    const ratings = await adminRepository.findRatingsInDateRange(
      start_date,
      end_date,
    );
    reportData = ratings.map((r) => {
      let name = "System";
      let role = ROLES.USER;
      if (r.from_customer) {
        name = r.from_customer.name || "Customer";
        role = ROLES.USER;
      } else if (r.from_dp) {
        name = r.from_dp.name || "Delivery Partner";
        role = ROLES.DP;
      } else if (r.from_pdc) {
        name = r.from_pdc.name || "PDC Hub";
        role = ROLES.PDC;
      }
      return {
        id: r._id,
        user_name: name,
        role: role,
        rating: r.stars || 5,
        comment: r.message || "",
        created_at: r.createdAt
          ? new Date(r.createdAt).toISOString().split("T")[0]
          : "N/A",
      };
    });
  }
  return reportData;
};

export const getDeliverCharges = async () => {
  const allCharges = await adminRepository.findAllDeliverCharges();

  const vehicleCharges = allCharges.map((c) => ({
    id: c._id,
    vehicle_type: c.vehicle_type,
    base_distance: c.base_distance,
    base_price: c.base_price,
    per_km_price: c.per_km_price,
    extra_min_charge: c.extra_min_charge || 0,
    grace_period: c.grace_period || 0,
    pickup_geofence_radius: c.pickup_geofence_radius || 0,
    dp_commission: c.dp_commission !== undefined ? c.dp_commission : 70,
    pdc_commission: c.pdc_commission !== undefined ? c.pdc_commission : 5,
    max_weight: c.max_weight,
    max_height: c.max_height,
    max_width: c.max_width,
    max_length: c.max_length,
    dimension_unit: c.dimension_unit,
  }));

  return {
    vehicle_charges: vehicleCharges,
  };
};

export const updateDeliverCharges = async (updates) => {
  for (const update of updates) {
    const typeName = update.vehicle_type;
    await adminRepository.updateDeliverCharge(typeName, {
      base_distance: update.base_distance,
      base_price: update.base_price,
      per_km_price: update.per_km_price,
      extra_min_charge: update.extra_min_charge !== undefined ? update.extra_min_charge : 0,
      grace_period: update.grace_period !== undefined ? update.grace_period : 5,
      pickup_geofence_radius: update.pickup_geofence_radius !== undefined ? update.pickup_geofence_radius : 100,
      dp_commission: update.dp_commission,
      pdc_commission: update.pdc_commission,
      max_weight: update.max_weight !== undefined ? update.max_weight : 0,
      max_height: update.max_height !== undefined ? update.max_height : 0,
      max_width: update.max_width !== undefined ? update.max_width : 0,
      max_length: update.max_length !== undefined ? update.max_length : 0,
      dimension_unit: update.dimension_unit || "cm",
    });
  }

  return { message: "Vehicle payout parameters updated successfully" };
};

export const addBroadcastPoint = async (name, radius, lat, lon) => {
  const newPoint = await adminRepository.createBroadcastPoint({
    name,
    radius: Number(radius),
    lat: Number(lat),
    lon: Number(lon),
  });
  return {
    message: "Broadcast point created successfully",
    point: {
      id: newPoint._id,
      name: newPoint.name,
      radius: newPoint.radius,
      lat: newPoint.lat,
      lon: newPoint.lon,
      active: newPoint.active,
    },
  };
};

export const getWalletConfigHistory = async () => {
  const history = await adminRepository.findWalletConfigHistory();
  return history;
};

export const getVehicleSubcategories = async () => {
  const { VehicleSubcategory } =
    await import("../deliveryPartner/vehicleSubcategory.model.js");
  const subcategories = await VehicleSubcategory.find().sort({
    vehicle_type: 1,
    created_at: -1,
  });
  return { subcategories };
};

export const addVehicleSubcategory = async (body) => {
  const { VehicleSubcategory } =
    await import("../deliveryPartner/vehicleSubcategory.model.js");
  const existing = await VehicleSubcategory.findOne({
    vehicle_type: body.vehicle_type,
    sub_vehicle_type: { $regex: new RegExp(`^${body.sub_vehicle_type}$`, "i") },
  });
  if (existing) {
    throw new Error(
      "This sub-category already exists for the selected vehicle type",
    );
  }
  const newSubcat = await VehicleSubcategory.create(body);
  return {
    message: "Vehicle subcategory added successfully",
    subcategory: newSubcat,
  };
};

export const editVehicleSubcategory = async (id, body) => {
  const { VehicleSubcategory } =
    await import("../deliveryPartner/vehicleSubcategory.model.js");
  const subcat = await VehicleSubcategory.findById(id);
  if (!subcat) throw new Error("Vehicle subcategory not found");

  if (body.sub_vehicle_type) {
    const existing = await VehicleSubcategory.findOne({
      vehicle_type: body.vehicle_type || subcat.vehicle_type,
      sub_vehicle_type: {
        $regex: new RegExp(`^${body.sub_vehicle_type}$`, "i"),
      },
      _id: { $ne: id },
    });
    if (existing) {
      throw new Error(
        "This sub-category already exists for the selected vehicle type",
      );
    }
  }

  if (body.status === 'Approved') {
    body.is_active = true;
  } else if (body.status === 'Rejected') {
    body.is_active = false;
  }

  Object.assign(subcat, body);
  await subcat.save();
  return {
    message: "Vehicle subcategory updated successfully",
    subcategory: subcat,
  };
};

export const deleteVehicleSubcategory = async (id) => {
  const { VehicleSubcategory } =
    await import("../deliveryPartner/vehicleSubcategory.model.js");
  const subcat = await VehicleSubcategory.findByIdAndDelete(id);
  if (!subcat) throw new Error("Vehicle subcategory not found");
  return { message: "Vehicle subcategory deleted successfully" };
};

export const findNearestDpsForOrders = async (orderIds) => {
  const mongoose = await import("mongoose");
  const Order = mongoose.default.model("Order");
  const PackageDetail = mongoose.default.model("PackageDetail");
  const DeliverCharge = mongoose.default.model("DeliverCharge");
  const DpDetail = mongoose.default.model("DpDetail");
  const User = mongoose.default.model("User");
  const { calculateDistance } = await import("../../common/utils/distance.js");

  // 1. Fetch Orders & Packages
  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (!orders || orders.length === 0) {
    throw new Error("No orders found");
  }

  const packageIds = orders.map((o) => o.package_id).filter(Boolean);
  const packages = await PackageDetail.find({ _id: { $in: packageIds } }).lean();

  // 2. Capacity Math
  let totalWeight = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;

  for (const pkg of packages) {
    totalWeight += parseFloat(pkg.product_weight || 0);
    maxLength = Math.max(maxLength, parseFloat(pkg.product_length || 0));
    maxWidth = Math.max(maxWidth, parseFloat(pkg.product_width || 0));
    maxHeight = Math.max(maxHeight, parseFloat(pkg.product_height || 0));
  }

  // 3. Vehicle Filter
  const vehicleTypes = await DeliverCharge.find().lean();
  const eligibleVehicleTypes = vehicleTypes
    .filter(
      (vt) =>
        vt.max_weight >= totalWeight &&
        vt.max_length >= maxLength &&
        vt.max_width >= maxWidth &&
        vt.max_height >= maxHeight
    )
    .map((vt) => vt.vehicle_type);

  if (eligibleVehicleTypes.length === 0) {
    throw new Error("No vehicle type has enough capacity for these orders");
  }

  // 4. Broadcast Range
  const { distancesByRole } = await getBroadcastDistance();
  const maxDistanceStr = distancesByRole["Delivery Partner"] || "5 km"; // fallback
  const maxDistanceKm = parseFloat(maxDistanceStr.replace(/[^0-9.]/g, "")) || 5;

  // 5. Fetch DPs
  const eligibleDps = await DpDetail.find({
    online: true,
    document_approval: "Approved",
  }).populate("dpDocument").lean();

  // Filter DPs by capable vehicle type
  const capableDps = eligibleDps.filter(
    (dp) =>
      dp.dpDocument &&
      eligibleVehicleTypes.includes(dp.dpDocument.vehicle_type)
  );

  // 6. Distance Math
  const pickupLat = orders[0].sender_latitude;
  const pickupLon = orders[0].sender_longitude;

  const dpsWithDistance = [];
  for (const dp of capableDps) {
    const distanceKm = calculateDistance(
      pickupLat,
      pickupLon,
      dp.latitude,
      dp.longitude
    );
    const user = await User.findById(dp.user_id).select("name phone profile_pic").lean();
    dpsWithDistance.push({
      user_id: dp.user_id,
      name: user?.name || "Unknown DP",
      phone: user?.phone || "",
      profile_pic: dp.profile_img || "",
      distance_km: distanceKm,
      vehicle_type: dp.dpDocument.vehicle_type,
      latitude: dp.latitude,
      longitude: dp.longitude,
    });
  }

  // 7. Filter & Sort
  const nearestDps = dpsWithDistance
    .filter((dp) => dp.distance_km <= maxDistanceKm)
    .sort((a, b) => a.distance_km - b.distance_km);

  return nearestDps;
};

export const assignOrderBundle = async (orderIds, dpIds) => {
  const mongoose = await import("mongoose");
  const Order = mongoose.default.model("Order");
  const { OrderBundle } = await import("../orders/orderBundle.model.js");
  const { Notification } = await import("../notifications/notification.model.js");

  // Generate unique bundle ID
  const bundle_id = `BNDL-${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Verify all orders exist
  const orders = await Order.find({ _id: { $in: orderIds } });
  if (orders.length !== orderIds.length) {
    throw new Error("One or more orders not found");
  }

  // Create Bundle with notified DPs
  const bundle = new OrderBundle({
    bundle_id,
    dp_id: null,
    notified_dps: dpIds,
    orders: orderIds,
    status: "broadcasting"
  });
  await bundle.save();

  // Dispatch Notifications to all selected DPs
  for (const dpId of dpIds) {
    const notify = new Notification({
      notifiable_type: ROLES.DP,
      notifiable_id: dpId,
      title: "New Order Bundle Request!",
      message: `You have received a new Order Bundle (${bundle_id}) containing ${orderIds.length} orders. Open your app to accept.`,
      // Assuming the app can handle a bundle broadcast even without order_id, 
      // or we can pass the bundle_id in the message or add it if Notification schema is expanded.
      order_id: null
    });
    await notify.save();
  }

  // Update order statuses to processing
  await Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: { status: "processing" } }
  );

  return { message: "Bundle broadcasted successfully to selected Delivery Partners", bundle_id, bundle };
};

export const finalizeBundleAssignment = async (bundle_id, dp_id) => {
  const mongoose = await import("mongoose");
  const Order = mongoose.default.model("Order");
  const { OrderBundle } = await import("../orders/orderBundle.model.js");
  const { Notification } = await import("../notifications/notification.model.js");
  const adminRepository = await import("./admin.repository.js");
  const { broadcastToAdmins, sendNotificationToUser } = await import("../../common/services/socket.service.js");
  const { ROLES } = await import("../../constants/index.js");

  // 1. Fetch Bundle
  const bundle = await OrderBundle.findOne({ bundle_id }).populate("orders");
  if (!bundle) throw new Error("Order bundle not found");
  if (bundle.status !== "broadcasting" && bundle.status !== "pending") {
    throw new Error(`Cannot assign bundle in ${bundle.status} status`);
  }

  // 2. Assign each order safely using repository function
  for (const order of bundle.orders) {
    await adminRepository.assignDpToOrder(order._id, dp_id, order.user_id);
  }

  // 3. Update Bundle status to assigned
  bundle.status = "assigned";
  bundle.dp_id = dp_id;
  await bundle.save();

  // 4. Create Notification for the assigned DP
  const notify = new Notification({
    notifiable_type: ROLES.DP,
    notifiable_id: dp_id,
    title: "Order Bundle Assigned",
    message: `Congratulations! Admin has assigned order bundle ${bundle_id} to you.`
  });
  await notify.save();
  sendNotificationToUser(dp_id, { title: notify.title, message: notify.message });

  // 5. Broadcast to Admins to update live tables
  broadcastToAdmins("BUNDLE_ASSIGNED", { bundle_id, dp_id });

  return { message: "Bundle assigned successfully", bundle };
};

export const getBundleResponses = async (bundle_id) => {
  const { OrderBundle } = await import("../orders/orderBundle.model.js");
  const { DpDocument } = await import("../deliveryPartner/dpDocument.model.js");
  const { User } = await import("../users/user.model.js");

  const bundle = await OrderBundle.findOne({ bundle_id })
    .populate('notified_dps', 'name email phone')
    .populate('accepted_dps', 'name email phone')
    .populate('rejected_dps', 'name email phone')
    .lean();

  if (!bundle) {
    throw new Error("Bundle not found");
  }

  // Format responses for the UI
  const responses = [];

  const addDpToResponses = async (dp, responseStatus) => {
    if (!dp) return;
    
    // Fetch vehicle details
    const dpDoc = await DpDocument.findOne({ user_id: dp._id }).lean();
    let vehicleStr = "N/A";
    if (dpDoc) {
      const vNo = dpDoc.vehicle_number || dpDoc.rc_number || "N/A";
      const vType = dpDoc.vehicle_type || "";
      const cap = dpDoc.vehicle_max_capacity ? `${dpDoc.vehicle_max_capacity}T` : "";
      vehicleStr = `${vNo}${vType || cap ? ` · ${vType} ${cap}` : ''}`;
    }

    responses.push({
      id: dp._id,
      name: dp.name,
      phone: dp.phone,
      response: responseStatus,
      time: "-", // Not tracked currently
      vehicle: vehicleStr
    });
  };

  const acceptedIds = bundle.accepted_dps.map(d => d._id.toString());
  const rejectedIds = bundle.rejected_dps.map(d => d._id.toString());

  // Merge all DPs to ensure we don't miss anyone who responded but wasn't originally notified
  const allDpMap = new Map();
  if (bundle.notified_dps) bundle.notified_dps.forEach(dp => allDpMap.set(dp._id.toString(), dp));
  if (bundle.accepted_dps) bundle.accepted_dps.forEach(dp => allDpMap.set(dp._id.toString(), dp));
  if (bundle.rejected_dps) bundle.rejected_dps.forEach(dp => allDpMap.set(dp._id.toString(), dp));

  const uniqueDps = Array.from(allDpMap.values());

  for (const dp of uniqueDps) {
    const idStr = dp._id.toString();
    let status = "Pending";
    if (acceptedIds.includes(idStr)) status = "Accepted";
    else if (rejectedIds.includes(idStr)) status = "Rejected";

    await addDpToResponses(dp, status);
  }

  // Calculate metrics
  const metrics = {
    notified: bundle.notified_dps.length,
    accepted: bundle.accepted_dps.length,
    rejected: bundle.rejected_dps.length,
    pending: bundle.notified_dps.length - bundle.accepted_dps.length - bundle.rejected_dps.length
  };

  return { bundle, responses, metrics };
};

export const getBundleTracking = async (bundle_id) => {
  const { OrderBundle } = await import("../orders/orderBundle.model.js");
  const { DpDocument } = await import("../deliveryPartner/dpDocument.model.js");
  const { User } = await import("../users/user.model.js");

  const bundle = await OrderBundle.findOne({ bundle_id })
    .populate({
      path: 'orders',
      populate: { path: 'user_id', select: 'name email phone' }
    })
    .populate('dp_id', 'name phone email')
    .lean();

  if (!bundle) {
    throw new Error("Bundle not found");
  }

  let dpDoc = null;
  if (bundle.dp_id) {
    dpDoc = await DpDocument.findOne({ user_id: bundle.dp_id._id }).lean();
  }

  return { bundle, dpDoc };
};

export const getActiveBundles = async () => {
  const { OrderBundle } = await import("../orders/orderBundle.model.js");
  
  // Fetch bundles that are in broadcasting, pending, or assigned status
  const bundles = await OrderBundle.find({
    status: { $in: ['broadcasting', 'pending', 'assigned'] }
  })
    .populate('notified_dps', 'name email phone')
    .populate('accepted_dps', 'name email phone')
    .populate('rejected_dps', 'name email phone')
    .populate({
      path: 'orders',
      populate: { path: 'package_id' }
    })
    .sort({ createdAt: -1 })
    .lean();
    
  return { bundles };
};

export const getBundleSummary = async (orderIds) => {
  const mongoose = await import("mongoose");
  const Order = mongoose.default.model("Order");
  const PackageDetail = mongoose.default.model("PackageDetail");
  const DeliverCharge = mongoose.default.model("DeliverCharge");

  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (!orders || orders.length === 0) {
    throw new Error("No orders found");
  }

  const packageIds = orders.map((o) => o.package_id).filter(Boolean);
  const packages = await PackageDetail.find({ _id: { $in: packageIds } }).lean();
  
  // Create a map for quick lookup
  const packageMap = packages.reduce((acc, pkg) => {
    acc[pkg._id.toString()] = pkg;
    return acc;
  }, {});

  const totalProduct = orders.length;
  
  let totalWeight = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;
  
  const orderBreakdown = [];

  let totalPrice = 0;
  let estDistance = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const pkg = packageMap[order.package_id?.toString()];
    const weight = parseFloat(pkg?.product_weight || 0);
    
    totalWeight += weight;
    maxLength = Math.max(maxLength, parseFloat(pkg?.product_length || 0));
    maxWidth = Math.max(maxWidth, parseFloat(pkg?.product_width || 0));
    maxHeight = Math.max(maxHeight, parseFloat(pkg?.product_height || 0));

    totalPrice += parseFloat(order.amount || order.charges || 0);
    estDistance += parseFloat(order.distance || 0);
    
    orderBreakdown.push({
      label: `Order ${i + 1}`,
      order_number: order.order_id || order._id,
      weight
    });
  }

  // Find recommended vehicle
  const vehicleTypes = await DeliverCharge.find().lean();
  // Sort vehicle types by capacity ascending
  vehicleTypes.sort((a, b) => (a.max_weight || 0) - (b.max_weight || 0));
  
  let recommendedVehicle = null;
  for (const vt of vehicleTypes) {
    if (
      vt.max_weight >= totalWeight &&
      vt.max_length >= maxLength &&
      vt.max_width >= maxWidth &&
      vt.max_height >= maxHeight
    ) {
      recommendedVehicle = vt;
      break;
    }
  }

  // Fetch Capable DPs directly
  const capableDps = [];
  if (recommendedVehicle) {
    const DpDetail = mongoose.default.model("DpDetail");
    const DpDocument = mongoose.default.model("DpDocument");
    const User = mongoose.default.model("User");

    // We fetch DPs with matching vehicle type
    const dpDocs = await DpDocument.find({
      vehicle_type: recommendedVehicle.vehicle_type
    }).lean();
    
    for (const doc of dpDocs) {
      if (!doc.user_id) continue;
      
      const [dpDetail, user] = await Promise.all([
        DpDetail.findOne({ user_id: doc.user_id }).lean(),
        User.findById(doc.user_id).lean()
      ]);
      
      if (dpDetail && user) {
        capableDps.push({
          user_id: doc.user_id,
          name: user.name || "Unknown DP",
          phone: user.phone || "",
          profile_pic: dpDetail.profile_img || "",
          vehicle_type: doc.vehicle_type,
          vehicle_no: doc.rc_number || "N/A",
          capacity: recommendedVehicle.max_weight,
          location: dpDetail.location || dpDetail.address || "Unknown Location",
          latitude: dpDetail.latitude,
          longitude: dpDetail.longitude,
          status: dpDetail.online ? "Available" : "On Trip", // Simplified for mockup
          rating: user.rating || 4.5,
          distance_km: (Math.random() * 5 + 1).toFixed(1) // Mock distance since this isn't geo-queried right now, usually done via nearest DP logic
        });
      }
    }
  }

  return {
    totalProduct,
    totalWeight: Number(totalWeight.toFixed(2)),
    totalPrice: Number(totalPrice.toFixed(2)),
    estDistance: Number(estDistance.toFixed(2)),
    orderBreakdown,
    recommendedVehicle: recommendedVehicle || null,
    capableDps,
    vehicleMatrix: vehicleTypes.map(vt => ({
      type: vt.vehicle_type,
      max_weight: vt.max_weight
    }))
  };
};
