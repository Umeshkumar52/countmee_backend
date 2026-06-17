import bcrypt from 'bcryptjs';
import * as adminRepository from './admin.repository.js';
import { generateAccessToken, generateRefreshToken } from '../../common/middlewares/auth.middleware.js';
import { uploadToCloudinary } from '../../common/services/cloudinary.service.js';
import { getLatLongFromAddress } from '../tracking/maps.service.js';

export const loginAdmin = async (email, password) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@countmee.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let adminUser = null;
  let isAuthenticated = false;

  if (email === adminEmail && password === adminPassword) {
    isAuthenticated = true;
    adminUser = await adminRepository.findUserByEmailAndType(email, 'admin');
    if (!adminUser) {
      adminUser = await adminRepository.createUser({ name: 'Admin', email, password: 'env', role: 'admin' });
    }
  } else {
    const user = await adminRepository.findUserByEmailAndType(email, 'admin');
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
    await adminUser.save();

    return {
      token,
      refreshToken,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        user_type: adminUser.role,
        role: adminUser.role
      }
    };
  }

  throw new Error('Invalid email or password');
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
    pdcCount
  };
};

export const getDpList = async () => {
  const dpList = await adminRepository.findAllDpDetails();
  return { dpList };
};

export const getDpDetails = async (id) => {
  const dpDetail = await adminRepository.findDpDetailById(id);
  if (!dpDetail) throw new Error('DP not found');

  const dpDocument = await adminRepository.findDpDocumentByUserId(dpDetail.user_id);
  return { dpDetail, dpDocument };
};

export const updateDpDocumentStatus = async (document_id, document_type, status, reason) => {
  const DpDocument = await adminRepository.findDpDocumentByUserId(document_id); // Wait, in the controller: doc = await DpDocument.findById(document_id);
  // Actually, the database operation is on the document primary _id.
  // Let's load the model dynamically or through a query.
  // Wait, let's look at controller logic:
  // const doc = await DpDocument.findById(document_id);
  // Let's create a generic query for DpDocument by ID in our repository.
  const mongoose = await import('mongoose');
  const DpDocModel = mongoose.default.model('DpDocument');
  const DpDetailModel = mongoose.default.model('DpDetail');

  const doc = await DpDocModel.findById(document_id);
  if (!doc) throw new Error('Document not found');

  const fieldMap = {
    aadhar: 'adhar_status',
    dl: 'dl_status',
    bank: 'bank_status',
    rc: 'rc_status',
    rv: 'rv_status'
  };

  const rejectFieldMap = {
    aadhar: 'adhar_reject_reason',
    dl: 'dl_reject_reason',
    bank: 'bank_reject_reason',
    rc: 'rc_reject_reason',
    rv: 'rv_reject_reason'
  };

  const statusField = fieldMap[document_type];
  const rejectField = rejectFieldMap[document_type];

  if (!statusField) throw new Error('Invalid document type');

  doc[statusField] = status;
  if (status === 'Reject') {
    doc[rejectField] = reason || '';
  } else {
    doc[rejectField] = null;
  }

  await doc.save();

  // Re-verify overall DP status
  const allFields = ['adhar_status', 'rc_status', 'dl_status', 'bank_status', 'rv_status'];
  let allVerified = true;
  let atLeastOneRejected = false;
  let anyPending = false;

  for (const f of allFields) {
    if (doc[f] !== 'Accept') allVerified = false;
    if (doc[f] === 'Reject') atLeastOneRejected = true;
    if (doc[f] === null || doc[f] === undefined) anyPending = true;
  }

  let overallStatus = 'Pending';
  if (atLeastOneRejected) overallStatus = 'Rejected';
  else if (allVerified) overallStatus = 'Verified';
  else if (anyPending) overallStatus = 'Pending';

  await DpDetailModel.updateOne({ user_id: doc.user_id }, { status: overallStatus });

  return { message: 'Document status updated successfully' };
};

export const updateDpDocumentApproval = async (userId, document_approval) => {
  const mongoose = await import('mongoose');
  const DpDetailModel = mongoose.default.model('DpDetail');
  await DpDetailModel.findByIdAndUpdate(userId, { document_approval });
  return { message: `Approval status updated to ${document_approval}` };
};

