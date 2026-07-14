import * as paymentsService from "./payments.service.js";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { ApiResponse } from "../../common/utils/responseFormatter.js";
import { validate } from "../../common/utils/validationHelper.js";
import * as paymentsValidation from "./payments.validation.js";

export const cashfreeWebhookController = asyncHandler(async (req, res) => {
  await paymentsService.cashfreeWebhook(req.body);
  return res.status(200).send("OK");
});

export const getBalance = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const balance = await paymentsService.getBalance(user_id);
  return res.json(
    ApiResponse.success(balance, "Wallet balance retrieved successfully"),
  );
});

export const getHistory = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const page = req.query.page ? Number(req.query.page) : 1;

  const result = await paymentsService.getHistory(user_id, page);
  return res.json(
    ApiResponse.success(result, "Wallet transaction history retrieved"),
  );
});

export const payOrder = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { user_id, order_id, amount } = validate(
    paymentsValidation.payOrderSchema,
    req.body,
  );
  await paymentsService.payOrder(_id, order_id, Number(amount));
  return res.json(
    ApiResponse.success(null, "Order paid successfully using wallet balance"),
  );
});

export const recharge = asyncHandler(async (req, res) => {
  const { user_id, amount, transaction_id, payment_method, status } = validate(
    paymentsValidation.rechargeSchema,
    req.body,
  );
  const result = await paymentsService.recharge(
    user_id,
    Number(amount),
    transaction_id,
    payment_method,
    status,
  );
  return res.json(ApiResponse.success(result, "Wallet recharged successfully"));
});

export const initiateCashfreePayment = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { user_id, amount } = validate(
    paymentsValidation.initiatePaymentSchema,
    req.body,
  );
  const result = await paymentsService.initiateCashfreePayment(
    _id,
    Number(amount),
  );
  return res.json(ApiResponse.success(result, "Order created successfully"));
});

export const verifyCashfreePayment = asyncHandler(async (req, res) => {
  const { order_id } = validate(
    paymentsValidation.verifyPaymentSchema,
    req.body,
  );
  const result = await paymentsService.verifyCashfreePayment(order_id);
  const message = result.already_processed
    ? "Payment already processed"
    : "Payment verified and balance updated";
  return res.json(ApiResponse.success(result, message));
});

export const initiateOrderPayment = asyncHandler(async (req, res) => {
  const { _id: userId } = req.user;
  const { payment_for, payment_method, order_id, amount } = validate(
    paymentsValidation.initiateOrderPaymentSchema,
    req.body,
  );

  let result;

  if (payment_for === "order_payment") {
    if (payment_method === "wallet") {
      result = await paymentsService.payOrder(userId, order_id, Number(amount));
    } else if (payment_method === "cashfree") {
      result = await paymentsService.initiateOrderPayment(userId, order_id);
    }
  } else if (payment_for === "wallet_recharge") {
    result = await paymentsService.initiateCashfreePayment(
      userId,
      Number(amount),
    );
  }

  return res.json(
    ApiResponse.success(result, "Payment initiated successfully"),
  );
});

export const verifyOrderPayment = asyncHandler(async (req, res) => {
  const { payment_for, cf_order_id, order_id } = validate(
    paymentsValidation.verifyOrderPaymentSchema,
    req.body,
  );

  let result;
  let message;

  if (payment_for === "order_payment") {
    result = await paymentsService.verifyOrderPayment(cf_order_id, order_id);
    message = result.already_processed
      ? "Payment already processed"
      : "Order payment verified successfully";
  } else if (payment_for === "wallet_recharge") {
    result = await paymentsService.verifyCashfreePayment(cf_order_id);
    message = result.already_processed
      ? "Recharge already processed"
      : "Wallet recharged successfully";
  }

  return res.json(ApiResponse.success(result, message));
});
