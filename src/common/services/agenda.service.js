import { Agenda } from 'agenda';
import { OrderRequest } from '../../features/orders/orderRequest.model.js';
import { Order } from '../../features/orders/order.model.js';
import { DpDetail } from '../../features/deliveryPartner/dpDetail.model.js';
import { sendNotification } from '../utils/sendNotification.js';
import { ROLES } from '../../constants/index.js';
import { PdcDocument } from '../../features/pdc/pdcDocument.model.js';
import { getAllCachedDpLocations } from './redis.service.js';

let agenda;

import mongoose from 'mongoose';

export const initAgenda = async () => {
    agenda = new Agenda({ db: { address: process.env.MONGODB_URI, collection: 'agendaJobs' } });

    agenda.define('auto-accept-pdc', async (job) => {
        const { order_id, order_request_id } = job.attrs.data;
        
        try {
            const orderRequest = await OrderRequest.findById(order_request_id);
            // Check if it's still pending
            if (orderRequest && orderRequest.status == null && orderRequest.request_type === 'deliver to pdc') {
                orderRequest.status = "Accepted"; // accepted
                orderRequest.accepted_by = orderRequest.notified_ids[0]; // The PDC who accepted
                await orderRequest.save();

                // Notify PDC and DP
                await sendNotification({
                    role: ROLES.DP,
                    userId: orderRequest.requested_by,
                    title: 'Drop-off Auto-Accepted',
                    message: `Your drop-off at PDC has been automatically accepted.`,
                    orderId: order_id
                });
                
                await sendNotification({
                    role: ROLES.PDC,
                    userId: orderRequest.notified_ids[0],
                    title: 'Auto-Accepted Parcel',
                    message: `You automatically accepted a parcel drop-off from DP.`,
                    orderId: order_id
                });
                
                console.log(`[Agenda] Auto-accepted order ${order_id} for PDC ${orderRequest.notified_ids[0]}`);
            }
        } catch (error) {
            console.error('[Agenda] Error in auto-accept-pdc job:', error);
        }
    });

    agenda.define('sync-dp-locations', async (job) => {
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
                                geo_location: { type: 'Point', coordinates: [lng, lat] } 
                            }
                        }
                    });

                    if (orderId) {
                        orderBulkOps.push({
                            updateOne: {
                                filter: { _id: orderId },
                                update: { current_lat: lat, current_lng: lng }
                            }
                        });
                    }
                }

                if (dpBulkOps.length > 0) await DpDetail.bulkWrite(dpBulkOps);
                if (orderBulkOps.length > 0) await Order.bulkWrite(orderBulkOps);
                
                console.log(`[Agenda] Synced ${userIds.length} DP locations from Redis to MongoDB`);
            }
        } catch (error) {
            console.error('[Agenda] Error in sync-dp-locations job:', error);
        }
    });

    await agenda.start();
    // Run the sync job every 2 minutes
    await agenda.every('2 minutes', 'sync-dp-locations');
    console.log('[Agenda] Started job scheduler.');
};

export const getAgenda = () => agenda;
