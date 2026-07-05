import { Agenda } from "agenda";
import { OrderRequest } from "../../features/orders/orderRequest.model.js";
import { Order } from "../../features/orders/order.model.js";
import { DpDetail } from "../../features/deliveryPartner/dpDetail.model.js";
import { sendNotification } from "../utils/sendNotification.js";
import { ROLES } from "../../constants/index.js";
import { PdcDocument } from "../../features/pdc/pdcDocument.model.js";
import { Broadcast } from "../../features/orders/broadcast.model.js";
import { getAllCachedDpLocations } from "./redis.service.js";

let agenda;

import mongoose from "mongoose";

export const initAgenda = async () => {
  agenda = new Agenda({
    db: { address: process.env.MONGODB_URI, collection: "agendaJobs" },
  });

  agenda.define("auto-accept-pdc", async (job) => {
    const { order_id, order_request_id } = job.attrs.data;

    try {
      const orderRequest = await OrderRequest.findById(order_request_id);
      // Check if it's still pending
      if (
        orderRequest &&
        (orderRequest.status === "Pending" || orderRequest.status == null) &&
        orderRequest.request_type === "deliver to pdc"
      ) {
        orderRequest.status = "Accepted"; // accepted
        orderRequest.accepted_by = orderRequest.notified_ids[0]; // The PDC who accepted
        await orderRequest.save();

        // Notify PDC and DP
        await sendNotification({
          role: ROLES.DP,
          userId: orderRequest.requested_by,
          title: "Drop-off Auto-Accepted",
          message: `Your drop-off at PDC has been automatically accepted.`,
          orderId: order_id,
        });

        await sendNotification({
          role: ROLES.PDC,
          userId: orderRequest.notified_ids[0],
          title: "Auto-Accepted Parcel",
          message: `You automatically accepted a parcel drop-off from DP.`,
          orderId: order_id,
        });

        console.log(
          `[Agenda] Auto-accepted order ${order_id} for PDC ${orderRequest.notified_ids[0]}`,
        );
      }
    } catch (error) {
      console.error("[Agenda] Error in auto-accept-pdc job:", error);
    }
  });

  agenda.define("expire-broadcast", async (job) => {
    const { broadcast_id, order_id, pdc_id } = job.attrs.data;

    try {
      const broadcast = await Broadcast.findById(broadcast_id);
      if (broadcast && broadcast.status === "Broadcasting") {
        // The 10-minute window has closed and no DP accepted it
        broadcast.status = "Pending";
        broadcast.pickup_otp = null;
        await broadcast.save();

        // Send a notification to trigger a dashboard refresh for the PDC
        await sendNotification({
          role: ROLES.PDC,
          userId: pdc_id,
          title: "Broadcast Expired",
          message: `The 10-minute broadcast window for order #${order_id} has expired. Please broadcast again.`,
          orderId: order_id,
        });

        console.log(
          `[Agenda] Expired broadcast ${broadcast_id} for order ${order_id}`,
        );
      }
    } catch (error) {
      console.error("[Agenda] Error in expire-broadcast job:", error);
    }
  });

  agenda.define("sync-dp-locations", async (job) => {
    try {
      const dpLocations = await getAllCachedDpLocations();
      const userIds = Object.keys(dpLocations);

      if (userIds.length > 0) {
        // Batch update all DPs and Orders using BulkWrite
        const dpBulkOps = [];
        const orderBulkOps = [];

        for (const userId of userIds) {
          const data = JSON.parse(dpLocations[userId]);
          const { lat, lng, orderId, timestamp } = data;

          // Skip if data is extremely old (e.g., > 1 hour)
          if (Date.now() - timestamp > 3600000) continue;

          dpBulkOps.push({
            updateOne: {
              filter: { user_id: userId },
              update: {
                latitude: lat,
                longitude: lng,
                geo_location: { type: "Point", coordinates: [lng, lat] },
              },
            },
          });

          if (orderId) {
            orderBulkOps.push({
              updateOne: {
                filter: { _id: orderId },
                update: { current_lat: lat, current_lng: lng },
              },
            });
          }
        }

        if (dpBulkOps.length > 0) await DpDetail.bulkWrite(dpBulkOps);
        if (orderBulkOps.length > 0) await Order.bulkWrite(orderBulkOps);

        console.log(
          `[Agenda] Synced ${userIds.length} DP locations from Redis to MongoDB`,
        );
      }
    } catch (error) {
      console.error("[Agenda] Error in sync-dp-locations job:", error);
    }
  });

  agenda.define("rebroadcast-unaccepted-order", async (job) => {
    const { order_id } = job.attrs.data;
    try {
      const { Order } = await import("../../features/orders/order.model.js");
      const { ORDER_STATUS } = await import("../../constants/orderStatus.js");
      const order = await Order.findById(order_id);

      // If order still not accepted
      if (order && order.status === ORDER_STATUS.CREATED) {
        console.log(
          `[Agenda] Order ${order_id} not accepted after 5 minutes. Rebroadcasting...`,
        );
        const { PackageDetail } =
          await import("../../features/orders/packageDetail.model.js");
        const packageDetail = await PackageDetail.findById(order.package_id);

        const { broadcastOrderToNearbyDPs } =
          await import("../../features/orders/orders.service.js");

        // Pass true as the third parameter to signify it's a rebroadcast (so it doesn't loop infinitely)
        await broadcastOrderToNearbyDPs(order, packageDetail, true);
      }
    } catch (error) {
      console.error(
        "[Agenda] Error in rebroadcast-unaccepted-order job:",
        error,
      );
    }
  });

  await agenda.start();
  // Run the sync job every 2 minutes
  await agenda.every("2 minutes", "sync-dp-locations");

  agenda.define("expire-bundle-broadcast", async (job) => {
    const { bundle_id } = job.attrs.data;
    try {
      const { OrderBundle } =
        await import("../../features/orders/orderBundle.model.js");
      const bundle = await OrderBundle.findOne({ bundle_id });
      if (bundle && bundle.status === "broadcasting") {
        bundle.status = "expired";
        await bundle.save();
        console.log(
          `[Agenda] Bundle ${bundle_id} broadcasting expired due to timeout`,
        );

        // Optionally broadcast to admin about expiration
        const { broadcastToAdmins } = await import("./socket.service.js");
        broadcastToAdmins("bundle:expired", { bundle_id });
      }
    } catch (error) {
      console.error("[Agenda] Error in expire-bundle-broadcast job:", error);
    }
  });

  console.log("[Agenda] Started job scheduler.");
};

export const getAgenda = () => agenda;
