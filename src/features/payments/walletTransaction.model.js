import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  wallet_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Wallet' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  description: { type: String, required: true },
  transaction_type: { type: String, required: true },
  reference_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  transaction_id: { type: String, default: null },
  payment_method: { type: String, default: null },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);