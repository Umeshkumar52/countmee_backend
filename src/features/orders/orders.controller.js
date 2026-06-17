import * as ordersService from './orders.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import { validate } from '../../common/utils/validationHelper.js';
import * as ordersValidation from './orders.validation.js';
import { ApiError } from '../../common/utils/ApiError.js';

export const createOrder = asyncHandler(async (req, res) => {
  req.body = validate(ordersValidation.createOrderSchema, req.body);
  if (!req.files || !req.files.image1 || !req.files.image2) {
    throw new ApiError(400, 'Validation error', {
      image1: ['image1 is required'],
      image2: ['image2 is required']
    });
  }

  const result = await ordersService.createOrder(req.body, req.files);
  return res.json(ApiResponse.success(result, 'order created'));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { order_id, cancel_order_reason } = validate(ordersValidation.cancelOrderSchema, req.body);
  await ordersService.cancelOrder(order_id, cancel_order_reason);
  return res.json(ApiResponse.success(null, 'order Cancelled'));
});

export const order_details = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order_details = await ordersService.getOrderDetails(id);
  return res.json(ApiResponse.success({ order_details }, 'all the data of orders'));
});

export const tracking = asyncHandler(async (req, res) => {
  const { user_id, order_id } = req.body;
  const result = await ordersService.getTrackingDetails(user_id, order_id);
  return res.json(ApiResponse.success(result, 'details of tracking'));
});

export const orderHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orders = await ordersService.getOrderHistory(id);
  return res.json(ApiResponse.success({ orders }, 'Order History'));
});

export const cancelledOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cancelledOrders = await ordersService.getCancelledOrders(id);
  return res.json(ApiResponse.success({ cancelledOrders }, 'cancelled orders'));
});

export const charges = asyncHandler(async (req, res) => {
  const { mode_of_transport, distance } = validate(ordersValidation.calculateChargesSchema, req.body);
  const result = await ordersService.getCharges(mode_of_transport, Number(distance));
  return res.json(ApiResponse.success(result, 'Charges calculated successfully'));
});

export const assignedStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const result = await ordersService.getAssignedStatus(orderId);
  return res.json(ApiResponse.success(result, 'order Assigned to the dp'));
});

export const notifyDp = asyncHandler(async (req, res) => {
  const { orderId, packageDetailsId } = req.params;
  const orderRequest = await ordersService.notifyDp(orderId, packageDetailsId);
  return res.json(ApiResponse.success({ orderRequest }, 'Notifications sent to nearest delivery partners'));
});

export const myNotifications = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  const notifications = await ordersService.getMyNotifications(user_id);
  return res.json(ApiResponse.success({ notifications }, 'customer notifications'));
});

export const rating = asyncHandler(async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await ordersService.getCustomerRating(user_id);
    return res.json(ApiResponse.success(result, 'CustomerRating Avarages'));
  } catch (error) {
    throw new ApiError(404, error.message);
  }
});

export const rateDp = asyncHandler(async (req, res) => {
  const { order_id, from_customer, to_dp, stars, message } = validate(ordersValidation.rateDpSchema, req.body);
  try {
    const result = await ordersService.rateDp(
      order_id,
      from_customer,
      to_dp,
      Number(stars),
      message
    );
    return res.json(ApiResponse.success(result));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});
