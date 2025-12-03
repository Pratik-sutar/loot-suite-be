// src/services/parsers/indiapostParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");

class IndiapostParser {
  constructor() {
    this.platform = "indiapost";
  }

  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    const isIndiaPost =
      from.includes("indiapost.gov.in") ||
      from.includes("@indiapost") ||
      from.includes("india post") ||
      from.includes("postal") ||
      from.includes("postoffice") ||
      from.includes("dak");
    if (!isIndiaPost) return false;

    const trackingIndicators = [
      "article",
      "tracking",
      "registered",
      "speed post",
      "parcel",
      "delivered",
      "dispatched",
      "postal",
    ];
    return trackingIndicators.some((keyword) => subject.includes(keyword));
  }

  parse(emailData) {
    try {
      const cleanContent = this.cleanIndiaPostHtml(
        emailData.html || emailData.text || ""
      );
      const emailType = this.detectEmailType(emailData.subject, cleanContent);

      const articleId = this.extractArticleId(cleanContent, emailData.subject);
      if (!articleId) return null;

      const postalInfo = this.extractPostalInfo(cleanContent);
      const status = this.mapTrackingStatus(emailType, cleanContent);
      const amount = this.extractAmount(cleanContent);

      return {
        platform: this.platform,
        orderId: articleId,
        trackingId: articleId,
        amount: amount,
        formattedAmount: amount > 0 ? `₹${amount}` : "Postal Service",
        products: [
          {
            name: `${
              postalInfo.description || "Mail Item"
            } - ${this.getEmailTypeLabel(emailType)}`,
            quantity: 1,
            price: amount,
            formattedPrice: amount > 0 ? `₹${amount}` : "Postal Service",
            trackingId: articleId,
            carrier: "India Post",
            weight: postalInfo.weight,
            destination: postalInfo.destination,
            articleType: postalInfo.articleType,
          },
        ],
        orderDate: this.extractPostalDate(cleanContent, emailData.date),
        status,
        emailType,
        postalInfo,
        confidence: this.calculateConfidence(articleId, postalInfo),
      };
    } catch (error) {
      return null;
    }
  }

  cleanIndiaPostHtml(htmlContent) {
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

  extractArticleId(content, subject) {
    const patterns = [
      /(?:Article|Track)[:\s]*(?:ID|Number|No\.?)?[:\s]*([A-Z]{2}[0-9]{9}[A-Z]{2})/gi, // Standard India Post format
      /(?:Registered|Speed Post|Parcel)[:\s]*(?:Number|No\.?)?[:\s]*([A-Z]{2}[0-9]{9}[A-Z]{2})/gi,
      /([A-Z]{2}[0-9]{9}[A-Z]{2})/g, // Direct pattern match
      /(?:Reference|Tracking)[:\s]*(?:Number|No\.?)?[:\s]*([A-Z0-9]{10,20})/gi,
    ];

    if (subject) {
      for (const pattern of patterns.slice(0, 2)) {
        const match = subject.match(pattern);
        if (match && this.isValidArticleId(match[1])) {
          return match[1];
        }
      }
    }

    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidArticleId(match[1])) {
          return match[1];
        }
      }
    }
    return null;
  }

  isValidArticleId(articleId) {
    if (!articleId) return false;

    // Standard India Post format: 2 letters + 9 digits + 2 letters
    if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(articleId)) {
      return true;
    }

    // Alternative formats
    return (
      articleId.length >= 10 &&
      articleId.length <= 20 &&
      /^[A-Z0-9]+$/.test(articleId) &&
      !/^[0-9]{6,10}$/.test(articleId) // Exclude phone-like numbers
    );
  }

  extractPostalInfo(content) {
    const postalInfo = {};

    // Extract destination
    const destinationPatterns = [
      /(?:Destination|Delivery Address|Deliver to|To Address)[:\s]*([^,\n]{10,300})/gi,
      /(?:Addressee)[:\s]*([^,\n]{10,300})/gi,
    ];

    for (const pattern of destinationPatterns) {
      const match = content.match(pattern);
      if (match && match[1].length > 10) {
        postalInfo.destination = match[1].trim();
        break;
      }
    }

    // Extract origin
    const originPatterns = [
      /(?:Origin|From|Sender)[:\s]*([^,\n]{5,300})/gi,
      /(?:Post Office)[:\s]*([^,\n]{5,300})/gi,
    ];

    for (const pattern of originPatterns) {
      const match = content.match(pattern);
      if (match && match[1].length > 5) {
        postalInfo.origin = match[1].trim();
        break;
      }
    }

    // Extract article type
    const typePatterns = [
      /(?:Article Type|Type|Service)[:\s]*([^,\n]{5,100})/gi,
      /(?:Registered Post|Speed Post|Express Post|Parcel|Money Order|EMS)/gi,
    ];

    for (const pattern of typePatterns) {
      const match = content.match(pattern);
      if (match) {
        postalInfo.articleType = match[1] ? match[1].trim() : match[0];
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
        postalInfo.weight = match[1].trim() + unit;
        break;
      }
    }

    // Extract posting date
    const postingPatterns = [
      /(?:Posting Date|Posted on|Booked on)[:\s]*([^,\n]{8,25})/gi,
    ];

    for (const pattern of postingPatterns) {
      const match = content.match(pattern);
      if (match) {
        postalInfo.postingDate = match[1].trim();
        break;
      }
    }

    // Extract delivery office
    const officePatterns = [
      /(?:Delivery Office|Office)[:\s]*([^,\n]{5,100})/gi,
      /(?:Post Office)[:\s]*([^,\n]{5,100})/gi,
    ];

    for (const pattern of officePatterns) {
      const match = content.match(pattern);
      if (match && match[1].length > 5) {
        postalInfo.deliveryOffice = match[1].trim();
        break;
      }
    }

    return postalInfo;
  }

  extractAmount(content) {
    const amountPatterns = [
      /(?:COD|Cash on Delivery|VPP|Value Payable Post)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /(?:Amount|Money Order)[:\s]*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:COD|VPP|payable)/gi,
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
      subjectLower.includes("dispatch")
    )
      return "dispatch_notification";
    if (subjectLower.includes("registered") || subjectLower.includes("booked"))
      return "registration_confirmation";
    if (subjectLower.includes("arrival") || contentLower.includes("arrived"))
      return "arrival_notification";
    if (subjectLower.includes("tracking") || subjectLower.includes("status"))
      return "tracking_update";
    if (subjectLower.includes("speed post") || subjectLower.includes("express"))
      return "express_notification";
    if (subjectLower.includes("money order")) return "money_order_notification";
    return "postal_notification";
  }

  extractPostalDate(content, emailDate) {
    const datePatterns = [
      /(?:Posting Date|Posted on|Booked on|Date)[:\s]*([^,\n]{8,30})/gi,
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
      case "registration_confirmation":
        return "registered";
      case "dispatch_notification":
        return "dispatched";
      case "arrival_notification":
        return "arrived";
      case "delivery_notification":
        return "delivered";
      case "money_order_notification":
        return "money_order_paid";
      case "tracking_update":
        if (contentLower.includes("delivered")) return "delivered";
        if (contentLower.includes("arrived")) return "arrived";
        if (contentLower.includes("dispatched")) return "dispatched";
        if (contentLower.includes("registered")) return "registered";
        return "in_transit";
      case "express_notification":
        return "express_service";
      default:
        return "in_transit";
    }
  }

  getEmailTypeLabel(emailType) {
    const labels = {
      registration_confirmation: "Mail Registered",
      dispatch_notification: "Mail Dispatched",
      arrival_notification: "Mail Arrived",
      delivery_notification: "Mail Delivered",
      money_order_notification: "Money Order",
      tracking_update: "Mail Update",
      express_notification: "Speed Post",
      postal_notification: "Postal Service",
    };
    return labels[emailType] || "Mail Item";
  }

  calculateConfidence(articleId, postalInfo) {
    let confidence = 0;

    // Higher confidence for standard India Post format
    if (articleId && /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(articleId)) {
      confidence += 0.5;
    } else if (articleId) {
      confidence += 0.3;
    }

    if (postalInfo.destination) confidence += 0.2;
    if (postalInfo.origin) confidence += 0.1;
    if (postalInfo.articleType) confidence += 0.1;
    if (postalInfo.weight) confidence += 0.05;
    if (postalInfo.deliveryOffice) confidence += 0.05;
    return Math.min(confidence, 0.95);
  }
}

module.exports = IndiapostParser;
