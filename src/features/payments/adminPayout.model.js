import mongoose from 'mongoose';

const adminPayoutSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  order_id: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  settled_amount: { type: Number, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const AdminPayout = mongoose.model('AdminPayout', adminPayoutSchema);
