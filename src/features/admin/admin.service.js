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
import { PackageDetail } from "../orders/packageDetail.model.js";
import { User } from "../users/user.model.js";
import { sendNotificationToUser } from "../../common/services/socket.service.js";
import { sendPushNotification } from "../../common/services/firebase.service.js";
import { AdminSetting } from "./adminSetting.model.js";
import { DpCancellation } from "../deliveryPartner/dpCancellation.model.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import mongoose from "mongoose";
import { Order } from "../orders/order.model.js";
import { OrderBundle } from "../orders/orderBundle.model.js";
import { DpDocument } from "../deliveryPartner/dpDocument.model.js";

import { MinBroadcastDist } from "../tracking/minBroadcast.model.js";
import { PAYOUT_STATUS } from "../../constants/orderStatus.js";
import { OrderWaitCharge } from "../orders/orderWaitCharge.model.js";
import { VehicleSubcategory } from "../deliveryPartner/vehicleSubcategory.model.js";
import { calculateDistance } from "../../common/utils/distance.js";
import { Notification } from "../notifications/notification.model.js";
import { createRefund } from "../../common/services/refund.service.js";

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
  const recentOrders = await adminRepository.findRecentOrders(5);
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
    insurance: "insurance_status",
    emission: "emission_status",
    permit: "permit_status",
  };

  const rejectFieldMap = {
    aadhar: "adhar_reject_reason",
    dl: "dl_reject_reason",
    bank: "bank_reject_reason",
    rc: "rc_reject_reason",
    rv: "rv_reject_reason",
    insurance: "insurance_reject_reason",
    emission: "emission_reject_reason",
    permit: "permit_reject_reason",
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
    "insurance_status",
    "emission_status",
    "permit_status",
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
    reference2_name,
    reference2_phone,
    dl_expiry_date,
    sub_vehicle_type,
    other_vehicle_details,
    vehicle_min_capacity,
    vehicle_max_capacity,
    insurance_expiry_date,
    emission_expiry_date,
    is_new_vehicle,
    vehicle_registration_date,
    travel_permit_states,
    permit_expiry,
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
    "insurance_document",
    "emission_certificate_document",
    "permit_document",
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
    reference2_name: reference2_name || null,
    reference2_phone: reference2_phone || null,
    dl_expiry_date: dl_expiry_date || null,
    sub_vehicle_type: sub_vehicle_type || null,
    other_vehicle_details: other_vehicle_details || null,
    vehicle_min_capacity: vehicle_min_capacity || null,
    vehicle_max_capacity: vehicle_max_capacity || null,
    insurance_expiry_date: insurance_expiry_date || null,
    emission_expiry_date: emission_expiry_date || null,
    is_new_vehicle: is_new_vehicle === "true" || is_new_vehicle === true,
    vehicle_registration_date: vehicle_registration_date || null,
    travel_permit_states: travel_permit_states
      ? travel_permit_states.split(",").map((s) => s.trim())
      : [],
    permit_expiry: permit_expiry || null,
    insurance_document: uploadResults.insurance_document || null,
    emission_certificate_document:
      uploadResults.emission_certificate_document || null,
    permit_document: uploadResults.permit_document || null,
    adhar_status: "Accept",
    rc_status: "Accept",
    dl_status: "Accept",
    bank_status: "Accept",
    rv_status: "Accept",
    insurance_status: "Accept",
    emission_status: "Accept",
    permit_status: "Accept",
  });

  return { message: "Delivery Partner registered successfully" };
};

