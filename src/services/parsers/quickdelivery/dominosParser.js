// src/services/parsers/dominosParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class DominosParser {
  constructor() {
    this.platform = "dominos";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isDominos =
      from.includes("dominos.co.in") ||
      from.includes("@dominos") ||
      from.includes("domino's");
    if (!isDominos) return false;

    const orderIndicators = [
      "order",
      "pizza",
      "delivery",
      "confirmed",
      "preparing",
      "dispatched",
      "delivered",
    ];
    return orderIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanDominosHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const orderId = this.extractOrderId(cleanContent, emailData.subject);
      if (!orderId) return null;

      const orderInfo = this.extractOrderInfo(cleanContent);
      const products = this.extractProducts(cleanContent);
      const status = this.mapOrderStatus(emailType, cleanContent);
      const amount = this.extractAmount(cleanContent);

      return {
        platform: this.platform,
        orderId: orderId,
        trackingId: orderId,
        amount: amount,
        formattedAmount: amount > 0 ? `₹${amount}` : "Order Service",
        products:
          products.length > 0
            ? products
            : [
                {
                  name: `${
                    orderInfo.storeInfo || "Pizza Order"
                  } - ${this.getEmailTypeLabel(emailType)}`,
                  quantity: 1,
                  price: amount,
                  formattedPrice: amount > 0 ? `₹${amount}` : "Order Service",
                  trackingId: orderId,
                  carrier: "Dominos",
                },
              ],
        orderDate: this.extractOrderDate(cleanContent, emailData.date),
        status,
        emailType,
        orderInfo,
        confidence: this.calculateConfidence(orderId, orderInfo, products),
      };
    } catch (error) {
      return null;
    }
  }

  cleanDominosHtml(htmlContent) {
    return htmlContent
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&rupees?;?/gi, "₹")
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  extractOrderId(content, subject) {
    const patterns = [
      /Order[:\s]*(?:ID|Number)[:\s]*([A-Z0-9]{6,12})/gi,
      /Order[:\s]*([A-Z0-9]{6,12})/gi,
      /([A-Z0-9]{6,12})/g,
    ];

    if (subject) {
      for (const pattern of patterns.slice(0, 2)) {
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
    return (
      orderId &&
      orderId.length >= 6 &&
      orderId.length <= 12 &&
      /^[A-Z0-9]+$/.test(orderId)
    );
  }

  extractOrderInfo(content) {
    const orderInfo = {};

    // Extract delivery address
    const addressPatterns = [
      /(?:Delivery Address|Address)[:\s]*([^,\n]{10,200})/gi,
      /(?:Delivering to)[:\s]*([^,\n]{10,200})/gi,
    ];

    for (const pattern of addressPatterns) {
      const match = content.match(pattern);
      if (match) {
        orderInfo.deliveryAddress = match[1].trim();
        break;
      }
    }

    // Extract store info
    const storePatterns = [
      /(?:Store|Restaurant)[:\s]*([^,\n]{5,100})/gi,
      /Domino's[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of storePatterns) {
      const match = content.match(pattern);
      if (match) {
        orderInfo.storeInfo = match[1].trim();
        break;
      }
    }

    // Extract estimated delivery time
    const timePatterns = [
      /(?:Estimated|Expected)[:\s]*(?:Delivery|Time)[:\s]*([^,\n]{5,50})/gi,
      /(?:Deliver by|ETA)[:\s]*([^,\n]{5,50})/gi,
    ];

    for (const pattern of timePatterns) {
      const match = content.match(pattern);
      if (match) {
        orderInfo.estimatedDelivery = match[1].trim();
        break;
      }
    }

    return orderInfo;
  }

  extractProducts(content) {
    const products = [];

    // Common pizza patterns
    const pizzaPatterns = [
      /(\d+)\s*x\s*([^₹\n]{5,50})\s*₹?\s*(\d+(?:\.\d{2})?)/gi,
      /([^₹\n]{5,50})\s*-\s*₹?\s*(\d+(?:\.\d{2})?)/gi,
    ];

    for (const pattern of pizzaPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        let quantity = 1;
        let name = "";
        let price = 0;

        if (match.length === 4) {
          // quantity x name price
          quantity = parseInt(match[1]) || 1;
          name = match[2].trim();
          price = parseFloat(match[3]) || 0;
        } else if (match.length === 3) {
          // name - price
          name = match[1].trim();
          price = parseFloat(match[2]) || 0;
        }

        if (name && name.length > 3) {
          products.push({
            name: name,
            quantity: quantity,
            price: price,
            formattedPrice: price > 0 ? `₹${price}` : "Pizza Item",
            trackingId: null,
            carrier: "Dominos",
          });
        }
      }
    }

    return products;
  }

  extractAmount(content) {
    const amountPatterns = [
      /(?:Total|Amount|Bill)[:\s]*₹?\s*(\d+(?:\.\d{2})?)/gi,
      /₹\s*(\d+(?:\.\d{2})?)\s*(?:total|amount|bill)/gi,
    ];

    for (const pattern of amountPatterns) {
      const match = content.match(pattern);
      if (match) {
        return parseFloat(match[1]) || 0;
      }
    }
    return 0;
  }

  detectEmailType(subject, content) {
    const subjectLower = subject.toLowerCase();
    const contentLower = content.toLowerCase();

    if (
      subjectLower.includes("delivered") ||
      contentLower.includes("delivered")
    )
      return "delivery_notification";
    if (
      subjectLower.includes("dispatched") ||
      subjectLower.includes("out for delivery")
    )
      return "dispatch_notification";
    if (subjectLower.includes("preparing") || subjectLower.includes("baking"))
      return "preparation_notification";
    if (subjectLower.includes("confirmed") || subjectLower.includes("placed"))
      return "order_confirmation";
    return "order_update";
  }

  extractOrderDate(content, emailDate) {
    const datePatterns = [/(?:Order Date|Placed on)[:\s]*([^,\n]{8,25})/gi];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const parsedDate = new Date(match[1].trim());
        if (!isNaN(parsedDate)) return parsedDate;
      }
    }

    return emailDate ? new Date(emailDate) : new Date();
  }

  mapOrderStatus(emailType, content) {
    switch (emailType) {
      case "order_confirmation":
        return "confirmed";
      case "preparation_notification":
        return "preparing";
      case "dispatch_notification":
        return "dispatched";
      case "delivery_notification":
        return "delivered";
      default:
        return "processing";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      order_confirmation: "Order Confirmed",
      preparation_notification: "Preparing Order",
      dispatch_notification: "Out for Delivery",
      delivery_notification: "Order Delivered",
      order_update: "Order Update",
    };
    return labels[emailType] || "Pizza Order";
  }

  calculateConfidence(orderId, orderInfo, products) {
    let confidence = 0;
    if (orderId) confidence += 0.4;
    if (orderInfo.deliveryAddress) confidence += 0.2;
    if (orderInfo.storeInfo) confidence += 0.1;
    if (products.length > 0) confidence += 0.2;
    if (orderInfo.estimatedDelivery) confidence += 0.1;
    return Math.min(confidence, 0.95);
  }
}

module.exports = DominosParser;
