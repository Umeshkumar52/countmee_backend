import { v2 as cloudinary } from "cloudinary";
// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "cloudinary_name",
  api_key: process.env.CLOUDINARY_API_KEY || "cloudinary_key",
  api_secret: process.env.CLOUDINARY_API_SECRET || "cloudinary_secret",
});

export default cloudinary;