export const bulkAddDp = async (dps, files) => {
  const errors = [];

  for (let i = 0; i < dps.length; i++) {
    const dp = dps[i];
    const row = dp.row || i + 1;

    // Basic Details
    if (!dp.name) errors.push({ row, error: "Name is required" });
    if (!dp.phone) errors.push({ row, error: "Phone is required" });
    if (!dp.email) errors.push({ row, error: "Email is required" });
    if (!dp.dob) errors.push({ row, error: "DOB is required" });
    if (!dp.gender) errors.push({ row, error: "Gender is required" });
    if (!dp.address) errors.push({ row, error: "Address is required" });

    // Vehicle Details
    if (!dp.vehicle_type)
      errors.push({ row, error: "Vehicle Type is required" });
    if (!dp.vehicle_number)
      errors.push({ row, error: "Vehicle Number is required" });

    // Document Text Fields
    if (!dp.aadhar_number)
      errors.push({ row, error: "Aadhar Number is required" });
    if (!dp.rc_number) errors.push({ row, error: "RC Number is required" });
    if (!dp.dl_number) errors.push({ row, error: "DL Number is required" });
    if (!dp.bank_name) errors.push({ row, error: "Bank Name is required" });
    if (!dp.bank_acc_number)
      errors.push({ row, error: "Bank Account Number is required" });
    if (!dp.bank_ifsc) errors.push({ row, error: "Bank IFSC is required" });

    const requiredFileFields = [
      "profile_img",
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
    ];

    const optionalFileFields = [
      "insurance_document",
      "emission_certificate_document",
      "permit_document",
    ];

    const allFileFields = [...requiredFileFields, ...optionalFileFields];

    // Document Images Text Validation
    for (const field of allFileFields) {
      if (!dp[field]) {
        if (requiredFileFields.includes(field)) {
          errors.push({
            row,
            error: `Filename text missing in CSV for ${field}`,
          });
        }
      } else {
        // Strict Backend Validation: Check if the actual binary file was successfully received
        const expectedFieldName = `row_${i}_${field}`;
        const hasFile =
          files && files.find((f) => f.fieldname === expectedFieldName);
        if (!hasFile) {
          errors.push({
            row,
            error: `Actual image file missing for '${dp[field]}'. Please ensure you highlighted it and the name matches exactly.`,
          });
        }
      }
    }

    if (dp.phone) {
      const existing = await adminRepository.findUserByPhoneAndType(
        dp.phone,
        ROLES.DP,
      );
      if (existing) {
        errors.push({ row, error: `Phone number ${dp.phone} already exists` });
      }
    }
  }

  if (errors.length > 0) {
    const errorObj = new Error("Bulk Upload Validation Failed");
    errorObj.errors = errors;
    throw errorObj;
  }

  let successCount = 0;
  for (let i = 0; i < dps.length; i++) {
    const dp = dps[i];
    try {
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
        "insurance_document",
        "emission_certificate_document",
        "permit_document",
      ];

      if (files && Array.isArray(files)) {
        for (const field of fileFields) {
          const expectedFieldName = `row_${i}_${field}`;
          const matchedFile = files.find(
            (f) => f.fieldname === expectedFieldName,
          );
          if (matchedFile) {
            const folder =
              field === "profile_img" ? "dp_profiles" : "dp_documents";
            const uploadResult = await uploadToCloudinary(
              matchedFile.path,
              folder,
            );
            if (uploadResult) {
              uploadResults[field] = uploadResult.secure_url;
            }
          }
        }
      }

      const newUser = await adminRepository.createUser({
        name: dp.name,
        phone: dp.phone,
        email: dp.email || "",
        dob: dp.dob || null,
        role: ROLES.DP,
      });

      await adminRepository.createDpDetail({
        user_id: newUser._id,
        dob: dp.dob || null,
        gender: dp.gender || "Other",
        address: dp.address || "",
        profile_img: uploadResults.profile_img || dp.profile_img || null,
        online: false,
        document_approval: "Approved",
        status: "Verified",
      });

      await adminRepository.createDpDocument({
        user_id: newUser._id,
        vehicle_type: dp.vehicle_type,
        aadhar_number: dp.aadhar_number || null,
        aadhar_imgfront:
          uploadResults.aadhar_imgfront || dp.aadhar_imgfront || null,
        aadhar_imgback:
          uploadResults.aadhar_imgback || dp.aadhar_imgback || null,
        rc_number: dp.rc_number || null,
        rc_imgfront: uploadResults.rc_imgfront || dp.rc_imgfront || null,
        rc_imgback: uploadResults.rc_imgback || dp.rc_imgback || null,
        dl_number: dp.dl_number || null,
        dl_imgfront: uploadResults.dl_imgfront || dp.dl_imgfront || null,
        dl_imgback: uploadResults.dl_imgback || dp.dl_imgback || null,
        bank_name: dp.bank_name || null,
        bank_acc_number: dp.bank_acc_number || null,
        bank_ifsc: dp.bank_ifsc || null,
        bank_imagefront:
          uploadResults.bank_imagefront || dp.bank_imagefront || null,
        bank_imageback:
          uploadResults.bank_imageback || dp.bank_imageback || null,
        vehicle_number: dp.vehicle_number,
        residence_img: uploadResults.residence_img || dp.residence_img || null,
        vehicle_img: uploadResults.vehicle_img || dp.vehicle_img || null,
        reference1_name: dp.reference1_name || null,
        reference1_phone: dp.reference1_phone || null,
        reference2_name: dp.reference2_name || null,
        reference2_phone: dp.reference2_phone || null,
        dl_expiry_date: dp.dl_expiry_date || null,
        sub_vehicle_type: dp.sub_vehicle_type || null,
        other_vehicle_details: dp.other_vehicle_details || null,
        vehicle_min_capacity: dp.vehicle_min_capacity || null,
        vehicle_max_capacity: dp.vehicle_max_capacity || null,
        insurance_expiry_date: dp.insurance_expiry_date || null,
        emission_expiry_date: dp.emission_expiry_date || null,
        is_new_vehicle:
          dp.is_new_vehicle === "true" || dp.is_new_vehicle === true,
        vehicle_registration_date: dp.vehicle_registration_date || null,
        travel_permit_states: dp.travel_permit_states
          ? dp.travel_permit_states.split(",").map((s) => s.trim())
          : [],
        permit_expiry: dp.permit_expiry || null,
        insurance_document:
          uploadResults.insurance_document || dp.insurance_document || null,
        emission_certificate_document:
          uploadResults.emission_certificate_document ||
          dp.emission_certificate_document ||
          null,
        permit_document:
          uploadResults.permit_document || dp.permit_document || null,
        status: "Verified",
        adhar_status: "Accept",
        rc_status: "Accept",
        dl_status: "Accept",
        bank_status: "Accept",
        rv_status: "Accept",
        insurance_status: "Accept",
        emission_status: "Accept",
        permit_status: "Accept",
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to insert DP at row ${dp.row}:`, err);
      errors.push({
        row: dp.row,
        error: err.message || "Database insertion failed",
      });
    }
  }

  if (errors.length > 0 && successCount === 0) {
    const errorObj = new Error("All rows failed to register");
    errorObj.errors = errors;
    throw errorObj;
  }

  return {
    message: `Successfully registered ${successCount} Delivery Partners`,
    insertionErrors: errors.length > 0 ? errors : undefined,
  };
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
    reference2_name,
    reference2_phone,
    dl_expiry_date,
    sub_vehicle_type,
    other_vehicle_details,
    vehicle_min_capacity,
    vehicle_max_capacity,
    insurance_expiry_date,
    emission_expiry_date,
    is_new_vehicle,
    vehicle_registration_date,
    travel_permit_states,
    permit_expiry,
  } = body;
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
    reference2_name: reference2_name || null,
    reference2_phone: reference2_phone || null,
    dl_expiry_date: dl_expiry_date || null,
    sub_vehicle_type: sub_vehicle_type || null,
    other_vehicle_details: other_vehicle_details || null,
    vehicle_min_capacity: vehicle_min_capacity || null,
    vehicle_max_capacity: vehicle_max_capacity || null,
    insurance_expiry_date: insurance_expiry_date || null,
    emission_expiry_date: emission_expiry_date || null,
    is_new_vehicle: is_new_vehicle === "true" || is_new_vehicle === true,
    vehicle_registration_date: vehicle_registration_date || null,
    travel_permit_states: travel_permit_states
      ? travel_permit_states.split(",").map((s) => s.trim())
      : [],
    permit_expiry: permit_expiry || null,
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
    "insurance_document",
    "emission_certificate_document",
    "permit_document",
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
    "insurance_document",
    "emission_certificate_document",
    "permit_document",
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

export const getPdcList = async (page = 1, limit = 10, search = "") => {
  const result = await adminRepository.findAllPdcs(page, limit, search);
  return result;
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
    city,
    district,
    state,
    pincode,
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

  const fullAddress = `${address}, ${city}, ${district}, ${state} ${pincode}`;
  const [lat, lng] = await getLatLongFromAddress(fullAddress);

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
    city: city || null,
    district: district || null,
    state: state || null,
    pincode: pincode || null,
    latitude: lat,
    longitude: lng,
    geo_location:
      lat && lng
        ? { type: "Point", coordinates: [lng, lat] }
        : { type: "Point", coordinates: [0, 0] },
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
    city,
    district,
    state,
    pincode,
  } = body;
  const UserModel = mongoose.default.model("User");
  await UserModel.updateOne({ _id: pdcid }, { name, email, phone });

  const updateData = {
    address,
    aadhar_card_no: aadhar,
    gst_no: gst,
    pan_card_no: pan,
    bank_name,
    ifsc: bank_ifsc,
    account_no: bank_acc_no,
    shop_name,
  };

  const fullAddress = `${address}, ${city}, ${district}, ${state} ${pincode}`;
  const [lat, lng] = await getLatLongFromAddress(fullAddress);

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
  vehicleType,
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
      { orderNumber: { $regex: search, $options: "i" } },
      { pickup_location: { $regex: search, $options: "i" } },
      { drop_location: { $regex: search, $options: "i" } },
      { sender_pin_code: { $regex: search, $options: "i" } },
      { receiver_pin_code: { $regex: search, $options: "i" } },
      { sender_name: { $regex: search, $options: "i" } },
      { sender_phone: { $regex: search, $options: "i" } },
      { receiver_name: { $regex: search, $options: "i" } },
      { receiver_phone: { $regex: search, $options: "i" } },
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
  const orders = await adminRepository.findPendingOrders();
  return { orders };
};

export const getScheduledOrderStats = async () => {
  const today = new Date();

  const formatDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDisplayDate = (date) => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }); // e.g. "15 Jun 2026"
  };

  const todayDate = new Date(today);
  const todayStr = formatDate(todayDate);

  const tomorrowDate = new Date(today);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatDate(tomorrowDate);

  const dayAfterDate = new Date(today);
  dayAfterDate.setDate(dayAfterDate.getDate() + 2);
  const dayAfterStr = formatDate(dayAfterDate);

  const [totalCount, todayCount, tomorrowCount, dayAfterCount, pendingCount, completedCount] =
    await Promise.all([
      Order.countDocuments({ order_type: "scheduled" }),
      Order.countDocuments({
        order_type: "scheduled",
        schedule_date: todayStr,
      }),
      Order.countDocuments({
        order_type: "scheduled",
        schedule_date: tomorrowStr,
      }),
      Order.countDocuments({
        order_type: "scheduled",
        schedule_date: dayAfterStr,
      }),
      Order.countDocuments({
        order_type: "scheduled",
        status: "scheduled",
      }),
      Order.countDocuments({
        order_type: "scheduled",
        status: "delivered",
      }),
    ]);

  return {
    total: totalCount,
    pending: pendingCount,
    completed: completedCount,
    today: {
      count: todayCount,
      date: todayStr,
      display: getDisplayDate(todayDate),
    },
    tomorrow: {
      count: tomorrowCount,
      date: tomorrowStr,
      display: getDisplayDate(tomorrowDate),
    },
    dayAfter: {
      count: dayAfterCount,
      date: dayAfterStr,
      display: getDisplayDate(dayAfterDate),
    },
  };
};

export const getScheduledFilters = async () => {
  const filterQuery = { order_type: "scheduled" };

  const [pickupPins, deliveryPins, vehicleTypes] = await Promise.all([
    Order.distinct("sender_pin_code", filterQuery),
    Order.distinct("receiver_pin_code", filterQuery),
    Order.distinct("mode_of_transport", filterQuery),
  ]);

  return {
    pickupPins: pickupPins.filter((pin) => pin !== null && pin !== "").sort(),
    deliveryPins: deliveryPins
      .filter((pin) => pin !== null && pin !== "")
      .sort(),
    vehicleTypes: vehicleTypes
      .filter((type) => type !== null && type !== "")
      .sort(),
  };
};

export const getAssignedOrders = async () => {
  const orders = await adminRepository.findAssignedOrders();
  return { orders };
};

export const getInTransitOrders = async () => {
  const orders = await adminRepository.findInTransitOrders();
  return { orders };
};

export const getDeliveredOrders = async () => {
  return await getOrders(["delivered"]);
};

export const getBroadcastedOrders = async () => {
  const orders = await adminRepository.findBroadcastedOrders();
  return { orders };
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

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  // Get minimum broadcast distance
  const minBroadcast = await MinBroadcastDist.findOne({
    role: { $regex: /^dp$/i },
  });
  const maxDistanceKm = minBroadcast
    ? minBroadcast.minimum_broadcast_distance
    : 5;
  const maxDistanceMeters = maxDistanceKm * 1000;

  // Run the optimized geo-location pipeline to find free DPs
  const targetDps = await DpDetail.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [order.sender_longitude, order.sender_latitude],
        },
        distanceField: "distance_meters",
        maxDistance: maxDistanceMeters,
        spherical: true,
        query: {
          online: true,
          document_approval: "Approved",
          active_order_ids: { $size: 0 },
        },
      },
    },
    // Filter by vehicle type
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
    // Get full user details for the admin dropdown
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
  ]);

  // Extract just the user object to match the exact frontend expectation
  const dps = targetDps.map((dp) => dp.user);

  return { orderId, dps };
};

export const assignDeliveryboy = async (order_id, dp_id) => {
  const order = await adminRepository.findOrderById(order_id);
  if (!order) throw new Error("Order not found");

  if (order.order_type === "schedule") {
    // Current flow: Directly lock the DP and move order to PROCESSING
    await adminRepository.assignDpToOrder(order_id, dp_id, order.user_id);
    return { message: "Order assigned successfully" };
  } else {
    // Normal flow: Send a targeted request without locking immediately
    await adminRepository.sendTargetedRequest(order_id, dp_id, order.user_id);

    // Notify the chosen DP via Socket and FCM
    const packageDetail = await PackageDetail.findOne({
      _id: order.package_id,
    });
    const dpUser = await User.findById(dp_id).select("fcm_tokens");

    const payload = {
      type: "new_order_request",
      order_id: order._id,
      pickup_location: order.pickup_location,
      drop_location: order.drop_location,
      charges: order.charges?.toString() || "0",
      product_description: packageDetail?.product_description || "",
      no_of_items: packageDetail?.no_of_items?.toString() || "1",
    };

    // Socket notification
    sendNotificationToUser(dp_id, payload);

    // FCM Push notification
    if (dpUser?.fcm_tokens?.length > 0) {
      await sendPushNotification(
        dpUser.fcm_tokens,
        "New Order Request!",
        `Pickup: ${order.pickup_location}`,
        payload,
      );
    }
    return { message: "Request sent to Delivery Partner successfully" };
  }
};

export const getParticularOrder = async (order_id) => {
  const order = await adminRepository.findOrderById(order_id);
  if (!order) throw new Error("Order not found");
  return { order: normalizeOrder(order) };
};

export const getFeedbacks = async (role, page = 1, limit = 10) => {
  const query = {};
  if (role === "CUSTOMER") {
    query.from_customer = { $exists: true, $ne: null };
  } else if (role === "DP") {
    query.from_dp = { $exists: true, $ne: null };
  } else if (role === "PDC") {
    query.from_pdc = { $exists: true, $ne: null };
  }

  return await adminRepository.findPaginatedRatings(query, page, limit);
};

import { getExpiryCutoffDate, getLateRevenueCutoffDate } from "../../common/utils/waitingChargeStatus.js";

export const getAdminWaitingCharges = async (status) => {
  const mongoose = await import("mongoose");
  const { getExpiryCutoffDate } = await import("../../common/utils/waitingChargeStatus.js");
  const { DpPayout } = await import("../deliveryPartner/dpPayout.model.js");
  const { User } = await import("../users/user.model.js");
  const { DpDocument } = await import("../deliveryPartner/dpDocument.model.js");
  const { PAYOUT_STATUS } = await import("../../constants/orderStatus.js");
  const cutoff = getExpiryCutoffDate();

  const query = {
    created_at: { $gte: cutoff },
    waiting_charge_earning: { $gt: 0 },
  };

  if (status === "pending") {
    query.waiting_charge_settled = { $in: [0, PAYOUT_STATUS.PENDING] };
  } else if (status === "settled") {
    query.waiting_charge_settled = { $in: [1, PAYOUT_STATUS.COMPLETED] };
  }

  const payouts = await DpPayout.find(query).populate("order_id");

  const orderIdsForWaitCharge = payouts.filter(p => p.order_id).map(p => p.order_id._id);
  const { OrderWaitCharge } = await import("../orders/orderWaitCharge.model.js");
  const waitCharges = await OrderWaitCharge.find({ order_id: { $in: orderIdsForWaitCharge } });
  const waitChargeMap = new Map();
  waitCharges.forEach(wc => waitChargeMap.set(wc.order_id.toString(), wc));

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
    g.amount_to_pay += p.waiting_charge_earning || 0;
    g.total_orders += 1;
    g.payout_ids.push(p._id);
    if (p.order_id) {
      g.order_ids.push(p.order_id._id);

      const wc = waitChargeMap.get(p.order_id._id.toString());

      g.orders.push({
        id: p.order_id._id,
        payout_id: p._id,
        order_number: p.order_id._id,
        pickup_address: p.order_id.pickup_location,
        delivery_address: p.order_id.drop_location,
        amount: p.earnings, // base amount for display
        base_settled: p.settled === PAYOUT_STATUS.COMPLETED || p.settled === 1,
        waiting_charge: p.waiting_charge_earning || 0,
        waiting_charge_settled: p.waiting_charge_settled === PAYOUT_STATUS.COMPLETED || p.waiting_charge_settled === 1,
        total_amount: p.earnings + (p.waiting_charge_earning || 0),
        customer_paid_waiting_charge: wc ? (wc.payment_status === "paid") : false
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
};

export const getLatePaidWaitingCharges = async () => {
  const { OrderWaitCharge } = await import("../orders/orderWaitCharge.model.js");
  const cutoff = getExpiryCutoffDate();
  const lateCutoff = getLateRevenueCutoffDate();

  const rows = await OrderWaitCharge.find({
    created_at: { $lt: cutoff },
    payment_status: "paid",
    paid_at: { $gte: lateCutoff },
  }).populate("order_id").sort({ paid_at: -1 });

  return rows;
};

export const getPendingPayments = async (type, startDate, endDate) => {
  const DpPayout = mongoose.default.model("DpPayout");
  const PdcPayout = mongoose.default.model("PdcPayout");
  const DpDocument = mongoose.default.model("DpDocument");
  const PdcDocument = mongoose.default.model("PdcDocument");
  const User = mongoose.default.model("User");

  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T23:59:59.999Z");

  if (type === ROLES.DP) {
    const payouts = await DpPayout.find({
      $or: [
        { settled: { $in: [0, PAYOUT_STATUS.PENDING] } },
        { waiting_charge_settled: { $in: [0, PAYOUT_STATUS.PENDING] } }
      ],
      created_at: { $gte: start, $lte: end },
    }).populate("order_id");

    // Fetch all related OrderWaitCharge documents to check customer payment status
    const orderIdsForWaitCharge = payouts
      .filter((p) => p.order_id)
      .map((p) => p.order_id._id);
    const waitCharges = await OrderWaitCharge.find({
      order_id: { $in: orderIdsForWaitCharge },
    });
    const waitChargeMap = new Map();
    waitCharges.forEach((wc) => waitChargeMap.set(wc.order_id.toString(), wc));

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
      let pendingForThisOrder = 0;
      if (p.settled === PAYOUT_STATUS.PENDING || p.settled === 0) pendingForThisOrder += p.earnings;
      
      const isExpired = new Date(p.created_at) < getExpiryCutoffDate();
      if ((p.waiting_charge_settled === PAYOUT_STATUS.PENDING || p.waiting_charge_settled === 0) && p.waiting_charge_earning > 0) {
        if (!isExpired) {
          pendingForThisOrder += p.waiting_charge_earning;
        }
      }

      g.amount_to_pay += pendingForThisOrder;
      g.total_orders += 1;
      g.payout_ids.push(p._id);
      if (p.order_id) {
        g.order_ids.push(p.order_id._id);

        const wc = waitChargeMap.get(p.order_id._id.toString());

        g.orders.push({
          id: p.order_id._id,
          payout_id: p._id,
          order_number: p.order_id._id,
          pickup_address: p.order_id.pickup_location,
          delivery_address: p.order_id.drop_location,
          amount: p.earnings,
          base_settled:
            p.settled === PAYOUT_STATUS.COMPLETED || p.settled === 1,
          waiting_charge: p.waiting_charge_earning || 0,
          waiting_charge_settled: p.waiting_charge_settled === PAYOUT_STATUS.COMPLETED || p.waiting_charge_settled === 1,
          waiting_charge_expired: (new Date(p.created_at) < getExpiryCutoffDate()) && !(p.waiting_charge_settled === PAYOUT_STATUS.COMPLETED || p.waiting_charge_settled === 1),
          total_amount: p.earnings + (p.waiting_charge_earning || 0),
          customer_paid_waiting_charge: wc
            ? wc.payment_status === "paid"
            : false,
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

export const settlePayments = async (
  ids,
  payable,
  settlementAmount,
  settle_type = "both",
) => {
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
    const payoutsToSettle = await DpPayout.find({ _id: { $in: ids } });
    const { getExpiryCutoffDate } = await import("../../common/utils/waitingChargeStatus.js");
    const cutoff = getExpiryCutoffDate();

    if (settle_type === "base" || settle_type === "both") {
      await DpPayout.updateMany({ _id: { $in: ids } }, { settled: PAYOUT_STATUS.COMPLETED });
    }
    
    if (settle_type === "waiting" || settle_type === "both") {
      const unexpiredIds = payoutsToSettle
        .filter((p) => new Date(p.created_at) >= cutoff)
        .map((p) => p._id);
        
      if (unexpiredIds.length > 0) {
        await DpPayout.updateMany(
          { _id: { $in: unexpiredIds } },
          { waiting_charge_settled: PAYOUT_STATUS.COMPLETED }
        );
      }
      
      if (settle_type === "waiting" && unexpiredIds.length === 0) {
        throw new Error("Cannot settle expired waiting charges");
      }
    }
    const payouts = await DpPayout.find({ _id: { $in: ids } });

    // Only mark Order as payment_settled if BOTH parts are settled for all payouts
    // (If waiting_charge_earning is 0, we consider the waiting charge part inherently "settled")
    orderIds = payouts
      .filter((p) => {
        const baseSettled =
          p.settled === PAYOUT_STATUS.COMPLETED || p.settled === 1;
        const waitingSettled =
          (p.waiting_charge_earning || 0) === 0 ||
          p.waiting_charge_settled === PAYOUT_STATUS.COMPLETED ||
          p.waiting_charge_settled === 1;
        return baseSettled && waitingSettled;
      })
      .map((p) => p.order_id)
      .filter(Boolean);
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
    settle_type: user.role === ROLES.DP ? (settle_type || 'base') : 'base'
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
    settle_type: p.settle_type || 'base',
    created_at: p.created_at
      ? new Date(p.created_at).toISOString().split("T")[0]
      : "N/A",
  }));

  return formattedPayouts;
};

export const getReportData = async (
  report_type,
  start_date,
  end_date,
  state,
  aip_only,
) => {
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
      amountWithoutGst: o.charges
        ? Math.round((o.charges / 1.05) * 100) / 100
        : 0,
      gstAmount: o.charges
        ? Math.round((o.charges - o.charges / 1.05) * 100) / 100
        : 0,
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
    console.log(ratings);
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
        created_at: r.created_at
          ? new Date(r.created_at).toISOString().split("T")[0]
          : "N/A",
      };
    });
  } else if (report_type === "travel_permit") {
    const dps = await adminRepository.findDpTravelPermits(state, aip_only);
    reportData = dps.map((dp) => {
      const hasAIP = dp.travel_permit_states?.includes(
        "All India Permit (AIP)",
      );
      let permitType = "None";
      if (hasAIP) permitType = "AIP";
      else if (dp.travel_permit_states?.length > 0) permitType = "State";

      let statesDisplay = "N/A";
      if (hasAIP) {
        statesDisplay = "All India";
      } else if (dp.travel_permit_states?.length > 0) {
        statesDisplay = dp.travel_permit_states.join(", ");
      }

      const dpIdStr = (dp.user_id?._id || dp._id).toString();
      const shortDpId = `DP-${dpIdStr.substring(dpIdStr.length - 4).toUpperCase()}`;

      return {
        id: dp._id,
        dp_name: dp.user_id?.name || "N/A",
        dp_id: shortDpId,
        mobile: dp.user_id?.phone || "N/A",
        vehicle: dp.vehicle_number || "N/A",
        permit_type: permitType,
        states: statesDisplay,
        expiry: dp.permit_expiry || "N/A",
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
      extra_min_charge:
        update.extra_min_charge !== undefined ? update.extra_min_charge : 0,
      grace_period: update.grace_period !== undefined ? update.grace_period : 5,
      pickup_geofence_radius:
        update.pickup_geofence_radius !== undefined
          ? update.pickup_geofence_radius
          : 100,
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

export const getVehicleSubcategories = async (type) => {
  const query = type ? { vehicle_type: type } : {};
  const subcategories = await VehicleSubcategory.find(query).sort({
    vehicle_type: 1,
    created_at: -1,
  });
  return { subcategories };
};

export const addVehicleSubcategory = async (body) => {
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

  if (body.status === "Approved") {
    body.is_active = true;

    if (subcat.requested_by) {
      const { DpDocument } = await import("../deliveryPartner/dpDocument.model.js");
      const { sendNotification } = await import("../../common/utils/sendNotification.js");
      const { ROLES } = await import("../../constants/index.js");

      const finalVehicleName = body.sub_vehicle_type || subcat.sub_vehicle_type;
      await DpDocument.findOneAndUpdate(
        { user_id: subcat.requested_by },
        {
          sub_vehicle_type: finalVehicleName,
          other_vehicle_details: null,
        }
      );

      await sendNotification({
        role: ROLES.DP,
        userId: subcat.requested_by,
        title: "Vehicle Category Approved",
        message: `Your requested vehicle type '${finalVehicleName}' has been approved by admin.`,
      });
    }
  } else if (body.status === "Rejected") {
    body.is_active = false;

    if (subcat.requested_by) {
      const { DpDocument } = await import("../deliveryPartner/dpDocument.model.js");
      const { sendNotification } = await import("../../common/utils/sendNotification.js");
      const { ROLES } = await import("../../constants/index.js");

      const rejectedName = body.sub_vehicle_type || subcat.sub_vehicle_type;
      await DpDocument.findOneAndUpdate(
        { user_id: subcat.requested_by },
        {
          rv_status: "Rejected",
          rv_reject_reason: `Your custom vehicle type '${rejectedName}' was rejected. Please select a valid vehicle type.`,
        }
      );

      await sendNotification({
        role: ROLES.DP,
        userId: subcat.requested_by,
        title: "Vehicle Category Rejected",
        message: `Your requested vehicle type '${rejectedName}' was rejected. Please update your vehicle details.`,
      });
    }
  }

  Object.assign(subcat, body);
  await subcat.save();
  return {
    message: "Vehicle subcategory updated successfully",
    subcategory: subcat,
  };
};

export const deleteVehicleSubcategory = async (id) => {
  const subcat = await VehicleSubcategory.findByIdAndDelete(id);
  if (!subcat) throw new Error("Vehicle subcategory not found");
  return { message: "Vehicle subcategory deleted successfully" };
};

export const findNearestDpsForOrders = async (orderIds) => {
  const Order = mongoose.default.model("Order");
  const PackageDetail = mongoose.default.model("PackageDetail");
  const DeliverCharge = mongoose.default.model("DeliverCharge");
  const DpDetail = mongoose.default.model("DpDetail");
  const User = mongoose.default.model("User");

  // 1. Fetch Orders & Packages
  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (!orders || orders.length === 0) {
    throw new Error("No orders found");
  }

  const packageIds = orders.map((o) => o.package_id).filter(Boolean);
  const packages = await PackageDetail.find({
    _id: { $in: packageIds },
  }).lean();

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
  const eligibleVehicleTypes = [orders[0].mode_of_transport];
  if (eligibleVehicleTypes.length === 0 || !eligibleVehicleTypes[0]) {
    throw new Error("Order does not specify a valid vehicle type");
  }

  // 4. Broadcast Range
  const { distancesByRole } = await getBroadcastDistance();
  const maxDistanceStr = distancesByRole[ROLES.DP] || "100"; // fallback
  const maxDistanceKm = parseFloat(maxDistanceStr, "");
  // 5. Fetch DPs via Optimized Aggregation Pipeline
  const lng = parseFloat(orders[0].sender_longitude);
  const lat = parseFloat(orders[0].sender_latitude);
  const maxDistanceMeters = maxDistanceKm * 1000;

  if (isNaN(lng) || isNaN(lat)) {
    throw new Error("Invalid order coordinates for finding DPs");
  }

  const orderTransportMode = orders[0].mode_of_transport;

  const aggregatedDps = await DpDetail.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [lng, lat],
        },
        distanceField: "distance_meters",
        maxDistance: maxDistanceMeters,
        spherical: true,
        query: {
          online: true,
          document_approval: "Approved",
          $or: [
            { active_order_ids: { $size: 0 } },
            { active_order_ids: { $exists: false } },
          ],
        },
      },
    },
    // Filter by vehicle type
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
        "dpDocument.vehicle_type": {
          $regex: new RegExp(`^${orderTransportMode}$`, "i"),
        },
      },
    },
    // Get full user details
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $sort: { distance_meters: 1 },
    },
  ]);
  console.log("Aggregated DPs:", aggregatedDps);
  const nearestDps = aggregatedDps.map((dp) => ({
    user_id: dp.user_id,
    name: dp.user?.name || "Unknown DP",
    phone: dp.user?.phone || "",
    profile_pic: dp.profile_img || "",
    distance_km: dp.distance_meters / 1000,
    vehicle_type: dp.dpDocument.vehicle_type,
    latitude: dp.geo_location?.coordinates?.[1] || dp.latitude,
    longitude: dp.geo_location?.coordinates?.[0] || dp.longitude,
  }));

  return nearestDps;
};

// send bundle orders notification to dp to keep the request and then assign the bundle to the dp who accepts the request first
export const assignOrderBundle = async (orderIds, dpIds) => {
  const Order = mongoose.default.model("Order");
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${year}${month}-S-`;

  const lastBundle = await OrderBundle.findOne({ bundle_id: new RegExp(`^${prefix}`) })
    .sort({ bundle_id: -1 })
    .exec();

  let nextSequenceNumber = 1;
  if (lastBundle && lastBundle.bundle_id) {
    const lastSequenceStr = lastBundle.bundle_id.replace(prefix, "");
    const lastSequenceNumber = parseInt(lastSequenceStr, 10);
    if (!isNaN(lastSequenceNumber)) {
      nextSequenceNumber = lastSequenceNumber + 1;
    }
  }

  const paddedSequence = String(nextSequenceNumber).padStart(4, "0");
  const bundle_id = `${prefix}${paddedSequence}`;

  // Verify all orders exist and populate package details
  const orders = await Order.find({ _id: { $in: orderIds } }).populate(
    "package_id",
  );

  if (orders.length !== orderIds.length) {
    throw new Error("One or more orders not found");
  }

  // Create Bundle with notified DPs
  const bundle = new OrderBundle({
    bundle_id,
    dp_id: null,
    notified_dps: dpIds,
    orders: orderIds,
    status: "broadcasting",
  });
  await bundle.save();

  // Construct the correct payload array for all orders in the bundle
  const bundlePayload = orders.map((order) => ({
    order_id: order._id,
    pickup_location: order.pickup_location,
    drop_location: order.drop_location,
    charges: order.charges?.toString() || "0",
    distance: order.distance?.toString() || "0",
    product_description: order.package_id?.product_description || "",
    no_of_items: order.package_id?.no_of_items?.toString() || "1",
  }));

  const socketMessage = {
    type: "new_bundle_request",
    bundle_id,
    orders: bundlePayload,
  };

  // Dispatch Notifications to all selected DPs
  for (const dpId of dpIds) {
    // Socket notification
    sendNotificationToUser(dpId, socketMessage);
  }

  // Update order statuses to processing
  await Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: { status: "processing" } },
  );

  return {
    message: "Bundle broadcasted successfully to selected Delivery Partners",
    bundle_id,
    bundle,
  };
};

// assing all orders of bundle  to dp who accepts the request first and update the bundle status to assigned and notify the dp about the assignment
export const finalizeBundleAssignment = async (bundle_id, dp_id) => {
  const Order = mongoose.default.model("Order");

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
    message: `Congratulations! Admin has assigned order bundle ${bundle_id} to you.`,
  });

  await notify.save();
  // sendNotificationToUser(dp_id, {
  //   title: notify.title,
  //   message: notify.message,
  // });

  // 5. Broadcast to Admins to update live tables
  broadcastToAdmins("BUNDLE_ASSIGNED", { bundle_id, dp_id });

  return { message: "Bundle assigned successfully", bundle };
};

