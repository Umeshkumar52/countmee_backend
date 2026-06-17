/**
 * Reusable wrapper to catch asynchronous errors in Express routes
 * and forward them to the global error handling middleware.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
