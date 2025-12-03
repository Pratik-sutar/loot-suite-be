// src/services/parsers/zeptoParser.js

const BaseParser = require("../baseParser");

class ZeptoParser extends BaseParser {
  constructor() {
    super("zepto");
  }

  /**
   * Check if this parser can handle the given email
   */
  canParse(email) {
    const sender = email.sender?.toLowerCase() || "";
    const subject = email.subject?.toLowerCase() || "";

    return (
      sender.includes("zepto") ||
      sender.includes("zepto.in") ||
      sender.includes("@zepto") ||
      sender.includes("noreply@zepto") ||
      sender.includes("orders@zepto") ||
      subject.includes("zepto") ||
      subject.includes("order confirmed") ||
      subject.includes("order placed") ||
      subject.includes("your order") ||
      subject.includes("order delivered") ||
      subject.includes("10 minute delivery")
    );
  }

  /**
   * Parse Zepto email and extract order information
   */
  parse(email) {
    const html = email.html || "";
    const text = email.text || "";
    const subject = email.subject || "";

    // Zepto-specific regex patterns
    const orderIdPattern = /order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i;
    const amountPattern =
      /(?:total|amount|paid|grand total|order total)\s*[:\-]?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i;
    const datePattern =
      /(?:ordered|placed)\s*on\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

    const orderId = this.extractOrderId(html, text, orderIdPattern);
    const amount = this.extractAmount(html, text, amountPattern);
    const orderDate = this.extractOrderDate(html, text, datePattern);
    const items = this.extractItems(html, text);
    const orderStatus = this.extractOrderStatus(html, text, subject);

    return {
      orderId,
      amount,
      orderDate,
      items,
      status: orderStatus,
      platform: "zepto",
      confidence: this.calculateConfidence(orderId, amount, items),
    };
  }

  /**
   * Extract order ID from email content
   */
  extractOrderId(html, text, pattern) {
    const content = html + text;
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract order amount from email content
   */
  extractAmount(html, text, pattern) {
    const content = html + text;
    const match = content.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, "");
      return parseFloat(amountStr);
    }
    return null;
  }

  /**
   * Extract order date from email content
   */
  extractOrderDate(html, text, pattern) {
    const content = html + text;
    const match = content.match(pattern);
    if (match) {
      const dateStr = match[1];
      // Try to parse the date
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    return new Date();
  }

  /**
   * Extract order items from email content
   */
  extractItems(html, text) {
    const items = [];
    const content = html + text;

    // Zepto-specific item patterns (grocery/daily essentials focused)
    const itemPatterns = [
      /product[:\-]?\s*([^₹\n]+?)\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /item[:\-]?\s*([^₹\n]+?)\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /([^₹\n]+?)\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
      /([^₹\n]+?)\s*-\s*₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
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
          itemName.toLowerCase().includes("packaging")
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
   * Extract order status from email content
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
   * Calculate confidence score for parsed data
   */
  calculateConfidence(orderId, amount, items) {
    let confidence = 0.5; // Base confidence

    if (orderId) confidence += 0.2;
    if (amount && amount > 0) confidence += 0.2;
    if (items && items.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

module.exports = ZeptoParser;
