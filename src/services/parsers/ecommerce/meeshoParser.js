// src/services/parsers/meeshoParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class MeeshoParser {
  constructor() {
    this.platform = "meesho";
  }

  /**
   * Enhanced canParse method with comprehensive Meesho sender detection
   */
  static canParse(emailData) {
    console.log("🛒 MEESHO DEBUG: canParse() called");
    console.log(`📧 From: ${emailData.from}`);
    console.log(`📋 Subject: ${emailData.subject}`);

    if (!emailData.from || !emailData.subject) {
      console.log("❌ MEESHO: Missing from/subject");
      return false;
    }

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    // Complete Meesho domain variations
    const meeshoDomains = [
      "meesho.com",
      "@meesho",
      "noreply@meesho.com",
      "no-reply@meesho.com",
      "orders@meesho.com",
      "support@meesho.com",
      "notifications@meesho.com",
    ];

    const isMeesho = meeshoDomains.some((domain) => from.includes(domain));
    console.log(`🎯 MEESHO: Is from Meesho domain? ${isMeesho} (${from})`);

    if (!isMeesho) {
      console.log("❌ MEESHO: Not from Meesho domain");
      return false;
    }

    // Enhanced order indicators
    const orderIndicators = [
      "order",
      "shipped",
      "delivered",
      "placed",
      "confirmed",
      "successful",
      "dispatched",
      "tracking",
      "invoice",
      "receipt",
      "purchase",
      "payment",
      "reseller",
    ];

    const hasOrderKeyword = orderIndicators.some((keyword) =>
      subject.includes(keyword)
    );
    console.log(
      `📧 MEESHO: Has order keywords? ${hasOrderKeyword} (${subject})`
    );

    // Strict rejection patterns
    const rejectPatterns = [
      "offer",
      "sale",
      "discount",
      "deal",
      "browse",
      "explore",
      "recommended",
      "wishlist",
      "cart",
      "newsletter",
      "unsubscribe",
      "cashback",
      "coupon",
      "advertisement",
      "promo",
      "marketing",
      "review your",
      "rate your",
      "feedback",
      "catalog",
    ];

    const isPromotional = rejectPatterns.some((pattern) =>
      subject.includes(pattern)
    );
    console.log(`🚫 MEESHO: Is promotional? ${isPromotional}`);

    const canParse = isMeesho && hasOrderKeyword && !isPromotional;
    console.log(`✅ MEESHO: Final canParse result: ${canParse}`);

    return canParse;
  }

  /**
   * Enhanced parse method for Meesho emails
   */
  parse(emailData) {
    console.log("🛒 MEESHO: Starting enhanced parsing...");
    console.log(`📧 Subject: ${emailData.subject}`);
    console.log(`📧 From: ${emailData.from}`);

    try {
      // Step 1: Clean HTML content
      const cleanContent = this.cleanMeeshoHtml(
        emailData.html || emailData.text || ""
      );
      console.log("✅ MEESHO: HTML cleaned successfully");

      // Step 2: Detect email type
      const emailType = this.detectMeeshoEmailType(
        emailData.subject,
        cleanContent
      );
      console.log(`📧 MEESHO: Email type detected - ${emailType}`);

      // Step 3: Extract order ID
      const orderId = this.extractOrderIdRobust(
        cleanContent,
        emailData.subject
      );
      if (!orderId) {
        console.log("❌ MEESHO: No order ID found - cannot process");
        return null;
      }
      console.log(`✅ MEESHO: Order ID extracted - ${orderId}`);

      // Step 4: Extract amount
      const amount = this.extractOrderAmountRobust(cleanContent, emailType);
      console.log(`💰 MEESHO: Amount extracted - ₹${amount || "not found"}`);

      // Step 5: Extract products
      const products = this.extractProductsRobust(
        cleanContent,
        emailType,
        orderId,
        emailData.subject,
        amount
      );
      console.log(`📦 MEESHO: Products found - ${products.length} items`);

      // Step 6: Extract additional data
      const orderDate = this.extractOrderDateRobust(
        cleanContent,
        emailData.date,
        emailType
      );
      const status = this.mapStatusConsistently(emailType, cleanContent);
      const metadata = this.extractMeeshoMetadata(cleanContent, emailData);

      const orderInfo = {
        platform: this.platform,
        orderId,
        amount: amount || 0,
        formattedAmount: amount ? `₹${amount}` : "Data not available in email",
        products,
        orderDate,
        status,
        trackingId: metadata.trackingId || null,
        expectedDelivery: metadata.expectedDelivery || null,
        sellerName: metadata.sellerName || null,
        emailType,
        confidence: this.calculateEnhancedConfidence(
          orderId,
          amount,
          products,
          emailType,
          metadata
        ),
        extractionDetails: {
          senderVariation: emailData.from,
          subjectPattern: emailData.subject,
          emailTypeDetected: emailType,
          amountExtractionMethod: amount ? "pattern_matched" : "not_found",
          processingTimestamp: new Date().toISOString(),
        },
      };

      console.log("📊 MEESHO: Enhanced parsing result:", {
        orderId: orderInfo.orderId,
        amount: orderInfo.amount,
        productsCount: orderInfo.products.length,
        status: orderInfo.status,
        confidence: orderInfo.confidence,
      });

      return orderInfo;
    } catch (error) {
      console.error("❌ MEESHO enhanced parser error:", error);
      return null;
    }
  }

  /**
   * Clean Meesho HTML with comprehensive fixes
   */
  cleanMeeshoHtml(htmlContent) {
    if (!htmlContent) return "";

    console.log("🧹 Cleaning Meesho HTML...");

    let cleaned = htmlContent;

    // Fix currency symbols
    cleaned = cleaned
      .replace(/&#8377;/g, "₹")
      .replace(/&₹/g, "₹")
      .replace(/₹\./g, "₹ ")
      .replace(/Rs\./g, "₹")
      .replace(/Rs\s/g, "₹ ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');

    // Extract valuable content before tag removal
    cleaned = cleaned
      .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " $1 ")
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, " $1 ")
      .replace(/<span[^>]*>([^<]*)<\/span>/gi, " $1 ");

    // Remove HTML structure
    cleaned = cleaned
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n")
      .replace(/<\/?(td|th)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ");

    // Clean up whitespace
    cleaned = cleaned
      .replace(/\s+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    console.log("✅ Meesho HTML cleaned successfully");
    return cleaned;
  }

  /**
   * Robust order ID extraction
   */
  extractOrderIdRobust(content, subject) {
    console.log("🆔 MEESHO: Robust order ID extraction...");

    const orderIdPatterns = [
      // Meesho specific patterns
      /Order\s*(?:ID|Number|#)\s*[:\-]?\s*(MS\d{8,15})/gi,
      /Order\s*(?:ID|Number|#)\s*[:\-]?\s*([A-Z0-9]{8,20})/gi,
      /(MS\d{8,15})/gi, // Meesho format like MS123456789
      /(\d{8,15})/gi, // Numeric order IDs
      /(?:Order|ID)[:\s]*([A-Z0-9]{8,20})/gi,
    ];

    // Search in subject first
    if (subject) {
      console.log("🔍 Searching order ID in subject:", subject);
      for (const pattern of orderIdPatterns) {
        const matches = [...subject.matchAll(pattern)];
        for (const match of matches) {
          const orderId = match[1];
          if (this.isValidMeeshoOrderId(orderId)) {
            console.log(`✅ MEESHO: Order ID from subject - ${orderId}`);
            return orderId;
          }
        }
      }
    }

    // Search in content
    console.log("🔍 Searching order ID in content...");
    for (const pattern of orderIdPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const orderId = match[1];
        if (this.isValidMeeshoOrderId(orderId)) {
          console.log(`✅ MEESHO: Order ID from content - ${orderId}`);
          return orderId;
        }
      }
    }

    console.log("❌ MEESHO: No valid order ID found");
    return null;
  }

  /**
   * Validate Meesho order ID
   */
  isValidMeeshoOrderId(orderId) {
    if (!orderId) return false;

    // Must be reasonable length
    if (orderId.length < 6 || orderId.length > 25) {
      console.log(`❌ MEESHO: Invalid order ID length - ${orderId}`);
      return false;
    }

    // Reject obvious non-order IDs
    const invalidPatterns = [/^(value|table|width|height|px|style)$/i];
    const isInvalid = invalidPatterns.some((pattern) => pattern.test(orderId));

    if (isInvalid) {
      console.log(`❌ MEESHO: Invalid order ID pattern - ${orderId}`);
      return false;
    }

    console.log(`✅ MEESHO: Valid order ID - ${orderId}`);
    return true;
  }

  /**
   * Robust amount extraction
   */
  extractOrderAmountRobust(content, emailType) {
    console.log("💰 MEESHO: Robust amount extraction...");

    const amountPatterns = [
      // High priority patterns
      /(?:Total Amount|Grand Total|Order Total|Amount Paid)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /(?:Final Amount|Bill Total|Total Price)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /(?:You Paid|Payment)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,

      // Medium priority patterns
      /(?:Total|Amount)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,

      // Generic rupee patterns
      /₹\s*([\d,]+(?:\.\d{2})?)/g,
    ];

    const foundAmounts = [];

    for (const pattern of amountPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const amountStr = match[1];
        const amount = parseFloat(amountStr.replace(/,/g, ""));

        if (!isNaN(amount) && amount > 0 && amount < 100000) {
          foundAmounts.push({
            amount,
            context: match[0],
            priority: this.getAmountPriority(match[0]),
          });
        }
      }
    }

    if (foundAmounts.length > 0) {
      foundAmounts.sort(
        (a, b) => b.priority - a.priority || b.amount - a.amount
      );
      const selectedAmount = foundAmounts[0].amount;
      console.log(`✅ MEESHO: Selected amount ₹${selectedAmount}`);
      return selectedAmount;
    }

    console.log("❌ MEESHO: No valid amount found");
    return null;
  }

  /**
   * Get priority for amount patterns
   */
  getAmountPriority(matchText) {
    const text = matchText.toLowerCase();

    if (text.includes("amount paid") || text.includes("you paid")) return 100;
    if (text.includes("total amount") || text.includes("grand total"))
      return 95;
    if (text.includes("order total") || text.includes("final amount"))
      return 90;
    if (text.includes("bill total") || text.includes("total price")) return 85;
    if (text.includes("payment")) return 80;
    if (text.includes("total")) return 70;
    return 50;
  }

  /**
   * Extract products with robust methods
   */
  extractProductsRobust(content, emailType, orderId, subject, totalAmount) {
    console.log("📦 MEESHO: Robust product extraction...");

    // Try to extract actual products
    const extractedProducts = this.extractActualMeeshoProducts(content);

    if (extractedProducts.length > 0) {
      console.log(
        `✅ MEESHO: Found ${extractedProducts.length} actual products`
      );
      return extractedProducts.map((product) => ({
        ...product,
        price:
          product.price !== "Data not available in email"
            ? product.price
            : totalAmount || "Data not available in email",
        formattedPrice:
          product.price !== "Data not available in email"
            ? product.formattedPrice
            : totalAmount
            ? `₹${totalAmount}`
            : "Data not available in email",
      }));
    }

    // Try subject extraction
    const subjectProduct = this.extractProductFromSubject(subject);
    if (subjectProduct) {
      console.log("✅ MEESHO: Extracted product from subject");
      return [
        {
          name: subjectProduct,
          quantity: "Data not available in email",
          price: totalAmount || "Data not available in email",
          formattedPrice: totalAmount
            ? `₹${totalAmount}`
            : "Data not available in email",
          confidence: 75,
          source: "subject_extraction",
        },
      ];
    }

    // Fallback product
    console.log("📦 MEESHO: Creating fallback product...");
    const productName = `Meesho ${this.getEmailTypeLabel(
      emailType
    )} Order ${orderId}`;

    return [
      {
        name: productName,
        quantity: "Data not available in email",
        price: totalAmount || "Data not available in email",
        formattedPrice: totalAmount
          ? `₹${totalAmount}`
          : "Data not available in email",
        confidence: 60,
        source: "fallback_generation",
      },
    ];
  }

  /**
   * Extract actual products from content
   */
  extractActualMeeshoProducts(content) {
    const products = [];

    const productPatterns = [
      // Product with price
      /([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})\s*₹\s*([\d,]+(?:\.\d{2})?)/g,
      // Item/Product labels
      /(?:Item|Product|Article)[:\s]*([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})/gi,
      // Alt text patterns
      /alt="([^"]{10,120})"/gi,
    ];

    for (const pattern of productPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const productName = match[1].trim();
        if (this.isValidMeeshoProduct(productName)) {
          products.push({
            name: this.cleanProductName(productName),
            quantity: 1,
            price: match[2] ? parseFloat(match[2].replace(/,/g, "")) : 0,
            formattedPrice: match[2]
              ? `₹${match[2]}`
              : "Data not available in email",
            confidence: 90,
            source: "content_extraction",
          });
          break;
        }
      }
    }

    return products;
  }

  /**
   * Extract product from subject
   */
  extractProductFromSubject(subject) {
    if (!subject) return null;

    const subjectPatterns = [
      /Your\s+Order\s+for\s+([^.]+?)(?:\.\.\.)?\s+has\s+been/gi,
      /([^.]+?)(?:\.\.\.)?\s+from\s+your\s+order\s+has\s+been/gi,
      /Your\s+([A-Z][a-zA-Z\s&-]+?)\s+order/gi,
      /([A-Z][a-zA-Z\s&-]+?)(?:\.\.\.)?\s/gi,
    ];

    for (const pattern of subjectPatterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        const productName = match[1].trim();
        if (this.isValidProductFromSubject(productName)) {
          return this.cleanProductName(productName);
        }
      }
    }

    return null;
  }

  /**
   * Validate Meesho product
   */
  isValidMeeshoProduct(name) {
    if (!name || name.length < 5) return false;

    const garbagePatterns = [
      /order|total|amount|meesho|email|notification|catalog/i,
      /background|url\(|\.css|\.js|font-family/i,
      /^[\d\s.,;:-]+$/,
      /^[a-f0-9]{8,}$/i,
    ];

    return !garbagePatterns.some((pattern) => pattern.test(name));
  }

  /**
   * Validate product from subject
   */
  isValidProductFromSubject(name) {
    if (!name || name.length < 3) return false;

    const invalidTerms = [
      "order",
      "item",
      "product",
      "shipment",
      "delivery",
      "notification",
      "catalog",
    ];
    const nameLower = name.toLowerCase();
    return !invalidTerms.some((term) => nameLower === term) && name.length >= 5;
  }

  /**
   * Clean product name
   */
  cleanProductName(name) {
    if (!name) return "";

    return name
      .replace(/\.{3,}/g, "...")
      .replace(/\s+/g, " ")
      .replace(/[<>]/g, "")
      .replace(/^\W+|\W+$/g, "")
      .substring(0, 120)
      .trim();
  }

  /**
   * Detect Meesho email type
   */
  detectMeeshoEmailType(subject, content) {
    if (!subject) return "unknown";

    const subjectLower = subject.toLowerCase();
    const contentLower = content.toLowerCase();

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
    if (subjectLower.includes("tracking")) {
      return "tracking_update";
    }

    return "notification";
  }

  /**
   * Extract order date
   */
  extractOrderDateRobust(content, emailDate, emailType) {
    const patterns = [
      /Order\s+Date[:\s]*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/gi,
      /Placed\s+on[:\s]*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/gi,
      /Order\s+Date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }

    return emailDate ? new Date(emailDate) : new Date();
  }

  /**
   * Extract Meesho metadata
   */
  extractMeeshoMetadata(content, emailData) {
    const metadata = {};

    // Extract tracking ID
    const trackingPatterns = [
      /tracking\s*(?:id|number)[:\s]*([A-Z0-9]{10,25})/gi,
      /awb\s*(?:number)?[:\s]*([A-Z0-9]{10,25})/gi,
    ];

    for (const pattern of trackingPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        metadata.trackingId = match[1];
        break;
      }
    }

    // Extract expected delivery
    const deliveryPatterns = [
      /Delivery\s+by[:\s]*([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
      /Expected\s+delivery[:\s]*([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    ];

    for (const pattern of deliveryPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const deliveryDate = new Date(match[1]);
        if (!isNaN(deliveryDate.getTime())) {
          metadata.expectedDelivery = deliveryDate;
          break;
        }
      }
    }

    // Extract seller information
    const sellerPatterns = [
      /Seller[:\s]*([^.\n]+)/gi,
      /Sold\s+by[:\s]*([^.\n]+)/gi,
    ];

    for (const pattern of sellerPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        metadata.sellerName = match[1].trim();
        break;
      }
    }

    return metadata;
  }

  /**
   * Map status consistently
   */
  mapStatusConsistently(emailType, content) {
    switch (emailType) {
      case "order_confirmation":
        return "confirmed";
      case "shipping_notification":
        return "shipped";
      case "delivery_notification":
        return "delivered";
      case "tracking_update":
        if (content.toLowerCase().includes("delivered")) return "delivered";
        return "shipped";
      default:
        return "ordered";
    }
  }

  /**
   * Get email type label
   */
  getEmailTypeLabel(emailType) {
    const labels = {
      order_confirmation: "Order",
      shipping_notification: "Shipped Item",
      delivery_notification: "Delivered Item",
      tracking_update: "Tracking Update",
    };
    return labels[emailType] || "Order";
  }

  /**
   * Calculate enhanced confidence
   */
  calculateEnhancedConfidence(orderId, amount, products, emailType, metadata) {
    let confidence = 0;

    if (orderId) confidence += 0.35;
    if (amount && amount > 0) confidence += 0.25;
    if (products && products.length > 0) {
      const hasRealProducts = products.some(
        (p) =>
          p.name &&
          p.name !== "Data not available in email" &&
          p.name.length > 10 &&
          !p.name.toLowerCase().includes("order")
      );
      confidence += hasRealProducts ? 0.25 : 0.15;
    }
    if (emailType !== "unknown") confidence += 0.1;
    if (metadata.trackingId || metadata.expectedDelivery || metadata.sellerName)
      confidence += 0.05;

    return Math.round(Math.min(confidence, 1.0) * 100) / 100;
  }
}

module.exports = MeeshoParser;