export const addDp = async (body, files) => {
  const { name, phone, email, dob, gender, address, vehicle_type, aadhar_number, rc_number, dl_number, bank_name, bank_acc_number, bank_ifsc, vehicle_number, reference1_name, reference1_phone, reference2_name, reference2_phone } = body;

  const existing = await adminRepository.findUserByPhoneAndType(phone, 'dp');
  if (existing) {
    throw new Error('Delivery Partner Already Exists');
  }

  const newUser = await adminRepository.createUser({
    name,
    phone,
    email,
    role: 'dp'
  });

  const uploadResults = {};
  const fileFields = [
    'profile_img', 'aadhar_imgfront', 'aadhar_imgback', 'rc_imgfront', 'rc_imgback',
    'dl_imgfront', 'dl_imgback', 'residence_img', 'vehicle_img', 'bank_imagefront', 'bank_imgeback'
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      // In the legacy code, multer saved the filename locally. We copy this behavior:
      // Wait, is uploadToCloudinary needed? In the previous legacy code, it just saved the local filename:
      // profile_img = req.files.profile_img[0].filename;
      // Let's keep it as the local filename for consistency or upload to cloudinary if needed.
      // Wait, let's check legacy code: `profile_img = req.files.profile_img[0].filename;`
      // It uses local filenames. So we just save the filename!
      uploadResults[field] = fileObj.filename;
    }
  }

  await adminRepository.createDpDetail({
    user_id: newUser._id,
    dob,
    gender,
    address,
    profile_img: uploadResults.profile_img || null,
    online: 0,
    document_approval: 'Approved',
    status: 'Verified'
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
    bank_imgeback: uploadResults.bank_imgeback || null,
    vehicle_number,
    residence_img: uploadResults.residence_img || null,
    vehicle_img: uploadResults.vehicle_img || null,
    reference1_name,
    reference1_phone,
    reference2_name,
    reference2_phone
  });

  return { message: 'Delivery Partner registered successfully' };
};

export const editDp = async (id, body, files) => {
  const detail = await adminRepository.findDpDetailById(id);
  if (!detail) throw new Error('DP not found');

  const { name, phone, email, dob, gender, address, vehicle_type, aadhar_number, rc_number, dl_number, bank_name, bank_acc_number, bank_ifsc, vehicle_number, reference1_name, reference1_phone, reference2_name, reference2_phone } = body;

  const mongoose = await import('mongoose');
  const UserModel = mongoose.default.model('User');
  await UserModel.updateOne({ _id: detail.user_id }, { name, phone, email });

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
    reference2_name,
    reference2_phone
  };

  const uploadResults = {};
  const fileFields = [
    'profile_img', 'aadhar_imgfront', 'aadhar_imgback', 'rc_imgfront', 'rc_imgback',
    'dl_imgfront', 'dl_imgback', 'residence_img', 'vehicle_img', 'bank_imagefront', 'bank_imgeback'
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      uploadResults[field] = fileObj.filename;
    }
  }

  if (uploadResults.profile_img) {
    detail.profile_img = uploadResults.profile_img;
  }
  detail.dob = dob;
  detail.gender = gender;
  detail.address = address;
  await detail.save();

  // Map remaining file fields to docUpdate
  const remainingFileFields = [
    'aadhar_imgfront', 'aadhar_imgback', 'rc_imgfront', 'rc_imgback',
    'dl_imgfront', 'dl_imgback', 'residence_img', 'vehicle_img', 'bank_imagefront', 'bank_imgeback'
  ];
  for (const f of remainingFileFields) {
    if (uploadResults[f]) {
      docUpdate[f] = uploadResults[f];
    }
  }

  await adminRepository.updateDpDocument(detail.user_id, docUpdate);

  return { message: 'Delivery partner details updated successfully' };
};

export const deleteDp = async (id) => {
  const detail = await adminRepository.findDpDetailById(id);
  if (!detail) throw new Error('DP details not found');

  await adminRepository.deleteDpDocumentByUserId(detail.user_id);
  await adminRepository.deleteUser(detail.user_id);
  await adminRepository.deleteDpDetail(id);

  return { message: 'Delivery Partner Deleted Successfully' };
};

export const getCustomersList = async () => {
  const customers = await adminRepository.findAllCustomers();
  return { customers };
};

