// src/config/parserConfig.js

const fs = require("fs");
const path = require("path");

/**
 * Auto-generate parser configuration based on discovered parsers
 * This eliminates the need to manually maintain platform lists
 */
class ParserConfig {
  constructor() {
    this.parsersDir = path.join(__dirname, "../services/parsers");
    this.config = this.generateConfig();
  }

  /**
   * Auto-generate configuration from parser files
   */
  generateConfig() {
    const config = {
      platforms: [],
      platformConfigs: {},
      emailPatterns: {},
      searchQueries: {},
    };

    try {
      const files = fs.readdirSync(this.parsersDir);

      files.forEach((file) => {
        if (
          file === "index.js" ||
          file === "baseParser.js" ||
          !file.endsWith(".js")
        ) {
          return;
        }

        const platformMatch = file.match(/^(.+)Parser\.js$/);
        if (!platformMatch) return;

        const platform = platformMatch[1].toLowerCase();

        // Add to platforms list
        config.platforms.push(platform);

        // Generate default configuration for this platform
        config.platformConfigs[platform] =
          this.generatePlatformConfig(platform);
      });

      // Generate email patterns and search queries after all platform configs are created
      config.platforms.forEach((platform) => {
        config.emailPatterns[platform] = this.generateEmailPatterns(
          platform,
          config.platformConfigs[platform]
        );
        config.searchQueries[platform] = this.generateSearchQueries(
          platform,
          config.platformConfigs[platform]
        );
      });

      console.log(
        `Auto-generated config for ${config.platforms.length} platforms`
      );
    } catch (error) {
      console.error("Error generating parser config:", error.message);
    }

    return config;
  }

