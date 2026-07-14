import mongoose from "mongoose";

const pdcAssignedOrderSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    pdc_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    otp: { type: String, default: null },
  },
  { timestamps: true },
);

export const PdcAssignedOrder = mongoose.model(
  "PdcAssignedOrder",
  pdcAssignedOrderSchema,
);
