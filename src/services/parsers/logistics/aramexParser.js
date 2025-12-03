// src/services/parsers/aramexParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class AramexParser {
  constructor() {
    this.platform = "aramex";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isAramex =
      from.includes("aramex.com") ||
      from.includes("aramex.in") ||
      from.includes("@aramex");
    if (!isAramex) return false;

    const trackingIndicators = [
      "tracking",
      "shipped",
      "delivered",
      "dispatched",
      "awb",
      "shipment",
    ];
    return trackingIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanAramexHtml(
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

      return {
        platform: this.platform,
        orderId: trackingId,
        trackingId: trackingId,
        amount: 0,
        formattedAmount: "International Courier Service",
        products: [
          {
            name: `${
              shipmentInfo.description || "International Package"
            } - ${this.getEmailTypeLabel(emailType)}`,
            quantity: 1,
            price: 0,
            formattedPrice: "International Courier Service",
            trackingId: trackingId,
            carrier: "Aramex",
          },
        ],
        orderDate: this.extractShipmentDate(cleanContent, emailData.date),
        status,
        emailType,
        shipmentInfo,
        confidence: this.calculateConfidence(trackingId, shipmentInfo),
      };
    } catch (error) {
      return null;
    }
  }

  cleanAramexHtml(htmlContent) {
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
      /Shipment[:\s]*(?:ID|Number)[:\s]*([A-Z0-9]{10,20})/gi,
      /([A-Z0-9]{10,20})/g,
    ];

    if (subject) {
      for (const pattern of patterns.slice(0, 3)) {
        const match = subject.match(pattern);
        if (match && this.isValidTrackingId(match[1])) {
          return match[1];
        }
      }
    }

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

    const destinationPatterns = [
      /(?:Destination|Delivery Address|To)[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of destinationPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.destination = match[1].trim();
        break;
      }
    }

    const originPatterns = [/(?:Origin|From|Ship From)[:\s]*([^,\n]{5,100})/gi];

    for (const pattern of originPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.origin = match[1].trim();
        break;
      }
    }

    // International shipments often have customs info
    const customsPatterns = [
      /(?:Description|Contents|Customs)[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of customsPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.description = match[1].trim();
        break;
      }
    }

    return shipmentInfo;
  }

  detectEmailType(subject, content) {
    const subjectLower = subject.toLowerCase();

    if (
      subjectLower.includes("delivered") ||
      subjectLower.includes("delivery confirmation")
    )
      return "delivery_notification";
    if (subjectLower.includes("dispatched") || subjectLower.includes("shipped"))
      return "shipping_notification";
    if (subjectLower.includes("tracking") || subjectLower.includes("status"))
      return "tracking_update";
    return "courier_notification";
  }

  extractShipmentDate(content, emailDate) {
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
        if (content.toLowerCase().includes("customs")) return "shipped";
        return "shipped";
      default:
        return "shipped";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      shipping_notification: "International Shipment",
      delivery_notification: "Delivered Package",
      tracking_update: "Shipment Update",
      courier_notification: "International Courier",
    };
    return labels[emailType] || "International Package";
  }

  calculateConfidence(trackingId, shipmentInfo) {
    let confidence = 0;
    if (trackingId) confidence += 0.5;
    if (shipmentInfo.destination) confidence += 0.3;
    if (shipmentInfo.origin) confidence += 0.2;
    return Math.min(confidence, 0.95);
  }
}

module.exports = AramexParser;
