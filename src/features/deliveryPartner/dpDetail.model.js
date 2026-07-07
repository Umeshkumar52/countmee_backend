import mongoose from "mongoose";

const dpDetailSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    gender: { type: String, required: true },
    address: { type: String, default: null },
    profile_img: { type: String, required: true },
    online: { type: Boolean, default: false },
    document_approval: {
      type: String,
      enum: ["Approved", "Rejected", "Pending"],
      default: "Pending",
    },
    status: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    location: { type: String, default: "" },
    geo_location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },
    active_order_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  },
);

dpDetailSchema.virtual("dpDocument", {
  ref: "DpDocument",
  localField: "user_id",
  foreignField: "user_id",
  justOne: true,
});

dpDetailSchema.index({ geo_location: "2dsphere" });

export const DpDetail = mongoose.model("DpDetail", dpDetailSchema);
