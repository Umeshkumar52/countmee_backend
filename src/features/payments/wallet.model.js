import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
  balance: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const Wallet = mongoose.model('Wallet', walletSchema);