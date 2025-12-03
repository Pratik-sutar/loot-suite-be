// src/services/parsers/flipkartParser.js - COMPLETE ENHANCED VERSION WITH PRODUCT NAME FIXES

const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class FlipkartParser {
  constructor() {
    this.platform = "flipkart";
  }

  /**
   * 🔍 ENHANCED canParse with comprehensive Flipkart sender detection
   */
  static canParse(emailData) {
    console.log("🔍 FLIPKART DEBUG: canParse() called");
    console.log(`📧 From: ${emailData.from}`);
    console.log(`📋 Subject: ${emailData.subject}`);

    if (!emailData.from || !emailData.subject) {
      console.log("❌ FLIPKART: Missing from/subject");
      return false;
    }

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    // ✅ COMPLETE: All Flipkart domain variations found in real emails
    const flipkartDomains = [
      "flipkart.com",
      "nct.flipkart.com",
      "rmt.flipkart.com", // ✅ NEW: Found in shipping emails
      "@flipkart",
      "no-reply@rmt.flipkart.com", // ✅ NEW: Exact sender from real emails
      "noreply@nct.flipkart.com", // ✅ NEW: Exact sender from real emails
      "noreply@flipkart.com", // EXISTING
      "auto-confirm@flipkart.com", // Common pattern
      "order-update@flipkart.com", // Common pattern
    ];

    const isFlipkart = flipkartDomains.some((domain) => from.includes(domain));
    console.log(
      `🎯 FLIPKART: Is from Flipkart domain? ${isFlipkart} (${from})`
    );

    if (!isFlipkart) {
      console.log("❌ FLIPKART: Not from Flipkart domain");
      return false;
    }

    // ✅ ENHANCED: Complete order indicators including real email patterns
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
      "item", // ✅ NEW: "item from your order has been shipped"
      "shipment", // ✅ NEW: Common in shipping notifications
      "successfully", // ✅ NEW: "successfully placed"
    ];

    const hasOrderKeyword = orderIndicators.some((keyword) =>
      subject.includes(keyword)
    );
    console.log(
      `📧 FLIPKART: Has order keywords? ${hasOrderKeyword} (${subject})`
    );

    // Check for promotional content (stricter rejection)
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
    console.log(`🚫 FLIPKART: Is promotional? ${isPromotional}`);

    const canParse = isFlipkart && hasOrderKeyword && !isPromotional;
    console.log(`✅ FLIPKART: Final canParse result: ${canParse}`);

    return canParse;
  }

  /**
   * 🎯 COMPLETE enhanced parse method for Flipkart emails
   */
  parse(emailData) {
    console.log("🛒 FLIPKART: Starting complete enhanced parsing...");
    console.log(`📧 Subject: ${emailData.subject}`);
    console.log(`📧 From: ${emailData.from}`);

    try {
      // Step 1: Clean HTML content with Flipkart-specific fixes
      const cleanContent = this.cleanFlipkartHtml(
        emailData.html || emailData.text || ""
      );
      console.log("✅ FLIPKART: HTML cleaned with enhanced encoding fixes");

      // Step 2: Detect email type with comprehensive patterns
      const emailType = this.detectFlipkartEmailType(
        emailData.subject,
        cleanContent
      );
      console.log(`📧 FLIPKART: Email type detected - ${emailType}`);

      // Step 3: Extract order ID with robust patterns
      const orderId = this.extractOrderIdRobust(
        cleanContent,
        emailData.subject
      );
      if (!orderId) {
        console.log("❌ FLIPKART: No order ID found - cannot process");
        return null;
      }
      console.log(`✅ FLIPKART: Order ID extracted - ${orderId}`);

      // Step 4: Extract order date with enhanced logic
      const orderDate = this.extractOrderDateRobust(
        cleanContent,
        emailData.date,
        emailType
      );
      console.log(
        `📅 FLIPKART: Order date - ${orderDate?.toLocaleDateString()}`
      );

      // Step 5: Extract amount with comprehensive currency handling
      const amount = this.extractOrderAmountRobust(cleanContent, emailType);
      console.log(`💰 FLIPKART: Amount extracted - ₹${amount || "not found"}`);

      // Step 6: Extract products with enhanced methods (pass total amount)
      const products = this.extractProductsRobust(
        cleanContent,
        emailType,
        orderId,
        emailData.subject,
        amount
      );
      console.log(`📦 FLIPKART: Products found - ${products.length} items`);

      // Step 7: Extract comprehensive metadata
      const metadata = this.extractFlipkartMetadata(cleanContent, emailData);
      console.log(`📋 FLIPKART: Metadata extracted`);

      // Step 8: Map status with email type awareness
      const status = this.mapStatusConsistently(emailType, cleanContent);
      console.log(`📊 FLIPKART: Status mapped - ${status}`);

      const orderInfo = {
        platform: this.platform,
        orderId,
        amount: amount || 0,
        formattedAmount: amount ? `₹${amount}` : "Data not available in email",
        products,
        orderDate,
        status,

        // Enhanced metadata
        trackingId: metadata.trackingId || null,
        expectedDelivery: metadata.expectedDelivery || null,
        carrierName: metadata.carrierName || null,
        sellerName: metadata.sellerName || null,
        phoneNumber: metadata.phoneNumber || null,
        deliveryAddress: metadata.deliveryAddress || null,

        // Email analysis
        emailType,
        confidence: this.calculateEnhancedConfidence(
          orderId,
          amount,
          products,
          emailType,
          metadata
        ),
        dataQuality: this.assessDataQuality(
          orderId,
          amount,
          products,
          orderDate,
          metadata
        ),

        // Debug information
        extractionDetails: {
          senderVariation: emailData.from,
          subjectPattern: emailData.subject,
          emailTypeDetected: emailType,
          amountExtractionMethod: amount ? "pattern_matched" : "not_found",
          productExtractionMethod: this.getProductExtractionMethod(products),
          processingTimestamp: new Date().toISOString(),
        },
      };

      console.log("📊 FLIPKART: Complete enhanced parsing result:", {
        orderId: orderInfo.orderId,
        orderDate: orderInfo.orderDate?.toLocaleDateString(),
        amount: orderInfo.amount,
        productsCount: orderInfo.products.length,
        status: orderInfo.status,
        confidence: orderInfo.confidence,
        dataQuality: orderInfo.dataQuality.completeness + "% complete",
      });

      return orderInfo;
    } catch (error) {
      console.error("❌ FLIPKART enhanced parser error:", error);
      return null;
    }
  }

  /**
   * 🧹 Clean Flipkart HTML with comprehensive encoding fixes
   */
  cleanFlipkartHtml(htmlContent) {
    if (!htmlContent) return "";

    console.log("🧹 Cleaning Flipkart HTML with comprehensive fixes...");

    let cleaned = htmlContent;

    // Step 1: Fix Flipkart-specific encoding issues
    cleaned = cleaned
      // ✅ COMPREHENSIVE: Rupee symbol variations
      .replace(/Ã¢â€šÂ¨/g, "₹") // Main Flipkart encoding issue
      .replace(/Ã¢â€šÂ¹/g, "₹") // Alternative encoding
      .replace(/&#8377;/g, "₹") // HTML entity
      .replace(/&₹/g, "₹") // Broken entity
      .replace(/₹\./g, "₹ ") // "₹." → "₹ "
      .replace(/Rs\./g, "₹") // "Rs." → "₹"
      .replace(/Rs\s/g, "₹ ") // "Rs " → "₹ "

      // Fix other common encoding issues
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');

    // Step 2: Extract valuable content before tag removal
    const extractedContent = cleaned
      // Extract alt text (product names)
      .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " $1 ")
      // Extract link text
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, " $1 ")
      // Extract span content
      .replace(/<span[^>]*>([^<]*)<\/span>/gi, " $1 ");

    // Step 3: Remove HTML structure
    cleaned = extractedContent
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n")
      .replace(/<\/?(td|th)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ");

    // Step 4: Clean up whitespace and normalize
    cleaned = cleaned
      .replace(/\s+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    console.log("✅ Flipkart HTML cleaned successfully");
    return cleaned;
  }

  /**
   * 🆔 ROBUST order ID extraction with multiple fallback strategies
   */
  extractOrderIdRobust(content, subject) {
    console.log("🆔 FLIPKART: Robust order ID extraction...");

    // ✅ COMPREHENSIVE: All Flipkart order ID patterns
    const orderIdPatterns = [
      // Direct patterns (highest priority)
      /\b(OD\d{15,21})\b/gi,
      /(OD\d{15,21})/gi,

      // Structured text patterns
      /Order\s*ID[:\s]*(OD\d{15,21})/gi,
      /Order\s*Number[:\s]*(OD\d{15,21})/gi,
      /Order\s*#[:\s]*(OD\d{15,21})/gi,

      // Subject line patterns
      /Order\s*for.*?(OD\d{15,21})/gi,
      /Your\s*order.*?(OD\d{15,21})/gi,
      /.*?(OD\d{15,21}).*?(?:order|shipped|delivered)/gi,

      // URL patterns
      /orderID=(OD\d{15,21})/gi,
      /order-id=(OD\d{15,21})/gi,
      /order_id=(OD\d{15,21})/gi,
    ];

    // Strategy 1: Search in subject first (most reliable)
    if (subject) {
      console.log("🔍 Searching order ID in subject:", subject);
      for (const pattern of orderIdPatterns) {
        const matches = [...subject.matchAll(pattern)];
        for (const match of matches) {
          const orderId = match[1];
          if (this.isValidFlipkartOrderId(orderId)) {
            console.log(`✅ FLIPKART: Order ID from subject - ${orderId}`);
            return orderId;
          }
        }
      }
    }

    // Strategy 2: Search in content
    console.log("🔍 Searching order ID in content...");
    for (const pattern of orderIdPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const orderId = match[1];
        if (this.isValidFlipkartOrderId(orderId)) {
          console.log(`✅ FLIPKART: Order ID from content - ${orderId}`);
          return orderId;
        }
      }
    }

    console.log("❌ FLIPKART: No valid order ID found");
    return null;
  }

  /**
   * ✅ Enhanced Flipkart order ID validation
   */
  isValidFlipkartOrderId(orderId) {
    if (!orderId) return false;

    // Must be OD followed by 15-21 digits (actual Flipkart format)
    const flipkartFormat = /^OD\d{15,21}$/i;

    if (!flipkartFormat.test(orderId)) {
      console.log(`❌ FLIPKART: Invalid order ID format - ${orderId}`);
      return false;
    }

    console.log(`✅ FLIPKART: Valid order ID format - ${orderId}`);
    return true;
  }

  /**
   * 💰 ROBUST amount extraction with complete currency variation support
   */
  extractOrderAmountRobust(content, emailType) {
    console.log(
      "💰 FLIPKART: Robust amount extraction with enhanced patterns..."
    );

    // ✅ COMPREHENSIVE: Flipkart amount patterns with ALL currency variations
    const flipkartAmountPatterns = [
      // Highest priority - Flipkart-specific exact patterns
      /Amount\s*Paid[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
      /Shipment\s*[Tt]otal[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
      /Order\s*Value[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,

      // High priority - payment and totals
      /Total\s*Amount[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
      /Grand\s*Total[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
      /Cart\s*Total[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
      /Item\s*Total[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,

      // Medium priority - payment context
      /Payment[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
      /Paid[:\s]*(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/gi,

      // Lower priority - generic currency patterns (fallback)
      /(?:₹|Ã¢â€šÂ¨|Rs\.?|INR)[.\s]*([\d,]+(?:\.\d{2})?)/g,
    ];

    const foundAmounts = [];

    for (const pattern of flipkartAmountPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const amountStr = match[1];
        const amount = parseFloat(amountStr.replace(/,/g, ""));

        if (!isNaN(amount) && amount > 0 && amount < 500000) {
          foundAmounts.push({
            amount,
            context: match[0],
            priority: this.getFlipkartAmountPriority(match[0]),
            pattern: pattern.toString().substring(0, 40) + "...",
          });
        }
      }
    }

    if (foundAmounts.length > 0) {
      // Sort by priority, then by amount (prefer higher amounts for order totals)
      foundAmounts.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.amount - a.amount;
      });

      const selectedAmount = foundAmounts[0].amount;
      console.log(
        `✅ FLIPKART: Selected amount ₹${selectedAmount} from ${foundAmounts.length} candidates`
      );

      if (foundAmounts.length > 1) {
        console.log(
          `📋 Other candidates:`,
          foundAmounts
            .slice(1, 4)
            .map((a) => `₹${a.amount} (priority: ${a.priority})`)
        );
      }

      return selectedAmount;
    }

    console.log("❌ FLIPKART: No valid amount found in email");
    return null;
  }

  /**
   * Get priority for Flipkart amount patterns (enhanced)
   */
  getFlipkartAmountPriority(matchText) {
    const text = matchText.toLowerCase();

    // Highest priority - definitive payment amounts
    if (text.includes("amount paid")) return 100;
    if (text.includes("shipment total")) return 95;
    if (text.includes("order value")) return 90;

    // High priority - order totals
    if (text.includes("total amount")) return 85;
    if (text.includes("grand total")) return 80;
    if (text.includes("cart total")) return 75;
    if (text.includes("item total")) return 70;

    // Medium priority - payment related
    if (text.includes("payment")) return 65;
    if (text.includes("paid")) return 60;

    // Lower priority - generic currency
    return 30;
  }

  /**
   * 📦 ROBUST product extraction with comprehensive fallback strategies
   */
  extractProductsRobust(
    content,
    emailType,
    orderId,
    subject,
    totalAmount = null
  ) {
    console.log("📦 FLIPKART: Robust product extraction...");

    // Strategy 1: Extract actual products from content
    const extractedProducts = this.extractActualFlipkartProducts(content);

    if (extractedProducts.length > 0) {
      console.log(
        `✅ FLIPKART: Found ${extractedProducts.length} actual products from content`
      );

      // ✅ NEW: Use total amount as item price if individual price not available
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

    // Strategy 2: Extract product name from subject line
    const subjectProduct = this.extractProductNameFromSubject(subject);
    if (subjectProduct) {
      console.log(`✅ FLIPKART: Extracted product name from subject`);
      return [
        {
          name: subjectProduct,
          quantity: "Data not available in email",
          price: totalAmount || "Data not available in email", // ✅ Use total amount
          formattedPrice: totalAmount
            ? `₹${totalAmount}`
            : "Data not available in email",
          confidence: 75,
          source: "subject_extraction",
        },
      ];
    }

    // Strategy 3: Create meaningful placeholder based on email type
    console.log(
      "📦 FLIPKART: Creating meaningful placeholder based on email type..."
    );

    const productName = `Flipkart ${this.getEmailTypeLabel(
      emailType
    )} Order ${orderId}`;

    return [
      {
        name: productName,
        quantity: "Data not available in email",
        price: totalAmount || "Data not available in email", // ✅ Use total amount
        formattedPrice: totalAmount
          ? `₹${totalAmount}`
          : "Data not available in email",
        confidence: 60,
        source: "fallback_generation",
      },
    ];
  }

  /**
   * Extract actual products from Flipkart content (FIXED - no garbage text)
   */
  extractActualFlipkartProducts(content) {
    console.log("📦 FLIPKART: Extracting actual products from content...");

    const products = [];

    // ✅ PRIORITY 1: Alt text from images (most reliable for product names)
    const altTextPattern = /alt="([^"]{10,120})"/gi;
    const altMatches = [...content.matchAll(altTextPattern)];

    for (const match of altMatches) {
      const productName = match[1].trim();
      if (this.isValidFlipkartProduct(productName)) {
        console.log(`✅ FLIPKART: Product from alt text - ${productName}`);
        products.push({
          name: this.cleanFlipkartProductName(productName),
          quantity:
            this.extractQuantityForProduct(content, productName) ||
            "Data not available in email",
          price: "Data not available in email",
          formattedPrice: "Data not available in email",
          confidence: 95,
          extractionMethod: "alt_text",
          source: "html_alt_attribute",
        });
        break; // Take the first valid alt text product
      }
    }

    // If we found a good product from alt text, return it
    if (products.length > 0) {
      return products;
    }

    // ✅ PRIORITY 2: Product name in structured content (before Seller line)
    const sellerPattern =
      /([A-Z][a-zA-Z0-9\s\-&.()]{10,120}(?:\.\.\.)?)\s*[\n\r\s]*Seller[:\s]/gi;
    const sellerMatches = [...content.matchAll(sellerPattern)];

    for (const match of sellerMatches) {
      const productName = match[1].trim();
      if (this.isValidFlipkartProduct(productName)) {
        console.log(`✅ FLIPKART: Product before seller - ${productName}`);
        products.push({
          name: this.cleanFlipkartProductName(productName),
          quantity:
            this.extractQuantityForProduct(content, productName) ||
            "Data not available in email",
          price: "Data not available in email",
          formattedPrice: "Data not available in email",
          confidence: 85,
          extractionMethod: "before_seller",
          source: "structured_content",
        });
        break; // Take the first valid product
      }
    }

    return products;
  }

  /**
   * Extract product name from subject line (enhanced)
   */
  extractProductNameFromSubject(subject) {
    if (!subject) return null;

    console.log("🔍 Extracting product name from subject:", subject);

    // ✅ ENHANCED: Subject line patterns for Flipkart
    const subjectPatterns = [
      // Pattern: "Your Order for Gurukrupa Internationa... has been successfully placed"
      /Your\s+Order\s+for\s+([^.]+?)(?:\.\.\.)?\s+has\s+been/gi,

      // Pattern: "Gurukrupa Internationa... from your order has been shipped"
      /([^.]+?)(?:\.\.\.)?\s+from\s+your\s+order\s+has\s+been/gi,

      // Pattern: General product name before keywords
      /([A-Z][a-zA-Z\s&-]+?)(?:\.\.\.)?\s+(?:from|has|order|shipped|delivered)/gi,

      // Pattern: Product name at start of subject
      /^([A-Z][a-zA-Z\s&-]{5,50})(?:\.\.\.)?\s/gi,
    ];

    for (const pattern of subjectPatterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        const productName = match[1].trim();

        // Validate extracted name
        if (this.isValidProductNameFromSubject(productName)) {
          console.log(
            `✅ FLIPKART: Product name from subject - ${productName}`
          );
          return this.cleanFlipkartProductName(productName);
        }
      }
    }

    console.log("❌ FLIPKART: No valid product name found in subject");
    return null;
  }

  /**
   * Validate product name extracted from subject
   */
  isValidProductNameFromSubject(name) {
    if (!name || name.length < 3) return false;

    // Should not be generic terms
    const invalidTerms = [
      "order",
      "item",
      "product",
      "shipment",
      "delivery",
      "notification",
      "confirmation",
      "update",
      "your",
      "the",
      "has",
      "been",
      "from",
    ];

    const nameLower = name.toLowerCase();
    const isGeneric = invalidTerms.some((term) => nameLower === term);

    return !isGeneric && name.length >= 5;
  }

  /**
   * Get email type label for meaningful placeholders
   */
  getEmailTypeLabel(emailType) {
    const labels = {
      order_confirmation: "Confirmed",
      shipping_notification: "Shipped",
      delivery_notification: "Delivered",
      tracking_update: "Tracking",
      notification: "Order",
    };
    return labels[emailType] || "Order";
  }

  /**
   * Get product extraction method for debugging
   */
  getProductExtractionMethod(products) {
    if (!products || products.length === 0) return "none";

    const methods = products.map(
      (p) => p.source || p.extractionMethod || "unknown"
    );
    return methods[0]; // Return primary method used
  }

  /**
   * 🔍 Enhanced Flipkart email type detection
   */
  detectFlipkartEmailType(subject, content) {
    if (!subject) return "unknown";

    const subjectLower = subject.toLowerCase();
    const contentLower = content.toLowerCase();

    console.log("🔍 Detecting Flipkart email type from subject and content...");

    // ✅ ENHANCED: Order confirmation patterns
    if (
      subjectLower.includes("order confirmation") ||
      subjectLower.includes("order placed") ||
      subjectLower.includes("successfully placed") ||
      subjectLower.includes("order for") ||
      subjectLower.includes("thank you for your order") ||
      contentLower.includes("order total") ||
      contentLower.includes("amount paid") ||
      contentLower.includes("order has been successfully placed")
    ) {
      console.log("📧 Detected: order_confirmation");
      return "order_confirmation";
    }

    // ✅ ENHANCED: Shipping notification patterns
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("dispatched") ||
      subjectLower.includes("on the way") ||
      (subjectLower.includes("item") && subjectLower.includes("shipped")) ||
      subjectLower.includes("from your order has been shipped") ||
      contentLower.includes("item has been shipped") ||
      contentLower.includes("shipped via")
    ) {
      console.log("📧 Detected: shipping_notification");
      return "shipping_notification";
    }

    // ✅ ENHANCED: Delivery notification patterns
    if (
      subjectLower.includes("delivered") ||
      subjectLower.includes("successfully delivered") ||
      contentLower.includes("has been delivered") ||
      contentLower.includes("delivery confirmed")
    ) {
      console.log("📧 Detected: delivery_notification");
      return "delivery_notification";
    }

    // ✅ ENHANCED: Tracking update patterns
    if (
      subjectLower.includes("tracking") ||
      subjectLower.includes("out for delivery") ||
      subjectLower.includes("in transit") ||
      contentLower.includes("track your shipment") ||
      contentLower.includes("tracking number")
    ) {
      console.log("📧 Detected: tracking_update");
      return "tracking_update";
    }

    console.log("📧 Detected: notification (generic)");
    return "notification";
  }

  /**
   * 📅 ROBUST order date extraction with Flipkart-specific patterns
   */
  extractOrderDateRobust(content, emailDate, emailType) {
    console.log("📅 FLIPKART: Robust order date extraction...");

    // For order confirmations, prioritize actual order date from content
    if (emailType === "order_confirmation") {
      const orderDatePatterns = [
        // Flipkart's "Order placed on Aug 01, 2025" pattern
        /Order\s+placed\s+on[:\s]*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/gi,
        /Placed\s+on[:\s]*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/gi,

        // Alternative date formats
        /Order\s+Date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
        /Date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
        /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi,
      ];

      for (const pattern of orderDatePatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const parsedDate = new Date(match[1]);
          if (!isNaN(parsedDate.getTime())) {
            console.log(
              `✅ FLIPKART: Found order date in content - ${parsedDate.toLocaleDateString()}`
            );
            return parsedDate;
          }
        }
      }
    }

    // Fallback to email date
    const fallbackDate = emailDate ? new Date(emailDate) : new Date();
    console.log(
      `⚠️ FLIPKART: Using email date as fallback - ${fallbackDate.toLocaleDateString()}`
    );
    return fallbackDate;
  }

  /**
   * 📋 Extract comprehensive Flipkart metadata
   */
  extractFlipkartMetadata(content, emailData) {
    console.log("📋 FLIPKART: Extracting comprehensive metadata...");

    const metadata = {};

    // Extract expected delivery date
    const deliveryPatterns = [
      /Delivery\s+by[:\s]*([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
      /Expected\s+delivery[:\s]*([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
      /by\s+([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    ];

    for (const pattern of deliveryPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const deliveryDate = new Date(match[1]);
        if (!isNaN(deliveryDate.getTime())) {
          metadata.expectedDelivery = deliveryDate;
          console.log(
            `📅 FLIPKART: Expected delivery - ${deliveryDate.toLocaleDateString()}`
          );
          break;
        }
      }
    }

    // Extract carrier/logistics information
    const carrierPatterns = [
      /shipped\s+via\s+([^.\n]+)/gi,
      /(?:carrier|logistics)[:\s]*([^.\n]+)/gi,
      /dispatched\s+through\s+([^.\n]+)/gi,
    ];

    for (const pattern of carrierPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        metadata.carrierName = match[1].trim();
        console.log(`🚛 FLIPKART: Carrier - ${metadata.carrierName}`);
        break;
      }
    }

    // Extract seller information
    const sellerPatterns = [
      /Seller[:\s]*([^.\n]+)/gi,
      /Sold\s+by[:\s]*([^.\n]+)/gi,
      /From[:\s]*([^.\n]+)/gi,
    ];

    for (const pattern of sellerPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const sellerName = match[1].trim();
        if (
          sellerName.length > 2 &&
          !sellerName.toLowerCase().includes("flipkart")
        ) {
          metadata.sellerName = sellerName;
          console.log(`🏪 FLIPKART: Seller - ${metadata.sellerName}`);
          break;
        }
      }
    }

    // Extract phone number for SMS updates
    const phonePatterns = [
      /SMS\s+updates\s+sent\s+to[:\s]*(\d{10})/gi,
      /Mobile[:\s]*(\d{10})/gi,
      /Phone[:\s]*(\d{10})/gi,
    ];

    for (const pattern of phonePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        metadata.phoneNumber = match[1];
        console.log(`📱 FLIPKART: Phone number - ${metadata.phoneNumber}`);
        break;
      }
    }

    // Extract delivery address
    const addressPatterns = [
      /Delivery\s+Address[:\s]*([^.]+?)(?:\n|$)/gi,
      /Address[:\s]*([^.]+?)(?:\n|$)/gi,
    ];

    for (const pattern of addressPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const address = match[1].trim();
        if (address.length > 10) {
          metadata.deliveryAddress = address;
          console.log(`🏠 FLIPKART: Delivery address found`);
          break;
        }
      }
    }

    // Extract tracking ID (AWB/tracking number)
    const trackingPatterns = [
      /tracking\s*(?:id|number)[:\s]*([A-Z0-9]{10,25})/gi,
      /awb\s*(?:number)?[:\s]*([A-Z0-9]{10,25})/gi,
      /shipment\s*(?:id|number)[:\s]*([A-Z0-9]{10,25})/gi,
      /consignment\s*(?:id|number)[:\s]*([A-Z0-9]{10,25})/gi,
    ];

    for (const pattern of trackingPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        metadata.trackingId = match[1];
        console.log(`📦 FLIPKART: Tracking ID - ${metadata.trackingId}`);
        break;
      }
    }

    return metadata;
  }

  /**
   * Extract quantity for a specific product
   */
  extractQuantityForProduct(content, productName) {
    // Look for quantity near the product name
    const qtyPatterns = [
      new RegExp(
        `${productName.substring(0, 20)}[^\\n]*Qty[:\\s]*(\\d+)`,
        "gi"
      ),
      /Qty[:\s]*(\d+)/gi,
      /Quantity[:\s]*(\d+)/gi,
    ];

    for (const pattern of qtyPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const qty = parseInt(match[1]);
        if (qty > 0 && qty < 100) {
          return qty;
        }
      }
    }

    return 1; // Default quantity
  }

  /**
   * 🧹 ENHANCED: Clean Flipkart product name with comprehensive text removal
   */
  cleanFlipkartProductName(name) {
    if (!name) return "Unknown Product";

    console.log(`🧹 Cleaning Flipkart product name: "${name}"`);

    let cleaned = name;

    // Step 1: Remove common extra text patterns
    const cleaningPatterns = [
      // Remove trailing dots and ellipsis
      /\.{2,}$/g,
      /\.\s*$/g,

      // Remove common Flipkart suffixes
      /\s*-\s*(flipkart|amazon|myntra|ajio).*$/i,

      // Remove promotional text at end
      /\s*-\s*(buy now|shop now|limited time|offer|deal).*$/i,

      // Remove size/color variations that are redundant
      /\s*-\s*(size|color|variant):.*$/i,

      // Remove brand repetition (if brand appears twice)
      /^([^-]+)\s*-\s*\1\s*/i,

      // Remove common e-commerce suffixes
      /\s*-\s*(product|item|piece|pack|set)$/i,

      // Remove trailing numbers/codes that aren't meaningful
      /\s*-\s*[A-Z0-9]{6,}$/i,

      // 🎯 SPECIFIC FIX: Remove trailing connector words
      /\s+(has|have|with|for|in|on|at|by|from|and|or|the)\.?\s*$/i,

      // Remove trailing punctuation after cleaning
      /[,;\-\.\s]+$/g,

      // Remove leading/trailing dashes and spaces
      /^[-\s]+|[-\s]+$/g,
    ];

    // Apply all cleaning patterns
    cleaningPatterns.forEach((pattern) => {
      const beforeCleaning = cleaned;
      cleaned = cleaned.replace(pattern, "");
      if (beforeCleaning !== cleaned) {
        console.log(`🧽 Applied cleaning: "${beforeCleaning}" → "${cleaned}"`);
      }
    });

    // Step 2: Normalize spaces and handle edge cases
    cleaned = cleaned
      .replace(/\s+/g, " ") // Normalize multiple spaces
      .replace(/[<>]/g, "") // Remove brackets
      .replace(/^\W+|\W+$/g, "") // Remove leading/trailing punctuation
      .replace(/\(\s*\)$/g, "") // Remove empty parentheses
      .trim();

    // Step 3: Handle length and validate result
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100).trim();
      // Ensure we don't cut off in the middle of a word
      const lastSpaceIndex = cleaned.lastIndexOf(" ");
      if (lastSpaceIndex > 80) {
        cleaned = cleaned.substring(0, lastSpaceIndex);
      }
      cleaned += "...";
    }

    // Step 4: If cleaning made the name too short or invalid, try to recover
    if (cleaned.length < 10 && name.length >= 10) {
      console.log(`⚠️ Cleaning made name too short, trying recovery...`);

      // Try gentler cleaning - just remove the most obvious issues
      cleaned = name
        .replace(/\.{2,}$/g, "") // Remove ellipsis
        .replace(/\s+(has|have|with|for|in|on|at|by)\.?\s*$/i, "") // Remove trailing connectors
        .replace(/\s+/g, " ")
        .trim();

      if (cleaned.length < 10) {
        console.log(`⚠️ Recovery failed, keeping original name`);
        cleaned = name.trim();
      }
    }

    console.log(`✅ Final cleaned name: "${cleaned}"`);
    return cleaned;
  }

  /**
   * Enhanced Flipkart product validation (STRICT - rejects garbage text)
   */
  isValidFlipkartProduct(name) {
    if (!name || name.length < 5) return false;

    const nameLower = name.toLowerCase();

    // ✅ STRICT: Reject Flipkart loyalty program garbage text
    const flipkartGarbagePatterns = [
      // Flipkart rewards/loyalty program text
      /supercoin|saved using|early access|flipkart plus|coin.*used/i,
      /reward|loyalty|member|benefit|cashback|points/i,

      // HTML/CSS garbage
      /background-image|url\(https?|flipkart\.com/i,
      /\.css|\.js|font-family|<!DOCTYPE|<html/i,
      /align\s*=|center|src\s*=|style\s*=|class\s*=/i,
      /div|span|table|width|height|padding|margin/i,

      // E-commerce UI elements
      /track\s+order|view\s+order|customer\s+care/i,
      /return\s+policy|help\s+center|contact\s+us/i,
      /manage\s+order|download\s+app|unsubscribe/i,

      // Generic patterns
      /^[\d\s.,;:-]+$|^[a-f0-9]{10,}$/i,
      /flipkart\.com|noreply|email|notification/i,

      // Single word rejections
      /^(Item|Order|Shipment|Delivery|Payment|Total|Amount|Seller|Qty|Coin|Save|Using|Early|Access|Member)$/i,

      // Email signature/footer content
      /customer|support|care|help|policy|terms|privacy/i,
      /copyright|reserved|trademark|registered/i,

      // ✅ NEW: Specific Flipkart garbage patterns
      /coin\s*s?\s*(used|earned|credited)/i,
      /flipkart\s*plus\s*member/i,
      /supercoin.*(?:way|credited|earned)/i,
      /early\s*access.*member/i,
    ];

    const isValid = !flipkartGarbagePatterns.some((pattern) =>
      pattern.test(name)
    );

    if (!isValid) {
      console.log(
        `❌ FLIPKART: Rejected garbage text - ${name.substring(0, 50)}...`
      );
      return false;
    }

    // ✅ ADDITIONAL: Must look like a real product name
    const realProductIndicators = [
      /[A-Z][a-z]+\s+[A-Z][a-z]+/, // At least two capitalized words
      /\b(?:for|with|and|or|of)\b/i, // Common prepositions in product names
      /\b(?:boys?|girls?|kids?|children|year|old|house|tent|play|toy|set|pack)\b/i, // Product descriptors
    ];

    const looksLikeProduct = realProductIndicators.some((pattern) =>
      pattern.test(name)
    );

    if (!looksLikeProduct && name.length < 15) {
      console.log(
        `❌ FLIPKART: Rejected - doesn't look like product name: ${name}`
      );
      return false;
    }

    console.log(
      `✅ FLIPKART: Valid product name - ${name.substring(0, 40)}...`
    );
    return true;
  }

  /**
   * Map status consistently across email types (enhanced)
   */
  mapStatusConsistently(emailType, content) {
    console.log(`📊 Mapping status for email type: ${emailType}`);

    const contentLower = content.toLowerCase();

    switch (emailType) {
      case "order_confirmation":
        return "confirmed";

      case "shipping_notification":
        // Check if it's actually delivered
        if (
          contentLower.includes("delivered") ||
          contentLower.includes("delivery confirmed")
        ) {
          return "delivered";
        }
        return "shipped";

      case "delivery_notification":
        return "delivered";

      case "tracking_update":
        if (contentLower.includes("delivered")) return "delivered";
        if (contentLower.includes("out for delivery"))
          return "out_for_delivery";
        return "shipped";

      default:
        // Try to infer from content
        if (contentLower.includes("delivered")) return "delivered";
        if (
          contentLower.includes("shipped") ||
          contentLower.includes("dispatched")
        )
          return "shipped";
        if (
          contentLower.includes("confirmed") ||
          contentLower.includes("placed")
        )
          return "confirmed";
        return "ordered";
    }
  }

  /**
   * 📊 Calculate enhanced confidence score with comprehensive factors
   */
  calculateEnhancedConfidence(orderId, amount, products, emailType, metadata) {
    let confidence = 0;
    const factors = [];

    // Order ID validation (35% weight)
    if (orderId && this.isValidFlipkartOrderId(orderId)) {
      confidence += 0.35;
      factors.push("valid_order_id");
    }

    // Amount validation (25% weight)
    if (amount && amount > 0) {
      confidence += 0.25;
      factors.push("valid_amount");
    }

    // Products validation (25% weight)
    if (products && products.length > 0) {
      const hasRealProducts = products.some(
        (p) =>
          p.name &&
          p.name !== "Data not available in email" &&
          p.name.length > 10 &&
          !p.name.toLowerCase().includes("order")
      );
      confidence += hasRealProducts ? 0.25 : 0.15;
      factors.push(hasRealProducts ? "real_products" : "placeholder_products");
    }

    // Email type validation (10% weight)
    if (emailType !== "unknown") {
      confidence += 0.1;
      factors.push("identified_email_type");
    }

    // Bonus: Additional metadata (5% weight)
    let metadataBonus = 0;
    if (metadata.expectedDelivery) metadataBonus += 0.01;
    if (metadata.carrierName) metadataBonus += 0.01;
    if (metadata.sellerName) metadataBonus += 0.01;
    if (metadata.trackingId) metadataBonus += 0.02;

    confidence += metadataBonus;
    if (metadataBonus > 0) factors.push("additional_metadata");

    const finalConfidence = Math.round(Math.min(confidence, 1.0) * 100) / 100;

    console.log(
      `📊 FLIPKART: Confidence calculated - ${finalConfidence} (factors: ${factors.join(
        ", "
      )})`
    );

    return finalConfidence;
  }

  /**
   * 📊 Assess comprehensive data quality
   */
  assessDataQuality(orderId, amount, products, orderDate, metadata) {
    const quality = {
      // Core data assessment
      hasValidOrderId: !!orderId,
      hasAmount: !!(amount && amount > 0),
      hasProducts: !!(products && products.length > 0),
      hasRealProducts:
        products &&
        products.some(
          (p) =>
            p.name &&
            p.name !== "Data not available in email" &&
            p.name.length > 10 &&
            !p.name.toLowerCase().includes("order")
        ),
      hasValidDate: !!(orderDate && !isNaN(orderDate.getTime())),

      // Enhanced metadata assessment
      hasExpectedDelivery: !!(metadata && metadata.expectedDelivery),
      hasCarrierInfo: !!(metadata && metadata.carrierName),
      hasSellerInfo: !!(metadata && metadata.sellerName),
      hasTrackingInfo: !!(metadata && metadata.trackingId),
      hasContactInfo: !!(metadata && metadata.phoneNumber),

      // Calculated fields
      completeness: 0,
      metadataRichness: 0,
      issues: [],
      strengths: [],
    };

    // Calculate core completeness
    const coreFields = [
      "hasValidOrderId",
      "hasAmount",
      "hasProducts",
      "hasValidDate",
    ];
    const availableCoreFields = coreFields.filter((field) => quality[field]);
    quality.completeness = Math.round(
      (availableCoreFields.length / coreFields.length) * 100
    );

    // Calculate metadata richness
    const metadataFields = [
      "hasExpectedDelivery",
      "hasCarrierInfo",
      "hasSellerInfo",
      "hasTrackingInfo",
      "hasContactInfo",
    ];
    const availableMetadataFields = metadataFields.filter(
      (field) => quality[field]
    );
    quality.metadataRichness = Math.round(
      (availableMetadataFields.length / metadataFields.length) * 100
    );

    // Identify specific issues
    if (!quality.hasValidOrderId) quality.issues.push("missing_order_id");
    if (!quality.hasAmount) quality.issues.push("missing_amount");
    if (!quality.hasRealProducts)
      quality.issues.push("missing_product_details");
    if (!quality.hasValidDate) quality.issues.push("missing_order_date");

    // Identify strengths
    if (quality.hasValidOrderId) quality.strengths.push("valid_order_id");
    if (quality.hasAmount) quality.strengths.push("amount_extracted");
    if (quality.hasRealProducts) quality.strengths.push("real_product_names");
    if (quality.hasExpectedDelivery) quality.strengths.push("delivery_date");
    if (quality.hasCarrierInfo) quality.strengths.push("carrier_info");
    if (quality.hasSellerInfo) quality.strengths.push("seller_info");

    console.log(
      `📊 FLIPKART: Data quality - ${quality.completeness}% core complete, ${quality.metadataRichness}% metadata rich`
    );
    if (quality.issues.length > 0) {
      console.log(`⚠️ FLIPKART: Issues - ${quality.issues.join(", ")}`);
    }
    if (quality.strengths.length > 0) {
      console.log(`✅ FLIPKART: Strengths - ${quality.strengths.join(", ")}`);
    }

    return quality;
  }

  /**
   * 🧪 Test parser with real Flipkart email data
   */
  static testWithRealData() {
    console.log("🧪 TESTING FLIPKART PARSER WITH REAL EMAIL DATA:");
    console.log("=".repeat(60));

    const realEmailSamples = [
      {
        from: '"Flipkart.com" <no-reply@rmt.flipkart.com>',
        subject: "Gurukrupa Internationa... from your order has been shipped",
        html: `<p>Hi Rakesh Singh, An item from your order has been shipped.</p>
               <p>Order ID OD335092197400720100</p>
               <p>Delivery by Friday, Aug 08, 2025</p>
               <p>Item has been shipped via Ekart Logistics.</p>
               <p>Shipment total ₹. 804 + 44 coins</p>
               <img alt="Gurukrupa International Play Tent House for 3-13 Year Old Girls and Boys." src="image.jpg">
               <p>Seller: Gurukrupainternational</p>
               <p>Qty: 1</p>`,
        expected: {
          orderId: "OD335092197400720100",
          amount: 804,
          productName:
            "Gurukrupa International Play Tent House for 3-13 Year Old Girls and Boys",
          status: "shipped",
        },
      },
      {
        from: "Flipkart <noreply@nct.flipkart.com>",
        subject:
          "Your Order for Gurukrupa Internationa... has been successfully placed",
        html: `<p>Hi Rakesh Singh, Your order has been successfully placed.</p>
               <p>Order placed on Aug 01, 2025</p>
               <p>Order ID OD335092197400720100</p>
               <p>Delivery by Fri, Aug 08, 2025</p>
               <p>Amount Paid Rs. 804 + 44 coins</p>
               <img alt="Gurukrupa International Play Tent House for 3-13 Year Old Girls and Boys." src="image.jpg">
               <p>Seller: Gurukrupainternational</p>`,
        expected: {
          orderId: "OD335092197400720100",
          amount: 804,
          productName:
            "Gurukrupa International Play Tent House for 3-13 Year Old Girls and Boys",
          status: "confirmed",
        },
      },
    ];

    const parser = new FlipkartParser();
    let passedTests = 0;

    realEmailSamples.forEach((sample, index) => {
      console.log(`\n📧 Testing Sample ${index + 1}:`);
      console.log(`From: ${sample.from}`);
      console.log(`Subject: ${sample.subject}`);

      // Test canParse
      const canParse = FlipkartParser.canParse(sample);
      console.log(`canParse: ${canParse ? "✅ PASS" : "❌ FAIL"}`);

      if (canParse) {
        // Test parse
        const result = parser.parse(sample);

        if (result) {
          const tests = [
            {
              field: "orderId",
              expected: sample.expected.orderId,
              actual: result.orderId,
            },
            {
              field: "amount",
              expected: sample.expected.amount,
              actual: result.amount,
            },
            {
              field: "status",
              expected: sample.expected.status,
              actual: result.status,
            },
          ];

          let samplePassed = true;
          tests.forEach((test) => {
            const passed = test.expected === test.actual;
            console.log(
              `  ${test.field}: Expected "${test.expected}", Got "${
                test.actual
              }" ${passed ? "✅" : "❌"}`
            );
            if (!passed) samplePassed = false;
          });

          if (samplePassed) {
            passedTests++;
            console.log(`  📊 SAMPLE ${index + 1}: ✅ PASSED`);
          } else {
            console.log(`  📊 SAMPLE ${index + 1}: ❌ FAILED`);
          }
        } else {
          console.log(
            `  📊 SAMPLE ${index + 1}: ❌ FAILED (parse returned null)`
          );
        }
      } else {
        console.log(`  📊 SAMPLE ${index + 1}: ❌ FAILED (canParse failed)`);
      }
    });

    console.log(
      `\n📈 OVERALL TEST RESULTS: ${passedTests}/${realEmailSamples.length} samples passed`
    );
    return { passed: passedTests, total: realEmailSamples.length };
  }

  /**
   * 🔧 Utility method to extract tracking ID
   */
  extractTrackingId(content) {
    const trackingPatterns = [
      /tracking\s*(?:id|number)[:\s]*([A-Z0-9]{10,25})/gi,
      /awb\s*(?:number)?[:\s]*([A-Z0-9]{10,25})/gi,
      /shipment\s*(?:id|number)[:\s]*([A-Z0-9]{10,25})/gi,
    ];

    for (const pattern of trackingPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * 🎯 Get parser statistics for monitoring
   */
  static getParserStats() {
    return {
      platform: "flipkart",
      version: "enhanced_v2.1_product_name_fix",
      capabilities: [
        "Complete sender domain coverage",
        "Robust currency symbol handling",
        "Enhanced product name extraction with garbage rejection",
        "Advanced product name cleaning with connector word removal",
        "Comprehensive metadata extraction",
        "Advanced email type detection",
        "Improved confidence scoring",
      ],
      supportedSenders: [
        "flipkart.com",
        "nct.flipkart.com",
        "rmt.flipkart.com",
        "no-reply@rmt.flipkart.com",
        "noreply@nct.flipkart.com",
        "noreply@flipkart.com",
      ],
      supportedCurrencyFormats: ["₹", "₹.", "Rs.", "Ã¢â€šÂ¨", "INR"],
      supportedEmailTypes: [
        "order_confirmation",
        "shipping_notification",
        "delivery_notification",
        "tracking_update",
      ],
      productNameCleaning: [
        "Removes trailing dots and ellipsis",
        "Removes connector words (has, have, with, for, etc.)",
        "Removes platform suffixes",
        "Removes promotional text",
        "Validates product name authenticity",
        "Recovers from over-aggressive cleaning",
      ],
    };
  }
}

module.exports = FlipkartParser;
