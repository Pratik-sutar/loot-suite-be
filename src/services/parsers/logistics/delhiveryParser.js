// src/services/parsers/delhiveryParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class DelhiveryParser {
  constructor() {
    this.platform = "delhivery";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isDelhivery =
      from.includes("delhivery.com") ||
      from.includes("@delhivery") ||
      from.includes("delhivery");
    if (!isDelhivery) return false;

    const trackingIndicators = [
      "tracking",
      "shipped",
      "delivered",
      "dispatched",
      "awb",
      "consignment",
    ];
    const rejectPatterns = ["newsletter", "marketing", "promotion"];

    const hasTrackingKeyword = trackingIndicators.some((keyword) =>
      subject.includes(keyword)
    );
    const isPromotional = rejectPatterns.some((pattern) =>
      subject.includes(pattern)
    );

    return hasTrackingKeyword && !isPromotional;
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanDelhiveryHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const trackingId = this.extractTrackingId(
        cleanContent,
        emailData.subject
      );
      if (!trackingId) return null;

      const shipmentInfo = this.extractShipmentInfo(cleanContent);
      const status = this.mapTrackingStatus(emailType, cleanContent);
      const deliveryInfo = this.extractDeliveryInfo(cleanContent);

      return {
        platform: this.platform,
        orderId: trackingId, // Using tracking ID as order ID for courier
        trackingId: trackingId,
        amount: 0, // Courier services don't have order amounts
        formattedAmount: "Courier Service",
        products: [
          {
            name: `${
              shipmentInfo.description || "Package"
            } - ${this.getEmailTypeLabel(emailType)}`,
            quantity: 1,
            price: 0,
            formattedPrice: "Courier Service",
            trackingId: trackingId,
            carrier: "Delhivery",
          },
        ],
        orderDate: this.extractShipmentDate(cleanContent, emailData.date),
        status,
        emailType,
        deliveryInfo,
        shipmentInfo,
        confidence: this.calculateConfidence(trackingId, shipmentInfo),
      };
    } catch (error) {
      console.error("❌ DELHIVERY parser error:", error);
      return null;
    }
  }

  cleanDelhiveryHtml(htmlContent) {
    return htmlContent
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  extractTrackingId(content, subject) {
    const patterns = [
      /AWB[:\s]*([A-Z0-9]{10,20})/gi,
      /Tracking[:\s]*(?:ID|Number)[:\s]*([A-Z0-9]{10,20})/gi,
      /Consignment[:\s]*(?:ID|Number)[:\s]*([A-Z0-9]{10,20})/gi,
      /([A-Z0-9]{10,20})/g, // Generic alphanumeric tracking
    ];

    // Try subject first
    if (subject) {
      for (const pattern of patterns.slice(0, 3)) {
        const match = subject.match(pattern);
        if (match && this.isValidTrackingId(match[1])) {
          return match[1];
        }
      }
    }

    // Try content
    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidTrackingId(match[1])) {
          return match[1];
        }
      }
    }
    return null;
  }

  isValidTrackingId(trackingId) {
    return (
      trackingId &&
      trackingId.length >= 8 &&
      trackingId.length <= 25 &&
      /^[A-Z0-9]+$/.test(trackingId)
    );
  }

  extractShipmentInfo(content) {
    const shipmentInfo = {};

    // Extract destination
    const destinationPatterns = [
      /(?:Destination|Delivery Address)[:\s]*([^,\n]{5,100})/gi,
      /(?:To|Ship To)[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of destinationPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.destination = match[1].trim();
        break;
      }
    }

    // Extract origin
    const originPatterns = [
      /(?:Origin|From)[:\s]*([^,\n]{5,100})/gi,
      /(?:Pickup|Ship From)[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of originPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.origin = match[1].trim();
        break;
      }
    }

    // Extract package description
    const descriptionPatterns = [
      /(?:Description|Contents|Package)[:\s]*([^,\n]{5,100})/gi,
      /(?:Item|Product)[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of descriptionPatterns) {
      const match = content.match(pattern);
      if (match && !match[1].toLowerCase().includes("delhivery")) {
        shipmentInfo.description = match[1].trim();
        break;
      }
    }

    return shipmentInfo;
  }

  extractDeliveryInfo(content) {
    const deliveryInfo = {};

    // Extract expected delivery date
    const deliveryPatterns = [
      /(?:Expected Delivery|Delivery by|ETA)[:\s]*([^,\n]{5,50})/gi,
      /(?:Estimated)[:\s]*([^,\n]{5,50})/gi,
    ];

    for (const pattern of deliveryPatterns) {
      const match = content.match(pattern);
      if (match) {
        deliveryInfo.expectedDelivery = match[1].trim();
        break;
      }
    }

    // Extract delivery agent
    const agentPatterns = [/(?:Delivered by|Agent)[:\s]*([^,\n]{5,50})/gi];

    for (const pattern of agentPatterns) {
      const match = content.match(pattern);
      if (match) {
        deliveryInfo.agent = match[1].trim();
        break;
      }
    }

    return deliveryInfo;
  }

  detectEmailType(subject, content) {
    const subjectLower = subject.toLowerCase();

    if (
      subjectLower.includes("delivered") ||
      subjectLower.includes("delivery confirmed")
    ) {
      return "delivery_notification";
    }
    if (
      subjectLower.includes("dispatched") ||
      subjectLower.includes("shipped")
    ) {
      return "shipping_notification";
    }
    if (subjectLower.includes("tracking") || subjectLower.includes("status")) {
      return "tracking_update";
    }
    return "courier_notification";
  }

  extractShipmentDate(content, emailDate) {
    const patterns = [
      /(?:Shipped on|Dispatch Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
      /(?:Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return new Date(match[1]);
      }
    }
    return emailDate ? new Date(emailDate) : new Date();
  }

  mapTrackingStatus(emailType, content) {
    switch (emailType) {
      case "shipping_notification":
        return "shipped";
      case "delivery_notification":
        return "delivered";
      case "tracking_update":
        if (content.toLowerCase().includes("delivered")) return "delivered";
        if (content.toLowerCase().includes("out for delivery"))
          return "out_for_delivery";
        return "shipped";
      default:
        return "shipped";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      shipping_notification: "Shipped Package",
      delivery_notification: "Delivered Package",
      tracking_update: "Package Update",
      courier_notification: "Courier Service",
    };
    return labels[emailType] || "Package";
  }

  calculateConfidence(trackingId, shipmentInfo) {
    let confidence = 0;
    if (trackingId) confidence += 0.5;
    if (shipmentInfo.destination) confidence += 0.2;
    if (shipmentInfo.origin) confidence += 0.1;
    if (shipmentInfo.description) confidence += 0.2;
    return Math.min(confidence, 0.95);
  }
}

module.exports = DelhiveryParser;