export const getBundleResponses = async (bundle_id) => {

  const bundle = await OrderBundle.findOne({ bundle_id })
    .populate("notified_dps", "name email phone")
    .populate("accepted_dps", "name email phone")
    .populate("rejected_dps", "name email phone")
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
      const cap = dpDoc.vehicle_max_capacity
        ? `${dpDoc.vehicle_max_capacity}T`
        : "";
      vehicleStr = `${vNo}${vType || cap ? ` · ${vType} ${cap}` : ""}`;
    }

    responses.push({
      id: dp._id,
      name: dp.name,
      phone: dp.phone,
      response: responseStatus,
      time: "-", // Not tracked currently
      vehicle: vehicleStr,
    });
  };

  const acceptedIds = bundle.accepted_dps.map((d) => d._id.toString());
  const rejectedIds = bundle.rejected_dps.map((d) => d._id.toString());

  // Merge all DPs to ensure we don't miss anyone who responded but wasn't originally notified
  const allDpMap = new Map();
  if (bundle.notified_dps)
    bundle.notified_dps.forEach((dp) => allDpMap.set(dp._id.toString(), dp));
  if (bundle.accepted_dps)
    bundle.accepted_dps.forEach((dp) => allDpMap.set(dp._id.toString(), dp));
  if (bundle.rejected_dps)
    bundle.rejected_dps.forEach((dp) => allDpMap.set(dp._id.toString(), dp));

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
    pending:
      bundle.notified_dps.length -
      bundle.accepted_dps.length -
      bundle.rejected_dps.length,
  };

  return { bundle, responses, metrics };
};

