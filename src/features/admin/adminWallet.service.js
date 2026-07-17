import jwt from 'jsonwebtoken';
import * as adminRepository from './admin.repository.js';
import { sendNotification } from '../../common/utils/sendNotification.js';
import { ROLES } from '../../constants/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtsecretkeyforsecurityandhashing';

const verifyVerificationToken = (token, expectedAction, expectedAmount) => {
  if (!token) {
    throw new Error('Security verification token is required.');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.action !== 'wallet_recharge_otp_verified') {
      throw new Error('Invalid verification action');
    }
    if (decoded.action_type !== expectedAction) {
      throw new Error('Action mismatch');
    }
    if (expectedAmount !== undefined && Number(decoded.amount) !== Number(expectedAmount)) {
      throw new Error('Amount mismatch');
    }
    return decoded;
  } catch (err) {
    throw new Error('Security verification failed: ' + err.message);
  }
};

export const getWalletsList = async (searchQuery, balanceRange, page = 1, limit = 10) => {
  const config = await adminRepository.findWalletConfig();
  const configHistory = await adminRepository.findWalletConfigHistory();
  const massCreditLogs = await adminRepository.findMassCreditLogs();

  const userQuery = { role: 'CUSTOMER' };
  if (searchQuery) {
    userQuery.$or = [
      { name: new RegExp(searchQuery, 'i') },
      { phone: new RegExp(searchQuery, 'i') }
    ];
  }

  const allCustomers = await adminRepository.findAllCustomersUnpaginated();
  const allWallets = await adminRepository.findAllWallets();
  const walletMap = new Map(allWallets.map(w => [w.user_id ? w.user_id.toString() : '', w]));
  
  // Filter by query and balance locally to preserve legacy search pattern
  let filteredCustomers = allCustomers;
  if (searchQuery) {
    const searchRegex = new RegExp(searchQuery, 'i');
    filteredCustomers = allCustomers.filter(cust => 
      searchRegex.test(cust.name) || searchRegex.test(cust.phone)
    );
  }

  if (balanceRange) {
    filteredCustomers = filteredCustomers.filter(cust => {
      const wallet = walletMap.get(cust._id.toString());
      const balance = wallet ? wallet.balance : 0;
      if (balanceRange === '0-100') return balance >= 0 && balance <= 100;
      if (balanceRange === '101-500') return balance >= 101 && balance <= 500;
      if (balanceRange === '501-1000') return balance >= 501 && balance <= 1000;
      if (balanceRange === '1000+') return balance > 1000;
      return true;
    });
  }

  const total = filteredCustomers.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const paginatedCustomers = filteredCustomers.slice(skip, skip + limit);

  const customersData = paginatedCustomers.map(cust => {
    const wallet = walletMap.get(cust._id.toString());
    return {
      ...cust,
      wallet: wallet ? (wallet.toObject ? wallet.toObject() : wallet) : { balance: 0 }
    };
  });

  const joiningBonus = config ? { value: config.joining_bonus } : { value: 0 };

  const formattedHistory = configHistory.map(hist => ({
    ...hist.toObject(),
    key: 'joining_bonus',
    old_value: hist.old_joining_bonus,
    new_value: hist.new_joining_bonus,
    admin: hist.changed_by
  }));

  const formattedLogs = massCreditLogs.map(log => ({
    ...log.toObject(),
    user_count: log.recipients_count,
    admin: log.credited_by
  }));

  return {
    joiningBonus,
    customers: customersData,
    total,
    page,
    totalPages,
    configHistory: formattedHistory,
    massCreditLogs: formattedLogs
  };
};

export const getWalletDetails = async (id) => {
  const wallet = await adminRepository.findWalletById(id);
  if (!wallet) throw new Error('Wallet not found');

  const transactions = await adminRepository.findWalletTransactionsByWalletId(wallet._id);

  return {
    ...wallet.toObject(),
    user: wallet.user_id,
    transactions
  };
};

export const creditIndividual = async (wallet_id, amount, description, verificationToken) => {
  verifyVerificationToken(verificationToken, 'Individual Wallet Credit', amount);

  const wallet = await adminRepository.findWalletById(wallet_id);
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  wallet.balance = (wallet.balance || 0) + Number(amount);
  await wallet.save();

  const transaction = await adminRepository.createWalletTransaction({
    wallet_id: wallet._id,
    user_id: wallet.user_id,
    amount: Number(amount),
    type: 'credit',
    description: description || 'Admin Credit',
    transaction_type: 'manual_credit'
  });

  return { wallet, transaction };
};

