import mongoose from "mongoose";

const OrderBundleSchema = new mongoose.Schema(
  {
    bundle_id: { type: String, required: true, unique: true },
    dp_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notified_dps: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }],
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

export const OrderBundle = mongoose.model("OrderBundle", OrderBundleSchema);
