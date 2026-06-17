import mongoose from 'mongoose';

const broadcastPointSchema = new mongoose.Schema({
  name: { type: String, required: true },
  radius: { type: Number, required: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  active: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const BroadcastPoint = mongoose.model('BroadcastPoint', broadcastPointSchema);
