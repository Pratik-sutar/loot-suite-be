// src/services/parsers/fedexParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class FedexParser {
  constructor() {
    this.platform = "fedex";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isFedex =
      from.includes("fedex.com") ||
      from.includes("@fedex") ||
      from.includes("fed ex") ||
      from.includes("federal express");
    if (!isFedex) return false;

    const trackingIndicators = [
      "tracking",
      "shipment",
      "delivered",
      "package",
      "delivery",
      "dispatched",
      "express",
    ];
    return trackingIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanFedexHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const trackingNumber = this.extractTrackingNumber(
        cleanContent,
        emailData.subject
      );
      if (!trackingNumber) return null;

      const shipmentInfo = this.extractShipmentInfo(cleanContent);
      const status = this.mapTrackingStatus(emailType, cleanContent);
      const amount = this.extractAmount(cleanContent);

      return {
        platform: this.platform,
        orderId: trackingNumber,
        trackingId: trackingNumber,
        amount: amount,
        formattedAmount: amount > 0 ? `₹${amount}` : "Express Service",
        products: [
          {
            name: `${
              shipmentInfo.description || "Package"
            } - ${this.getEmailTypeLabel(emailType)}`,
            quantity: shipmentInfo.pieces || 1,
            price: amount,
            formattedPrice: amount > 0 ? `₹${amount}` : "Express Service",
            trackingId: trackingNumber,
            carrier: "FedEx",
            weight: shipmentInfo.weight,
            destination: shipmentInfo.destination,
            serviceType: shipmentInfo.serviceType,
          },
        ],
        orderDate: this.extractShipmentDate(cleanContent, emailData.date),
        status,
        emailType,
        shipmentInfo,
        confidence: this.calculateConfidence(trackingNumber, shipmentInfo),
      };
    } catch (error) {
      return null;
    }
  }

  cleanFedexHtml(htmlContent) {
    return htmlContent
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&rupees?;?/gi, "₹")
      .replace(/&dollar;?/gi, "$")
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  extractTrackingNumber(content, subject) {
    const patterns = [
      /(?:Tracking|Track)[:\s]*(?:Number|No\.?|#)?[:\s]*([0-9]{12,22})/gi,
      /(?:Shipment|Package)[:\s]*(?:ID|Number)?[:\s]*([0-9]{12,22})/gi,
      /([0-9]{12}|[0-9]{14}|[0-9]{20}|96[0-9]{20})/g, // Standard FedEx patterns
      /([A-Z0-9]{10,22})/g,
    ];

    if (subject) {
      for (const pattern of patterns.slice(0, 2)) {
        const match = subject.match(pattern);
        if (match && this.isValidTrackingNumber(match[1])) {
          return match[1];
        }
      }
    }

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidTrackingNumber(match[1])) {
          return match[1];
        }
      }
    }
    return null;
  }

  isValidTrackingNumber(trackingNumber) {
    if (!trackingNumber || trackingNumber.length < 10) return false;

    // FedEx tracking number patterns
    const fedexPatterns = [
      /^[0-9]{12}$/, // 12 digits
      /^[0-9]{14}$/, // 14 digits
      /^[0-9]{20}$/, // 20 digits
      /^96[0-9]{20}$/, // 96 + 20 digits
      /^[A-Z0-9]{10,22}$/, // General alphanumeric
    ];

    return (
      fedexPatterns.some((pattern) => pattern.test(trackingNumber)) &&
      !/^[0-9]{6,10}$/.test(trackingNumber)
    ); // Exclude phone-like numbers
  }

  extractShipmentInfo(content) {
    const shipmentInfo = {};

    // Extract destination
    const destinationPatterns = [
      /(?:Delivery Address|Destination|Deliver to|To)[:\s]*([^,\n]{10,250})/gi,
      /(?:Recipient)[:\s]*([^,\n]{10,250})/gi,
    ];

    for (const pattern of destinationPatterns) {
      const match = content.match(pattern);
      if (match && match[1].length > 10) {
        shipmentInfo.destination = match[1].trim();
        break;
      }
    }

    // Extract origin/sender
    const originPatterns = [
      /(?:Origin|From|Sender|Ship from)[:\s]*([^,\n]{5,250})/gi,
      /(?:Shipper)[:\s]*([^,\n]{5,250})/gi,
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
      /(?:Weight|Wt\.?)[:\s]*([0-9.]+)\s*(?:lbs?|kg|pounds?|kgs?)/gi,
      /([0-9.]+)\s*(?:lbs?|pounds?|kg|kgs?)/gi,
    ];

    for (const pattern of weightPatterns) {
      const match = content.match(pattern);
      if (match) {
        const unit = match[0].toLowerCase().includes("lb") ? "lbs" : "kg";
        shipmentInfo.weight = match[1].trim() + unit;
        break;
      }
    }

    // Extract service type
    const servicePatterns = [
      /(?:Service Type|Service)[:\s]*([^,\n]{5,80})/gi,
      /FedEx\s+(Express|Ground|Overnight|Priority|International|Economy)/gi,
      /(?:Express|Ground|Overnight|Priority|International|Economy|Standard)/gi,
    ];

    for (const pattern of servicePatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.serviceType = match[1] ? match[1].trim() : match[0];
        break;
      }
    }

    // Extract delivery date
    const deliveryPatterns = [
      /(?:Scheduled|Expected|Estimated)\s+(?:Delivery|Deliver)[:\s]*([^,\n]{8,30})/gi,
      /(?:Delivery Date)[:\s]*([^,\n]{8,30})/gi,
    ];

    for (const pattern of deliveryPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.expectedDelivery = match[1].trim();
        break;
      }
    }

    // Extract pieces/packages
    const piecesPatterns = [
      /(?:Pieces?|Packages?|Qty)[:\s]*(\d+)/gi,
      /(\d+)\s*(?:piece|pieces|package|packages|pkg)/gi,
    ];

    for (const pattern of piecesPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.pieces = parseInt(match[1]) || 1;
        break;
      }
    }

    return shipmentInfo;
  }

  extractAmount(content) {
    const amountPatterns = [
      /(?:COD|Cash on Delivery|Amount)[:\s]*\$?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /(?:Total|Charges|Freight)[:\s]*\$?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /\$\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
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
      subjectLower.includes("out for delivery") ||
      contentLower.includes("out for delivery")
    )
      return "out_for_delivery_notification";
    if (subjectLower.includes("shipment") || subjectLower.includes("shipped"))
      return "shipment_notification";
    if (subjectLower.includes("pickup") || subjectLower.includes("picked"))
      return "pickup_notification";
    if (subjectLower.includes("exception") || subjectLower.includes("delayed"))
      return "exception_notification";
    if (subjectLower.includes("tracking") || subjectLower.includes("status"))
      return "tracking_update";
    return "express_notification";
  }

  extractShipmentDate(content, emailDate) {
    const datePatterns = [
      /(?:Ship Date|Pickup Date|Shipment Date)[:\s]*([^,\n]{8,30})/gi,
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
      case "shipment_notification":
        return "in_transit";
      case "out_for_delivery_notification":
        return "out_for_delivery";
      case "delivery_notification":
        return "delivered";
      case "exception_notification":
        return "exception";
      case "tracking_update":
        if (contentLower.includes("delivered")) return "delivered";
        if (contentLower.includes("out for delivery"))
          return "out_for_delivery";
        if (contentLower.includes("exception")) return "exception";
        if (contentLower.includes("in transit")) return "in_transit";
        if (contentLower.includes("picked")) return "picked_up";
        return "in_transit";
      default:
        return "in_transit";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      pickup_notification: "Package Picked Up",
      shipment_notification: "Package Shipped",
      out_for_delivery_notification: "Out for Delivery",
      delivery_notification: "Package Delivered",
      exception_notification: "Delivery Exception",
      tracking_update: "Package Update",
      express_notification: "Express Service",
    };
    return labels[emailType] || "Express Package";
  }

  calculateConfidence(trackingNumber, shipmentInfo) {
    let confidence = 0;
    if (trackingNumber) confidence += 0.4;
    if (shipmentInfo.destination) confidence += 0.2;
    if (shipmentInfo.origin) confidence += 0.1;
    if (shipmentInfo.serviceType) confidence += 0.1;
    if (shipmentInfo.weight) confidence += 0.05;
    if (shipmentInfo.expectedDelivery) confidence += 0.1;
    if (shipmentInfo.pieces) confidence += 0.05;
    return Math.min(confidence, 0.95);
  }
}

module.exports = FedexParser;
