import mongoose from 'mongoose';

const customerAddressSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  location: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  phone_no: { type: String, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const CustomerAddress = mongoose.model('CustomerAddress', customerAddressSchema);