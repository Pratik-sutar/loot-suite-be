// src/services/parsers/dtdcParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class DtdcParser {
  constructor() {
    this.platform = "dtdc";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isDtdc =
      from.includes("dtdc.in") ||
      from.includes("@dtdc") ||
      from.includes("dtdc") ||
      from.includes("desk to desk");
    if (!isDtdc) return false;

    const trackingIndicators = [
      "consignment",
      "tracking",
      "shipment",
      "delivered",
      "dispatched",
      "picked",
      "reference",
      "docket",
    ];
    return trackingIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanDtdcHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const referenceNumber = this.extractReferenceNumber(
        cleanContent,
        emailData.subject
      );
      if (!referenceNumber) return null;

      const shipmentInfo = this.extractShipmentInfo(cleanContent);
      const status = this.mapTrackingStatus(emailType, cleanContent);
      const amount = this.extractAmount(cleanContent);

      return {
        platform: this.platform,
        orderId: referenceNumber,
        trackingId: referenceNumber,
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
            trackingId: referenceNumber,
            carrier: "DTDC",
            weight: shipmentInfo.weight,
            destination: shipmentInfo.destination,
          },
        ],
        orderDate: this.extractShipmentDate(cleanContent, emailData.date),
        status,
        emailType,
        shipmentInfo,
        confidence: this.calculateConfidence(referenceNumber, shipmentInfo),
      };
    } catch (error) {
      return null;
    }
  }

  cleanDtdcHtml(htmlContent) {
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

  extractReferenceNumber(content, subject) {
    const patterns = [
      /(?:Reference|Consignment|Docket)[:\s]*(?:Number|No\.?|#)?[:\s]*([A-Z0-9]{8,20})/gi,
      /(?:Tracking|Track)[:\s]*(?:Number|No\.?|ID)?[:\s]*([A-Z0-9]{8,20})/gi,
      /(?:DTDC|D)[:\s]*([A-Z0-9]{8,20})/gi,
      /([A-Z0-9]{10,20})/g,
    ];

    if (subject) {
      for (const pattern of patterns.slice(0, 3)) {
        const match = subject.match(pattern);
        if (match && this.isValidReferenceNumber(match[1])) {
          return match[1];
        }
      }
    }

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidReferenceNumber(match[1])) {
          return match[1];
        }
      }
    }
    return null;
  }

  isValidReferenceNumber(referenceNumber) {
    return (
      referenceNumber &&
      referenceNumber.length >= 8 &&
      referenceNumber.length <= 20 &&
      /^[A-Z0-9]+$/.test(referenceNumber) &&
      !/^[0-9]{6,10}$/.test(referenceNumber) // Exclude simple phone-like numbers
    );
  }

  extractShipmentInfo(content) {
    const shipmentInfo = {};

    // Extract destination
    const destinationPatterns = [
      /(?:Destination|Delivery Address|Deliver to|To)[:\s]*([^,\n]{10,200})/gi,
      /(?:Consignee)[:\s]*([^,\n]{10,200})/gi,
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
      /(?:Origin|From|Pickup|Consigner)[:\s]*([^,\n]{5,200})/gi,
      /(?:Sender|Shipper)[:\s]*([^,\n]{5,200})/gi,
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
      /(?:Weight|Wt\.?)[:\s]*([0-9.]+)\s*(?:kg|grams?|kgs?|gms?)/gi,
      /([0-9.]+)\s*(?:kg|kgs?|grams?|gms?)/gi,
    ];

    for (const pattern of weightPatterns) {
      const match = content.match(pattern);
      if (match) {
        const unit = match[0].toLowerCase().includes("kg") ? "kg" : "grams";
        shipmentInfo.weight = match[1].trim() + unit;
        break;
      }
    }

    // Extract pieces/quantity
    const piecesPatterns = [
      /(?:Pieces?|Quantity|Qty|Nos?\.?)[:\s]*(\d+)/gi,
      /(\d+)\s*(?:piece|pieces|pcs?|nos?)/gi,
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
      /(?:Service Type|Service|Product)[:\s]*([^,\n]{5,50})/gi,
      /(?:Express|Standard|Priority|Surface|Air)/gi,
    ];

    for (const pattern of servicePatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.serviceType = match[1] ? match[1].trim() : match[0];
        break;
      }
    }

    // Extract booking date
    const bookingPatterns = [
      /(?:Booking Date|Book Date)[:\s]*([^,\n]{8,25})/gi,
    ];

    for (const pattern of bookingPatterns) {
      const match = content.match(pattern);
      if (match) {
        shipmentInfo.bookingDate = match[1].trim();
        break;
      }
    }

    return shipmentInfo;
  }

  extractAmount(content) {
    const amountPatterns = [
      /(?:COD|Cash on Delivery|Amount to collect)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /(?:Total|Freight|Charges)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:COD|collect|payable)/gi,
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
    if (subjectLower.includes("booking") || subjectLower.includes("booked"))
      return "booking_confirmation";
    if (subjectLower.includes("tracking") || subjectLower.includes("status"))
      return "tracking_update";
    if (
      subjectLower.includes("consignment") ||
      subjectLower.includes("shipment")
    )
      return "shipment_notification";
    return "courier_notification";
  }

  extractShipmentDate(content, emailDate) {
    const datePatterns = [
      /(?:Pickup Date|Ship Date|Booking Date|Book Date)[:\s]*([^,\n]{8,25})/gi,
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
      case "booking_confirmation":
        return "booked";
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
        if (contentLower.includes("picked")) return "picked_up";
        return "in_transit";
      case "shipment_notification":
        return "booked";
      default:
        return "in_transit";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      booking_confirmation: "Shipment Booked",
      pickup_notification: "Package Picked Up",
      dispatch_notification: "Package Dispatched",
      delivery_notification: "Package Delivered",
      tracking_update: "Package Update",
      shipment_notification: "Shipment Created",
      courier_notification: "Courier Service",
    };
    return labels[emailType] || "Package";
  }

  calculateConfidence(referenceNumber, shipmentInfo) {
    let confidence = 0;
    if (referenceNumber) confidence += 0.4;
    if (shipmentInfo.destination) confidence += 0.2;
    if (shipmentInfo.origin) confidence += 0.15;
    if (shipmentInfo.weight) confidence += 0.1;
    if (shipmentInfo.serviceType) confidence += 0.05;
    if (shipmentInfo.pieces) confidence += 0.05;
    if (shipmentInfo.bookingDate) confidence += 0.05;
    return Math.min(confidence, 0.95);
  }
}

module.exports = DtdcParser;
