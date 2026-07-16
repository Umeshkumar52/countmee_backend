import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    cf_order_id: { type: String, default: null },
    cf_payment_id: { type: String, default: null },
    payment_mode: { type: String, default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["PAID", "SUCCESS", "ACTIVE", "FAILED", "EXPIRED", "TERMINATED", "REFUNDED"],
      default: "ACTIVE",
      required: true,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ cf_order_id: 1, status: 1 });
paymentSchema.index({ order_id: 1, status: 1 });

export const Payment = mongoose.model("Payment", paymentSchema);
