import mongoose from 'mongoose';

import { PAYOUT_STATUS } from '../../constants/orderStatus.js';

const dpPayoutSchema = new mongoose.Schema({
  dp_auth_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  broadcast_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', default: null },
  travel_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Travel' },
  earnings: { type: Number, required: true },
  // 100% of waiting charge earned by THIS DP for waiting at their phase (pickup or drop)
  waiting_charge_earning: { type: Number, default: 0 },
  settled: { type: String, enum: Object.values(PAYOUT_STATUS), default: PAYOUT_STATUS.PENDING },
  waiting_charge_settled: { type: String, enum: Object.values(PAYOUT_STATUS), default: PAYOUT_STATUS.PENDING }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const DpPayout = mongoose.model('DpPayout', dpPayoutSchema);