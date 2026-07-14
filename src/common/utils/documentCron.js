import cron from "node-cron";
import { DpDocument } from "../../features/deliveryPartner/dpDocument.model.js";
import { sendNotification } from "./sendNotification.js";
import { ROLES } from "../../constants/index.js";

const checkDocumentExpiry = async () => {
  try {
    console.log("[CRON] Starting DP Document Expiry check...");
    
    const dpDocs = await DpDocument.find({
      $or: [
        { dl_expiry_date: { $ne: null, $ne: "" } },
        { insurance_expiry_date: { $ne: null, $ne: "" } },
        { emission_expiry_date: { $ne: null, $ne: "" } },
        { permit_expiry: { $ne: null, $ne: "" } },
      ],
    }).lean();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const checkAndNotify = async (userId, docName, expiryDateStr) => {
      if (!expiryDateStr) return;

      const expiryDate = new Date(expiryDateStr);
      if (isNaN(expiryDate.getTime())) return; 

      expiryDate.setUTCHours(0, 0, 0, 0);

      const diffTime = expiryDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let shouldNotify = false;
      let title = "";
      let message = "";

      if (daysLeft === 30) {
        shouldNotify = true;
        title = `Document Expiry Warning`;
        message = `Your ${docName} will expire in exactly 1 month on ${expiryDateStr}. Please update it soon.`;
      } else if (daysLeft < 30 && daysLeft > 0 && (30 - daysLeft) % 7 === 0) {
        shouldNotify = true;
        title = `Document Expiry Reminder`;
        message = `Reminder: Your ${docName} expires in ${daysLeft} days (${expiryDateStr}).`;
      } else if (daysLeft === 0) {
        shouldNotify = true;
        title = `Document Expired`;
        message = `Your ${docName} has expired today. Please upload a new one immediately.`;
      }

      if (shouldNotify) {
        await sendNotification({
          role: ROLES.DELIVERY_PARTNER,
          userId: userId,
          title,
          message,
        });
      }
    };

    for (const doc of dpDocs) {
      const userId = doc.user_id;
      if (!userId) continue;

      await checkAndNotify(userId, "Driving License", doc.dl_expiry_date);
      await checkAndNotify(userId, "Vehicle Insurance", doc.insurance_expiry_date);
      await checkAndNotify(userId, "Emission Certificate", doc.emission_expiry_date);
      await checkAndNotify(userId, "Travel Permit", doc.permit_expiry);
    }

    console.log("[CRON] DP Document Expiry check completed successfully.");
  } catch (error) {
    console.error("[CRON] Error during DP Document Expiry check:", error);
  }
};

export const initDocumentCron = () => {
  cron.schedule("0 0 * * *", checkDocumentExpiry);
  console.log("[CRON] Document Expiry cron job initialized (Runs at 00:00 daily)");
};
