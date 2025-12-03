const express = require("express");
const passport = require("passport");
const { generateToken, verifyToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const { globalErrorHandler } = require("../middleware/errorHandler");
const { google } = require("googleapis");
const { authenticateJWT } = require("../middleware/auth");
const { User } = require("../models");
const router = express.Router();

/**
 * GET /auth/google
 * - Normal login: no prompt param (Google decides UI; no consent forced).
 * - Fresh login (reauth): ?fresh=1 → prompt=consent to force new refresh_token.
 * - We always request offline access so refresh_token can be issued on fresh flows.
 */
router.get("/google", (req, res, next) => {
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
  // IMPORTANT: do NOT set prompt: 'none' for normal logins

  return passport.authenticate("google", opts)(req, res, next);
});

/**
 * GET /auth/google/callback
 * - Reads state to recover the original redirect_url (deep link or web)
 * - Issues your app JWT and sends it back in the redirect
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/error",
  }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);

      // Recover redirect_url from the state we sent to Google
      let redirectUrl = process.env.FRONTEND_URL;
      try {
        const raw = req.query.state || "{}";
        const parsed = JSON.parse(raw);
        if (parsed.redirect_url) redirectUrl = parsed.redirect_url;
      } catch (_) {
        // Fallback: if old flow sent redirect_url directly, prefer it
        if (req.query.redirect_url) redirectUrl = req.query.redirect_url;
      }

      const delimiter = redirectUrl.includes("?") ? "&" : "?";
      const finalUrl = `${redirectUrl}${delimiter}token=${encodeURIComponent(
        token
      )}`;

      return res.redirect(finalUrl);
    } catch (err) {
      const errorUrl =
        (process.env.FRONTEND_URL || "") +
        `/auth/error?message=${encodeURIComponent(err.message)}`;
      return res.redirect(errorUrl);
    }
  }
);

// Get current user
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    // Get user from database
    const { User } = require("../models");
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: "User not found or inactive",
      });
    }

    res.json({
      success: true,
      user: user.toSafeObject(),
    });
  } catch (error) {
    logger.error("Error getting current user:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user information",
    });
  }
});

// POST /auth/refresh
router.post("/refresh", authenticateJWT, async (req, res) => {
  try {
    const user = req.user;

    if (!user.refresh_token) {
      return res.status(403).json({
        success: false,
        message: "No refresh token available",
        action: "REAUTH_REQUIRED",
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: user.refresh_token });

    const { tokens } = await oauth2Client.refreshToken(user.refresh_token);

    if (!tokens?.access_token) {
      return res.status(500).json({
        success: false,
        message: "Failed to obtain new access token",
      });
    }

    user.access_token = tokens.access_token;

    // Handle both expiry_date (ms) and expires_in (s)
    const expiryMs = tokens.expiry_date
      ? tokens.expiry_date
      : tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : Date.now() + 60 * 60 * 1000; // default 1h
    user.token_expires_at = new Date(expiryMs);

    await user.save();

    return res.json({ success: true, message: "Token refreshed successfully" });
  } catch (error) {
    // If Google says invalid_grant, the refresh token was revoked/expired
    const isInvalidGrant =
      error?.response?.data?.error === "invalid_grant" ||
      /invalid_grant/i.test(error?.message || "");
    return res.status(isInvalidGrant ? 403 : 500).json({
      success: false,
      message: isInvalidGrant
        ? "Refresh token invalid—reauth required"
        : "Failed to refresh token",
      action: isInvalidGrant ? "REAUTH_REQUIRED" : undefined,
    });
  }
});

// Logout
router.post("/logout", authenticateJWT, async (req, res) => {
  try {
    const user = req.user; // set by authenticateJWT
    await user.update({
      access_token: null,
      token_expires_at: null,
      // NOTE: DO NOT clear refresh_token here
    });

    return res.json({ success: true, message: "Logged out (session only)" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, error: "Failed to logout" });
  }
});

const fetch =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

router.post("/disconnect", authenticateJWT, async (req, res) => {
  try {
    const user = req.user;

    if (!user.refresh_token) {
      return res.status(400).json({
        success: false,
        message: "Already disconnected (no refresh token on file)",
      });
    }

    // Revoke at Google (safe to ignore failures)
    try {
      await fetch(
        "https://oauth2.googleapis.com/revoke?token=" +
          encodeURIComponent(user.refresh_token),
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
    } catch (e) {
      console.warn("Google revoke failed (continuing):", e?.message);
    }

    // Now remove all Google tokens from DB
    await user.update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
    });

    return res.json({ success: true, message: "Google disconnected" });
  } catch (error) {
    console.error("Disconnect error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to disconnect Google",
    });
  }
});

// Health check for auth service
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth service is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
router.use(globalErrorHandler);

module.exports = router;
