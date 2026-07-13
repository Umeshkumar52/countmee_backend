import mongoose from "mongoose";

const adminSettingSchema = new mongoose.Schema(
  {
    max_dp_cancellation_limit: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

export const AdminSetting = mongoose.model("AdminSetting", adminSettingSchema);
