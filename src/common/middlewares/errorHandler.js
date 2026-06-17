import { ApiResponse } from '../utils/responseFormatter.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Global Express error handling middleware.
 * Standardizes error responses and manages server-side logging.
 */
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  let statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Treat standard Error instances (without specific statusCode/status) as 400 Bad Request
  if (!err.statusCode && !err.status && err.name === 'Error') {
    statusCode = 400;
  }

  // 1. Structured Server Logging
  if (statusCode >= 500) {
    // Critical system errors: Log full stack trace
    console.error(' [SYSTEM ERROR] Unhandled Exception:', {
      message: err.message,
      name: err.name,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method
    });
  } else {
    // Operational errors (validation, bad requests, auth checks): clean log without stack noise
    console.warn(` [OPERATIONAL ERROR] ${req.method} ${req.originalUrl} - Status: ${statusCode} - Message: ${message}`);
  }

  // 2. Custom ApiError Formatting
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // 3. Fallback Joi Validation (if validation middleware is triggered elsewhere)
  if (err.isJoi) {
    const errorDetails = {};
    err.details.forEach(item => {
      const key = item.context.key;
      if (!errorDetails[key]) {
        errorDetails[key] = [];
      }
      errorDetails[key].push(item.message);
    });

    return res.status(400).json(ApiResponse.error('Validation error', errorDetails));
  }

  // 4. Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json(ApiResponse.error(`${field.toUpperCase()} already exists.`, { [field]: [`${field} already exists.`] }));
  }

  // 5. JWT Auth Signatures Errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json(ApiResponse.error('Unauthorized or invalid token.'));
  }

  // 6. Final Catch-all for Generic Server Errors
  return res.status(statusCode).json(ApiResponse.error(message, isDevelopment ? { debug: err.stack } : null));
};
