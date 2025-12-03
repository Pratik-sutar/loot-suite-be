// backend/src/routes/sync.js - ENHANCED WITH BETTER DAYSTOEFETCH LOGGING

const express = require("express");
const syncService = require("../services/syncService");
const {
  verifyToken,
  authenticateJWT,
} = require("../middleware/authentication/index");
const logger = require("../utils/logger");
const { globalErrorHandler } = require("../middleware/errorHandler");
const { User } = require("../models");
const emailConfig = require("../config/emailConfig");

const router = express.Router();

// Enhanced trigger sync with validation and logging
router.post("/trigger", authenticateJWT, async (req, res) => {
  try {
    const options = req.body || {};
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Log incoming request with user sync settings
    console.log("🚀 SYNC TRIGGER REQUEST:");
    console.log("=".repeat(40));
    console.log("User:", userEmail);
    console.log("User ID:", userId);
    console.log("Request body:", JSON.stringify(options, null, 2));
    console.log("Timestamp:", new Date().toISOString());

    // Validate and enhance daysToFetch parameter
    const requestedDays = options.daysToFetch;
    const defaultDays = emailConfig.defaultDaysToFetch || 7;

    let finalDaysToFetch = defaultDays;
    let daysSource = "config_default";

    if (requestedDays !== undefined) {
      const validatedDays = validateDaysToFetch(requestedDays);
      if (validatedDays.valid) {
        finalDaysToFetch = validatedDays.value;
        daysSource = "frontend_request";
      } else {
        console.log(
          `⚠️ Invalid daysToFetch (${requestedDays}): ${validatedDays.message}`
        );
        console.log(`📅 Using default: ${defaultDays} days`);
      }
    } else {
      console.log(
        `📅 No daysToFetch specified, using default: ${defaultDays} days`
      );
    }

    // Validate maxResults parameter
    const requestedMaxResults = options.maxResults;
    const defaultMaxResults = emailConfig.maxEmailsPerSync || 50;

    let finalMaxResults = defaultMaxResults;
    let maxResultsSource = "config_default";

    if (requestedMaxResults !== undefined) {
      const validatedMaxResults = validateMaxResults(requestedMaxResults);
      if (validatedMaxResults.valid) {
        finalMaxResults = validatedMaxResults.value;
        maxResultsSource = "frontend_request";
      } else {
        console.log(
          `⚠️ Invalid maxResults (${requestedMaxResults}): ${validatedMaxResults.message}`
        );
        console.log(`📧 Using default: ${defaultMaxResults} emails`);
      }
    }

    // Enhanced options with validation and metadata
    const enhancedOptions = {
      ...options,
      daysToFetch: finalDaysToFetch,
      maxResults: finalMaxResults,
      metadata: {
        originalRequest: {
          daysToFetch: requestedDays,
          maxResults: requestedMaxResults,
        },
        validation: {
          daysSource,
          maxResultsSource,
          requestTimestamp: new Date().toISOString(),
          userAgent: req.headers["user-agent"],
        },
        searchPeriod: {
          fromDate: new Date(
            Date.now() - finalDaysToFetch * 24 * 60 * 60 * 1000
          ).toISOString(),
          toDate: new Date().toISOString(),
          totalDays: finalDaysToFetch,
        },
      },
    };

    console.log("📋 FINAL SYNC CONFIGURATION:");
    console.log("Days to fetch:", finalDaysToFetch, `(${daysSource})`);
    console.log("Max results:", finalMaxResults, `(${maxResultsSource})`);
    console.log("Search from:", enhancedOptions.metadata.searchPeriod.fromDate);
    console.log("Search to:", enhancedOptions.metadata.searchPeriod.toDate);
    console.log("=".repeat(40));

    logger.info("Enhanced sync trigger", {
      userId,
      userEmail,
      originalOptions: options,
      finalOptions: {
        daysToFetch: finalDaysToFetch,
        maxResults: finalMaxResults,
      },
      validation: enhancedOptions.metadata.validation,
    });

    const result = await syncService.syncUserOrders(userId, enhancedOptions);

    return res.status(200).json({
      success: true,
      message: `Sync started for last ${finalDaysToFetch} days`,
      data: {
        ...result,
        syncConfiguration: {
          daysToFetch: finalDaysToFetch,
          maxResults: finalMaxResults,
          searchPeriod: enhancedOptions.metadata.searchPeriod,
          validation: enhancedOptions.metadata.validation,
        },
      },
    });
  } catch (err) {
    logger.error("Sync trigger error:", err);

    if (err.code === "REAUTH_REQUIRED") {
      return res.status(403).json({
        success: false,
        message: err.message || "Re-authorization required",
        action: "REAUTH_REQUIRED",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to trigger sync",
      error: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// GET /api/sync/status
router.get("/status", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get latest sync info to show current configuration
    const latestSync = await syncService.getSyncHistory(userId, 1);
    const syncStats = await syncService.getSyncStats(userId);

    const response = {
      success: true,
      status: "idle",
      timestamp: new Date().toISOString(),
      latestSync: latestSync[0] || null,
      stats: syncStats,
      configuration: {
        defaultDaysToFetch: emailConfig.defaultDaysToFetch || 7,
        maxEmailsPerSync: emailConfig.maxEmailsPerSync || 50,
        supportedPlatforms: emailConfig.getSupportedPlatforms?.() || [
          "amazon",
          "flipkart",
          "myntra",
        ],
      },
    };

    // Log the status request for debugging
    console.log("📊 Sync status requested:", {
      userId,
      hasLatestSync: !!latestSync[0],
      lastSyncDays: latestSync[0]?.metadata?.searchPeriod?.totalDays,
    });

    return res.json(response);
  } catch (error) {
    logger.error("Status fetch error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch sync status",
    });
  }
});

// Get sync status for specific sync
router.get("/status/:syncId", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || !user.is_active) {
      return res
        .status(401)
        .json({ success: false, error: "User not found or inactive" });
    }

    const { syncId } = req.params;
    const status = await syncService.getSyncStatus(user.id, syncId);

    // Enhanced status response with configuration info
    const enhancedStatus = {
      ...status,
      configuration: status.metadata?.searchPeriod
        ? {
            daysSearched: status.metadata.searchPeriod.totalDays,
            searchFromDate: status.metadata.searchPeriod.fromDate,
            searchToDate: status.metadata.searchPeriod.toDate,
          }
        : null,
    };

    res.json({ success: true, status: enhancedStatus });
  } catch (error) {
    logger.error("Sync status error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get sync status",
    });
  }
});

