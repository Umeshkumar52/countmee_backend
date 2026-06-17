import mongoose from 'mongoose';

const deliveryPartnerImageSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  delivery_partner_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  image1: { type: String, required: true },
  image2: { type: String, required: true },
  image3: { type: String, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const DeliveryPartnerImage = mongoose.model('DeliveryPartnerImage', deliveryPartnerImageSchema);