import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["customer", "dp", "pdc", "admin"],
      default: "customer",
    },

    name: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    DOB: { type: Date, default: null },
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

// userSchema.virtual("user_type").get(function () {
//   return this.role;
// }).set(function (val) {
//   this.role = val;
// })
// ;

export const User = mongoose.model("User", userSchema);