export const getBundleTracking = async (bundle_id) => {

  const bundle = await OrderBundle.findOne({ bundle_id })
    .populate({
      path: "orders",
      populate: { path: "user_id", select: "name email phone" },
    })
    .populate("dp_id", "name phone email")
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

  // Fetch bundles that are in broadcasting, pending, or assigned status
  const bundles = await OrderBundle.find({
    status: { $in: ["broadcasting", "pending", "assigned"] },
  })
    .populate("notified_dps", "name email phone")
    .populate("accepted_dps", "name email phone")
    .populate("rejected_dps", "name email phone")
    .populate({
      path: "orders",
      populate: { path: "package_id" },
    })
    .sort({ createdAt: -1 })
    .lean();

  return { bundles };
};

export const getBundleSummary = async (orderIds) => {
  const Order = mongoose.default.model("Order");
  const PackageDetail = mongoose.default.model("PackageDetail");
  const DeliverCharge = mongoose.default.model("DeliverCharge");

  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (!orders || orders.length === 0) {
    throw new Error("No orders found");
  }

  const packageIds = orders.map((o) => o.package_id).filter(Boolean);
  const packages = await PackageDetail.find({
    _id: { $in: packageIds },
  }).lean();

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
      weight,
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

  // Fetch Capable DPs directly using optimized spatial aggregation
  let capableDps = [];
  if (recommendedVehicle && orders.length > 0) {
    const DpDetail = mongoose.default.model("DpDetail");
    const MinBroadcastDist = mongoose.default.model("MinBroadcastDist");

    // Get minimum broadcast distance for DP role
    const minBroadcast = await MinBroadcastDist.findOne({
      role: { $regex: /^dp$/i },
    });
    const maxDistanceKm = minBroadcast
      ? minBroadcast.minimum_broadcast_distance
      : 5;
    const maxDistanceMeters = maxDistanceKm * 1000;

    const firstOrder = orders[0];
    const lng = parseFloat(firstOrder.sender_longitude);
    const lat = parseFloat(firstOrder.sender_latitude);

    if (!isNaN(lng) && !isNaN(lat)) {
      const targetDps = await DpDetail.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lng, lat],
            },
            distanceField: "distance_meters",
            maxDistance: maxDistanceMeters,
            spherical: true,
            query: {
              online: true,
              document_approval: "Approved",
              $or: [
                { active_order_ids: { $exists: false } },
                { active_order_ids: { $size: 0 } },
              ],
            },
          },
        },
        // Filter by vehicle type
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
            "dpDocument.vehicle_type": recommendedVehicle.vehicle_type,
          },
        },
        // Get full user details
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
      ]);

      capableDps = targetDps.map((dp) => ({
        user_id: dp.user_id,
        name: dp.user.name || "Unknown DP",
        phone: dp.user.phone || "",
        profile_pic: dp.profile_img || "",
        vehicle_type: dp.dpDocument.vehicle_type,
        vehicle_no: dp.dpDocument.rc_number || "N/A",
        capacity: recommendedVehicle.max_weight,
        location: dp.location || dp.address || "Unknown Location",
        latitude: dp.latitude,
        longitude: dp.longitude,
        status: dp.online ? "Available" : "On Trip",
        rating: dp.user.rating || 4.5,
        distance_km: (dp.distance_meters / 1000).toFixed(1), // Real calculated distance
      }));
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
    vehicleMatrix: vehicleTypes.map((vt) => ({
      type: vt.vehicle_type,
      max_weight: vt.max_weight,
    })),
  };
};

