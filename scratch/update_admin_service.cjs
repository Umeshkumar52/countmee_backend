const fs = require('fs');
const file = 'r:/CouteMee/countmee_backend/src/features/admin/admin.service.js';
let content = fs.readFileSync(file, 'utf8');

const target = `  if (body.status === "Approved") {
    body.is_active = true;
  } else if (body.status === "Rejected") {
    body.is_active = false;
  }`;

const replacement = `  if (body.status === "Approved") {
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
        message: \`Your requested vehicle type '\${finalVehicleName}' has been approved by admin.\`,
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
          rv_reject_reason: \`Your custom vehicle type '\${rejectedName}' was rejected. Please select a valid vehicle type.\`,
        }
      );

      await sendNotification({
        role: ROLES.DP,
        userId: subcat.requested_by,
        title: "Vehicle Category Rejected",
        message: \`Your requested vehicle type '\${rejectedName}' was rejected. Please update your vehicle details.\`,
      });
    }
  }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log("Replaced successfully!");
} else {
  // try replacing with looser whitespace matching
  const regex = /if\s*\(\s*body\.status\s*===\s*"Approved"\s*\)\s*\{\s*body\.is_active\s*=\s*true;\s*\}\s*else\s*if\s*\(\s*body\.status\s*===\s*"Rejected"\s*\)\s*\{\s*body\.is_active\s*=\s*false;\s*\}/g;
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
    console.log("Replaced successfully using regex!");
  } else {
    console.log("Target not found!");
  }
}
