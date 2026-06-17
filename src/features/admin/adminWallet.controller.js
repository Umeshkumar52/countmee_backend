import * as adminWalletService from './adminWallet.service.js';
import { validate } from '../../common/utils/validationHelper.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import * as adminValidation from './admin.validation.js';

export const getWalletDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const wallet = await adminWalletService.getWalletDetails(id);
    return res.json(ApiResponse.success({ wallet }));
  } catch (err) {
    next(err);
  }
};

export const postCreditIndividual = async (req, res, next) => {
  try {
    const { wallet_id, amount, description, verificationToken } = validate(adminValidation.creditIndividualSchema, req.body);
    const result = await adminWalletService.creditIndividual(wallet_id, amount, description, verificationToken);
    return res.json(ApiResponse.success({
      wallet: result.wallet,
      transaction: result.transaction
    }, 'Amount credited successfully'));
  } catch (err) {
    next(err);
  }
};

export const postCreditCustomer = async (req, res, next) => {
  try {
    const { user_id, amount, description, verificationToken } = validate(adminValidation.creditCustomerSchema, req.body);
    const result = await adminWalletService.creditCustomer(user_id, amount, description, verificationToken);
    return res.json(ApiResponse.success({
      wallet: result.wallet,
      transaction: result.transaction
    }, 'Customer wallet credited successfully'));
  } catch (err) {
    next(err);
  }
};

export const postCreditMass = async (req, res, next) => {
  try {
    const { amount, description, verificationToken } = validate(adminValidation.creditMassSchema, req.body);
    const result = await adminWalletService.creditMass(req.user.email, amount, description, verificationToken);
    return res.json(ApiResponse.success({
      user_count: result.user_count,
      amount: result.amount
    }, 'Mass credit operation completed successfully'));
  } catch (err) {
    next(err);
  }
};

export const getWallets = async (req, res, next) => {
  try {
    const searchQuery = req.query.search || '';
    const balanceRange = req.query.balance_range || '';
    const result = await adminWalletService.getWalletsList(searchQuery, balanceRange);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getWalletConfig = async (req, res, next) => {
  try {
    const result = await adminWalletService.getWalletConfig();
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const postUpdateJoiningBonus = async (req, res, next) => {
  try {
    const { amount, verificationToken } = validate(adminValidation.joiningBonusSchema, req.body);
    const result = await adminWalletService.updateJoiningBonus(req.user.email, amount, verificationToken);
    return res.json(ApiResponse.success({
      joining_bonus: result.joining_bonus,
      history: result.history
    }, 'Joining bonus updated successfully'));
  } catch (err) {
    next(err);
  }
};

export const getVerifyUser = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const result = await adminWalletService.verifyUser(phone);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getUserTransactions = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const result = await adminWalletService.getUserTransactions(user_id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};

export const getMassCreditRecipients = async (req, res, next) => {
  try {
    const { log_id } = req.params;
    const result = await adminWalletService.getMassCreditRecipients(log_id);
    return res.json(ApiResponse.success(result));
  } catch (err) {
    next(err);
  }
};