// Get sync configuration options (NEW ENDPOINT)
router.get("/config", authenticateJWT, async (req, res) => {
  try {
    const config = {
      defaultDaysToFetch: emailConfig.defaultDaysToFetch || 7,
      maxEmailsPerSync: emailConfig.maxEmailsPerSync || 50,
      supportedPlatforms: emailConfig.getSupportedPlatforms?.() || [
        "amazon",
        "flipkart",
        "myntra",
      ],

      // Days options for frontend
      daysOptions: [
        {
          value: 7,
          label: "Last 7 days",
          description: "Recent orders only",
          recommended: false,
        },
        {
          value: 15,
          label: "Last 15 days",
          description: "Good balance",
          recommended: true,
        },
        {
          value: 30,
          label: "Last 30 days",
          description: "Full month history",
          recommended: false,
        },
      ],

      // Validation rules
      validation: {
        daysToFetch: {
          min: 1,
          max: 90,
          default: emailConfig.defaultDaysToFetch || 7,
        },
        maxResults: {
          min: 5,
          max: 500,
          default: emailConfig.maxEmailsPerSync || 50,
        },
      },
    };

    console.log("⚙️ Sync config requested:", {
      userId: req.user.id,
      defaultDays: config.defaultDaysToFetch,
      optionsCount: config.daysOptions.length,
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    logger.error("Config fetch error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch sync configuration",
    });
  }
});

// Get sync history
router.get("/history", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || !user.is_active) {
      return res
        .status(401)
        .json({ success: false, error: "User not found or inactive" });
    }

    const defaultLimit = parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 10;
    const { limit = defaultLimit } = req.query;
    const history = await syncService.getSyncHistory(user.id, parseInt(limit));

    res.json({ success: true, history });
  } catch (error) {
    logger.error("Sync history error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get sync history",
    });
  }
});

// Get sync stats
router.get("/stats", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || !user.is_active) {
      return res
        .status(401)
        .json({ success: false, error: "User not found or inactive" });
    }

    const stats = await syncService.getSyncStats(user.id);

    res.json({ success: true, stats });
  } catch (error) {
    logger.error("Sync stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get sync stats",
    });
  }
});

// Get available sources
router.get("/sources", (req, res) => {
  try {
    const sources = emailConfig.sources;
    res.json({ success: true, sources });
  } catch (error) {
    logger.error("Sources error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get sources",
    });
  }
});

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Sync service is healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Validation helper for daysToFetch parameter
 */
function validateDaysToFetch(days) {
  const daysNum = parseInt(days);

  if (isNaN(daysNum)) {
    return {
      valid: false,
      message: "daysToFetch must be a valid number",
      value: emailConfig.defaultDaysToFetch || 7,
    };
  }

  if (daysNum < 1) {
    return {
      valid: false,
      message: "daysToFetch must be at least 1 day",
      value: emailConfig.defaultDaysToFetch || 7,
    };
  }

  if (daysNum > 90) {
    return {
      valid: false,
      message: "daysToFetch cannot exceed 90 days for performance reasons",
      value: emailConfig.defaultDaysToFetch || 7,
    };
  }

  return {
    valid: true,
    value: daysNum,
  };
}

/**
 * Validation helper for maxResults parameter
 */
function validateMaxResults(maxResults) {
  const maxNum = parseInt(maxResults);

  if (isNaN(maxNum)) {
    return {
      valid: false,
      message: "maxResults must be a valid number",
      value: emailConfig.maxEmailsPerSync || 50,
    };
  }

  if (maxNum < 5) {
    return {
      valid: false,
      message: "maxResults must be at least 5",
      value: emailConfig.maxEmailsPerSync || 50,
    };
  }

  if (maxNum > 500) {
    return {
      valid: false,
      message: "maxResults cannot exceed 500 emails for performance reasons",
      value: emailConfig.maxEmailsPerSync || 50,
    };
  }

  return {
    valid: true,
    value: maxNum,
  };
}

// Error handling middleware
router.use(globalErrorHandler);

module.exports = router;
