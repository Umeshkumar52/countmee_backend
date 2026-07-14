import mongoose from "mongoose";

const orderRequestSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    notified_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    request_type: { type: String, required: true },
    broadcast_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Broadcast",
      default: null,
    },
    accepted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejected_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    complete_status: { type: String, enum: ["pending", "completed"], default: "pending" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
export const OrderRequest = mongoose.model("OrderRequest", orderRequestSchema);
