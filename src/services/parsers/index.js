// src/services/parsers/index.js - ENHANCED PARSER FACTORY
// Comprehensive parser factory with organized imports

// E-commerce Platform Parsers
const AmazonParser = require("./ecommerce/amazonParser");
const FlipkartParser = require("./ecommerce/flipkartParser");
const MyntraParser = require("./ecommerce/myntraParser");
const AjioParser = require("./ecommerce/ajioParser");
const MeeshoParser = require("./ecommerce/meeshoParser");
const TataCliqParser = require("./ecommerce/tatacliqParser");
const FirstCryParser = require("./ecommerce/firstcryParser");
const PaytmMallParser = require("./ecommerce/paytmmallParser");
const SnapdealParser = require("./ecommerce/snapdealParser");
const RelianceDigitalParser = require("./ecommerce/reliancedigitalParser");

// Quick Delivery Parsers
const SwiggyParser = require("./quickdelivery/swiggyParser");
const BlinkitParser = require("./quickdelivery/blinkitParser");
const BigBasketParser = require("./quickdelivery/bigbasketParser");
const ZeptoParser = require("./quickdelivery/zeptoParser");
const DominosParser = require("./quickdelivery/dominosParser");

// Logistics/Courier Parsers
const DelhiveryParser = require("./logistics/delhiveryParser");
const EcomExpressParser = require("./logistics/ecomexpressParser");
const AramexParser = require("./logistics/aramexParser");
const XpressbeesParser = require("./logistics/xpressbeesParser");
const TciExpressParser = require("./logistics/tciexpressParser");
const SafexpressParser = require("./logistics/safexpressParser");
const GatiParser = require("./logistics/gatiParser");
const BluedartParser = require("./logistics/bluedartParser");
const DtdcParser = require("./logistics/dtdcParser");
const FedexParser = require("./logistics/fedexParser");
const IndiapostParser = require("./logistics/indiapostParser");

// Specialized Parsers
const EkartParser = require("./specialized/ekartParser");
const GenericParser = require("./specialized/genericParser");

class ParserFactory {
  constructor() {
    // Initialize all parsers organized by category
    this.parsers = {
      // E-commerce platforms
      amazon: new AmazonParser(),
      flipkart: new FlipkartParser(),
      myntra: new MyntraParser(),
      ajio: new AjioParser(),
      meesho: new MeeshoParser(),
      tatacliq: new TataCliqParser(),
      firstcry: new FirstCryParser(),
      paytmmall: new PaytmMallParser(),
      snapdeal: new SnapdealParser(),
      reliancedigital: new RelianceDigitalParser(),

      // Quick delivery services
      swiggy: new SwiggyParser(),
      blinkit: new BlinkitParser(),
      bigbasket: new BigBasketParser(),
      zepto: new ZeptoParser(),
      dominos: new DominosParser(),

      // Logistics/courier services
      delhivery: new DelhiveryParser(),
      ecomexpress: new EcomExpressParser(),
      aramex: new AramexParser(),
      xpressbees: new XpressbeesParser(),
      tciexpress: new TciExpressParser(),
      safexpress: new SafexpressParser(),
      gati: new GatiParser(),
      bluedart: new BluedartParser(),
      dtdc: new DtdcParser(),
      fedex: new FedexParser(),
      indiapost: new IndiapostParser(),

      // Specialized parsers
      ekart: new EkartParser(),
      generic: new GenericParser(),
    };

    console.log(
      `🔧 ParserFactory initialized with ${
        Object.keys(this.parsers).length
      } parsers`
    );
  }

