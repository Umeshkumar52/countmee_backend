import mongoose from 'mongoose';

const deliverChargeSchema = new mongoose.Schema({
  vehicle_type: { type: String, required: true, unique: true }, // e.g. 'By Hand', 'Two Wheeler'
  base_distance: { type: Number, default: 0 },
  base_price: { type: Number, default: 0 },
  per_km_price: { type: Number, default: 0 }, // Represents price per km
  dp_commission: { type: Number, default: 50 }, // DP earning percentage
  pdc_commission: { type: Number, default: 5 } // PDC earning percentage
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const DeliverCharge = mongoose.model('DeliverCharge', deliverChargeSchema);
