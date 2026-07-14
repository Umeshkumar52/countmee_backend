import * as ordersService from "./orders.service.js";
import { asyncHandler } from "../../common/utils/asyncHandler.js";
import { ApiResponse } from "../../common/utils/responseFormatter.js";
import { validate } from "../../common/utils/validationHelper.js";
import * as ordersValidation from "./orders.validation.js";
import { ApiError } from "../../common/utils/ApiError.js";

import { OrderWaitCharge } from "./orderWaitCharge.model.js";

export const createOrder = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  // Enforce Restriction: Block order creation if unpaid waiting charges exist
  const unpaidCharges = await OrderWaitCharge.findOne({
    user_id: _id,
    payment_status: "unpaid",
  });
  if (unpaidCharges) {
    throw new ApiError(
      400,
      `You have an overdue waiting charge of ₹${unpaidCharges.total_waiting_charge}. Please clear it before creating a new order.`,
    );
  }

  if (typeof req.body.different_dimantion === "string") {
    req.body.different_dimantion = req.body.different_dimantion === "true";
  }
  if (
    req.body.dimensions_list &&
    typeof req.body.dimensions_list === "string"
  ) {
    try {
      req.body.dimensions_list = JSON.parse(req.body.dimensions_list);
    } catch (e) {
      throw new ApiError(400, "Invalid JSON format for dimensions_list");
    }
  }

  req.body = validate(ordersValidation.createOrderSchema, req.body);

  const fileErrors = {};
  if (!req.files || !req.files.image1)
    fileErrors.image1 = ["image1 is required"];
  if (!req.files || !req.files.image2)
    fileErrors.image2 = ["image2 is required"];

  if (Object.keys(fileErrors).length > 0) {
    throw new ApiError(400, "Validation error", fileErrors);
  }
  const result = await ordersService.createOrder(req.body, req.files, _id);
  return res.json(ApiResponse.success(result, "order created"));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { order_id, cancel_order_reason } = validate(
    ordersValidation.cancelOrderSchema,
    req.body,
  );
  await ordersService.cancelOrder(order_id, cancel_order_reason);
  return res.json(ApiResponse.success(null, "order Cancelled"));
});

export const order_details = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id } = req.params;
  const order_details = await ordersService.getOrderDetails(_id ?? id);
  return res.json(
    ApiResponse.success({ order_details }, "all the data of orders"),
  );
});

export const tracking = asyncHandler(async (req, res) => {
  const { user_id, order_id } = req.body;
  const result = await ordersService.getTrackingDetails(user_id, order_id);
  return res.json(ApiResponse.success(result, "details of tracking"));
});

export const orderHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { order_type } = req.query;
  const orders = await ordersService.getOrderHistory(id, order_type);
  return res.json(ApiResponse.success({ orders }, "Order History"));
});

export const cancelledOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cancelledOrders = await ordersService.getCancelledOrders(id);
  return res.json(ApiResponse.success({ cancelledOrders }, "cancelled orders"));
});

export const charges = asyncHandler(async (req, res) => {
  const {
    mode_of_transport,
    pickup_lat,
    pickup_lng,
    drop_lat,
    drop_lng,
    no_of_items,
  } = validate(ordersValidation.calculateChargesSchema, req.body);
  const result = await ordersService.getCharges(
    mode_of_transport,
    Number(pickup_lat),
    Number(pickup_lng),
    Number(drop_lat),
    Number(drop_lng),
    Number(no_of_items),
  );
  return res.json(
    ApiResponse.success(result, "Charges calculated successfully"),
  );
});

export const assignedStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const result = await ordersService.getAssignedStatus(orderId);
  return res.json(ApiResponse.success(result, "order Assigned to the dp"));
});

export const notifyDp = asyncHandler(async (req, res) => {
  const { orderId, packageDetailsId } = validate(
    ordersValidation.notifyDpSchema,
    req.body,
  );
  const orderRequest = await ordersService.notifyDp(orderId, packageDetailsId);
  return res.json(
    ApiResponse.success(
      { orderRequest },
      "Notifications sent to nearest delivery partners",
    ),
  );
});

export const myNotifications = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const notifications = await ordersService.getMyNotifications(user_id);
  return res.json(
    ApiResponse.success({ notifications }, "customer notifications"),
  );
});

export const rating = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await ordersService.getCustomerRating(user_id);
    return res.json(ApiResponse.success(result, "CustomerRating Avarages"));
  } catch (error) {
    throw new ApiError(404, error.message);
  }
});

export const rateDp = asyncHandler(async (req, res) => {
  const { order_id, from_customer, to_dp, stars, message } = validate(
    ordersValidation.rateDpSchema,
    req.body,
  );
  try {
    const result = await ordersService.rateDp(
      order_id,
      from_customer,
      to_dp,
      Number(stars),
      message,
    );
    return res.json(ApiResponse.success(result));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const myDues = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const dues = await ordersService.getMyDues(_id);
  return res.json(ApiResponse.success({ dues }, "Customer Dues"));
});
