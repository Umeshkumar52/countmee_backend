import mongoose from "mongoose";
import { ROLES } from "../../constants/index.js";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: [ROLES.USER, ROLES.DP, ROLES.PDC, ROLES.ADMIN],
      default: ROLES.USER,
    },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    dob: { type: Date, default: null },
    password: { type: String, default: "" },
    otp: { type: String, default: "" },
    refreshToken: { type: String, default: null },
    fcm_token: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);



export const User = mongoose.model("User", userSchema);
