import mongoose from "mongoose";

const dpCancellationSchema = new mongoose.Schema(
  {
    dp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    month: {
      type: Number, // 1-12
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export const DpCancellation = mongoose.model("DpCancellation", dpCancellationSchema);
