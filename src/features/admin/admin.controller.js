import * as adminService from './admin.service.js';
import { validate } from '../../common/utils/validationHelper.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import * as adminValidation from './admin.validation.js';

export const postLogin = async (req, res, next) => {
  try {
    const { email, password } = validate(adminValidation.loginSchema, req.body);
    const result = await adminService.loginAdmin(email, password);
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
    const result = await adminService.getDpList();
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
    const { document_id, document_type, status, reason } = validate(adminValidation.updateDocStatusSchema, req.body);
    const result = await adminService.updateDpDocumentStatus(document_id, document_type, status, reason);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postUpdateAction = async (req, res, next) => {
  try {
    const { userId, document_approval } = validate(adminValidation.updateActionSchema, req.body);
    const result = await adminService.updateDpDocumentApproval(userId, document_approval);
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
    const result = await adminService.getCustomersList();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postEditCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedBody = validate(adminValidation.editCustomerSchema, req.body);
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
    const result = await adminService.getPdcList();
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
    const result = await adminService.updatePdcLocation(pdc_id, Number(latitude), Number(longitude));
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAadharStatus = (req, res, next) => adminService.updatePdcDocStatus(req.params.user, 'aadhar_status', req.params.value).then(d => res.json(ApiResponse.success(d))).catch(next);
export const postPanStatus = (req, res, next) => adminService.updatePdcDocStatus(req.params.user, 'pan_status', req.params.value).then(d => res.json(ApiResponse.success(d))).catch(next);
export const postGstStatus = (req, res, next) => adminService.updatePdcDocStatus(req.params.user, 'gst_status', req.params.value).then(d => res.json(ApiResponse.success(d))).catch(next);
export const postBankStatus = (req, res, next) => adminService.updatePdcDocStatus(req.params.user, 'bank_status', req.params.value).then(d => res.json(ApiResponse.success(d))).catch(next);

export const postAadharReject = (req, res, next) => adminService.updatePdcDocStatus(req.params.pdcid, 'aadhar_reject_reason', req.params.reason).then(d => res.json(ApiResponse.success(d))).catch(next);
export const postPanReject = (req, res, next) => adminService.updatePdcDocStatus(req.params.pdcid, 'pan_reject_reason', req.params.reason).then(d => res.json(ApiResponse.success(d))).catch(next);
export const postGstReject = (req, res, next) => adminService.updatePdcDocStatus(req.params.pdcid, 'gst_reject_reason', req.params.reason).then(d => res.json(ApiResponse.success(d))).catch(next);
export const postBankReject = (req, res, next) => adminService.updatePdcDocStatus(req.params.pdcid, 'bank_reject_reason', req.params.reason).then(d => res.json(ApiResponse.success(d))).catch(next);

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
    const { distance } = validate(adminValidation.minBroadcastSchema, req.body);
    const result = await adminService.updateMinBroadcastDistance(distance);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAddBroadcastPoint = async (req, res, next) => {
  try {
    const { name, radius, lat, lon } = req.body;
    if (!name || radius === undefined || lat === undefined || lon === undefined) {
      throw new Error('Missing required fields name, radius, lat, lon');
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

export const postAssignDeliveryboy = async (req, res, next) => {
  try {
    const { order_id, dp_id } = validate(adminValidation.assignDeliveryboySchema, req.body);
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

export const getParticularOrderPage = async (req, res, next) => {
  try {
    const { order_id } = req.params;
    const result = await adminService.getParticularOrder(order_id);
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
    const result = await adminService.getFeedbacks();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getFinancePage = (req, res) => {
  return res.json(ApiResponse.success({ message: 'Finance page endpoint' }));
};

export const getPendingPaymentsPage = async (req, res, next) => {
  try {
    const { type, startdate, enddate } = req.query;
    const result = await adminService.getPendingPayments(type, startdate, enddate);
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
    const { ids, payable, settlement_amount } = req.body;
    const result = await adminService.settlePayments(ids, payable, settlement_amount);
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
  return res.json(ApiResponse.success({ message: 'Reports configuration endpoint' }));
};

export const postReportDataPage = async (req, res, next) => {
  try {
    const { report_type, start_date, end_date } = validate(adminValidation.reportDataSchema, req.body);
    const result = await adminService.getReportData(report_type, start_date, end_date);
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
    const { vehicle_type, base_distance, base_price, per_km_price, dp_commission, pdc_commission } = validate(adminValidation.deliverChargeSchema, req.body);
    const result = await adminService.updateDeliverCharge(vehicle_type, base_distance, base_price, per_km_price, dp_commission, pdc_commission);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};



export const getVehicleTypes = async (req, res, next) => {
  try {
    const { type } = req.query;
    const validTypes = ['By Hand', 'Two Wheeler', 'Three Wheeler', 'Four Wheeler'];

    if (!type) {
      return res.json(ApiResponse.success({ vehicleTypes: validTypes }, 'Vehicle types fetched successfully'));
    }

    if (type === 'all') {
      const result = await adminService.getVehicleSubcategories();
      return res.json(ApiResponse.success(result));
    }

    if (!validTypes.includes(type)) {
      throw new Error('Invalid vehicle type');
    }

    const result = await adminService.getVehicleSubcategories(type);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postAddVehicleSubcategory = async (req, res, next) => {
  try {
    const validatedBody = validate(adminValidation.addVehicleSubcategorySchema, req.body);
    const result = await adminService.addVehicleSubcategory(validatedBody);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postEditVehicleSubcategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedBody = validate(adminValidation.editVehicleSubcategorySchema, req.body);
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
