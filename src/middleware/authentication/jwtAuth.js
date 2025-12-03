// src/middleware/authentication/jwtAuth.js

const jwt = require("jsonwebtoken");
const passport = require("passport");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const { User } = require("../../models");
const logger = require("../../utils/logger").createModuleLogger("JWTAuth");
const { ERROR_MESSAGES } = require("../../constants");

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * JWT Strategy for Passport
 */
const jwtStrategy = new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: JWT_SECRET,
  },
  async (payload, done) => {
    try {
      const user = await User.findByPk(payload.userId);
      if (user && user.is_active) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (error) {
      logger.error("JWT Strategy error:", { error: error.message });
      return done(error, false);
    }
  }
);

/**
 * Generate JWT Token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: "order-tracker",
    }
  );
};

/**
 * Verify JWT Token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error(ERROR_MESSAGES.TOKEN_EXPIRED);
  }
};

/**
 * JWT Authentication middleware
 */
const authenticateJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      logger.error("Authentication error:", { error: err.message });
      return res.status(500).json({
        success: false,
        message: ERROR_MESSAGES.AUTHENTICATION_FAILED,
      });
    }

    if (!user) {
      logger.warn("Authentication failed:", { info });
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    User.findByPk(decoded.userId)
      .then((user) => {
        if (user && user.is_active) {
          req.user = user;
        }
        next();
      })
      .catch(() => next());
  } catch (error) {
    next();
  }
};

/**
 * Check if user has valid Google tokens
 */
const requireGoogleAuth = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.access_token) {
      return res.status(403).json({
        success: false,
        message: ERROR_MESSAGES.REAUTH_REQUIRED,
        action: "REAUTH_REQUIRED",
      });
    }

    // Check if token needs refresh
    if (user.needsTokenRefresh()) {
      logger.info(`Token refresh needed for user: ${user.id}`);
      return res.status(403).json({
        success: false,
        message: ERROR_MESSAGES.TOKEN_EXPIRED,
        action: "REAUTH_REQUIRED",
      });
    }

    next();
  } catch (error) {
    logger.error("Google auth check error:", { error: error.message });
    res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.AUTHENTICATION_FAILED,
    });
  }
};

module.exports = {
  jwtStrategy,
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  requireGoogleAuth,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
