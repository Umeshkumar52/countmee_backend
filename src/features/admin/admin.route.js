import { Router } from 'express';
import * as adminController from './admin.controller.js';
import * as adminWalletController from './adminWallet.controller.js';
import * as adminVerificationController from './adminVerification.controller.js';
import { uploadSingle, uploadFields, uploadAny } from '../../common/middlewares/upload.middleware.js';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware.js';
import { ROLES } from '../../constants/index.js';

const router = Router();

// File upload configurations
const dpUploadFields = uploadFields([
  { name: 'profile_img', maxCount: 1 },
  { name: 'aadhar_imgfront', maxCount: 1 },
  { name: 'aadhar_imgback', maxCount: 1 },
  { name: 'rc_imgfront', maxCount: 1 },
  { name: 'rc_imgback', maxCount: 1 },
  { name: 'dl_imgfront', maxCount: 1 },
  { name: 'dl_imgback', maxCount: 1 },
  { name: 'residence_img', maxCount: 1 },
  { name: 'vehicle_img', maxCount: 1 },
  { name: 'bank_imagefront', maxCount: 1 },
  { name: 'bank_imageback', maxCount: 1 },
  { name: 'insurance_document', maxCount: 1 },
  { name: 'emission_certificate_document', maxCount: 1 },
  { name: 'permit_document', maxCount: 1 }
]);

const pdcUploadFields = uploadFields([
  { name: 'gst_doc', maxCount: 1 },
  { name: 'aadhar_front_image', maxCount: 1 },
  { name: 'aadhar_back_image', maxCount: 1 },
  { name: 'pancard_image', maxCount: 1 },
  { name: 'passbook_image', maxCount: 1 },
  { name: 'profile_image', maxCount: 1 },
  { name: 'shop_image', maxCount: 1 }
]);

// Public login API
router.post('/login', adminController.postLogin);

// Protected Admin REST API routes
router.use(authenticate);
router.use(authorize([ROLES.ADMIN]));

router.get('/dashboard', adminController.getDashboard);

// Delivery Partner (DP) Management
router.get('/deliverypartner', adminController.getDeliveryPartnerPage);
router.get('/dpDetails/:id', adminController.getDpDetails);
router.post('/update-document-status', adminController.postUpdateDocumentStatus);
router.post('/update-action', adminController.postUpdateAction);
router.post('/adddp', dpUploadFields, adminController.postAddDp);
router.post('/bulk-adddp', uploadAny(), adminController.postBulkAddDp);
router.delete('/delete_dp/:id', adminController.deleteDp);
router.put('/editdp/:id', dpUploadFields, adminController.postEditDp);

// Customer Management
router.get('/customer', adminController.getCustomerPage);
router.put('/editcustomer/:id', uploadSingle('profile_pic'), adminController.postEditCustomer);
router.delete('/deleteCustomer/:id', adminController.deleteCustomer);

// PDC Management
router.get('/pdc', adminController.getPdcPage);
router.post('/addpdc', pdcUploadFields, adminController.postAddPdc);
router.put('/activatepdc/:id', adminController.activatePdc);
router.put('/deactivatepdc/:id', adminController.deactivatePdc);
router.put('/editpdc/:pdcid', pdcUploadFields, adminController.postEditPdc);
router.delete('/deletepdc/:id', adminController.deletePdc);
router.get('/pdcdetails/:pdcid', adminController.getPdcDetails);
router.post('/pdcdetail/location-update/:pdc_id', adminController.postPdcLocationUpdate);

// Document status updates & rejections for PDC
router.post('/aadhar_status/:user/:value', adminController.postAadharStatus);
router.post('/aadhar_reject/:pdcid/:reason', adminController.postAadharReject);
router.post('/pan_status/:user/:value', adminController.postPanStatus);
router.post('/pan_reject/:pdcid/:reason', adminController.postPanReject);
router.post('/gst_status/:user/:value', adminController.postGstStatus);
router.post('/gst_reject/:pdcid/:reason', adminController.postGstReject);
router.post('/bank_status/:user/:value', adminController.postBankStatus);
router.post('/bank_reject/:pdcid/:reason', adminController.postBankReject);

// Broadcast settings
router.get('/broadcast', adminController.getBroadcastPage);
router.post('/broadcast', adminController.postAddBroadcastPoint);
router.post('/minbroadcast', adminController.postMinBroadcast);

