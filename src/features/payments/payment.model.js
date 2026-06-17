import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  customer_auth_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  razorpay_order_id: { type: String, default: null },
  razorpay_payment_id: { type: String, default: null },
  payment_mode: { type: String, default: null },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Relationships/Virtuals
paymentSchema.virtual('order', {
  ref: 'Order',
  localField: 'order_id',
  foreignField: '_id',
  justOne: true
});

export const Payment = mongoose.model('Payment', paymentSchema);