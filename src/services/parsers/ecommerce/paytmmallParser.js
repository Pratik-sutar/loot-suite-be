// src/services/parsers/paytmmallParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class PaytmMallParser {
  constructor() {
    this.platform = "paytmmall";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isPaytmMall =
      from.includes("paytmmall.com") ||
      from.includes("@paytmmall") ||
      from.includes("paytm mall");
    if (!isPaytmMall) return false;

    const orderIndicators = [
      "order",
      "shipped",
      "delivered",
      "placed",
      "confirmed",
    ];
    const rejectPatterns = [
      "newsletter",
      "offer",
      "sale",
      "discount",
      "deals",
      "promotion",
    ];

    const hasOrderKeyword = orderIndicators.some((keyword) =>
      subject.includes(keyword)
    );
    const isPromotional = rejectPatterns.some((pattern) =>
      subject.includes(pattern)
    );

    return hasOrderKeyword && !isPromotional;
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanPaytmMallHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const orderId = this.extractOrderId(cleanContent, emailData.subject);
      if (!orderId) return null;

      const amount = this.extractAmount(cleanContent, emailType);
      const products = this.extractProducts(cleanContent, emailType, orderId);
      const orderDate = this.extractOrderDate(cleanContent, emailData.date);
      const status = this.mapStatus(emailType, cleanContent);

      return {
        platform: this.platform,
        orderId,
        amount: amount || 0,
        formattedAmount: amount ? `₹${amount}` : "Data not available in email",
        products,
        orderDate,
        status,
        emailType,
        confidence: this.calculateConfidence(orderId, amount, products),
      };
    } catch (error) {
      return null;
    }
  }

  cleanPaytmMallHtml(htmlContent) {
    return htmlContent
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#8377;/g, "₹")
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  extractOrderId(content, subject) {
    const patterns = [
      /Order\s*(?:ID|Number|#)\s*[:\-]?\s*(PM[A-Z0-9]{8,15})/gi,
      /Order\s*(?:ID|Number|#)\s*[:\-]?\s*([A-Z0-9]{8,20})/gi,
      /(PM[A-Z0-9]{8,15})/gi,
      /(\d{10,15})/gi,
    ];

    if (subject) {
      for (const pattern of patterns) {
        const match = subject.match(pattern);
        if (match && this.isValidOrderId(match[1])) {
          return match[1];
        }
      }
    }

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidOrderId(match[1])) {
          return match[1];
        }
      }
    }
    return null;
  }

  isValidOrderId(orderId) {
    return orderId && orderId.length >= 6 && orderId.length <= 25;
  }

  extractAmount(content, emailType) {
    const patterns = [
      /(?:Total Amount|Grand Total|Order Total|Amount Paid|Final Amount)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /₹\s*([\d,]+(?:\.\d{2})?)/g,
    ];

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          return amount;
        }
      }
    }
    return null;
  }

  extractProducts(content, emailType, orderId) {
    const products = [];

    const productPatterns = [
      /([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})\s*₹\s*([\d,]+(?:\.\d{2})?)/g,
      /Product[:\s]*([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})/gi,
    ];

    for (const pattern of productPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const productName = match[1].trim();
        if (this.isValidProduct(productName)) {
          products.push({
            name: this.cleanProductName(productName),
            quantity: 1,
            price: match[2] ? parseFloat(match[2].replace(/,/g, "")) : 0,
            formattedPrice: match[2]
              ? `₹${match[2]}`
              : "Data not available in email",
          });
          break;
        }
      }
    }

    if (products.length === 0) {
      products.push({
        name: `Paytm Mall Order ${orderId}`,
        quantity: 1,
        price: 0,
        formattedPrice: "Data not available in email",
      });
    }

    return products;
  }

  isValidProduct(name) {
    if (!name || name.length < 5) return false;
    const invalidPatterns = [
      /order|total|amount|paytm|mall|email|notification/i,
    ];
    return !invalidPatterns.some((pattern) => pattern.test(name));
  }

  cleanProductName(name) {
    return name.replace(/\s+/g, " ").trim().substring(0, 100);
  }

  detectEmailType(subject, content) {
    const subjectLower = subject.toLowerCase();

    if (
      subjectLower.includes("confirmation") ||
      subjectLower.includes("placed")
    ) {
      return "order_confirmation";
    }
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("dispatched")
    ) {
      return "shipping_notification";
    }
    if (subjectLower.includes("delivered")) {
      return "delivery_notification";
    }
    return "notification";
  }

  extractOrderDate(content, emailDate) {
    const patterns = [
      /Order Date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
      /Placed on[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return new Date(match[1]);
      }
    }
    return emailDate ? new Date(emailDate) : new Date();
  }

  mapStatus(emailType, content) {
    switch (emailType) {
      case "order_confirmation":
        return "confirmed";
      case "shipping_notification":
        return "shipped";
      case "delivery_notification":
        return "delivered";
      default:
        return "ordered";
    }
  }

  calculateConfidence(orderId, amount, products) {
    let confidence = 0;
    if (orderId) confidence += 0.4;
    if (amount && amount > 0) confidence += 0.3;
    if (products && products.length > 0) confidence += 0.3;
    return Math.min(confidence, 0.95);
  }
}

module.exports = PaytmMallParser;