  /**
   * ENHANCED: Parse email with comprehensive platform detection and debugging
   */
  parseEmail(emailData) {
    console.log("\n🔧 PARSER FACTORY: Starting email parsing...");
    console.log(`📧 From: ${emailData.from}`);
    console.log(`📧 Subject: ${emailData.subject?.substring(0, 60)}...`);

    try {
      // Step 1: Detect platform with enhanced logic
      const platform = this.detectPlatform(emailData);

      if (!platform) {
        console.log("❌ PARSER: No platform detected");
        return null;
      }

      console.log(`✅ PARSER: Platform detected - ${platform}`);

      // Step 2: Get appropriate parser
      const parser = this.parsers[platform];

      if (!parser) {
        console.log(`❌ PARSER: No parser available for platform ${platform}`);
        return this.parsers.generic.parse(emailData);
      }

      // Step 3: Verify parser can handle this email
      if (
        parser.constructor.canParse &&
        !parser.constructor.canParse(emailData)
      ) {
        console.log(`❌ PARSER: ${platform} parser cannot handle this email`);
        return null;
      }

      console.log(`🚀 PARSER: Using ${platform} parser...`);

      // Step 4: Parse with the specific parser
      const result = parser.parse(emailData);

      if (!result) {
        console.log(`❌ PARSER: ${platform} parser returned null`);
        return null;
      }

      // Step 5: Validate and enhance result
      const enhancedResult = this.enhanceParseResult(
        result,
        emailData,
        platform
      );

      console.log(`✅ PARSER: Successfully parsed ${platform} order`);
      console.log(`📊 PARSER RESULT:`, {
        platform: enhancedResult.platform,
        orderId: enhancedResult.orderId,
        amount: enhancedResult.amount,
        itemsCount: enhancedResult.products?.length || 0,
        confidence: enhancedResult.confidence,
      });

      return enhancedResult;
    } catch (error) {
      console.error("❌ PARSER FACTORY ERROR:", error.message);
      return null;
    }
  }

  /**
   * ENHANCED: Comprehensive platform detection with all supported platforms
   */
  detectPlatform(emailData) {
    const from = (emailData.from || "").toLowerCase();
    const subject = (emailData.subject || "").toLowerCase();
    const content = (emailData.html || emailData.text || "").toLowerCase();

    // Comprehensive platform detection with multiple indicators
    const platformIndicators = {
      // E-commerce platforms
      amazon: [
        "amazon.in",
        "amazon.com",
        "@amazon",
        "auto-confirm@amazon",
        "shipment-tracking@amazon",
        "amazon.in order",
        "order-update@amazon",
      ],
      flipkart: [
        "flipkart.com",
        "@flipkart",
        "nct.flipkart.com",
        "rmt.flipkart.com",
      ],
      myntra: ["myntra.com", "@myntra"],
      ajio: ["ajio.com", "@ajio"],
      meesho: ["meesho.com", "@meesho"],
      tatacliq: ["tatacliq.com", "@tatacliq", "tata cliq"],
      firstcry: ["firstcry.com", "@firstcry"],
      paytmmall: ["paytmmall.com", "@paytmmall", "paytm mall"],
      snapdeal: ["snapdeal.com", "@snapdeal"],
      reliancedigital: [
        "reliancedigital.in",
        "@reliancedigital",
        "reliance digital",
      ],

      // Quick delivery services
      swiggy: ["swiggy.in", "@swiggy", "instamart"],
      blinkit: ["blinkit.com", "@blinkit"],
      bigbasket: ["bigbasket.com", "@bigbasket", "big basket"],
      zepto: ["zepto.in", "@zepto"],
      dominos: ["dominos.co.in", "@dominos", "domino's"],

      // Logistics/courier services
      delhivery: ["delhivery.com", "@delhivery"],
      ecomexpress: ["ecomexpress.in", "@ecomexpress", "ecom express"],
      aramex: ["aramex.com", "aramex.in", "@aramex"],
      xpressbees: ["xpressbees.com", "@xpressbees", "xpress bees"],
      tciexpress: ["tciexpress.in", "@tciexpress", "tci express"],
      safexpress: ["safexpress.com", "@safexpress"],
      gati: ["gati.com", "@gati"],
      bluedart: ["bluedart.com", "bluedart.in", "@bluedart", "blue dart"],
      dtdc: ["dtdc.in", "dtdc.com", "@dtdc"],
      fedex: ["fedex.com", "fedex.in", "@fedex"],
      indiapost: [
        "indianpost.gov.in",
        "indiapost.gov.in",
        "@indiapost",
        "india post",
      ],

      // Specialized
      ekart: ["ekart.in", "@ekart"],
    };

    // Check each platform with priority order
    const platformPriority = [
      // E-commerce platforms (highest priority)
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

      // Quick delivery
      "swiggy",
      "blinkit",
      "bigbasket",
      "zepto",
      "dominos",

      // Logistics (lower priority to avoid conflicts with e-commerce)
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

      // Specialized
      "ekart",
    ];

    for (const platform of platformPriority) {
      const indicators = platformIndicators[platform] || [];
      const hasIndicator = indicators.some(
        (indicator) =>
          from.includes(indicator) ||
          subject.includes(indicator) ||
          content.includes(indicator)
      );

      if (hasIndicator) {
        console.log(
          `🎯 PARSER: Platform detected as ${platform} from indicators:`,
          indicators.filter((i) => from.includes(i) || subject.includes(i))
        );
        return platform;
      }
    }

    // ENHANCED: STRICT generic detection - only for emails with ORDER IDs
    console.log(
      "⚠️ PARSER: No specific platform detected, checking if valid order email..."
    );

    // Must have actual order ID patterns to be considered generic order
    const orderIdPatterns = [
      /\b\d{3}-\d{7,8}-\d{7,8}\b/, // Amazon format
      /\bOD\d{15,21}\b/, // Flipkart format
      /\b\d{12,18}\b/, // Long number IDs
      /\b[A-Z]{2,4}\d{10,20}\b/, // Letter+number combinations
      /\b[A-Z0-9]{8,20}\b/, // Alphanumeric IDs
    ];

    const hasOrderId = orderIdPatterns.some(
      (pattern) => pattern.test(content) || pattern.test(subject)
    );

    if (!hasOrderId) {
      console.log("❌ PARSER: No order ID patterns found - rejecting email");
      return null;
    }

    // Additional validation - must be order-related
    const orderKeywords = [
      "order",
      "shipped",
      "delivered",
      "confirmation",
      "receipt",
      "payment",
      "tracking",
      "dispatched",
      "consignment",
      "awb",
    ];
    const hasOrderKeyword = orderKeywords.some(
      (keyword) => subject.includes(keyword) || content.includes(keyword)
    );

    if (!hasOrderKeyword) {
      console.log("❌ PARSER: No order keywords found - rejecting email");
      return null;
    }

    console.log(
      "🔍 PARSER: Using generic parser for order email with ID patterns"
    );
    return "generic";
  }

