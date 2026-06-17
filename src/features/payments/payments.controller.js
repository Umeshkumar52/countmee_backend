import * as paymentsService from './payments.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import { validate } from '../../common/utils/validationHelper.js';
import * as paymentsValidation from './payments.validation.js';

export const getBalance = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const balance = await paymentsService.getBalance(user_id);
  return res.json(ApiResponse.success(balance, 'Wallet balance retrieved successfully'));
});

export const getHistory = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const page = req.query.page ? Number(req.query.page) : 1;

  const result = await paymentsService.getHistory(user_id, page);
  return res.json(ApiResponse.success(result, 'Wallet transaction history retrieved'));
});

export const payOrder = asyncHandler(async (req, res) => {
  const { user_id, order_id, amount } = validate(paymentsValidation.payOrderSchema, req.body);
  await paymentsService.payOrder(user_id, order_id, Number(amount));
  return res.json(ApiResponse.success(null, 'Order paid successfully using wallet balance'));
});

export const recharge = asyncHandler(async (req, res) => {
  const { user_id, amount, transaction_id, payment_method, status } = validate(paymentsValidation.rechargeSchema, req.body);
  const result = await paymentsService.recharge(
    user_id,
    Number(amount),
    transaction_id,
    payment_method,
    status
  );
  return res.json(ApiResponse.success(result, 'Wallet recharged successfully'));
});

export const initiateCashfreePayment = asyncHandler(async (req, res) => {
  const { user_id, amount } = validate(paymentsValidation.initiatePaymentSchema, req.body);
  const result = await paymentsService.initiateCashfreePayment(user_id, Number(amount));
  return res.json(ApiResponse.success(result, 'Order created successfully'));
});

export const verifyCashfreePayment = asyncHandler(async (req, res) => {
  const { order_id } = validate(paymentsValidation.verifyPaymentSchema, req.body);
  const result = await paymentsService.verifyCashfreePayment(order_id);
  const message = result.already_processed ? 'Payment already processed' : 'Payment verified and balance updated';
  return res.json(ApiResponse.success(result, message));
});

export const processRazorpayPayment = asyncHandler(async (req, res) => {
  const result = await paymentsService.processRazorpayPayment(req.body);
  return res.json(ApiResponse.success(result, 'payment details save successfully'));
});