  /**
   * Generate default configuration for a platform
   */
  generatePlatformConfig(platform) {
    const configs = {
      amazon: {
        displayName: "Amazon",
        senderPatterns: ["amazon.in", "amazon.com", "@amazon"],
        subjectPatterns: [
          "shipped",
          "delivered",
          "dispatched",
          "your order",
          "order confirmation",
        ],
        orderIdPatterns: [/\b\d{3}-\d{7,8}-\d{7,8}\b/],
        amountPatterns: [
          /Order Total[^â‚¹Rs\d]*(?:â‚¹|Rs\.?)\s*([\d,.]+)/i,
          /Total[^â‚¹Rs\d]*(?:â‚¹|Rs\.?)\s*([\d,.]+)/i,
        ],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["shipped", "dispatched"],
          confirmed: ["confirmed", "order placed"],
        },
      },
      flipkart: {
        displayName: "Flipkart",
        senderPatterns: ["flipkart.com"],
        subjectPatterns: [
          "your order",
          "order confirmation",
          "shipped",
          "delivered",
        ],
        orderIdPatterns: [/Order ID\s*([A-Z0-9]+)/i],
        amountPatterns: [/Amount Paid[:\s]*â‚¹\s*([\d,]+)/i],
        statusKeywords: {
          delivered: ["delivered"],
          shipped: ["shipped", "out for delivery"],
          confirmed: ["confirmed", "order placed"],
        },
      },
      swiggy: {
        displayName: "Swiggy",
        senderPatterns: ["swiggy.in", "@swiggy", "noreply@swiggy"],
        subjectPatterns: [
          "instamart order",
          "instamart",
          "swiggy",
          "delivered",
        ],
        orderIdPatterns: [/order id[:\s]*(\d{12,20})/i],
        amountPatterns: [/Grand Total[:\s]*â‚¹\s*([\d,]+(?:\.\d+)?)/i],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["dispatched", "shipped"],
          confirmed: ["order placed", "confirmed"],
        },
      },
      myntra: {
        displayName: "Myntra",
        senderPatterns: ["myntra.com", "@myntra"],
        subjectPatterns: ["order confirmation", "order placed", "myntra"],
        orderIdPatterns: [/order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i],
        amountPatterns: [
          /(?:total|amount|paid)\s*[:\-]?\s*â‚¹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        ],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["shipped", "dispatched"],
          confirmed: ["confirmed", "order placed"],
        },
      },
      blinkit: {
        displayName: "Blinkit",
        senderPatterns: ["blinkit.com", "@blinkit", "noreply@blinkit"],
        subjectPatterns: [
          "order confirmed",
          "order placed",
          "your order",
          "order delivered",
        ],
        orderIdPatterns: [/order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i],
        amountPatterns: [
          /(?:total|amount|paid|grand total)\s*[:\-]?\s*â‚¹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        ],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["shipped", "dispatched"],
          confirmed: ["confirmed", "order placed"],
        },
      },
      nykaa: {
        displayName: "Nykaa",
        senderPatterns: [
          "nykaa.com",
          "@nykaa",
          "noreply@nykaa",
          "orders@nykaa",
        ],
        subjectPatterns: [
          "order confirmation",
          "order placed",
          "your order",
          "order shipped",
          "order delivered",
        ],
        orderIdPatterns: [/order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i],
        amountPatterns: [
          /(?:total|amount|paid|grand total|order total)\s*[:\-]?\s*â‚¹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        ],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["shipped", "dispatched"],
          confirmed: ["confirmed", "order placed"],
        },
      },
      zepto: {
        displayName: "Zepto",
        senderPatterns: ["zepto.in", "@zepto", "noreply@zepto", "orders@zepto"],
        subjectPatterns: [
          "order confirmed",
          "order placed",
          "your order",
          "order delivered",
          "10 minute delivery",
        ],
        orderIdPatterns: [/order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i],
        amountPatterns: [
          /(?:total|amount|paid|grand total|order total)\s*[:\-]?\s*â‚¹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        ],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["shipped", "dispatched"],
          confirmed: ["confirmed", "order placed"],
        },
      },
      generic: {
        displayName: "Generic",
        senderPatterns: ["*"],
        subjectPatterns: ["order", "confirmation", "shipped", "delivered"],
        orderIdPatterns: [/order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i],
        amountPatterns: [
          /(?:total|amount|paid|grand total|order total|final amount)\s*[:\-]?\s*â‚¹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        ],
        statusKeywords: {
          delivered: ["delivered", "successfully delivered"],
          shipped: ["shipped", "dispatched"],
          confirmed: ["confirmed", "order placed"],
        },
      },
    };

    return (
      configs[platform] || {
        displayName: platform.charAt(0).toUpperCase() + platform.slice(1),
        senderPatterns: [`${platform}.com`, `@${platform}`],
        subjectPatterns: ["order", "confirmation"],
        orderIdPatterns: [/order\s*[:\-]?\s*([A-Z0-9\-]+)/i],
        amountPatterns: [
          /(?:total|amount)\s*[:\-]?\s*â‚¹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        ],
        statusKeywords: {
          delivered: ["delivered"],
          shipped: ["shipped"],
          confirmed: ["confirmed"],
        },
      }
    );
  }

  /**
   * Generate email search patterns for a platform
   */
  generateEmailPatterns(platform, platformConfig) {
    return {
      from: platformConfig.senderPatterns.join(" OR "),
      subject: platformConfig.subjectPatterns.join(" OR "),
      keywords: [
        ...platformConfig.senderPatterns,
        ...platformConfig.subjectPatterns,
      ],
    };
  }

  /**
   * Generate search queries for a platform
   */
  generateSearchQueries(platform, platformConfig) {
    return {
      from: platformConfig.senderPatterns,
      subject: platformConfig.subjectPatterns,
      excludePromotions: true,
    };
  }

  /**
   * Get all supported platforms
   */
  getSupportedPlatforms() {
    return this.config.platforms;
  }

  /**
   * Get configuration for a specific platform
   */
  getPlatformConfig(platform) {
    return this.config.platformConfigs[platform.toLowerCase()];
  }

  /**
   * Get email patterns for a platform
   */
  getEmailPatterns(platform) {
    return this.config.emailPatterns[platform.toLowerCase()];
  }

  /**
   * Get search queries for a platform
   */
  getSearchQueries(platform) {
    return this.config.searchQueries[platform.toLowerCase()];
  }

  /**
   * Reload configuration (useful for development)
   */
  reload() {
    this.config = this.generateConfig();
    return this.config;
  }

  /**
   * Get full configuration
   */
  getConfig() {
    return this.config;
  }
}

// Create singleton instance
const parserConfig = new ParserConfig();

module.exports = {
  ParserConfig,
  parserConfig,
  // Convenience methods
  getSupportedPlatforms: () => parserConfig.getSupportedPlatforms(),
  getPlatformConfig: (platform) => parserConfig.getPlatformConfig(platform),
  getEmailPatterns: (platform) => parserConfig.getEmailPatterns(platform),
  getSearchQueries: (platform) => parserConfig.getSearchQueries(platform),
  reload: () => parserConfig.reload(),
  getConfig: () => parserConfig.getConfig(),
};