export const editCustomer = async (id, body, file) => {
  const user = await adminRepository.findUserById(id);
  if (!user) throw new Error('Customer not found');

  let customer = await adminRepository.findCustomerByUserId(user._id);
  if (!customer) {
    customer = await adminRepository.createCustomerDetails({ user_id: user._id });
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

  return { message: 'Customer updated successfully' };
};

export const deleteCustomer = async (id) => {
  await adminRepository.deleteUser(id);
  await adminRepository.deleteCustomerDetails(id);
  return { message: 'Customer Deleted Successfully' };
};

export const getPdcList = async () => {
  const pdcs = await adminRepository.findAllPdcs();
  return { pdcs };
};

export const getPdcDetails = async (pdcid) => {
  const pdc = await adminRepository.findPdcDocumentByUserId(pdcid);
  if (!pdc) throw new Error('PDC not found');
  return { pdc };
};

export const addPdc = async (body, files) => {
  const { name, email, phone, address, aadhar, gst, pan, bank_name, bank_ifsc, bank_acc_no, shop_name, password1, password2 } = body;

  if (password1 !== password2) {
    throw new Error('Passwords do not match');
  }

  const existing = await adminRepository.findUserByPhoneAndType(phone, 'pdc');
  if (existing) {
    throw new Error('PDC Already Exists');
  }

  const hashedPassword = await bcrypt.hash(password1, 10);
  const newUser = await adminRepository.createUser({
    name,
    email,
    phone,
    password: hashedPassword,
    role: 'pdc'
  });

  const uploadResults = {};
  const fileFields = [
    'gst_doc', 'aadhar_front_image', 'aadhar_back_image', 'pancard_image', 'passbook_image', 'profile_image', 'shop_image'
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      uploadResults[field] = fileObj.filename;
    }
  }

  await adminRepository.createPdcDocument({
    user_id: newUser._id,
    address,
    aadhar_card_no: aadhar,
    gst_no: gst,
    pan_card_no: pan,
    bank_name,
    bank_ifsc_code: bank_ifsc,
    bank_acc_no,
    shop_name,
    gst_doc: uploadResults.gst_doc || null,
    aadhar_front_image: uploadResults.aadhar_front_image || null,
    aadhar_back_image: uploadResults.aadhar_back_image || null,
    pancard_image: uploadResults.pancard_image || null,
    passbook_image: uploadResults.passbook_image || null,
    profile_image: uploadResults.profile_image || null,
    shop_image: uploadResults.shop_image || null,
    status: 1,
    aadhar_status: 'Accept',
    pan_status: 'Accept',
    pancard_status: 'Accept',
    gst_status: 'Accept',
    bank_status: 'Accept'
  });

  return { message: 'PDC Added Successfully' };
};

export const editPdc = async (pdcid, body, files) => {
  const pdc = await adminRepository.findPdcDocumentByUserId(pdcid);
  if (!pdc) throw new Error('PDC not found');

  const { name, email, phone, address, aadhar, gst, pan, bank_name, bank_ifsc, bank_acc_no, shop_name } = body;

  const mongoose = await import('mongoose');
  const UserModel = mongoose.default.model('User');
  await UserModel.updateOne({ _id: pdcid }, { name, email, phone });

  const docUpdate = {
    address,
    aadhar_card_no: aadhar,
    gst_no: gst,
    pan_card_no: pan,
    bank_name,
    bank_ifsc_code: bank_ifsc,
    bank_acc_no,
    shop_name
  };

  const uploadResults = {};
  const fileFields = [
    'gst_doc', 'aadhar_front_image', 'aadhar_back_image', 'pancard_image', 'passbook_image', 'profile_image', 'shop_image'
  ];

  for (const field of fileFields) {
    const fileObj = files?.[field]?.[0] || files?.[field];
    if (fileObj) {
      uploadResults[field] = fileObj.filename;
    }
  }

  for (const f of fileFields) {
    if (uploadResults[f]) {
      docUpdate[f] = uploadResults[f];
    }
  }

  await adminRepository.updatePdcDocument(pdcid, docUpdate);

  return { message: 'PDC updated successfully' };
};

export const deletePdc = async (id) => {
  await adminRepository.deleteUser(id);
  await adminRepository.deletePdcDocument(id);
  return { message: 'PDC Deleted Successfully' };
};

