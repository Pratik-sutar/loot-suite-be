// src/services/parsers/xpressbeesParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class XpressbeesParser {
  constructor() {
    this.platform = "xpressbees";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isXpressbees =
      from.includes("xpressbees.com") ||
      from.includes("@xpressbees") ||
      from.includes("xpress bees");
    if (!isXpressbees) return false;

    const trackingIndicators = [
      "tracking",
      "shipped",
      "delivered",
      "dispatched",
      "awb",
    ];
    return trackingIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanXpressbeesHtml(
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
            carrier: "Xpressbees",
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

  cleanXpressbeesHtml(htmlContent) {
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
      /AWB[:\s]*([A-Z0-9]{8,20})/gi,
      /Tracking[:\s]*(?:ID|Number)[:\s]*([A-Z0-9]{8,20})/gi,
      /Shipment[:\s]*(?:ID|Number)[:\s]*([A-Z0-9]{8,20})/gi,
      /([A-Z0-9]{8,20})/g,
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

    const originPatterns = [/(?:Origin|From|Pickup)[:\s]*([^,\n]{5,100})/gi];

    for (const pattern of originPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.origin = match[1].trim();
        break;
      }
    }

    return shipmentInfo;
  }

  detectEmailType(subject, content) {
    const subjectLower = subject.toLowerCase();

    if (subjectLower.includes("delivered")) return "delivery_notification";
    if (subjectLower.includes("dispatched") || subjectLower.includes("shipped"))
      return "shipping_notification";
    if (subjectLower.includes("tracking")) return "tracking_update";
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
    if (shipmentInfo.destination) confidence += 0.3;
    if (shipmentInfo.origin) confidence += 0.2;
    return Math.min(confidence, 0.95);
  }
}

module.exports = XpressbeesParser;
