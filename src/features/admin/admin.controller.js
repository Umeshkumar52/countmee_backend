import * as adminService from "./admin.service.js";
import { validate } from "../../common/utils/validationHelper.js";
import { ApiResponse } from "../../common/utils/responseFormatter.js";
import * as adminValidation from "./admin.validation.js";
import { broadcastOrderToNearbyDPs } from "../orders/orders.service.js";
import { Order } from "../orders/order.model.js";
import { PackageDetail } from "../orders/packageDetail.model.js";
import { ORDER_STATUS } from "../../constants/orderStatus.js";

export const postLogin = async (req, res, next) => {
  try {
    const { email, password, fcmToken } = validate(
      adminValidation.loginSchema,
      req.body,
    );
    const result = await adminService.loginAdmin(email, password, fcmToken);
    return res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const result = await adminService.getDashboardStats();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getDeliveryPartnerPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const result = await adminService.getDpList(page, limit, search);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getDpDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.getDpDetails(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postUpdateDocumentStatus = async (req, res, next) => {
  try {
    const { document_id, document_type, status, reason } = validate(
      adminValidation.updateDocStatusSchema,
      req.body,
    );
    const result = await adminService.updateDpDocumentStatus(
      document_id,
      document_type,
      status,
      reason,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postUpdateAction = async (req, res, next) => {
  try {
    const { userId, document_approval } = validate(
      adminValidation.updateActionSchema,
      req.body,
    );
    const result = await adminService.updateDpDocumentApproval(
      userId,
      document_approval,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAddDp = async (req, res, next) => {
  try {
    const validatedBody = validate(adminValidation.addDpSchema, req.body);
    const result = await adminService.addDp(validatedBody, req.files);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postBulkAddDp = async (req, res, next) => {
  try {
    let dps = [];
    if (req.body.data) {
      dps = JSON.parse(req.body.data);
    } else {
      dps = req.body;
    }

    if (!Array.isArray(dps) || dps.length === 0) {
      throw new Error("No data provided or invalid format");
    }
    const result = await adminService.bulkAddDp(dps, req.files);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({
        success: false,
        message: "Validation Failed",
        errors: err.errors,
      });
    }
    next(err);
  }
};

export const postEditDp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedBody = validate(adminValidation.editDpSchema, req.body);
    const result = await adminService.editDp(id, validatedBody, req.files);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const deleteDp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteDp(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getCustomerPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const result = await adminService.getCustomersList(page, limit, search);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postEditCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedBody = validate(
      adminValidation.editCustomerSchema,
      req.body,
    );
    const result = await adminService.editCustomer(id, validatedBody, req.file);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteCustomer(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getPdcPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const result = await adminService.getPdcList(page, limit, search);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getPdcDetails = async (req, res, next) => {
  try {
    const { pdcid } = req.params;
    const result = await adminService.getPdcDetails(pdcid);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAddPdc = async (req, res, next) => {
  try {
    const validatedBody = validate(adminValidation.addPdcSchema, req.body);
    const result = await adminService.addPdc(validatedBody, req.files);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postEditPdc = async (req, res, next) => {
  try {
    const { pdcid } = req.params;
    const validatedBody = validate(adminValidation.editPdcSchema, req.body);
    const result = await adminService.editPdc(pdcid, validatedBody, req.files);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const deletePdc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deletePdc(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const activatePdc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.activatePdc(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const deactivatePdc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deactivatePdc(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postPdcLocationUpdate = async (req, res, next) => {
  try {
    const { pdc_id } = req.params;
    const { latitude, longitude } = req.body;
    const result = await adminService.updatePdcLocation(
      pdc_id,
      Number(latitude),
      Number(longitude),
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAadharStatus = (req, res, next) =>
  adminService
    .updatePdcDocStatus(req.params.user, "aadhar_status", req.params.value)
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);
export const postPanStatus = (req, res, next) =>
  adminService
    .updatePdcDocStatus(req.params.user, "pan_status", req.params.value)
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);
export const postGstStatus = (req, res, next) =>
  adminService
    .updatePdcDocStatus(req.params.user, "gst_status", req.params.value)
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);
export const postBankStatus = (req, res, next) =>
  adminService
    .updatePdcDocStatus(req.params.user, "bank_status", req.params.value)
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);

export const postAadharReject = (req, res, next) =>
  adminService
    .updatePdcDocStatus(
      req.params.pdcid,
      "aadhar_reject_reason",
      req.params.reason,
    )
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);
export const postPanReject = (req, res, next) =>
  adminService
    .updatePdcDocStatus(
      req.params.pdcid,
      "pan_reject_reason",
      req.params.reason,
    )
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);
export const postGstReject = (req, res, next) =>
  adminService
    .updatePdcDocStatus(
      req.params.pdcid,
      "gst_reject_reason",
      req.params.reason,
    )
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);
export const postBankReject = (req, res, next) =>
  adminService
    .updatePdcDocStatus(
      req.params.pdcid,
      "bank_reject_reason",
      req.params.reason,
    )
    .then((d) => res.json(ApiResponse.success(d)))
    .catch(next);

export const getBroadcastPage = async (req, res, next) => {
  try {
    const result = await adminService.getBroadcastDistance();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postMinBroadcast = async (req, res, next) => {
  try {
    const { role, distance } = validate(
      adminValidation.minBroadcastSchema,
      req.body,
    );
    const result = await adminService.updateMinBroadcastDistance(
      role,
      distance,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAddBroadcastPoint = async (req, res, next) => {
  try {
    const { name, radius, lat, lon } = req.body;
    if (
      !name ||
      radius === undefined ||
      lat === undefined ||
      lon === undefined
    ) {
      throw new Error("Missing required fields name, radius, lat, lon");
    }
    const result = await adminService.addBroadcastPoint(name, radius, lat, lon);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getWalletConfigHistory = async (req, res, next) => {
  try {
    const result = await adminService.getWalletConfigHistory();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getPendingOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getDeliveredOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getDeliveredOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getBroadcastedOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getBroadcastedOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getAssignOrdersSelect = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const result = await adminService.getAssignOrdersSelect(orderId);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postBroadcastOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) throw new Error("Order not found");
    if (order.status == ORDER_STATUS.CREATED) {
      throw new Error(
        "Order has not been payment confirmed yet. Cannot broadcast.",
      );
    }
    const packageDetail = await PackageDetail.findById(order.package_id);
    if (!packageDetail) throw new Error("Package not found");

    await broadcastOrderToNearbyDPs(order, packageDetail, true);

    if (order.status === ORDER_STATUS.CONFIRMED) {
      order.status = ORDER_STATUS.PENDING;
      await order.save();
    }

    return res.json(
      ApiResponse.success(null, "Order successfully broadcasted to nearby DPs"),
    );
  } catch (err) {
    next(err);
  }
};

export const postAssignDeliveryboy = async (req, res, next) => {
  try {
    const { order_id, dp_id } = validate(
      adminValidation.assignDeliveryboySchema,
      req.body,
    );
    const result = await adminService.assignDeliveryboy(order_id, dp_id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getAllOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getPaginatedOrdersPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const orderType = req.query.orderType;
    const search = req.query.search;
    const scheduleDate = req.query.scheduleDate;

    const pickupPin = req.query.pickupPin;
    const deliveryPin = req.query.deliveryPin;
    const vehicleType = req.query.vehicleType;

    let statusList = null;
    if (status && status !== "all") {
      if (status === ORDER_STATUS.PENDING) {
        statusList = [ORDER_STATUS.PENDING, ORDER_STATUS.CREATED];
      } else if (status === ORDER_STATUS.ASSIGNED) {
        statusList = [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ASSIGNED];
      } else if (status === ORDER_STATUS.IN_TRANSIT) {
        statusList = [
          ORDER_STATUS.PACKED,
          ORDER_STATUS.SHIPPED,
          ORDER_STATUS.OUT_FOR_DELIVERY,
        ];
      } else {
        statusList = [status];
      }
    }

    const result = await adminService.getPaginatedOrders(
      statusList,
      page,
      limit,
      orderType,
      search,
      scheduleDate,
      pickupPin,
      deliveryPin,
      vehicleType,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getScheduledOrderStats = async (req, res, next) => {
  try {
    const result = await adminService.getScheduledOrderStats();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getScheduledFilters = async (req, res, next) => {
  try {
    const result = await adminService.getScheduledFilters();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getParticularOrderPage = async (req, res, next) => {
  try {
    const { order_id } = req.params;
    const result = await adminService.getParticularOrder(order_id);
    console.log("Result from getParticularOrder:", result);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getPendingOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getPendingOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getAssignedOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getAssignedOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getIntransitOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getInTransitOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getCustomerCancelledOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getCustomerCancelledOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getDpCancelledOrdersPage = async (req, res, next) => {
  try {
    const result = await adminService.getDpCancelledOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getFeedbackPage = async (req, res, next) => {
  try {
    const { role, page, limit } = req.query;
    const result = await adminService.getFeedbacks(
      role,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getFinancePage = (req, res) => {
  return res.json(ApiResponse.success({ message: "Finance page endpoint" }));
};

export const getPendingPaymentsPage = async (req, res, next) => {
  try {
    const { type, startdate, enddate } = req.query;
    const result = await adminService.getPendingPayments(
      type,
      startdate,
      enddate,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getAdminWaitingChargesPage = async (req, res, next) => {
  try {
    const { status = "pending" } = req.query;
    const result = await adminService.getAdminWaitingCharges(status);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getLatePaidWaitingChargesPage = async (req, res, next) => {
  try {
    const result = await adminService.getLatePaidWaitingCharges();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getViewPaymentsPage = async (req, res, next) => {
  try {
    const result = await adminService.getOrders();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postSettlePayments = async (req, res, next) => {
  try {
    const { ids, payable, settlement_amount, settle_type } = req.body;
    const result = await adminService.settlePayments(
      ids,
      payable,
      settlement_amount,
      settle_type,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getPastPaymentsPage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await adminService.getPastPayments(userId, false);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getPastPaymentsSpecificOrderPage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const result = await adminService.getPastPayments(userId, true);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getReportsPage = (req, res) => {
  return res.json(
    ApiResponse.success({ message: "Reports configuration endpoint" }),
  );
};

export const postReportDataPage = async (req, res, next) => {
  try {
    const { report_type, start_date, end_date, state, aip_only } = validate(
      adminValidation.reportDataSchema,
      req.body,
    );
    const result = await adminService.getReportData(
      report_type,
      start_date,
      end_date,
      state,
      aip_only,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getDeliverChargePage = async (req, res, next) => {
  try {
    const result = await adminService.getDeliverCharges();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postUpdateDeliverCharge = async (req, res, next) => {
  try {
    const validatedBody = validate(
      adminValidation.deliverChargeSchema,
      req.body,
    );
    console.log(
      "Validated body inside postUpdateDeliverCharge:",
      validatedBody,
    );
    const updates = Array.isArray(validatedBody)
      ? validatedBody
      : [validatedBody];
    const result = await adminService.updateDeliverCharges(updates);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getVehicleTypes = async (req, res, next) => {
  try {
    const { type } = req.query;
    const validTypes = [
      "By Hand",
      "Two Wheeler",
      "Three Wheeler",
      "Four Wheeler",
    ];

    if (!type) {
      return res.json(
        ApiResponse.success(
          { vehicleTypes: validTypes },
          "Vehicle types fetched successfully",
        ),
      );
    }

    if (type === "all") {
      const result = await adminService.getVehicleSubcategories();
      return res.json(ApiResponse.success(result));
    }

    if (!validTypes.includes(type)) {
      throw new Error("Invalid vehicle type");
    }

    const result = await adminService.getVehicleSubcategories(type);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAddVehicleSubcategory = async (req, res, next) => {
  try {
    const validatedBody = validate(
      adminValidation.addVehicleSubcategorySchema,
      req.body,
    );
    const result = await adminService.addVehicleSubcategory(validatedBody);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postEditVehicleSubcategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedBody = validate(
      adminValidation.editVehicleSubcategorySchema,
      req.body,
    );
    const result = await adminService.editVehicleSubcategory(id, validatedBody);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const deleteVehicleSubcategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.deleteVehicleSubcategory(id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postNearestDps = async (req, res, next) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error("Please provide an array of orderIds");
    }
    const result = await adminService.findNearestDpsForOrders(orderIds);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAssignBundle = async (req, res, next) => {
  try {
    const { orderIds, dp_id, dp_ids } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error("Please provide an array of orderIds");
    }
    const targetDps = dp_ids || dp_id;
    if (!targetDps) {
      throw new Error("Please provide dp_id or dp_ids");
    }

    // Ensure array for service
    const dpIdsArray = Array.isArray(targetDps) ? targetDps : [targetDps];

    const result = await adminService.assignOrderBundle(orderIds, dpIdsArray);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getBundleResponses = async (req, res, next) => {
  try {
    const { bundle_id } = req.params;
    const result = await adminService.getBundleResponses(bundle_id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getBundleTracking = async (req, res, next) => {
  try {
    const { bundle_id } = req.params;
    const result = await adminService.getBundleTracking(bundle_id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getActiveBundles = async (req, res, next) => {
  try {
    const result = await adminService.getActiveBundles();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAssignBundleFinal = async (req, res, next) => {
  try {
    const { bundle_id, dp_id } = req.body;
    if (!bundle_id || !dp_id) {
      throw new Error("Please provide both bundle_id and dp_id");
    }
    const result = await adminService.finalizeBundleAssignment(
      bundle_id,
      dp_id,
    );
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postBundleSummary = async (req, res, next) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error("Please provide an array of orderIds");
    }
    const result = await adminService.getBundleSummary(orderIds);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const processManualRefund = async (req, res, next) => {
  try {
    const { order_id, amount, reason } = req.body;
    if (!order_id || !amount) {
      throw new Error("order_id and amount are required");
    }
    const result = await adminService.processManualRefund(
      order_id,
      amount,
      reason,
    );
    return res.json(
      ApiResponse.success(result, "Manual refund processed successfully"),
    );
  } catch (err) {
    next(err);
  }
};

// DP Cancellation Penalty System Controllers
export const getDpCancellations = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const result = await adminService.getDpCancellations(month, year);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getCancellationSetting = async (req, res, next) => {
  try {
    const result = await adminService.getCancellationSetting();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const updateCancellationSetting = async (req, res, next) => {
  try {
    const { limit } = req.body;
    const result = await adminService.updateCancellationSetting(limit);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const unblockDp = async (req, res, next) => {
  try {
    const { dp_id } = req.params;
    const result = await adminService.unblockDp(dp_id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const blockDp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;

    if (typeof is_blocked !== "boolean") {
      return res
        .status(400)
        .json(ApiResponse.error("is_blocked must be a boolean"));
    }

    const result = await adminService.blockDp(id, is_blocked);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};
