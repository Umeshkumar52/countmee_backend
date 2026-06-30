import mongoose from 'mongoose';

const minBroadcastDistSchema = new mongoose.Schema({
  role: { type: String, required: true },
  minimum_broadcast_distance: { type: Number, default: 1 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const MinBroadcastDist = mongoose.model('MinBroadcastDist', minBroadcastDistSchema);