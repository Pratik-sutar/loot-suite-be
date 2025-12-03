// src/services/parsers/genericParser.js

const BaseParser = require("../baseParser");

class GenericParser extends BaseParser {
  constructor() {
    super("generic");
  }

  /**
   * Generic parser should only return true as a last resort
   * This parser will be used when no other specific parser matches
   */
  canParse(email) {
    // Generic parser should only be used when no other parser can handle the email
    // Since this is called last in the parser factory, we can be more conservative
    const { sender, subject } = email;

    // Only attempt parsing if we have some basic order-related keywords
    const content = `${sender} ${subject}`.toLowerCase();
    const orderKeywords = [
      "order",
      "delivered",
      "shipped",
      "confirmed",
      "placed",
      "amount",
      "total",
      "paid",
      "invoice",
      "receipt",
    ];

    // Return true only if we detect order-related content
    return orderKeywords.some((keyword) => content.includes(keyword));
  }

  /**
   * Parse generic email and extract order information using common patterns
   */
  parse(email) {
    const html = email.html || "";
    const text = email.text || "";
    const subject = email.subject || "";
    const sender = email.sender || "";

    // Generic regex patterns that work across most platforms
    const orderIdPatterns = [
      // More specific patterns to avoid HTML/CSS garbage
      /order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]{8,20})/i,
      /order\s*[:\-]?\s*([A-Z0-9\-]{8,20})/i,
      /(?:order|order id)\s*[:\-]?\s*([A-Z0-9\-]{8,20})/i,
      // Only match # followed by reasonable order ID length
      /#([A-Z0-9\-]{8,20})/i,
    ];

    const amountPatterns = [
      /(?:total|amount|paid|grand total|order total|final amount)\s*[:\-]?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
      /₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
      /rs\.?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
      /(\d+(?:,\d+)*(?:\.\d{2})?)\s*₹/i,
    ];

    const datePatterns = [
      /(?:ordered|placed|booked)\s*on\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:date|ordered)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    ];

    const orderId = this.extractOrderId(html, text, orderIdPatterns);
    const amount = this.extractAmount(html, text, amountPatterns);
    const orderDate = this.extractOrderDate(html, text, datePatterns);
    const items = this.extractItems(html, text);
    const orderStatus = this.extractOrderStatus(html, text, subject);
    const platform = this.detectPlatform(sender, subject);

    return {
      orderId,
      amount,
      orderDate,
      items,
      status: orderStatus,
      platform: platform,
      confidence: this.calculateConfidence(orderId, amount, items),
    };
  }

  /**
   * Extract order ID using multiple patterns
   */
  extractOrderId(html, text, patterns) {
    const content = html + text;

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const orderId = match[1].trim();
        // Avoid returning placeholder values
        if (
          orderId &&
          orderId.length > 2 &&
          !orderId.toLowerCase().includes("value") &&
          !orderId.toLowerCase().includes("table")
        ) {
          return orderId;
        }
      }
    }
    return null;
  }

  /**
   * Extract order amount using multiple patterns
   */
  extractAmount(html, text, patterns) {
    const content = html + text;

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const amountStr = match[1].replace(/,/g, "");
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          // Reasonable amount range
          return amount;
        }
      }
    }
    return null;
  }

  /**
   * Extract order date using multiple patterns
   */
  extractOrderDate(html, text, patterns) {
    const content = html + text;

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    return new Date();
  }

  /**
   * Extract order items using generic patterns
   */
  extractItems(html, text) {
    const items = [];
    const content = html + text;

    // Generic item patterns
    const itemPatterns = [
      /([^₹\n]+?)\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /([^₹\n]+?)\s*-\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /([^₹\n]+?)\s*rs\.?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /product[:\-]?\s*([^₹\n]+?)\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /item[:\-]?\s*([^₹\n]+?)\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    ];

    for (const pattern of itemPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const itemName = this.cleanProductName(match[1]);
        const price = parseFloat(match[2].replace(/,/g, ""));

        // Skip if item name is too short or contains common non-product text
        if (
          itemName.length < 3 ||
          itemName.toLowerCase().includes("total") ||
          itemName.toLowerCase().includes("amount") ||
          itemName.toLowerCase().includes("delivery") ||
          itemName.toLowerCase().includes("tax") ||
          itemName.toLowerCase().includes("discount") ||
          itemName.toLowerCase().includes("subtotal") ||
          itemName.toLowerCase().includes("grand total")
        ) {
          continue;
        }

        items.push({
          name: itemName,
          price: price,
          quantity: 1,
        });
      }
    }

    return this.deduplicateItems(items);
  }

  /**
   * Extract order status using generic patterns
   */
  extractOrderStatus(html, text, subject) {
    const content = (html + text + subject).toLowerCase();

    if (
      content.includes("delivered") ||
      content.includes("successfully delivered")
    ) {
      return "delivered";
    } else if (
      content.includes("out for delivery") ||
      content.includes("on the way")
    ) {
      return "out_for_delivery";
    } else if (content.includes("shipped") || content.includes("dispatched")) {
      return "shipped";
    } else if (
      content.includes("confirmed") ||
      content.includes("order placed")
    ) {
      return "confirmed";
    } else if (
      content.includes("processing") ||
      content.includes("preparing")
    ) {
      return "processing";
    }

    return "ordered";
  }

  /**
   * Try to detect platform from sender and subject
   */
  detectPlatform(sender, subject) {
    const content = (sender + " " + subject).toLowerCase();

    // Common platform patterns
    const platformPatterns = {
      amazon: ["amazon", "amzn"],
      flipkart: ["flipkart"],
      swiggy: ["swiggy", "instamart"],
      myntra: ["myntra"],
      blinkit: ["blinkit"],
      nykaa: ["nykaa"],
      zepto: ["zepto"],
      bigbasket: ["bigbasket", "big basket"],
      grofers: ["grofers"],
      jiomart: ["jiomart", "jio mart"],
      dunzo: ["dunzo"],
      rapido: ["rapido"],
      uber: ["uber eats", "ubereats"],
      zomato: ["zomato"],
    };

    for (const [platform, patterns] of Object.entries(platformPatterns)) {
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          return platform;
        }
      }
    }

    return "generic";
  }

  /**
   * Calculate confidence score for parsed data
   * Generic parser typically has lower confidence
   */
  calculateConfidence(orderId, amount, items) {
    let confidence = 0.3; // Lower base confidence for generic parser

    if (orderId) confidence += 0.2;
    if (amount && amount > 0) confidence += 0.2;
    if (items && items.length > 0) confidence += 0.1;

    return Math.min(confidence, 0.8); // Cap at 0.8 for generic parser
  }
}

module.exports = GenericParser;