export const processManualRefund = async (order_id, amount, reason) => {
  const Order = mongoose.default.model("Order");
  const Payment = mongoose.default.model("Payment");
  const WalletTransaction = mongoose.default.model("WalletTransaction");
  const Wallet = mongoose.default.model("Wallet");

  const order = await Order.findById(order_id);
  if (!order) throw new Error("Order not found");

  const refundAmount = Number(amount);
  if (isNaN(refundAmount) || refundAmount <= 0) {
    throw new Error("Invalid refund amount");
  }

  if (refundAmount > order.charges) {
    throw new Error(
      `Refund amount cannot exceed the order charges (₹${order.charges})`,
    );
  }

  let refundType = null;

  if (order.payment_id) {
    // Cashfree Refund
    const payment = await Payment.findById(order.payment_id);
    if (!payment || payment.status !== "SUCCESS") {
      throw new Error("No successful direct payment found for this order");
    }
    await createRefund({
      paymentId: payment.cf_order_id,
      amount: refundAmount,
      notes: { reason: reason || "Admin manual refund" },
    });
    payment.status = "REFUNDED";
    await payment.save();
    refundType = "Cashfree";
  } else if (order.wallet_transaction_id) {
    // Wallet Refund
    const wTx = await WalletTransaction.findById(order.wallet_transaction_id);
    if (!wTx) {
      throw new Error("Wallet transaction not found for this order");
    }
    const wallet = await Wallet.findById(wTx.wallet_id);
    if (!wallet) throw new Error("User wallet not found");

    wallet.balance += refundAmount;
    await wallet.save();
    const refundTransaction = await WalletTransaction.create({
      wallet_id: wallet._id,
      amount: refundAmount,
      type: "credit",
      description: reason
        ? `Admin Refund: ${reason}`
        : `Admin Refund for Order #${order._id}`,
      transaction_type: "refund",
      reference_id: order._id,
      status: "completed",
    });

    order.wallet_transaction_id = refundTransaction._id;
    await order.save();
    refundType = "Wallet";
  } else {
    throw new Error("This order has no associated payment record");
  }

  // Notify User
  await sendNotification({
    role: ROLES.USER,
    userId: order.user_id,
    title: "Manual Refund Processed",
    message: `An admin has processed a manual refund of ₹${refundAmount} for Order #${order._id}.`,
    orderId: order._id,
  });

  return {
    success: true,
    message: `Successfully processed ₹${refundAmount} refund via ${refundType}`,
    order_id: order._id,
    refundAmount,
  };
};