  /**
   * Enhance parse result with additional metadata
   */
  enhanceParseResult(result, emailData, platform) {
    // Ensure required fields exist
    const enhanced = {
      platform: result.platform || platform,
      orderId: result.orderId || result.order_id || null,
      amount: result.amount || result.totalAmount || 0,
      formattedAmount: result.formattedAmount || `₹${result.amount || 0}`,
      products: result.products || result.items || [],
      orderDate: result.orderDate || new Date(emailData.date || Date.now()),
      status: result.status || "unknown",
      confidence: result.confidence || 70,
      trackingId: result.trackingId || null,
      extractedAt: new Date().toISOString(),
      emailMetadata: {
        messageId: emailData.messageId,
        subject: emailData.subject,
        from: emailData.from,
        receivedAt: emailData.date,
      },
    };

    // Ensure products have required fields
    enhanced.products = enhanced.products.map((product) => ({
      name: product.name || "Unknown Product",
      quantity: product.quantity || 1,
      price: product.price || product.unit_price || 0,
      formattedPrice: product.formattedPrice || `₹${product.price || 0}`,
      type: product.type || "item",
      trackingId: product.trackingId || enhanced.trackingId,
      carrier: product.carrier || null,
    }));

    return enhanced;
  }

  /**
   * Get parsers by category
   */
  getParsersByCategory() {
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

    const result = {};
    Object.entries(categories).forEach(([category, platformList]) => {
      result[category] = platformList.filter((platform) =>
        this.parsers.hasOwnProperty(platform)
      );
    });

    return result;
  }

  /**
   * Get all available platforms
   */
  getAvailablePlatforms() {
    return Object.keys(this.parsers);
  }

  /**
   * Check if a platform is supported
   */
  isPlatformSupported(platform) {
    return this.parsers.hasOwnProperty(platform);
  }

  /**
   * Get parser statistics
   */
  getParserStats() {
    const categories = this.getParsersByCategory();
    const stats = {
      total: Object.keys(this.parsers).length,
      byCategory: {},
    };

    Object.entries(categories).forEach(([category, platforms]) => {
      stats.byCategory[category] = platforms.length;
    });

    return stats;
  }

  /**
   * Test parser availability
   */
  validateParsers() {
    const missing = [];
    const available = [];

    Object.entries(this.parsers).forEach(([platform, parser]) => {
      if (parser) {
        available.push(platform);
      } else {
        missing.push(platform);
      }
    });

    console.log(`✅ Available parsers: ${available.length}`);
    if (missing.length > 0) {
      console.log(`❌ Missing parsers: ${missing.join(", ")}`);
    }

    return { available, missing };
  }
}

// Export singleton instance
const parserFactory = new ParserFactory();

// Validate parsers on initialization
parserFactory.validateParsers();

module.exports = {
  parserFactory,
  ParserFactory,
};
