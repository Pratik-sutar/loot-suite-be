// src/services/parsers/bigbasketParser.js
const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class BigBasketParser {
  constructor() {
    this.platform = "bigbasket";
  }

  /**
   * Enhanced canParse method with comprehensive BigBasket sender detection
   */
  static canParse(emailData) {
    console.log("🛒 BIGBASKET DEBUG: canParse() called");
    console.log(`📧 From: ${emailData.from}`);
    console.log(`📋 Subject: ${emailData.subject}`);

    if (!emailData.from || !emailData.subject) {
      console.log("❌ BIGBASKET: Missing from/subject");
      return false;
    }

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    // Complete BigBasket domain variations
    const bigbasketDomains = [
      "bigbasket.com",
      "@bigbasket",
      "noreply@bigbasket.com",
      "no-reply@bigbasket.com",
      "orders@bigbasket.com",
      "support@bigbasket.com",
      "notifications@bigbasket.com",
      "big basket",
    ];

    const isBigBasket = bigbasketDomains.some((domain) =>
      from.includes(domain)
    );
    console.log(
      `🎯 BIGBASKET: Is from BigBasket domain? ${isBigBasket} (${from})`
    );

    if (!isBigBasket) {
      console.log("❌ BIGBASKET: Not from BigBasket domain");
      return false;
    }

    // Enhanced order indicators (grocery-specific)
    const orderIndicators = [
      "order",
      "delivered",
      "shipped",
      "placed",
      "confirmed",
      "grocery",
      "dispatched",
      "tracking",
      "invoice",
      "receipt",
      "purchase",
      "payment",
      "delivery",
      "fresh",
      "vegetables",
      "fruits",
      "groceries",
    ];

    const hasOrderKeyword = orderIndicators.some((keyword) =>
      subject.includes(keyword)
    );
    console.log(
      `📧 BIGBASKET: Has order keywords? ${hasOrderKeyword} (${subject})`
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
    ];

    const isPromotional = rejectPatterns.some((pattern) =>
      subject.includes(pattern)
    );
    console.log(`🚫 BIGBASKET: Is promotional? ${isPromotional}`);

    const canParse = isBigBasket && hasOrderKeyword && !isPromotional;
    console.log(`✅ BIGBASKET: Final canParse result: ${canParse}`);

    return canParse;
  }

  /**
   * Enhanced parse method for BigBasket emails
   */
  parse(emailData) {
    console.log("🛒 BIGBASKET: Starting enhanced parsing...");
    console.log(`📧 Subject: ${emailData.subject}`);
    console.log(`📧 From: ${emailData.from}`);

    try {
      // Step 1: Clean HTML content
      const cleanContent = this.cleanBigBasketHtml(
        emailData.html || emailData.text || ""
      );
      console.log("✅ BIGBASKET: HTML cleaned successfully");

      // Step 2: Detect email type
      const emailType = this.detectBigBasketEmailType(
        emailData.subject,
        cleanContent
      );
      console.log(`📧 BIGBASKET: Email type detected - ${emailType}`);

      // Step 3: Extract order ID
      const orderId = this.extractOrderIdRobust(
        cleanContent,
        emailData.subject
      );
      if (!orderId) {
        console.log("❌ BIGBASKET: No order ID found - cannot process");
        return null;
      }
      console.log(`✅ BIGBASKET: Order ID extracted - ${orderId}`);

      // Step 4: Extract amount
      const amount = this.extractOrderAmountRobust(cleanContent, emailType);
      console.log(`💰 BIGBASKET: Amount extracted - ₹${amount || "not found"}`);

      // Step 5: Extract products (grocery items)
      const products = this.extractGroceryItemsRobust(
        cleanContent,
        emailType,
        orderId,
        emailData.subject,
        amount
      );
      console.log(
        `🛒 BIGBASKET: Grocery items found - ${products.length} items`
      );

      // Step 6: Extract additional data
      const orderDate = this.extractOrderDateRobust(
        cleanContent,
        emailData.date,
        emailType
      );
      const status = this.mapStatusConsistently(emailType, cleanContent);
      const metadata = this.extractBigBasketMetadata(cleanContent, emailData);

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
        deliverySlot: metadata.deliverySlot || null,
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

      console.log("📊 BIGBASKET: Enhanced parsing result:", {
        orderId: orderInfo.orderId,
        amount: orderInfo.amount,
        itemsCount: orderInfo.products.length,
        status: orderInfo.status,
        confidence: orderInfo.confidence,
      });

      return orderInfo;
    } catch (error) {
      console.error("❌ BIGBASKET enhanced parser error:", error);
      return null;
    }
  }

  /**
   * Clean BigBasket HTML with comprehensive fixes
   */
  cleanBigBasketHtml(htmlContent) {
    if (!htmlContent) return "";

    console.log("🧹 Cleaning BigBasket HTML...");

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

    console.log("✅ BigBasket HTML cleaned successfully");
    return cleaned;
  }

  /**
   * Robust order ID extraction
   */
  extractOrderIdRobust(content, subject) {
    console.log("🆔 BIGBASKET: Robust order ID extraction...");

    const orderIdPatterns = [
      // BigBasket specific patterns
      /Order\s*(?:ID|Number|#)\s*[:\-]?\s*(BB\d{8,15})/gi,
      /Order\s*(?:ID|Number|#)\s*[:\-]?\s*([A-Z0-9]{8,20})/gi,
      /(BB\d{8,15})/gi, // BigBasket format
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
          if (this.isValidBigBasketOrderId(orderId)) {
            console.log(`✅ BIGBASKET: Order ID from subject - ${orderId}`);
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
        if (this.isValidBigBasketOrderId(orderId)) {
          console.log(`✅ BIGBASKET: Order ID from content - ${orderId}`);
          return orderId;
        }
      }
    }

    console.log("❌ BIGBASKET: No valid order ID found");
    return null;
  }

  /**
   * Validate BigBasket order ID
   */
  isValidBigBasketOrderId(orderId) {
    if (!orderId) return false;

    // Must be reasonable length
    if (orderId.length < 6 || orderId.length > 25) {
      console.log(`❌ BIGBASKET: Invalid order ID length - ${orderId}`);
      return false;
    }

    console.log(`✅ BIGBASKET: Valid order ID - ${orderId}`);
    return true;
  }

  /**
   * Robust amount extraction
   */
  extractOrderAmountRobust(content, emailType) {
    console.log("💰 BIGBASKET: Robust amount extraction...");

    const amountPatterns = [
      // High priority patterns (grocery-specific)
      /(?:Total Amount|Grand Total|Order Total|Amount Paid|Bill Amount)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /(?:Final Amount|Bill Total|Total Price)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /(?:You Paid|Payment|Amount Payable)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,

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

        // Grocery orders are typically smaller amounts
        if (!isNaN(amount) && amount > 10 && amount < 50000) {
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
      console.log(`✅ BIGBASKET: Selected amount ₹${selectedAmount}`);
      return selectedAmount;
    }

    console.log("❌ BIGBASKET: No valid amount found");
    return null;
  }

  /**
   * Get priority for amount patterns
   */
  getAmountPriority(matchText) {
    const text = matchText.toLowerCase();

    if (text.includes("amount paid") || text.includes("you paid")) return 100;
    if (text.includes("bill amount") || text.includes("total amount"))
      return 95;
    if (text.includes("grand total") || text.includes("order total")) return 90;
    if (text.includes("final amount") || text.includes("bill total")) return 85;
    if (text.includes("amount payable") || text.includes("payment")) return 80;
    if (text.includes("total")) return 70;
    return 50;
  }

  /**
   * Extract grocery items with robust methods
   */
  extractGroceryItemsRobust(content, emailType, orderId, subject, totalAmount) {
    console.log("🛒 BIGBASKET: Robust grocery items extraction...");

    // Try to extract actual grocery items
    const extractedItems = this.extractActualGroceryItems(content);

    if (extractedItems.length > 0) {
      console.log(
        `✅ BIGBASKET: Found ${extractedItems.length} actual grocery items`
      );
      return extractedItems;
    }

    // Try subject extraction
    const subjectProduct = this.extractProductFromSubject(subject);
    if (subjectProduct) {
      console.log("✅ BIGBASKET: Extracted product from subject");
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
    console.log("🛒 BIGBASKET: Creating fallback grocery order...");
    const productName = `BigBasket ${this.getEmailTypeLabel(
      emailType
    )} ${orderId}`;

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
   * Extract actual grocery items from content
   */
  extractActualGroceryItems(content) {
    const items = [];

    const groceryItemPatterns = [
      // Quantity x Item pattern (common in grocery)
      /(\d+)\s*x\s*([A-Z][a-zA-Z0-9\s\-&.'()]{5,80})\s*₹\s*([\d,]+(?:\.\d{2})?)/g,
      // Item with price pattern
      /([A-Z][a-zA-Z0-9\s\-&.'()]{5,80})\s*₹\s*([\d,]+(?:\.\d{2})?)/g,
      // Product/Item labels
      /(?:Item|Product)[:\s]*([A-Z][a-zA-Z0-9\s\-&.'()]{5,80})/gi,
    ];

    for (const pattern of groceryItemPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        let itemName, quantity, price;

        if (match.length === 4) {
          // Pattern with quantity first
          quantity = parseInt(match[1]) || 1;
          itemName = match[2].trim();
          price = parseFloat(match[3].replace(/,/g, ""));
        } else {
          // Pattern without explicit quantity
          itemName = match[1].trim();
          price = parseFloat(match[2].replace(/,/g, ""));
          quantity = 1;
        }

        if (this.isValidGroceryItem(itemName)) {
          items.push({
            name: this.cleanProductName(itemName),
            quantity,
            price,
            formattedPrice: `₹${price}`,
            confidence: 90,
            source: "content_extraction",
          });

          // Limit to top 10 items to avoid clutter
          if (items.length >= 10) break;
        }
      }
    }

    return items;
  }

  /**
   * Extract product from subject
   */
  extractProductFromSubject(subject) {
    if (!subject) return null;

    const subjectPatterns = [
      /Your\s+Order\s+for\s+([^.]+?)(?:\.\.\.)?\s+has\s+been/gi,
      /([^.]+?)(?:\.\.\.)?\s+from\s+your\s+order\s+has\s+been/gi,
      /Your\s+grocery\s+order/gi,
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
   * Validate grocery item (stricter for grocery items)
   */
  isValidGroceryItem(name) {
    if (!name || name.length < 3) return false;

    const garbagePatterns = [
      /order|total|amount|bigbasket|email|notification|delivery|fee|charge/i,
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
      "delivery",
      "notification",
      "grocery",
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
      .substring(0, 100)
      .trim();
  }

  /**
   * Detect BigBasket email type
   */
  detectBigBasketEmailType(subject, content) {
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
      subjectLower.includes("delivered") ||
      subjectLower.includes("delivery")
    ) {
      return "delivery_notification";
    }
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("dispatched")
    ) {
      return "shipping_notification";
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
      /Delivery\s+Date[:\s]*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/gi,
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
   * Extract BigBasket metadata
   */
  extractBigBasketMetadata(content, emailData) {
    const metadata = {};

    // Extract delivery slot
    const slotPatterns = [
      /Delivery\s+Slot[:\s]*([^,\n]{5,50})/gi,
      /Time\s+Slot[:\s]*([^,\n]{5,50})/gi,
    ];

    for (const pattern of slotPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        metadata.deliverySlot = match[1].trim();
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
      order_confirmation: "Grocery Order",
      shipping_notification: "Shipped Items",
      delivery_notification: "Delivered Items",
      tracking_update: "Delivery Update",
    };
    return labels[emailType] || "Grocery Order";
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
          p.name.length > 5 &&
          !p.name.toLowerCase().includes("order")
      );
      confidence += hasRealProducts ? 0.25 : 0.15;
    }
    if (emailType !== "unknown") confidence += 0.1;
    if (metadata.deliverySlot || metadata.expectedDelivery) confidence += 0.05;

    return Math.round(Math.min(confidence, 1.0) * 100) / 100;
  }
}

module.exports = BigBasketParser;