export const activatePdc = async (id) => {
  await adminRepository.updatePdcDocument(id, {
    status: 1,
    aadhar_status: 'Accept',
    pan_status: 'Accept',
    pancard_status: 'Accept',
    gst_status: 'Accept',
    bank_status: 'Accept'
  });
  return { message: 'PDC Activated Successfully' };
};

export const deactivatePdc = async (id) => {
  await adminRepository.updatePdcDocument(id, {
    status: 0,
    aadhar_status: 'Reject',
    pan_status: 'Reject',
    pancard_status: 'Reject',
    gst_status: 'Reject',
    bank_status: 'Reject'
  });
  return { message: 'PDC Deactivated Successfully' };
};

export const updatePdcLocation = async (pdc_id, latitude, longitude) => {
  await adminRepository.updatePdcDocument(pdc_id, { latitude, longitude });
  return { message: 'Location updated successfully' };
};

export const updatePdcDocStatus = async (user, field, value) => {
  const updates = { [field]: value };
  
  if (field === 'aadhar_status' && value === 'Accept') {
    updates.aadhar_reject_reason = null;
  } else if (field === 'aadhar_reject_reason') {
    updates.aadhar_status = 'Reject';
  } else if (field === 'pan_status') {
    updates.pancard_status = value;
    if (value === 'Accept') {
      updates.pan_reject_reason = null;
    }
  } else if (field === 'pancard_status') {
    updates.pan_status = value;
    if (value === 'Accept') {
      updates.pan_reject_reason = null;
    }
  } else if (field === 'pan_reject_reason') {
    updates.pan_status = 'Reject';
    updates.pancard_status = 'Reject';
  } else if (field === 'gst_status' && value === 'Accept') {
    updates.gst_reject_reason = null;
  } else if (field === 'gst_reject_reason') {
    updates.gst_status = 'Reject';
  } else if (field === 'bank_status' && value === 'Accept') {
    updates.bank_reject_reason = null;
  } else if (field === 'bank_reject_reason') {
    updates.bank_status = 'Reject';
  }

  await adminRepository.updatePdcDocument(user, updates);
  return { message: 'Status updated' };
};

export const getBroadcastDistance = async () => {
  const distRecord = await adminRepository.findMinBroadcast();
  const distance = distRecord ? (distRecord.minimum_broadcast_distance ?? distRecord.distance ?? 0) : 0;
  const broadcasts = await adminRepository.findAllBroadcastPoints();
  const formattedBroadcasts = broadcasts.map(b => ({
    id: b._id,
    name: b.name,
    radius: b.radius,
    lat: b.lat,
    lon: b.lon,
    active: b.active
  }));
  return { minBroadcastDistance: distance, broadcasts: formattedBroadcasts };
};

export const updateMinBroadcastDistance = async (distance) => {
  await adminRepository.updateMinBroadcast(distance);
  return { message: 'Minimum broadcast distance updated' };
};

export const getOrders = async (statusList) => {
  const query = statusList ? { status: { $in: statusList } } : {};
  const orders = await adminRepository.findOrders(query);
  return { orders };
};

export const getAssignOrdersSelect = async (orderId) => {
  const User = await import('../users/user.model.js');
  const dps = await User.User.find({ role: 'dp' });
  return { orderId, dps };
};

export const assignDeliveryboy = async (order_id, dp_id) => {
  await adminRepository.updateOrder(order_id, { pickup_dp_id: dp_id, status: 'Accepted' });
  return { message: 'Order assigned successfully' };
};

export const getParticularOrder = async (order_id) => {
  const order = await adminRepository.findOrderById(order_id);
  if (!order) throw new Error('Order not found');
  return { order };
};

export const getFeedbacks = async () => {
  const ratings = await adminRepository.findAllRatings();
  return { ratings };
};

