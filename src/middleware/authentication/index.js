// src/middleware/authentication/index.js

const passport = require("passport");
const {
  jwtStrategy,
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  requireGoogleAuth,
} = require("./jwtAuth");
const {
  googleStrategy,
  authenticateGoogle,
  handleGoogleCallback,
  authRateLimit,
} = require("./googleAuth");

// Initialize Passport
passport.initialize();

// Register strategies
passport.use("jwt", jwtStrategy);
passport.use("google", googleStrategy);

module.exports = {
  passport,
  generateToken,
  verifyToken,
  authenticateJWT,
  optionalAuth,
  requireGoogleAuth,
  authenticateGoogle,
  handleGoogleCallback,
  authRateLimit,
};