// Order Management
router.get('/orders/paginated', adminController.getPaginatedOrdersPage);
router.get('/orders/scheduled-stats', adminController.getScheduledOrderStats);
router.get('/orders/scheduled-filters', adminController.getScheduledFilters);
router.get('/orders', adminController.getOrdersPage);
router.post('/orders/:id/broadcast', adminController.postBroadcastOrder);
router.post('/refund-order', adminController.processManualRefund);
router.get('/orders/delivered', adminController.getDeliveredOrdersPage);
router.get('/orders/broadcasted', adminController.getBroadcastedOrdersPage);
router.get('/assignordersselect/:orderId', adminController.getAssignOrdersSelect);
router.post('/assigndeliveryboy', adminController.postAssignDeliveryboy);
router.get('/allorders', adminController.getAllOrdersPage);
router.get('/orderview/:order_id', adminController.getParticularOrderPage);
router.get('/pendingorders', adminController.getPendingOrdersPage);
router.get('/assignedorders', adminController.getAssignedOrdersPage);
router.get('/intransitorders', adminController.getIntransitOrdersPage);
router.get('/customerCancelledOrders', adminController.getCustomerCancelledOrdersPage);
router.get('/dpcancelledorders', adminController.getDpCancelledOrdersPage);

// Feedbacks & Ratings
router.get('/feedback', adminController.getFeedbackPage);

// Finance Management
router.get('/finance', adminController.getFinancePage);
router.get('/pendingpayments', adminController.getPendingPaymentsPage);
router.get('/viewpayments', adminController.getViewPaymentsPage);
router.post('/settlepayments', adminController.postSettlePayments);
router.get('/pastpaymentsview/:userId?', adminController.getPastPaymentsPage);
router.get('/pastpaymentsviewspecificorder/:userId?', adminController.getPastPaymentsSpecificOrderPage);

// Reports Management
router.get('/reports', adminController.getReportsPage);
router.post('/reportdata', adminController.postReportDataPage);

// Delivery Charges configuration
router.get('/deliver_charge', adminController.getDeliverChargePage);
router.post('/deliver_charge', adminController.postUpdateDeliverCharge);

/////////////////////////////////////////////////////////
// 2nd Phase New Api= Vehicle Subcategories configuration
router.get('/vehicleTypes', adminController.getVehicleTypes);
router.post('/vehicle_subcategories', adminController.postAddVehicleSubcategory);
router.put('/vehicle_subcategories/:id', adminController.postEditVehicleSubcategory);
router.delete('/vehicle_subcategories/:id', adminController.deleteVehicleSubcategory);
////////////////////////////////////////////////////////


// Wallet Management
router.get('/wallets', adminWalletController.getWallets);
router.get('/wallets/:id', adminWalletController.getWalletDetails);
router.post('/wallets/credit/individual', adminWalletController.postCreditIndividual);
router.post('/wallets/credit/customer', adminWalletController.postCreditCustomer);
router.post('/wallets/credit/mass', adminWalletController.postCreditMass);
router.get('/wallet-config', adminWalletController.getWalletConfig);
router.get('/wallet-config/history', adminController.getWalletConfigHistory);
router.post('/wallet-config/joining-bonus', adminWalletController.postUpdateJoiningBonus);
router.get('/wallets/verify-user/:phone', adminWalletController.getVerifyUser);
router.get('/wallets/user-transactions/:user_id', adminWalletController.getUserTransactions);
router.get('/wallets/mass-credit-recipients/:log_id', adminWalletController.getMassCreditRecipients);

// Security Verification for Wallets
router.post('/wallets/verify-credentials', adminVerificationController.postVerifyCredentials);
router.post('/wallets/send-otp', adminVerificationController.postSendOtp);
router.post('/wallets/verify-otp', adminVerificationController.postVerifyOtp);

// Nearest DP logic
router.post('/orders/nearest-dps', adminController.postNearestDps);

// Assign Order Bundle
router.post('/orders/assign-bundle', adminController.postAssignBundle);

router.get('/orders/bundles', adminController.getActiveBundles);
router.get('/orders/bundle-responses/:bundle_id', adminController.getBundleResponses);
router.get('/orders/bundle-tracking/:bundle_id', adminController.getBundleTracking);
router.post('/orders/assign-bundle-final', adminController.postAssignBundleFinal);

// Bundle Summary
router.post('/orders/bundle-summary', adminController.postBundleSummary);

export default router;
