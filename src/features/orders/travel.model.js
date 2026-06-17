import mongoose from 'mongoose';

const travelSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  order_cost: { type: Number, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  pickup_location: { type: String, required: true },
  pickup_latitude: { type: Number, required: true },
  pickup_longitude: { type: Number, required: true },
  drop_location: { type: String, default: null },
  drop_latitude: { type: Number, default: null },
  drop_longitude: { type: Number, default: null },
  distance: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const Travel = mongoose.model('Travel', travelSchema);