export const getPendingPayments = async (type, startDate, endDate) => {
  const mongoose = await import('mongoose');
  const DpPayout = mongoose.default.model('DpPayout');
  const PdcPayout = mongoose.default.model('PdcPayout');
  const DpDocument = mongoose.default.model('DpDocument');
  const PdcDocument = mongoose.default.model('PdcDocument');
  const User = mongoose.default.model('User');

  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T23:59:59.999Z');

  if (type === 'dp') {
    const payouts = await DpPayout.find({
      settled: 0,
      created_at: { $gte: start, $lte: end }
    }).populate('order_id');

    const groups = {};
    for (const p of payouts) {
      const dpId = p.dp_auth_id.toString();
      if (!groups[dpId]) {
        groups[dpId] = {
          dp_auth_id: dpId,
          name: '',
          total_orders: 0,
          amount_to_pay: 0,
          bank_name: '',
          bank_acc_number: '',
          bank_ifsc: '',
          payout_ids: [],
          order_ids: [],
          orders: []
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
          amount: p.earnings
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
        g.bank_name = doc.bank_name || '';
        g.bank_acc_number = doc.bank_acc_number || '';
        g.bank_ifsc = doc.bank_ifsc || '';
      }
      resultList.push(g);
    }
    return resultList;

  } else {
    const payouts = await PdcPayout.find({
      settled: 0,
      created_at: { $gte: start, $lte: end }
    }).populate('order_id');

    const groups = {};
    for (const p of payouts) {
      const pdcId = p.pdc_auth_id.toString();
      if (!groups[pdcId]) {
        groups[pdcId] = {
          pdc_auth_id: pdcId,
          name: '',
          total_orders: 0,
          amount_to_pay: 0,
          account_no: '',
          ifsc: '',
          bank_name: '',
          payout_ids: [],
          order_ids: [],
          orders: []
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
          amount: p.earnings
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
        g.account_no = doc.account_no || doc.bank_acc_no || '';
        g.ifsc = doc.ifsc || doc.bank_ifsc_code || '';
        g.bank_name = doc.bank_name || '';
      }
      resultList.push(g);
    }
    return resultList;
  }
};

export const settlePayments = async (ids, payable, settlementAmount) => {
  const mongoose = await import('mongoose');
  const DpPayout = mongoose.default.model('DpPayout');
  const PdcPayout = mongoose.default.model('PdcPayout');
  const User = mongoose.default.model('User');
  const Order = mongoose.default.model('Order');

  const user = await User.findById(payable);
  if (!user) {
    throw new Error('User not found');
  }

  let orderIds = [];
  if (user.role === 'dp') {
    await DpPayout.updateMany({ _id: { $in: ids } }, { settled: 1 });
    const payouts = await DpPayout.find({ _id: { $in: ids } });
    orderIds = payouts.map(p => p.order_id).filter(Boolean);
  } else if (user.role === 'pdc') {
    await PdcPayout.updateMany({ _id: { $in: ids } }, { settled: 1 });
    const payouts = await PdcPayout.find({ _id: { $in: ids } });
    orderIds = payouts.map(p => p.order_id).filter(Boolean);
  }

  if (orderIds.length > 0) {
    await Order.updateMany({ _id: { $in: orderIds } }, { payment_settled: true });
  }

  await adminRepository.createAdminPayout({
    user_id: payable,
    order_id: orderIds,
    settled_amount: Number(settlementAmount)
  });

  return { message: 'Settlement completed successfully' };
};

export const getPastPayments = async (userId, onlySpecificOrder = false) => {
  if (onlySpecificOrder) {
    const query = { status: 'Delivered' };
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

  const formattedPayouts = payouts.map(p => ({
    id: p._id,
    user_name: p.user_id?.name || 'Unknown',
    user_type: p.user_id?.role || 'dp',
    settled_amount: p.settled_amount,
    order_id: p.order_id || [],
    created_at: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : 'N/A'
  }));

  return formattedPayouts;
};

export const getReportData = async (report_type, start_date, end_date) => {
  let reportData = [];
  if (report_type === 'order') {
    const orders = await adminRepository.findOrdersInDateRange(start_date, end_date);
    reportData = orders.map(o => ({
      id: o._id,
      order_number: o.order_id || o._id,
      customer_name: o.user_id?.name || o.sender_name || 'N/A',
      pdc_name: o.pdc_id?.shop_name || 'Direct',
      pickup_address: o.pickup_address || o.pickup_location,
      delivery_address: o.delivery_address || o.delivery_location,
      transport_mode: o.mode_of_transport,
      created_at: o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : 'N/A',
      amountWithoutGst: o.charges ? Math.round(o.charges * 100) / 100 : 0,
      gstAmount: o.gst_charges ? Math.round(o.gst_charges * 100) / 100 : 0,
      payoutCost: o.payout ? Math.round(o.payout * 100) / 100 : 0,
      status: o.status
    }));
  } else if (report_type === 'user') {
    const users = await adminRepository.findUsersInDateRange(start_date, end_date);
    reportData = users.map(u => ({
      id: u._id,
      role: u.role,
      name: u.name,
      phone: u.phone,
      email: u.email,
      registered_at: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A'
    }));
  } else if (report_type === 'feedback') {
    const ratings = await adminRepository.findRatingsInDateRange(start_date, end_date);
    reportData = ratings.map(r => {
      let name = 'System';
      let role = 'customer';
      if (r.from_customer) {
        name = r.from_customer.name || 'Customer';
        role = 'customer';
      } else if (r.from_dp) {
        name = r.from_dp.name || 'Delivery Partner';
        role = 'dp';
      } else if (r.from_pdc) {
        name = r.from_pdc.name || 'PDC Hub';
        role = 'pdc';
      }
      return {
        id: r._id,
        user_name: name,
        role: role,
        rating: r.stars || 5,
        comment: r.message || '',
        created_at: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A'
      };
    });
  }
  return reportData;
};

export const getDeliverCharges = async () => {
  const allCharges = await adminRepository.findAllDeliverCharges();
  
  const vehicleMap = {
    'By Hand': 1,
    'Two Wheeler': 2,
    'Three Wheeler': 3,
    'Four Wheeler': 4
  };

  const vehicleCharges = allCharges
    .filter(c => vehicleMap[c.vehicle_type] !== undefined)
    .map(c => ({
      id: vehicleMap[c.vehicle_type],
      vehicle_type: c.vehicle_type,
      base_distance: c.base_distance,
      base_price: c.base_price,
      per_km_price: c.per_km_price
    }));

  const dpRecord = allCharges.find(c => c.vehicle_type === 'dp_charges');
  const pdcRecord = allCharges.find(c => c.vehicle_type === 'pdc_charges');

  return {
    vehicle_charges: vehicleCharges,
    dp_commission: dpRecord ? dpRecord.per_km_price : 70,
    pdc_commission: pdcRecord ? pdcRecord.per_km_price : 5
  };
};

export const updateDeliverCharge = async (vehicle_type, base_distance, base_price, per_km_price) => {
  const vehicleMap = {
    '1': 'By Hand',
    '2': 'Two Wheeler',
    '3': 'Three Wheeler',
    '4': 'Four Wheeler',
    'By Hand': 'By Hand',
    'Two Wheeler': 'Two Wheeler',
    'Three Wheeler': 'Three Wheeler',
    'Four Wheeler': 'Four Wheeler'
  };
  const typeName = vehicleMap[vehicle_type] || 'Unknown';
  await adminRepository.updateDeliverCharge(typeName, {
    base_distance,
    base_price,
    per_km_price
  });
  return { message: 'Vehicle payout parameters updated successfully' };
};

export const updateDpCharge = async (dp_base_charge, dp_per_km_charge) => {
  await adminRepository.updateDeliverCharge('dp_charges', {
    base_distance: dp_base_charge,
    base_price: dp_base_charge,
    per_km_price: dp_per_km_charge
  });
  return { message: 'Delivery partner share rates updated successfully' };
};

export const updatePdcPackageCharge = async (pdc_package_rate) => {
  await adminRepository.updateDeliverCharge('pdc_charges', {
    base_distance: 0,
    base_price: 0,
    per_km_price: pdc_package_rate
  });
  return { message: 'PDC package charge rate updated successfully' };
};

export const addBroadcastPoint = async (name, radius, lat, lon) => {
  const newPoint = await adminRepository.createBroadcastPoint({
    name,
    radius: Number(radius),
    lat: Number(lat),
    lon: Number(lon)
  });
  return {
    message: 'Broadcast point created successfully',
    point: {
      id: newPoint._id,
      name: newPoint.name,
      radius: newPoint.radius,
      lat: newPoint.lat,
      lon: newPoint.lon,
      active: newPoint.active
    }
  };
};

export const getWalletConfigHistory = async () => {
  const history = await adminRepository.findWalletConfigHistory();
  return history;
};
