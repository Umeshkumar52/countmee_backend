import mongoose from "mongoose";

const broadcastSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    broadcasted_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    pickup_location: { type: String, required: true },
    pickup_latitude: { type: Number, required: true },
    pickup_longitude: { type: Number, required: true },
    drop_location: { type: String, required: true },
    drop_latitude: { type: Number, required: true },
    drop_longitude: { type: Number, required: true },
    distance: { type: String, default: "0 km" },
    pickup_dp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pickup_otp: { type: Number },
    drop_otp: { type: Number },
    status: { type: String, enum: ["Pending", "Broadcasting", "Accepted", "Completed", "Active"], default: "Pending" },
  },
  {
    timestamps: true,
  },
);

export const Broadcast = mongoose.model("Broadcast", broadcastSchema);
