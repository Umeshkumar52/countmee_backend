import mongoose from "mongoose";

/**
 * OrderWaitCharge
 * 
 * Dedicated schema for tracking waiting charges per order.
 * This is a SEPARATE, IMMUTABLE snapshot — it does NOT modify
 * the main Order.charges field in any way.
 *
 * One document per order. Created when DP marks arrival,
 * updated at pickup OTP and drop OTP verification.
 * Deleted if the order is cancelled.
 */
const orderWaitChargeSchema = new mongoose.Schema(
  {
    // ─── References ───────────────────────────────────────────────
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true, // One document per order, strictly
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ─── Pickup Phase ─────────────────────────────────────────────
    pickup_dp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Timestamp when DP clicked "Arrived" at pickup location
    pickup_arrival_time: { type: Date, default: null },
    // Timestamp when pickup OTP was verified (parcel handed over)
    pickup_otp_verified_time: { type: Date, default: null },
    // Grace period applied at pickup (in minutes), copied from DeliverCharge
    pickup_grace_period: { type: Number, default: 0 },
    // Total minutes DP waited at pickup (from arrival to OTP verify)
    pickup_total_wait_mins: { type: Number, default: 0 },
    // Minutes beyond grace period
    pickup_extra_mins: { type: Number, default: 0 },
    // Rate applied per extra minute at pickup (from DeliverCharge.extra_min_charge)
    pickup_rate_per_min: { type: Number, default: 0 },
    // Final charge for pickup waiting (extra_mins * rate_per_min)
    pickup_waiting_charge: { type: Number, default: 0 },

    // ─── Drop Phase ───────────────────────────────────────────────
    delivery_dp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Timestamp when DP clicked "Arrived" at drop/delivery location
    drop_arrival_time: { type: Date, default: null },
    // Timestamp when drop OTP was verified (parcel delivered to customer)
    drop_otp_verified_time: { type: Date, default: null },
    // Grace period applied at drop (in minutes), copied from DeliverCharge
    drop_grace_period: { type: Number, default: 0 },
    // Total minutes DP waited at drop (from arrival to OTP verify)
    drop_total_wait_mins: { type: Number, default: 0 },
    // Minutes beyond grace period
    drop_extra_mins: { type: Number, default: 0 },
    // Rate applied per extra minute at drop (from DeliverCharge.extra_min_charge)
    drop_rate_per_min: { type: Number, default: 0 },
    // Final charge for drop waiting (extra_mins * rate_per_min)
    drop_waiting_charge: { type: Number, default: 0 },

    // ─── Totals & Payment ─────────────────────────────────────────
    // Total = pickup_waiting_charge + drop_waiting_charge
    total_waiting_charge: { type: Number, default: 0 },
    // "paid" = auto-deducted from wallet at delivery.
    // "unpaid" = wallet was insufficient; customer must pay manually.
    payment_status: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
    },
    // "wallet" if auto-deducted, null if still unpaid
    payment_method: {
      type: String,
      enum: ["wallet", "cashfree", null],
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export const OrderWaitCharge = mongoose.model(
  "OrderWaitCharge",
  orderWaitChargeSchema
);
