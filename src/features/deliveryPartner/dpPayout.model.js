import mongoose from 'mongoose';

const dpPayoutSchema = new mongoose.Schema({
  dp_auth_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  broadcast_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', default: null },
  travel_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Travel' },
  earnings: { type: Number, required: true },
  settled: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const DpPayout = mongoose.model('DpPayout', dpPayoutSchema);