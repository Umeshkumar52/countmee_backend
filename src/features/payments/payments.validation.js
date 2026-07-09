import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const payOrderSchema = Joi.object({
  user_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "User ID cannot be empty",
    "string.pattern.base": "Invalid User ID format",
    "any.required": "User ID is required",
  }),
  order_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "Order ID cannot be empty",
    "string.pattern.base": "Invalid Order ID format",
    "any.required": "Order ID is required",
  }),
  amount: Joi.number().min(1).required().messages({
    "number.base": "Amount must be a valid number",
    "number.min": "Amount must be at least 1",
    "any.required": "Amount is required",
  }),
});

export const rechargeSchema = Joi.object({
  user_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "User ID cannot be empty",
    "string.pattern.base": "Invalid User ID format",
    "any.required": "User ID is required",
  }),
  amount: Joi.number().min(1).required().messages({
    "number.base": "Amount must be a valid number",
    "number.min": "Amount must be at least 1",
    "any.required": "Amount is required",
  }),
  transaction_id: Joi.string().trim().required().messages({
    "string.empty": "Transaction ID is required",
    "any.required": "Transaction ID is required",
  }),
  payment_method: Joi.string().trim().required().messages({
    "string.empty": "Payment method is required",
    "any.required": "Payment method is required",
  }),
  status: Joi.string().trim().required().messages({
    "string.empty": "Status is required",
    "any.required": "Status is required",
  }),
});

export const initiatePaymentSchema = Joi.object({
  user_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "User ID cannot be empty",
    "string.pattern.base": "Invalid User ID format",
    "any.required": "User ID is required",
  }),
  amount: Joi.number().min(1).required().messages({
    "number.base": "Amount must be a valid number",
    "number.min": "Amount must be at least 1",
    "any.required": "Amount is required",
  }),
});

export const verifyPaymentSchema = Joi.object({
  order_id: Joi.string().trim().required().messages({
    "string.empty": "Order ID is required",
    "any.required": "Order ID is required",
  }),
});

export const initiateOrderPaymentSchema = Joi.object({
  payment_for: Joi.string()
    .valid("order_payment", "wallet_recharge")
    .required()
    .messages({
      "string.empty": "Payment for is required",
      "any.required": "Payment for is required",
    }),
  payment_method: Joi.string().valid("wallet", "cashfree").required().messages({
    "string.empty": "Payment method is required",
    "any.required": "Payment method is required",
  }),
  order_id: Joi.string().regex(objectIdRegex)
    .when('payment_for', {
      is: "order_payment",
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      "string.empty": "Order ID cannot be empty",
      "string.pattern.base": "Invalid Order ID format",
      "any.required": "Order ID is required for order payment",
    }),
  amount: Joi.number().min(1)
    .when('payment_for', {
      is: "wallet_recharge",
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      "number.base": "Amount must be a valid number",
      "number.min": "Amount must be at least 1",
      "any.required": "Amount is required for wallet recharge",
    }),
});

export const verifyOrderPaymentSchema = Joi.object({
  payment_for: Joi.string()
    .valid("order_payment", "wallet_recharge")
    .required()
    .messages({
      "string.empty": "Payment for is required",
      "any.required": "Payment for is required",
    }),
  cf_order_id: Joi.string().trim().required().messages({
    "string.empty": "Cashfree Order ID is required",
    "any.required": "Cashfree Order ID is required",
  }),
  order_id: Joi.string().regex(objectIdRegex)
    .when('payment_for', {
      is: "order_payment",
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      "string.empty": "Order ID cannot be empty",
      "string.pattern.base": "Invalid Order ID format",
      "any.required": "Order ID is required for order payment",
    }),
});
