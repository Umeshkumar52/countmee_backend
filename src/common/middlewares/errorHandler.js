import { ApiResponse } from "../utils/responseFormatter.js";
import { ApiError } from "../utils/ApiError.js";
import fs from "fs";

/**
 * Global Express error handling middleware.
 * Standardizes error responses and manages server-side logging.
 */
export const errorHandler = (err, req, res, next) => {
  console.error("❌ Server Error:", err);

  // Clean up any uploaded files if the request fails
  const filesToDelete = [];
  if (req.file) {
    filesToDelete.push(req.file.path);
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach((file) => filesToDelete.push(file.path));
    } else {
      // It's an object mapping field names to arrays of files
      Object.values(req.files).forEach((fileArray) => {
        fileArray.forEach((file) => filesToDelete.push(file.path));
      });
    }
  }

  filesToDelete.forEach((filePath) => {
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr && unlinkErr.code !== 'ENOENT') {
        console.warn(`Failed to clean up file ${filePath}:`, unlinkErr.message);
      }
    });
  });

  // Handle multer file size errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File too large. Maximum file size is 500MB",
      data: null,
    });
  }

  // Handle multer file type errors
  if (
    err.message &&
    (err.message.includes("video files") ||
      err.message.includes("Only video files"))
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
      data: null,
    });
  }

  // Handle multer "Unexpected field" error (wrong field name)
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    const fieldMsg = err.field ? ` '${err.field}'` : "";
    return res.status(400).json({
      success: false,
      message: `Unexpected file upload field${fieldMsg}. Please check the allowed file field names for this endpoint.`,
      data: null,
    });
  }

  // If it's an instance of ApiError → use its structure
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // ✅ Handle JWT errors globally (Expired/Invalid)
  if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "401 Invalid or expired access token",
      data: null,
    });
  }

  // Otherwise, fallback to generic
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
  });
};
