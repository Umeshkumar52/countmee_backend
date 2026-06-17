import { Wallet } from './wallet.model.js';
import { WalletTransaction } from './walletTransaction.model.js';
import { Payment } from './payment.model.js';

export const findWalletByUserId = async (user_id) => {
  return await Wallet.findOne({ user_id });
};

export const createWallet = async (walletData) => {
  return await Wallet.create(walletData);
};

export const createWalletTransaction = async (transactionData, session = null) => {
  if (session) {
    return await WalletTransaction.create([transactionData], { session });
  }
  return await WalletTransaction.create(transactionData);
};

export const createPayment = async (paymentData, session = null) => {
  if (session) {
    return await Payment.create([paymentData], { session });
  }
  return await Payment.create(paymentData);
};

export const findTransactionByGatewayId = async (transaction_id) => {
  return await WalletTransaction.findOne({ transaction_id });
};

export const getHistoryPaginated = async (wallet_id, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const items = await WalletTransaction.find({ wallet_id })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit);

  const total = await WalletTransaction.countDocuments({ wallet_id });
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    total,
    totalPages,
    currentPage: page
  };
};
