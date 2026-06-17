import mongoose from "mongoose";

const pdcPayoutSchema = new mongoose.Schema(
  {
    pdc_auth_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    pdc_package_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "PackageDetail",
    },
    broadcast_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Broadcast",
      default: null,
    },
    earnings: { type: Number, required: true },
    settled: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PdcPayout = mongoose.model("PdcPayout", pdcPayoutSchema);
