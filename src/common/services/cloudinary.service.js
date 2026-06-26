import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "cloudinary_name",
  api_key: process.env.CLOUDINARY_API_KEY || "cloudinary_key",
  api_secret: process.env.CLOUDINARY_API_SECRET || "cloudinary_secret",
});

export const uploadToCloudinary = async (
  localFilePath,
  folderName = "countme",
) => {
  try {
    if (!localFilePath) return null;

    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: folderName,
      resource_type: "auto",
    });

    // Cleanup local temp file asynchronously
    await fs.unlink(localFilePath).catch((err) => {
      console.warn(
        "Failed to delete temporary local file:",
        localFilePath,
        err.message,
      );
    });

    return result;
  } catch (error) {
    // Make sure we clean up the local file even if upload fails
    await fs.unlink(localFilePath).catch(() => {});
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Deletes an asset from Cloudinary by its public ID
 * @param {string} publicId - The Cloudinary asset public ID
 * @returns {Promise<object>} Delete result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return null;
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};