export const blockDp = async (id, is_blocked) => {
  const detail = await adminRepository.findDpDetailById(id);
  if (!detail) throw new Error("DP not found");

  const UserModel = mongoose.default.model("User");
  await UserModel.updateOne(
    { _id: detail.user_id },
    { is_blocked }
  );

  return { message: `Delivery Partner successfully ${is_blocked ? 'blocked' : 'unblocked'}`, is_blocked };
};



// --- DP Cancellation Penalty System ---
export const getDpCancellations = async (month, year) => {
  const queryMonth = parseInt(month) || new Date().getMonth() + 1;
  const queryYear = parseInt(year) || new Date().getFullYear();

  const records = await DpCancellation.aggregate([
    {
      $match: {
        month: queryMonth,
        year: queryYear,
      },
    },
    {
      $group: {
        _id: "$dp_id",
        totalCancellations: { $sum: 1 },
        orders: {
          $push: {
            order_id: "$order_id",
            reason: "$reason",
            date: "$createdAt",
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "dp_user",
      },
    },
    {
      $lookup: {
        from: "dpdetails",
        localField: "_id",
        foreignField: "user_id",
        as: "dp_detail",
      },
    },
    {
      $unwind: { path: "$dp_user", preserveNullAndEmptyArrays: true },
    },
    {
      $unwind: { path: "$dp_detail", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        _id: 1,
        totalCancellations: 1,
        orders: 1,
        name: "$dp_user.name",
        phone: "$dp_user.phone",
        status: "$dp_detail.status",
      },
    },
  ]);

  return { records, month: queryMonth, year: queryYear };
};

export const getCancellationSetting = async () => {
  let setting = await AdminSetting.findOne();
  if (!setting) {
    setting = await AdminSetting.create({});
  }
  return { limit: setting.max_dp_cancellation_limit };
};

export const updateCancellationSetting = async (limit) => {
  if (limit === undefined || limit < 0) {
    throw new Error("Invalid limit value");
  }

  let setting = await AdminSetting.findOne();
  if (!setting) {
    setting = await AdminSetting.create({ max_dp_cancellation_limit: limit });
  } else {
    setting.max_dp_cancellation_limit = limit;
    await setting.save();
  }

  return { message: "Cancellation limit updated successfully", limit: setting.max_dp_cancellation_limit };
};

export const unblockDp = async (dp_id) => {
  const dpDetail = await DpDetail.findOne({ user_id: dp_id });
  if (!dpDetail) {
    throw new Error("DP Detail not found");
  }

  dpDetail.status = null; // Unblock the DP
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  await DpCancellation.deleteMany({ dp_id, month: currentMonth, year: currentYear });

  await dpDetail.save();

  return { message: "DP successfully unblocked and their cancellation penalty record for this month has been reset." };
};
