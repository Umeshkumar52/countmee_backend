import mongoose from 'mongoose';

const walletConfigSchema = new mongoose.Schema({
  joining_bonus: { type: Number, default: 0 },
  min_recharge: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const walletConfigHistorySchema = new mongoose.Schema({
  changed_by: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  old_joining_bonus: { type: Number, required: true },
  new_joining_bonus: { type: Number, required: true },
  old_min_recharge: { type: Number, required: true },
  new_min_recharge: { type: Number, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const WalletConfig = mongoose.model('WalletConfig', walletConfigSchema);
export const WalletConfigHistory = mongoose.model('WalletConfigHistory', walletConfigHistorySchema);