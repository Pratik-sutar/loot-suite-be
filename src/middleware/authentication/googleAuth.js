// src/middleware/authentication/googleAuth.js

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User } = require("../../models");
const logger = require("../../utils/logger").createModuleLogger("GoogleAuth");
const { AUTH_PROVIDERS } = require("../../constants");

/**
 * Google OAuth Strategy for Passport
 */
const googleStrategy = new GoogleStrategy(
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
      let user = await User.findByProviderId(AUTH_PROVIDERS.GOOGLE, profile.id);

      if (user) {
        // Update existing user's tokens
        user.access_token = accessToken;
        user.refresh_token = refreshToken || user.refresh_token;
        user.token_expires_at = new Date(Date.now() + (parseInt(process.env.GOOGLE_TOKEN_EXPIRY_MS) || 3600000));
        await user.save();

        logger.info(`Existing user updated: ${user.email}`);
      } else {
        // Create new user
        user = await User.create({
          email: profile.emails[0].value,
          name: profile.displayName,
          avatar: profile.photos[0]?.value,
          provider: AUTH_PROVIDERS.GOOGLE,
          provider_id: profile.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: new Date(Date.now() + (parseInt(process.env.GOOGLE_TOKEN_EXPIRY_MS) || 3600000)),
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
);

/**
 * Google OAuth authentication middleware
 */
const authenticateGoogle = (req, res, next) => {
  const isFresh = req.query.fresh === "1";
  const redirectUrl = req.query.redirect_url || process.env.FRONTEND_URL;

  // Put redirect_url into state so we can recover it in /callback
  const state = JSON.stringify({ redirect_url: redirectUrl });

  const opts = {
    scope: [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    accessType: "offline", // needed to ever receive refresh_token
    includeGrantedScopes: true,
    state,
    session: false,
  };

  // Only force user consent on "fresh" flows
  if (isFresh) {
    opts.prompt = "consent";
  }

  return passport.authenticate("google", opts)(req, res, next);
};

/**
 * Google OAuth callback middleware
 */
const handleGoogleCallback = (req, res, next) => {
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/error",
  })(req, res, next);
};

/**
 * Rate limiting for authentication endpoints
 */
const authRateLimit =
  (process.env.NODE_ENV === "production" || process.env.DEBUG_MODE !== "true")
    ? require("express-rate-limit")({
        windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
        message: "Too many authentication attempts, please try again later.",
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (req, res, next) => next(); // Skip rate limiting in development

module.exports = {
  googleStrategy,
  authenticateGoogle,
  handleGoogleCallback,
  authRateLimit,
};
