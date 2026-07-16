import mongoose from "mongoose";
import {
  ORDER_STATUS,
  USER_ACTION_STATUS,
} from "../../constants/orderStatus.js";
import { VEHICLE_TYPES } from "../../constants/index.js";
import { Counter } from "../../common/counter.model.js";

const orderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PackageDetail",
      default: null,
    },
    pickup_location: { type: String, required: true },
    sender_latitude: { type: Number, required: true },
    sender_longitude: { type: Number, required: true },
    drop_location: { type: String, required: true },
    receiver_latitude: { type: Number, required: true },
    receiver_longitude: { type: Number, required: true },
    mode_of_transport: {
      type: String,
      enum: [
        VEHICLE_TYPES.BY_HAND,
        VEHICLE_TYPES.TWO_WHEELER,
        VEHICLE_TYPES.THREE_WHEELER,
        VEHICLE_TYPES.FOUR_WHEELER,
      ],
      default: VEHICLE_TYPES.TWO_WHEELER,
    },
    sender_name: { type: String, required: true },
    sender_phone: { type: String, required: true },
    how_to_reach_sender_location: { type: String, default: null },
    sender_pin_code: { type: String, default: null },
    sender_address: { type: String, default: null },
    secondary_sender_phone: { type: String, default: null },
    receiver_name: { type: String, required: true },
    receiver_phone: { type: String, required: true },
    how_to_reach_receiver_address: { type: String, default: null },
    receiver_address: { type: String, default: null },
    secondary_receiver_phone: { type: String, default: null },
    receiver_pin_code: { type: String, default: null },
    distance: { type: Number, required: true },
    charges: { type: Number, required: true },
    user_action: {
      type: String,
      enum: [USER_ACTION_STATUS.CANCELLED, null],
      default: null,
    },
    cancel_order_reason: { type: String, default: null },
    status_completed: { type: String, default: null },
    dp_accept_time: { type: Date, default: null },
    dp_pickup_arrival_time: { type: Date, default: null },
    dp_drop_arrival_time: { type: Date, default: null },
    dp_pickup_time: { type: Date, default: null },
    dp_deliver_time: { type: Date, default: null },
    pickup_otp: { type: Number, required: true },
    drop_otp: { type: Number, required: true },
    delivery_type: { type: String, default: "direct" },
    order_type: {
      type: String,
      enum: ["normal", "scheduled"],
      default: "normal",
    },

    schedule_date: { type: String, default: null },
    schedule_time: { type: String, default: null },
    broadcast_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Broadcast",
      default: null,
    },
    pickup_dp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    wallet_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
    delivery_dp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.CREATED,
    },
    current_lat: { type: Number, default: null },
    current_lng: { type: Number, default: null },
  },
  {
    timestamps: true,
  },
);

orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { id: "orderNumber" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      this.orderNumber = `order_${counter.seq}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

export const Order = mongoose.model("Order", orderSchema);
