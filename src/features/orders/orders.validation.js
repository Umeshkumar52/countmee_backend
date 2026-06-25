import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createOrderSchema = Joi.object({
  user_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "User ID cannot be empty",
    "string.pattern.base": "Invalid User ID format",
    "any.required": "User ID is required",
  }),
  pickup_location: Joi.string().trim().required().messages({
    "string.empty": "Pickup location is required",
    "any.required": "Pickup location is required",
  }),
  sender_latitude: Joi.number().required().messages({
    "number.base": "Sender latitude must be a number",
    "any.required": "Sender latitude is required",
  }),
  sender_longitude: Joi.number().required().messages({
    "number.base": "Sender longitude must be a number",
    "any.required": "Sender longitude is required",
  }),
  drop_location: Joi.string().trim().required().messages({
    "string.empty": "Drop location is required",
    "any.required": "Drop location is required",
  }),
  receiver_latitude: Joi.number().required().messages({
    "number.base": "Receiver latitude must be a number",
    "any.required": "Receiver latitude is required",
  }),
  receiver_longitude: Joi.number().required().messages({
    "number.base": "Receiver longitude must be a number",
    "any.required": "Receiver longitude is required",
  }),
  mode_of_transport: Joi.string().trim().required().messages({
    "string.empty": "Mode of transport is required",
    "any.required": "Mode of transport is required",
  }),
  sender_name: Joi.string().trim().required().messages({
    "string.empty": "Sender name is required",
    "any.required": "Sender name is required",
  }),
  sender_phone: Joi.string().trim().required().messages({
    "string.empty": "Sender phone is required",
    "any.required": "Sender phone is required",
  }),
  how_to_reach_sender_location: Joi.string().trim().allow("", null),
  sender_pin_code: Joi.string().trim().allow("", null),
  sender_address: Joi.string().trim().allow("", null),
  secondary_sender_phone: Joi.string().trim().allow("", null),
  receiver_name: Joi.string().trim().required().messages({
    "string.empty": "Receiver name is required",
    "any.required": "Receiver name is required",
  }),
  receiver_phone: Joi.string().trim().required().messages({
    "string.empty": "Receiver phone is required",
    "any.required": "Receiver phone is required",
  }),
  how_to_reach_receiver_address: Joi.string().trim().allow("", null),
  receiver_address: Joi.string().trim().allow("", null),
  secondary_receiver_phone: Joi.string().trim().allow("", null),
  receiver_pin_code: Joi.string().trim().allow("", null),
  distance: Joi.number().required().messages({
    "number.base": "Distance must be a valid number",
    "any.required": "Distance is required",
  }),
  product_description: Joi.string().trim().allow("", null),
  product_weight: Joi.string().trim().required().messages({
    "string.empty": "Product weight is required",
    "any.required": "Product weight is required",
  }),
  no_of_items: Joi.number().integer().required().messages({
    "number.base": "Number of items must be a number",
    "number.integer": "Number of items must be an integer",
    "any.required": "Number of items is required",
  }),
  types_of_product: Joi.string().trim().required().messages({
    "string.empty": "Types of product is required",
    "any.required": "Types of product is required",
  }),
  size_of_package: Joi.string().trim().required().messages({
    "string.empty": "Size of package is required",
    "any.required": "Size of package is required",
  }),
  product_height: Joi.string().trim().required().messages({
    "string.empty": "Height of product is required",
    "any.required": "Height of product is required",
  }),
  product_width: Joi.string().trim().required().messages({
    "string.empty": "Width of product is required",
    "any.required": "Width of product is required",
  }),
  product_length: Joi.string().trim().required().messages({
    "string.empty": "Length of product is required",
    "any.required": "Length of product is required",
  }),
});

export const cancelOrderSchema = Joi.object({
  order_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "Order ID is required",
    "string.pattern.base": "Invalid Order ID format",
    "any.required": "Order ID is required",
  }),
  cancel_order_reason: Joi.string().trim().required().messages({
    "string.empty": "Cancellation reason is required",
    "any.required": "Cancellation reason is required",
  }),
});

export const calculateChargesSchema = Joi.object({
  mode_of_transport: Joi.string().trim().required().messages({
    "string.empty": "Mode of transport is required",
    "any.required": "Mode of transport is required",
  }),
  distance: Joi.number().min(0).required().messages({
    "number.base": "Distance must be a valid number",
    "number.min": "Distance cannot be negative",
    "any.required": "Distance is required",
  }),
});

export const rateDpSchema = Joi.object({
  order_id: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "Order ID is required",
    "string.pattern.base": "Invalid Order ID format",
    "any.required": "Order ID is required",
  }),
  from_customer: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "Customer ID is required",
    "string.pattern.base": "Invalid Customer ID format",
    "any.required": "Customer ID is required",
  }),
  to_dp: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "DP ID is required",
    "string.pattern.base": "Invalid DP ID format",
    "any.required": "DP ID is required",
  }),
  stars: Joi.number().integer().min(1).max(5).required().messages({
    "number.base": "Rating stars must be a number",
    "number.min": "Stars must be at least 1",
    "number.max": "Stars cannot be greater than 5",
    "any.required": "Rating stars is required",
  }),
  message: Joi.string().trim().allow("", null),
});

export const notifyDpSchema = Joi.object({
  orderId: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "Order ID is required",
    "string.pattern.base": "Invalid Order ID format",
    "any.required": "Order ID is required",
  }),
  packageDetailsId: Joi.string().regex(objectIdRegex).required().messages({
    "string.empty": "Package Details ID is required",
    "string.pattern.base": "Invalid Package Details ID format",
    "any.required": "Package Details ID is required",
  }),
});
