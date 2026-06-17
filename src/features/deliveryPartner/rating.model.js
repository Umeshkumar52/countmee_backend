import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  stars: { type: Number, required: true, min: 1, max: 5 },
  from_customer: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
  from_dp: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
  from_pdc: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
  to_customer: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
  to_dp: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
  to_pdc: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  message: { type: String, default: '' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Rating = mongoose.model('Rating', ratingSchema);