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
    product_height: { type: String, required: true },
    product_length: { type: String, required: true },
    product_width: { type: String, required: true },
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
