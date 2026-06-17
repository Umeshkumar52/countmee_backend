import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  profile_pic: { type: String, default: null },
  address: { type: String, default: null }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const Customer = mongoose.model('Customer', customerSchema);