// src/services/parsers/baseParser.js

const { ORDER_STATUS } = require("../../constants");

/**
 * Base parser class with common functionality
 */
class BaseParser {
  constructor(platform) {
    this.platform = platform;
  }

  /**
   * Clean product name
   */
  cleanProductName(name) {
    return name
      .replace(/\s+/g, " ")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .substring(0, 255);
  }

  /**
   * Deduplicate items based on name and price
   */
  deduplicateItems(items) {
    const seen = new Map();
    const uniqueItems = [];

    for (const item of items) {
      const key = `${item.name}-${item.unit_price}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  }

  /**
   * Extract order date from email content
   */
  extractOrderDate(content, subject) {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/,
      /(\w+ \d{1,2},? \d{4})/,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Fallback to current date
    return new Date();
  }

  /**
   * Extract field by patterns
   */
  extractFieldByPatterns(content, patterns) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }
    return null;
  }

  /**
   * Calculate confidence score for parsed data
   */
  calculateConfidenceScore(data) {
    let score = 0;

    if (data.orderId) score += 0.3;
    if (data.amount && data.amount > 0) score += 0.3;
    if (data.items && data.items.length > 0) score += 0.2;
    if (data.status) score += 0.1;
    if (data.trackingId || data.deliveryAddress) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Normalize status text
   */
  normalizeStatus(status) {
    const statusMap = {
      delivered: ORDER_STATUS.DELIVERED,
      "successfully delivered": ORDER_STATUS.DELIVERED,
      shipped: ORDER_STATUS.SHIPPED,
      dispatched: ORDER_STATUS.SHIPPED,
      "out for delivery": ORDER_STATUS.OUT_FOR_DELIVERY,
      confirmed: ORDER_STATUS.CONFIRMED,
      "order placed": ORDER_STATUS.CONFIRMED,
      "order confirmed": ORDER_STATUS.CONFIRMED,
      cancelled: ORDER_STATUS.CANCELLED,
      canceled: ORDER_STATUS.CANCELLED,
      returned: ORDER_STATUS.RETURNED,
    };

    const normalized = status.toLowerCase().trim();
    return statusMap[normalized] || ORDER_STATUS.ORDERED;
  }

  /**
   * Extract order status from content and subject
   */
  extractOrderStatus(content, subject) {
    const contentLower = content.toLowerCase();
    const subjectLower = subject.toLowerCase();
    const combinedText = `${contentLower} ${subjectLower}`;

    const statusKeywords = {
      [ORDER_STATUS.DELIVERED]: ["delivered", "successfully delivered"],
      [ORDER_STATUS.SHIPPED]: ["shipped", "dispatched"],
      [ORDER_STATUS.OUT_FOR_DELIVERY]: ["out for delivery"],
      [ORDER_STATUS.CONFIRMED]: [
        "confirmed",
        "order placed",
        "order confirmed",
      ],
      [ORDER_STATUS.CANCELLED]: ["cancelled", "canceled", "refund initiated"],
      [ORDER_STATUS.RETURNED]: ["returned", "refunded"],
    };

    for (const [status, keywords] of Object.entries(statusKeywords)) {
      if (keywords.some((keyword) => combinedText.includes(keyword))) {
        return status;
      }
    }

    return ORDER_STATUS.ORDERED;
  }

  /**
   * Validate parsed order data
   */
  validateOrderData(data) {
    const errors = [];

    if (!data.orderId) {
      errors.push("Order ID is required");
    }

    if (data.amount && data.amount < 0) {
      errors.push("Order amount cannot be negative");
    }

    if (data.items && !Array.isArray(data.items)) {
      errors.push("Items must be an array");
    }

    if (
      data.confidenceScore &&
      (data.confidenceScore < 0 || data.confidenceScore > 1)
    ) {
      errors.push("Confidence score must be between 0 and 1");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format order data for database storage
   */
  formatOrderData(parsedData, userId) {
    return {
      user_id: userId,
      platform: this.platform,
      platform_order_id: parsedData.orderId,
      product_name: parsedData.items?.[0]?.name || "Unknown Product",
      total_amount: parsedData.amount || 0,
      currency: "INR",
      order_date: parsedData.orderDate,
      status: parsedData.status,
      tracking_number: parsedData.trackingId,
      delivery_address: parsedData.deliveryAddress
        ? { address: parsedData.deliveryAddress }
        : null,
      confidence_score: parsedData.confidenceScore || 0.5,
      raw_data: parsedData,
    };
  }

  /**
   * Format order items for database storage
   */
  formatOrderItems(items, orderId) {
    return items.map((item) => ({
      order_id: orderId,
      name: item.name,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      total_price: item.total_price || item.unit_price * (item.quantity || 1),
    }));
  }
}

module.exports = BaseParser;
