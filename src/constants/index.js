// src/constants/index.js

const fs = require("fs");
const path = require("path");

/**
 * Auto-generate platform constants from discovered parsers (recursive search)
 */
function generatePlatformConstants() {
  const parsersDir = path.join(__dirname, "../services/parsers");
  const platforms = {};

  /**
   * Recursively search directories for parser files
   */
  function searchParsersRecursively(dir) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      items.forEach((item) => {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          // Recursively search subdirectories
          searchParsersRecursively(fullPath);
        } else if (item.isFile() && item.name.endsWith(".js")) {
          // Skip index and base files
          if (item.name === "index.js" || item.name === "baseParser.js") {
            return;
          }

          // Extract platform name from parser filename
          const platformMatch = item.name.match(/^(.+)Parser\.js$/);
          if (platformMatch) {
            const platform = platformMatch[1].toLowerCase();
            const platformKey = platform.toUpperCase();
            platforms[platformKey] = platform;

            // Log discovered parser for debugging
            console.log(`🔍 Discovered parser: ${platform} at ${fullPath}`);
          }
        }
      });
    } catch (error) {
      console.error(`❌ Error reading directory ${dir}:`, error.message);
    }
  }

  try {
    searchParsersRecursively(parsersDir);
    console.log(
      `📦 Auto-generated ${Object.keys(platforms).length} platform constants`
    );
  } catch (error) {
    console.error("❌ Error generating platform constants:", error.message);
  }

  return platforms;
}

/**
 * Get platforms by category (useful for UI grouping)
 */
function getPlatformsByCategory() {
  const categories = {
    ecommerce: [
      "amazon",
      "flipkart",
      "myntra",
      "ajio",
      "meesho",
      "tatacliq",
      "firstcry",
      "paytmmall",
      "snapdeal",
      "reliancedigital",
      "nykaa",
    ],
    quickdelivery: ["swiggy", "blinkit", "bigbasket", "zepto", "dominos"],
    logistics: [
      "delhivery",
      "ecomexpress",
      "aramex",
      "xpressbees",
      "tciexpress",
      "safexpress",
      "gati",
      "bluedart",
      "dtdc",
      "fedex",
      "indiapost",
    ],
    specialized: ["ekart", "generic"],
  };

  // Filter to only include platforms that actually exist
  const existingPlatforms = Object.values(PLATFORMS);
  const categorizedPlatforms = {};

  Object.entries(categories).forEach(([category, platformList]) => {
    categorizedPlatforms[category] = platformList.filter((platform) =>
      existingPlatforms.includes(platform)
    );
  });

  return categorizedPlatforms;
}

/**
 * Check if a platform exists in any category
 */
function isPlatformSupported(platform) {
  return Object.values(PLATFORMS).includes(platform.toLowerCase());
}

/**
 * Get platform category
 */
function getPlatformCategory(platform) {
  const categories = getPlatformsByCategory();

  for (const [category, platforms] of Object.entries(categories)) {
    if (platforms.includes(platform.toLowerCase())) {
      return category;
    }
  }

  return "unknown";
}

// Platform constants - Auto-generated from parser files
const PLATFORMS = generatePlatformConstants();

// Order status constants
const ORDER_STATUS = {
  ORDERED: "ordered",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
  UNKNOWN: "unknown",
};

// Sync status constants
const SYNC_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// Sync type constants
const SYNC_TYPE = {
  MANUAL: "manual",
  AUTOMATIC: "automatic",
  SCHEDULED: "scheduled",
};

// Authentication constants
const AUTH_PROVIDERS = {
  GOOGLE: "google",
  LOCAL: "local",
};

// API response constants
const API_RESPONSES = {
  SUCCESS: "success",
  FAILURE: "failure",
  ERROR: "error",
};

// Email search constants
const EMAIL_SEARCH = {
  DEFAULT_DAYS_TO_FETCH: 7,
  MAX_EMAILS_PER_SYNC: 50,
  BATCH_SIZE: 20,
};

// Database constants
const DB_CONSTRAINTS = {
  MAX_STRING_LENGTH: 255,
  MAX_TEXT_LENGTH: 65535,
  MAX_DECIMAL_PRECISION: 10,
  MAX_DECIMAL_SCALE: 2,
};

// Validation constants
const VALIDATION = {
  MIN_ORDER_AMOUNT: 0,
  MAX_CONFIDENCE_SCORE: 1,
  MIN_CONFIDENCE_SCORE: 0,
  MIN_QUANTITY: 1,
};

// Platform category constants
const PLATFORM_CATEGORIES = {
  ECOMMERCE: "ecommerce",
  QUICK_DELIVERY: "quickdelivery",
  LOGISTICS: "logistics",
  SPECIALIZED: "specialized",
};

// Error messages
const ERROR_MESSAGES = {
  AUTHENTICATION_FAILED: "Authentication failed",
  UNAUTHORIZED: "Unauthorized access",
  RESOURCE_NOT_FOUND: "Resource not found",
  VALIDATION_FAILED: "Validation failed",
  DATABASE_ERROR: "Database operation failed",
  SYNC_FAILED: "Email sync failed",
  TOKEN_EXPIRED: "Token has expired",
  REAUTH_REQUIRED: "Re-authentication required",
  PARSER_NOT_FOUND: "No parser found for this email",
  PLATFORM_NOT_SUPPORTED: "Platform not supported",
};

// Success messages
const SUCCESS_MESSAGES = {
  SYNC_STARTED: "Email sync started successfully",
  ORDER_CREATED: "Order created successfully",
  ORDER_UPDATED: "Order updated successfully",
  ORDER_DELETED: "Order deleted successfully",
  TOKEN_REFRESHED: "Token refreshed successfully",
  LOGOUT_SUCCESS: "Logged out successfully",
  PARSER_DISCOVERED: "Parser discovered successfully",
};

/**
 * Reload platform constants (useful for development)
 */
function reloadPlatformConstants() {
  const newPlatforms = generatePlatformConstants();

  // Clear existing platforms
  Object.keys(PLATFORMS).forEach((key) => delete PLATFORMS[key]);

  // Add new platforms
  Object.assign(PLATFORMS, newPlatforms);

  console.log(
    `🔄 Reloaded platform constants: ${Object.keys(PLATFORMS).join(", ")}`
  );

  return PLATFORMS;
}

/**
 * Get platform statistics
 */
function getPlatformStats() {
  const categories = getPlatformsByCategory();
  const stats = {
    total: Object.keys(PLATFORMS).length,
    byCategory: {},
  };

  Object.entries(categories).forEach(([category, platforms]) => {
    stats.byCategory[category] = platforms.length;
  });

  return stats;
}

module.exports = {
  // Core constants
  PLATFORMS,
  ORDER_STATUS,
  SYNC_STATUS,
  SYNC_TYPE,
  AUTH_PROVIDERS,
  API_RESPONSES,
  EMAIL_SEARCH,
  DB_CONSTRAINTS,
  VALIDATION,
  PLATFORM_CATEGORIES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,

  // Utility functions
  reloadPlatformConstants,
  generatePlatformConstants,
  getPlatformsByCategory,
  isPlatformSupported,
  getPlatformCategory,
  getPlatformStats,
};
