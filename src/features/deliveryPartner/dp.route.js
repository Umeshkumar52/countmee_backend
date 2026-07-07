import { Router } from 'express';
import * as dpController from './dp.controller.js';
import { authenticate } from '../../common/middlewares/auth.middleware.js';
import { uploadSingle, uploadFields } from '../../common/middlewares/upload.middleware.js';

const router = Router();

// File upload configuration helper for doc fields
const docUploadFields = uploadFields([
  { name: 'aadhar_imgfront', maxCount: 1 },
  { name: 'aadhar_imgback', maxCount: 1 },
  { name: 'rc_imgfront', maxCount: 1 },
  { name: 'rc_imgback', maxCount: 1 },
  { name: 'dl_imgfront', maxCount: 1 },
  { name: 'dl_imgback', maxCount: 1 },
  { name: 'bank_imagefront', maxCount: 1 },
  { name: 'bank_imageback', maxCount: 1 },
  { name: 'residence_img', maxCount: 1 },
  { name: 'vehicle_img', maxCount: 1 },
  { name: 'insurance_document', maxCount: 1 },
  { name: 'emission_certificate_document', maxCount: 1 },
  { name: 'permit_document', maxCount: 1 }
]);

const bankUploadFields = uploadFields([
  { name: 'bank_imagefront', maxCount: 1 },
  { name: 'bank_imageback', maxCount: 1 }
]);

const pickupImageUploadFields = uploadFields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 }
]);

// Apply authentication middleware to all DP endpoints
router.use(authenticate);

// OTP Resend
router.post('/resendPickupOtp', dpController.resendPickupOtp);
router.post('/resendReceiverOtp', dpController.resendReceiverOtp);

// Profile and details submission
router.post('/details', uploadSingle('profile_img'), dpController.dpDetails);
router.post('/documents', docUploadFields, dpController.dpDocuments);
router.post('/reference', dpController.dpReference);
router.post('/documentStatus', dpController.dpDocumentStatus);
router.post('/documentsreupload', docUploadFields, dpController.documentsReupload);

///////////////////////////////////
// New 2nd Phase api for vehicle types and subcategories
router.get('/vehicleTypes', dpController.getVehicleTypes);
router.get('/travelStates', dpController.getTravelStates);
///////////////////////////////////

// Order workflows
router.get('/new_order/:order_id', dpController.new_order);
router.post('/order_accept', dpController.order_accept);
router.post('/arrival', dpController.arrival);
router.post('/cancel_assignment', dpController.cancelAssignment);
router.get('/acceptedOrders/:user_id', dpController.acceptedOrders);
router.post('/pickupOtp', dpController.pickupOtp);
router.post('/pickupOrderImageUpload', pickupImageUploadFields, dpController.pickupOrderImageUpload);
router.post('/bundle-response', dpController.postRespondToBundle);

// Distances and Broadcasters
router.get('/minbroadcast/:order/:lat/:lon', dpController.minBroadcast);
router.post('/brodcastForFindDp', dpController.brodcastForFindDp);
router.get('/broadcastdeliver/:broadcastId', dpController.broadcastDeliver);

// PDC deliveries
router.post('/showpdc', dpController.showNearbyPdc);
router.post('/deliverpdc', dpController.deliverPdc);
router.post('/pdcdeliveryotp', dpController.pdcDeliveryOtp);

// Final drop workflows
router.post('/dropOrderToCustomer', dpController.dropOrderToCustomer);
router.get('/order_history/:user_id', dpController.order_history);
router.post('/request_type', dpController.requestType);
router.get('/totalorder/:user_id', dpController.totalorder);
router.get('/earning_history/:userId', dpController.earning_history);
router.post('/online', dpController.online);

// Documents & Bank details
router.get('/documents/:user_id', dpController.documents);
router.post('/updateBankDetail', bankUploadFields, dpController.updateBankDetail);

// Mapping & Profile
router.get('/customerLocation/:order_id', dpController.customerLocation);
router.post('/findPdcInRoute', dpController.findPdcInRoute);
router.post('/editProfile', uploadSingle('profile_img'), dpController.editProfile);

// Notifications & Ratings
router.get('/myNotifications/:userId', dpController.myNotifications);
router.get('/myRatings/:user_id', dpController.myRatings);
router.post('/rateuser', dpController.rateUser);
router.get('/documentVerificationStatus/:dp_id', dpController.documentVerificationStatus);
router.post('/cancelBroadcast', dpController.cancelBroadcast);

export default router;
