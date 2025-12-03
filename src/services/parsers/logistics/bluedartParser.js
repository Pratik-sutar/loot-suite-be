// src/services/parsers/bluedartParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class BluedartParser {
  constructor() {
    this.platform = "bluedart";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isBluedart =
      from.includes("bluedart.com") ||
      from.includes("@bluedart") ||
      from.includes("blue dart");
    if (!isBluedart) return false;

    const trackingIndicators = [
      "awb",
      "tracking",
      "shipment",
      "delivered",
      "dispatched",
      "picked",
      "courier",
    ];
    return trackingIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanBluedartHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const awbNumber = this.extractAWBNumber(cleanContent, emailData.subject);
      if (!awbNumber) return null;

      const shipmentInfo = this.extractShipmentInfo(cleanContent);
      const status = this.mapTrackingStatus(emailType, cleanContent);
      const amount = this.extractAmount(cleanContent);

      return {
        platform: this.platform,
        orderId: awbNumber,
        trackingId: awbNumber,
        amount: amount,
        formattedAmount: amount > 0 ? `₹${amount}` : "Courier Service",
        products: [
          {
            name: `${
              shipmentInfo.description || "Package"
            } - ${this.getEmailTypeLabel(emailType)}`,
            quantity: shipmentInfo.pieces || 1,
            price: amount,
            formattedPrice: amount > 0 ? `₹${amount}` : "Courier Service",
            trackingId: awbNumber,
            carrier: "Bluedart",
            weight: shipmentInfo.weight,
            destination: shipmentInfo.destination,
          },
        ],
        orderDate: this.extractShipmentDate(cleanContent, emailData.date),
        status,
        emailType,
        shipmentInfo,
        confidence: this.calculateConfidence(awbNumber, shipmentInfo),
      };
    } catch (error) {
      return null;
    }
  }

  cleanBluedartHtml(htmlContent) {
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

  extractAWBNumber(content, subject) {
    const patterns = [
      /AWB[:\s]*(?:Number|No\.?|#)?[:\s]*([A-Z0-9]{8,15})/gi,
      /(?:Airway Bill|Air Way Bill)[:\s]*([A-Z0-9]{8,15})/gi,
      /(?:Tracking|Reference)[:\s]*(?:Number|No\.?|ID)?[:\s]*([A-Z0-9]{8,15})/gi,
      /([A-Z0-9]{10,15})/g,
    ];

    if (subject) {
      for (const pattern of patterns.slice(0, 3)) {
        const match = subject.match(pattern);
        if (match && this.isValidAWBNumber(match[1])) {
          return match[1];
        }
      }
    }

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidAWBNumber(match[1])) {
          return match[1];
        }
      }
    }
    return null;
  }

  isValidAWBNumber(awbNumber) {
    return (
      awbNumber &&
      awbNumber.length >= 8 &&
      awbNumber.length <= 15 &&
      /^[A-Z0-9]+$/.test(awbNumber) &&
      !/^[0-9]{6,8}$/.test(awbNumber) // Exclude simple numeric patterns that might be phone numbers
    );
  }

  extractShipmentInfo(content) {
    const shipmentInfo = {};

    // Extract destination
    const destinationPatterns = [
      /(?:Destination|Delivery Address|Deliver to)[:\s]*([^,\n]{5,150})/gi,
      /(?:To)[:\s]*([^,\n]{10,150})/gi,
    ];

    for (const pattern of destinationPatterns) {
      const match = content.match(pattern);
      if (match && match[1].length > 10) {
        shipmentInfo.destination = match[1].trim();
        break;
      }
    }

    // Extract origin
    const originPatterns = [
      /(?:Origin|From|Pickup)[:\s]*([^,\n]{5,150})/gi,
      /(?:Sender|Shipper)[:\s]*([^,\n]{5,150})/gi,
    ];

    for (const pattern of originPatterns) {
      const match = content.match(pattern);
      if (match && match[1].length > 5) {
        shipmentInfo.origin = match[1].trim();
        break;
      }
    }

    // Extract weight
    const weightPatterns = [
      /(?:Weight)[:\s]*([0-9.]+)\s*(?:kg|grams?|kgs?)/gi,
      /([0-9.]+)\s*(?:kg|kgs?|grams?)/gi,
    ];

    for (const pattern of weightPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.weight =
          match[1].trim() +
          (match[0].toLowerCase().includes("kg") ? "kg" : "grams");
        break;
      }
    }

    // Extract pieces/quantity
    const piecesPatterns = [
      /(?:Pieces?|Quantity|Qty)[:\s]*(\d+)/gi,
      /(\d+)\s*(?:piece|pieces|pcs)/gi,
    ];

    for (const pattern of piecesPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.pieces = parseInt(match[1]) || 1;
        break;
      }
    }

    // Extract service type
    const servicePatterns = [
      /(?:Service Type|Service)[:\s]*([^,\n]{5,50})/gi,
      /(?:Express|Standard|Priority|Overnight)/gi,
    ];

    for (const pattern of servicePatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.serviceType = match[1] ? match[1].trim() : match[0];
        break;
      }
    }

    return shipmentInfo;
  }

  extractAmount(content) {
    const amountPatterns = [
      /(?:COD|Cash on Delivery|Amount)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:COD|payable)/gi,
      /(?:Total|Bill)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
    ];

    for (const pattern of amountPatterns) {
      const match = content.match(pattern);
      if (match) {
        const amount = match[1].replace(/,/g, "");
        return parseFloat(amount) || 0;
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
    if (subjectLower.includes("picked") || subjectLower.includes("pickup"))
      return "pickup_notification";
    if (subjectLower.includes("tracking") || subjectLower.includes("status"))
      return "tracking_update";
    if (subjectLower.includes("shipment") || subjectLower.includes("awb"))
      return "shipment_notification";
    return "courier_notification";
  }

  extractShipmentDate(content, emailDate) {
    const datePatterns = [
      /(?:Pickup Date|Ship Date|Booking Date)[:\s]*([^,\n]{8,25})/gi,
      /(?:Date)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/gi,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const parsedDate = new Date(match[1].trim());
        if (!isNaN(parsedDate)) return parsedDate;
      }
    }

    return emailDate ? new Date(emailDate) : new Date();
  }

  mapTrackingStatus(emailType, content) {
    const contentLower = content.toLowerCase();

    switch (emailType) {
      case "pickup_notification":
        return "picked_up";
      case "dispatch_notification":
        return "in_transit";
      case "delivery_notification":
        return "delivered";
      case "tracking_update":
        if (contentLower.includes("delivered")) return "delivered";
        if (contentLower.includes("out for delivery"))
          return "out_for_delivery";
        if (contentLower.includes("in transit")) return "in_transit";
        return "picked_up";
      case "shipment_notification":
        return "booked";
      default:
        return "in_transit";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      pickup_notification: "Package Picked Up",
      dispatch_notification: "Package Dispatched",
      delivery_notification: "Package Delivered",
      tracking_update: "Package Update",
      shipment_notification: "Shipment Booked",
      courier_notification: "Courier Service",
    };
    return labels[emailType] || "Package";
  }

  calculateConfidence(awbNumber, shipmentInfo) {
    let confidence = 0;
    if (awbNumber) confidence += 0.4;
    if (shipmentInfo.destination) confidence += 0.2;
    if (shipmentInfo.origin) confidence += 0.15;
    if (shipmentInfo.weight) confidence += 0.1;
    if (shipmentInfo.serviceType) confidence += 0.1;
    if (shipmentInfo.pieces) confidence += 0.05;
    return Math.min(confidence, 0.95);
  }
}

module.exports = BluedartParser;
