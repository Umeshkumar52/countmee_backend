/**
 * Security Middlewares for Production Ready Express App
 */

/**
 * Sanitizes input to prevent MongoDB Operator Injection attacks.
 * Recursively deletes any keys starting with '$' from req.body, req.query, and req.params.
 */
export const sanitizeMongo = (req, res, next) => {
  const clean = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (key.startsWith('$')) {
            delete obj[key];
          } else if (typeof obj[key] === 'object') {
            clean(obj[key]);
          }
        }
      }
    }
  };

  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};

/**
 * Prevents HTTP Parameter Pollution (HPP) by ensuring query params are singular.
 * If multiple values are supplied for a query parameter, it retains only the last one.
 */
export const preventHpp = (req, res, next) => {
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (Object.prototype.hasOwnProperty.call(req.query, key)) {
        if (Array.isArray(req.query[key])) {
          req.query[key] = req.query[key][req.query[key].length - 1];
        }
      }
    }
  }
  next();
};
