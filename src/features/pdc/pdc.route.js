import { Router } from "express";
import {
  register,
  login,
  submit_pdc_documents,
  pdc_inner_form,
  submitdocuments,
  register_inner_form,
  submit_pdc_documents_form,
  pdcDocumentStatus,
  pdcProfile,
  pdcHome,
  updatePdcStatus,
  locationUpdate,
  earnings,
  orderHistory,
  readNotifications,
  reloadPartial,
  rateDp,
  logout,
  actionDrop,
  broadcastOrder,
  online,
} from "./pdc.controller.js";
import { uploadFields } from "../../common/middlewares/upload.middleware.js";
import {
  authenticate,
  authorize,
} from "../../common/middlewares/auth.middleware.js";

const router = Router();

// File upload configuration for PDC doc submission
const pdcUploadFields = uploadFields([
  { name: "gst_doc", maxCount: 1 },
  { name: "aadhar_front_image", maxCount: 1 },
  { name: "aadhar_back_image", maxCount: 1 },
  { name: "pancard_image", maxCount: 1 },
  { name: "passbook_image", maxCount: 1 },
  { name: "profile_image", maxCount: 1 },
  { name: "shop_image", maxCount: 1 },
]);

// Public auth routes
router.post("/register", register);
router.post("/login", login);

// Protected PDC routes
router.use(authenticate);
// router.use(authorize(["pdc"]));

router.get("/submit-doc", submitdocuments);
router.get("/inner-registered/:pdcid", pdc_inner_form);
router.put("/inner-register-update", register_inner_form);
router.get("/submit-documents/:pdcid", submit_pdc_documents);
router.post(
  "/submit-documents-form",
  pdcUploadFields,
  submit_pdc_documents_form,
);
router.get("/document-status", pdcDocumentStatus);
router.get("/profile", pdcProfile);
router.get("/home", pdcHome);
router.get("/earning", earnings);
router.get("/order-history", orderHistory);

// Notification and status endpoints
router.post("/read-notification", readNotifications);
router.get("/notifications/unread", reloadPartial);
router.put("/update-assigned-order/:id/:accept_status", updatePdcStatus);
router.put("/online/:id/:online", online);
router.post("/location-update", locationUpdate);
router.post("/rate-dp", rateDp);
router.post("/logout", logout);


// New Actions
router.post("/action-drop", actionDrop);
router.post("/broadcast", broadcastOrder);

export default router;
