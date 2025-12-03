const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const { User } = require("../models");
const logger = require("../utils/logger").createModuleLogger("Auth");

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Initialize Passport
passport.initialize();

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("=== GOOGLE STRATEGY CALLBACK ===");
        console.log("Profile ID:", profile.id);
        console.log("Email:", profile.emails[0]?.value);
        console.log(
          "accessToken?",
          !!accessToken,
          "refreshToken?",
          !!refreshToken
        );

        logger.info(`Google OAuth callback for user: ${profile.id}`);

        // Check if user already exists
        let user = await User.findByProviderId("google", profile.id);

        if (user) {
          // Update existing user's tokens
          user.access_token = accessToken;
          user.refresh_token = refreshToken || user.refresh_token;
          user.token_expires_at = new Date(Date.now() + 3600000); // 1 hour from now
          await user.save();

          logger.info(`Existing user updated: ${user.email}`);
        } else {
          // Create new user
          user = await User.create({
            email: profile.emails[0].value,
            name: profile.displayName,
            avatar: profile.photos[0]?.value,
            provider: "google",
            provider_id: profile.id,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expires_at: new Date(Date.now() + 3600000),
          });

          logger.info(`New user created: ${user.email}`);
        }

        console.log("=== GOOGLE STRATEGY SUCCESS ===");
        return done(null, user);
      } catch (error) {
        console.log("=== GOOGLE STRATEGY ERROR ===", error.message);
        logger.error("Google OAuth error:", { error: error.message });
        return done(error, null);
      }
    }
  )
);

// JWT Strategy
passport.use(
  new JwtStrategy(
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
  )
);

// Generate JWT Token
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

// Verify JWT Token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid token");
  }
};

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      logger.error("Authentication error:", { error: err.message });
      return res.status(500).json({
        success: false,
        message: "Authentication error",
      });
    }

    if (!user) {
      logger.warn("Authentication failed:", { info });
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.user = user;
    next();
  })(req, res, next);
};

// Optional authentication middleware (doesn't fail if no token)
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

// Check if user has valid Google tokens
const requireGoogleAuth = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.access_token) {
      return res.status(403).json({
        success: false,
        message: "Google authentication required",
        action: "REAUTH_REQUIRED",
      });
    }

    // Check if token needs refresh
    if (user.needsTokenRefresh()) {
      // Token refresh logic would go here
      logger.info(`Token refresh needed for user: ${user.id}`);
      // For now, require re-authentication
      return res.status(403).json({
        success: false,
        message: "Token expired, re-authentication required",
        action: "REAUTH_REQUIRED",
      });
    }

    next();
  } catch (error) {
    logger.error("Google auth check error:", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Authentication check failed",
    });
  }
};

// Rate limiting for authentication endpoints - only in production
const authRateLimit =
  process.env.NODE_ENV === "production"
    ? require("express-rate-limit")({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 requests per windowMs
        message: "Too many authentication attempts, please try again later.",
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (req, res, next) => next(); // Skip rate limiting in development

module.exports = {
  passport,
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  requireGoogleAuth,
  authRateLimit,
};
