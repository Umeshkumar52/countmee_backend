import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "supersecretjwtsecretkeyforsecurityandhashing";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "supersecretjwtrefreshsecretkeyforrotationandrevocation";

/**
 * Generate a short-lived access token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      _id: user._id,
      email: user.email,
      role: user.role,
      user_type: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
    },
  );
};

/**
 * Generate a long-lived refresh token
 */
export const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id, _id: user._id }, JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

// Keep for compatibility
export const generateToken = (user) => {
  return generateAccessToken(user);
};

/**
 * Express middleware to authenticate users using JWT bearer token
 */
export const authenticate = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return next(
        new ApiError(
          401,
          "Authentication required. Please provide a valid Bearer token.",
        ),
      );
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("token decode", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "TokenExpired"));
    }
    return next(new ApiError(401, "Invalid or expired token."));
  }
};

export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const userRole = req.user.role || req.user.user_type;
    if (roles.length && !roles.includes(userRole)) {
      return next(new ApiError(403, "Forbidden: Insufficient privileges"));
    }
    next();
  };
};
