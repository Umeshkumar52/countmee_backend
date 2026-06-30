import mongoose from "mongoose";

const packageDetailSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    product_description: { type: String, default: null },
    product_weight: { type: String, required: true },
    no_of_items: { type: Number, required: true },
    types_of_product: { type: String, required: true },
    size_of_package: { type: String, required: true },
    product_height: { type: String },
    product_length: { type: String },
    product_width: { type: String },
    dimension_unit: { type: String, enum: ['cm', 'm', 'ft', 'inch'], default: 'cm' },
    different_dimantion: { type: Boolean, default: false },
    dimensions_list: [{
      length: { type: String },
      width: { type: String },
      height: { type: String },
      dimension_unit: { type: String, enum: ['cm', 'm', 'ft', 'inch'], default: 'cm' }
    }],
    image1: { type: String, required: true },
    image2: { type: String, required: true },
    image3: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

export const PackageDetail = mongoose.model(
  "PackageDetail",
  packageDetailSchema,
);