export const creditCustomer = async (user_id, amount, description, verificationToken) => {
  verifyVerificationToken(verificationToken, 'Customer Wallet Credit', amount);

  let wallet = await adminRepository.findWalletByUserId(user_id);
  if (!wallet) {
    wallet = await adminRepository.createWallet({ user_id, balance: 0 });
  }

  wallet.balance = (wallet.balance || 0) + Number(amount);
  await wallet.save();

  const transaction = await adminRepository.createWalletTransaction({
    wallet_id: wallet._id,
    user_id: wallet.user_id,
    amount: Number(amount),
    type: 'credit',
    description: description || 'Admin Credit',
    transaction_type: 'manual_credit'
  });

  await sendNotification({
    role: ROLES.USER,
    userId: wallet.user_id,
    title: 'Wallet Credited',
    message: `Your wallet has been credited with ₹${amount}. Reason: ${description || 'Admin Credit'}`
  });

  return { wallet, transaction };
};

export const creditMass = async (adminEmail, amount, description, verificationToken) => {
  verifyVerificationToken(verificationToken, 'Mass Credit', amount);

  const adminUser = await adminRepository.findUserByEmailAndType(adminEmail, 'ADMIN');
  const customers = await adminRepository.findAllCustomers();

  const log = await adminRepository.createMassCreditLog({
    amount: Number(amount),
    recipients_count: customers.length,
    description,
    credited_by: adminUser ? adminUser._id : null,
    role: 'CUSTOMER'
  });

  for (const customer of customers) {
    let wallet = await adminRepository.findWalletByUserId(customer._id);
    if (!wallet) {
      wallet = await adminRepository.createWallet({ user_id: customer._id, balance: 0 });
    }

    wallet.balance = (wallet.balance || 0) + Number(amount);
    await wallet.save();

    await adminRepository.createWalletTransaction({
      wallet_id: wallet._id,
      user_id: customer._id,
      amount: Number(amount),
      type: 'credit',
      description,
      transaction_type: 'mass_credit',
      reference_id: log._id
    });

    await sendNotification({
      role: ROLES.USER,
      userId: customer._id,
      title: 'Promotional Wallet Credit',
      message: `Your wallet has been credited with ₹${amount}. Reason: ${description}`
    });
  }

  return { user_count: customers.length, amount: Number(amount) };
};

export const getWalletConfig = async () => {
  const config = await adminRepository.findWalletConfig();
  return { config };
};

export const updateJoiningBonus = async (adminEmail, amount, verificationToken) => {
  verifyVerificationToken(verificationToken, 'Update Joining Bonus', amount);

  let config = await adminRepository.findWalletConfig();
  const oldValue = config ? config.joining_bonus : 0;
  const oldMin = config ? config.min_recharge : 0;

  if (!config) {
    config = await adminRepository.createWalletConfig({ joining_bonus: Number(amount), min_recharge: 0 });
  } else {
    config.joining_bonus = Number(amount);
    await config.save();
  }

  const adminUser = await adminRepository.findUserByEmailAndType(adminEmail, 'ADMIN');

  const history = await adminRepository.createWalletConfigHistory({
    changed_by: adminUser ? adminUser._id : null,
    old_joining_bonus: oldValue,
    new_joining_bonus: Number(amount),
    old_min_recharge: oldMin,
    new_min_recharge: oldMin
  });

  return { joining_bonus: Number(amount), history };
};

export const verifyUser = async (phone) => {
  const user = await adminRepository.findUserByPhoneAndType(phone, 'CUSTOMER');
  if (user) {
    return { name: user.name, user_id: user._id };
  }
  throw new Error('User not found');
};

export const getUserTransactions = async (user_id) => {
  const wallet = await adminRepository.findWalletByUserId(user_id);
  if (!wallet) {
    return { transactions: [] };
  }
  const transactions = await adminRepository.findWalletTransactionsByWalletId(wallet._id);
  return { transactions };
};

export const getMassCreditRecipients = async (log_id) => {
  const transactions = await adminRepository.findWalletTransactionsByLogId(log_id);
  const recipients = transactions.map(trx => ({
    name: trx.wallet_id && trx.wallet_id.user_id ? trx.wallet_id.user_id.name : 'N/A',
    phone: trx.wallet_id && trx.wallet_id.user_id ? trx.wallet_id.user_id.phone : 'N/A',
    amount: trx.amount,
    created_at: trx.created_at
  }));
  return { recipients };
};
