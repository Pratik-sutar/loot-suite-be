const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class AmazonParser {
  constructor() {
    this.platform = "amazon";
  }

  /**
   * 🎯 COMPLETELY ENHANCED: Parse Amazon emails with MAXIMUM product extraction
   */
  parse(emailData) {
    console.log("🛒 Amazon: Starting ENHANCED V2 parsing...");
    console.log(`📧 Subject: ${emailData.subject}`);
    console.log(`📧 From: ${emailData.from}`);

    try {
      // Step 1: Clean HTML content
      const cleanContent = cleanHtml(emailData.html || emailData.text || "");
      console.log("✅ Amazon: HTML cleaned successfully");

      // Step 2: Detect email type
      const emailType = this.detectEmailType(emailData.subject, cleanContent);
      console.log(`📧 Amazon: Email type detected - ${emailType}`);

      // Step 3: Extract order ID(s)
      const orderIds = this.extractAllOrderIds(cleanContent, emailData.subject);

      if (orderIds.length === 0) {
        console.log("❌ Amazon: No order IDs found");
        return null;
      }

      const primaryOrderId = orderIds[0];
      console.log(`🎯 Amazon: Processing primary order - ${primaryOrderId}`);

      // Step 4: 🔧 ENHANCED: Multi-source product extraction
      const products = this.extractProductsEnhanced(
        emailData.subject,
        cleanContent,
        emailType,
        primaryOrderId
      );

      // Step 5: 🔧 ENHANCED: Multi-source amount extraction
      const amount = this.extractAmountEnhanced(
        cleanContent,
        emailData.subject,
        emailType
      );

      // Step 6: Extract additional data
      const trackingId = this.extractTrackingId(cleanContent);
      const orderDate = this.extractOrderDate(cleanContent, emailData.date);
      const status = this.extractOrderStatus(emailType, cleanContent);

      // Step 7: Build final order object with enhanced validation
      const orderInfo = {
        platform: this.platform,
        orderId: primaryOrderId,
        amount: amount || 0,
        formattedAmount: amount ? `₹${amount}` : "₹0",
        products: products,
        orderDate: orderDate,
        status: status,
        trackingId: trackingId,
        emailType: emailType,
        confidence: this.calculateEnhancedConfidence(
          primaryOrderId,
          amount,
          products,
          emailType
        ),
        additionalOrderIds: orderIds.slice(1),

        // 🔧 ENHANCED: Detailed extraction metadata
        extractionMetadata: {
          productExtractionMethod: this.getProductExtractionMethod(products),
          amountExtractionMethod: amount
            ? this.getAmountExtractionMethod(emailType)
            : "none",
          emailType: emailType,
          hasValidAmount: !!(amount && amount > 0),
          hasRealProductName: this.hasRealProductName(products),
          extractionQuality: this.assessExtractionQuality(products, amount),
        },
      };

      console.log("📊 Amazon: ENHANCED V2 parsing result:", {
        orderId: orderInfo.orderId,
        amount: orderInfo.amount,
        productName: orderInfo.products[0]?.name?.substring(0, 40),
        status: orderInfo.status,
        emailType: orderInfo.emailType,
        confidence: orderInfo.confidence,
        extractionQuality: orderInfo.extractionMetadata.extractionQuality,
      });

      return orderInfo;
    } catch (error) {
      console.error("❌ Amazon parser error:", error);
      return null;
    }
  }

  /**
   * 🎯 COMPLETELY ENHANCED: Multi-source product extraction with aggressive fallbacks
   */
  extractProductsEnhanced(subject, content, emailType, orderId) {
    console.log(`🎯 Amazon: ENHANCED multi-source product extraction...`);

    // METHOD 1: Subject line extraction (highest priority)
    console.log(`🔍 Method 1: Subject line extraction...`);
    const subjectProducts = this.extractProductFromSubjectEnhanced(subject);
    if (
      subjectProducts.length > 0 &&
      this.hasRealProductName(subjectProducts)
    ) {
      console.log(`✅ SUCCESS: Found real product in subject`);
      return subjectProducts;
    }

    // METHOD 2: Content structured patterns
    console.log(`🔍 Method 2: Content structured patterns...`);
    const contentProducts = this.extractProductFromContentEnhanced(
      content,
      orderId
    );
    if (
      contentProducts.length > 0 &&
      this.hasRealProductName(contentProducts)
    ) {
      console.log(`✅ SUCCESS: Found real product in content`);
      return contentProducts;
    }

    // METHOD 3: Aggressive subject parsing (lower standards)
    console.log(`🔍 Method 3: Aggressive subject parsing...`);
    const aggressiveProducts =
      this.extractProductAggressiveFromSubject(subject);
    if (
      aggressiveProducts.length > 0 &&
      this.hasRealProductName(aggressiveProducts)
    ) {
      console.log(`✅ SUCCESS: Found product with aggressive parsing`);
      return aggressiveProducts;
    }

    // METHOD 4: Content keyword search
    console.log(`🔍 Method 4: Content keyword search...`);
    const keywordProducts = this.extractProductFromKeywords(content);
    if (
      keywordProducts.length > 0 &&
      this.hasRealProductName(keywordProducts)
    ) {
      console.log(`✅ SUCCESS: Found product via keyword search`);
      return keywordProducts;
    }

    // METHOD 5: Create intelligent fallback
    console.log(`🔍 Method 5: Creating intelligent fallback...`);
    const intelligentFallback = this.createIntelligentFallback(
      subject,
      orderId,
      emailType
    );
    console.log(`📋 FALLBACK: Using intelligent fallback product name`);
    return [intelligentFallback];
  }

  /**
   * 🎯 ENHANCED: Better subject line extraction with more patterns
   */
  extractProductFromSubjectEnhanced(subject) {
    if (!subject) return [];

    console.log(`🎯 Amazon: ENHANCED subject extraction: "${subject}"`);

    // 🔧 COMPREHENSIVE Amazon subject patterns
    const enhancedSubjectPatterns = [
      // Standard Amazon formats
      /(?:Shipped|Delivered|Ordered):\s*"([^"]{5,120})"/i,
      /(?:Shipped|Delivered|Ordered):\s*([^\.]{8,100})\.{2,}/i,

      // Package/Item containing patterns
      /(?:Package|Item).*?(?:containing|with)\s*"?([^"\.]{8,80})"?/i,

      // Your order/item patterns
      /Your\s+(?:order|item)\s+(?:of\s+)?"?([^"\.]{8,80})"?.*?(?:has\s+been|was)/i,

      // Regarding patterns
      /regarding.*order.*?(?:containing|for|of)\s*"?([^"\.]{8,80})"?/i,

      // More flexible patterns
      /Amazon\.in[^:]*:\s*([A-Z][a-zA-Z0-9\s\-&.'(),]{8,80})(?:\.\.\.|\s+-\s+|$)/i,
      /Amazon[^:]*:\s*([A-Z][a-zA-Z0-9\s\-&.'(),]{8,80})(?:\.\.\.|\s+-\s+|$)/i,

      // Brand name patterns (common in Amazon)
      /\b([A-Z][A-Za-z]*\s+[A-Z][a-zA-Z0-9\s\-&.'(),]{5,60})(?:\s+has\s+been|\s+was|\s+is|\.\.\.)/i,

      // Product followed by action
      /\b([A-Z][a-zA-Z0-9\s\-&.'(),]{8,60})\s+(?:has\s+been\s+(?:delivered|shipped)|was\s+(?:delivered|shipped))/i,
    ];

    for (let i = 0; i < enhancedSubjectPatterns.length; i++) {
      const pattern = enhancedSubjectPatterns[i];
      const match = subject.match(pattern);

      if (match) {
        const productName = match[1].trim();
        console.log(
          `🔍 Amazon: Enhanced pattern ${i + 1} matched: "${productName}"`
        );

        const cleanName = this.cleanProductNameEnhanced(productName);

        if (this.isValidProductNameEnhanced(cleanName)) {
          console.log(
            `✅ Amazon: VALID enhanced product from subject - "${cleanName}"`
          );
          return [
            {
              name: cleanName,
              quantity: 1,
              price: 0,
              confidence: 95,
              source: "subject_enhanced",
              extractionPattern: i + 1,
            },
          ];
        }
      }
    }

    return [];
  }

  /**
   * 🎯 NEW: Aggressive subject parsing with lower standards
   */
  extractProductAggressiveFromSubject(subject) {
    if (!subject) return [];

    console.log(`🎯 Amazon: Aggressive subject parsing: "${subject}"`);

    // Remove common Amazon prefixes/suffixes to isolate product name
    let cleanSubject = subject
      .replace(/^.*?Amazon\.in[^:]*:\s*/i, "") // Remove "Amazon.in order update:"
      .replace(/^.*?Amazon[^:]*:\s*/i, "") // Remove "Amazon:"
      .replace(/\s+has\s+been.*$/i, "") // Remove "has been delivered"
      .replace(/\s+was\s+.*$/i, "") // Remove "was shipped"
      .replace(/\s+is\s+.*$/i, "") // Remove "is out for delivery"
      .replace(/^(?:Shipped|Delivered|Ordered):\s*/i, "") // Remove action prefixes
      .replace(/^(?:Your|The)\s+(?:order|item|package)\s+/i, "") // Remove "Your order"
      .replace(/^(?:Package|Item)\s+containing\s+/i, "") // Remove "Package containing"
      .replace(/\s*-\s*Amazon\.in.*$/i, "") // Remove "- Amazon.in" suffix
      .replace(/\.{2,}.*$/, "") // Remove ellipsis and everything after
      .trim();

    console.log(`🧹 Cleaned subject: "${cleanSubject}"`);

    if (cleanSubject.length >= 5 && cleanSubject.length <= 100) {
      const finalName = this.cleanProductNameEnhanced(cleanSubject);

      if (this.isValidProductNameAggressive(finalName)) {
        console.log(
          `✅ Amazon: AGGRESSIVE extraction success - "${finalName}"`
        );
        return [
          {
            name: finalName,
            quantity: 1,
            price: 0,
            confidence: 80,
            source: "subject_aggressive",
          },
        ];
      }
    }

    return [];
  }

  /**
   * 🔧 NEW: Extract products from content keywords
   */
  extractProductFromKeywords(content) {
    console.log(`🔍 Amazon: Keyword-based product extraction...`);

    // Look for common product name indicators in content
    const keywordPatterns = [
      // Product name after "Item:" or "Product:"
      /(?:Item|Product):\s*([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})/gi,

      // Product name in item listing
      /(?:1\s*x\s+|1\s+)([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})/gi,

      // Product name with price context
      /([A-Z][a-zA-Z0-9\s\-&.'()]{8,80})\s*(?:₹|Rs\.)\s*[\d,]+/g,

      // Brand followed by product
      /\b([A-Z]{2,}\s+[A-Za-z0-9\s\-&.'()]{5,60})\s*(?:₹|Rs\.|Price|Total)/gi,
    ];

    const foundProducts = [];

    for (const pattern of keywordPatterns) {
      const matches = [...content.matchAll(pattern)];

      for (const match of matches) {
        const productName = match[1].trim();
        const cleanName = this.cleanProductNameEnhanced(productName);

        if (this.isValidProductNameEnhanced(cleanName)) {
          // Check for duplicates
          const isDuplicate = foundProducts.some((p) =>
            this.areProductsSimilar(p.name, cleanName)
          );

          if (!isDuplicate) {
            foundProducts.push({
              name: cleanName,
              quantity: 1,
              price: 0,
              confidence: 75,
              source: "content_keywords",
            });

            console.log(`✅ Amazon keyword product: ${cleanName}`);
          }
        }
      }
    }

    return foundProducts;
  }

  /**
   * 🔧 ENHANCED: Multi-source amount extraction
   */
  extractAmountEnhanced(content, subject, emailType) {
    console.log(`💰 Amazon: ENHANCED amount extraction for ${emailType}...`);

    let amount = null;

    // METHOD 1: Primary content extraction
    amount = this.extractAmountFromContent(content, emailType);
    if (amount && amount > 0) {
      console.log(`✅ Amount from content: ₹${amount}`);
      return amount;
    }

    // METHOD 2: Subject line extraction (sometimes Amazon puts total in subject)
    amount = this.extractAmountFromSubject(subject);
    if (amount && amount > 0) {
      console.log(`✅ Amount from subject: ₹${amount}`);
      return amount;
    }

    // METHOD 3: Aggressive content search
    amount = this.extractAmountAggressive(content);
    if (amount && amount > 0) {
      console.log(`✅ Amount from aggressive search: ₹${amount}`);
      return amount;
    }

    console.log("❌ Amazon: No amount found with any method");
    return null;
  }

  /**
   * 🔧 ENHANCED: Primary amount extraction from content
   */
  extractAmountFromContent(content, emailType) {
    // Skip for pure delivery notifications
    if (
      emailType === "delivery_notification" ||
      emailType === "feedback_request"
    ) {
      return null;
    }

    const amountPatterns = [
      // High priority - clear total indicators
      {
        pattern:
          /(?:Grand\s*Total|Order\s*Total|Total\s*Amount|Final\s*Amount)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        priority: 100,
        name: "Order Total",
      },
      {
        pattern: /Shipment\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        priority: 95,
        name: "Shipment Total",
      },
      {
        pattern: /Amount\s*Paid[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        priority: 90,
        name: "Amount Paid",
      },
      {
        pattern: /Item\s*(?:Price|Total)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        priority: 85,
        name: "Item Price",
      },
      {
        pattern: /(?:Total|Price)[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        priority: 80,
        name: "Total/Price",
      },

      // Medium priority - contextual amounts
      {
        pattern:
          /₹\s*([\d,]+(?:\.\d{2})?)\s*(?:was\s+)?(?:paid|charged|total)/gi,
        priority: 70,
        name: "Contextual Amount",
      },

      // Lower priority - any rupee amount
      {
        pattern: /₹\s*([\d,]+(?:\.\d{2})?)/g,
        priority: 40,
        name: "Generic Rupee",
      },
    ];

    const foundAmounts = [];

    for (const { pattern, priority, name } of amountPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ""));

        // Enhanced validation
        if (!isNaN(amount) && amount > 0 && amount < 2000000) {
          // Stricter minimum for low priority patterns
          if (priority <= 40 && amount < 25) continue;

          // Skip suspiciously round numbers for low priority (likely not real amounts)
          if (priority <= 40 && amount % 100 === 0 && amount > 1000) continue;

          foundAmounts.push({
            amount,
            context: match[0],
            priority,
            patternName: name,
          });
        }
      }
    }

    if (foundAmounts.length > 0) {
      foundAmounts.sort(
        (a, b) => b.priority - a.priority || b.amount - a.amount
      );
      const selectedAmount = foundAmounts[0].amount;

      console.log(`✅ Amazon: Selected amount ₹${selectedAmount}`);
      console.log(`   Method: ${foundAmounts[0].patternName}`);
      console.log(`   Context: ${foundAmounts[0].context}`);

      return selectedAmount;
    }

    return null;
  }

  /**
   * 🔧 NEW: Extract amount from subject line
   */
  extractAmountFromSubject(subject) {
    if (!subject) return null;

    const subjectAmountPatterns = [
      /₹\s*([\d,]+(?:\.\d{2})?)/g,
      /Rs\.\s*([\d,]+(?:\.\d{2})?)/g,
      /INR\s*([\d,]+(?:\.\d{2})?)/g,
    ];

    for (const pattern of subjectAmountPatterns) {
      const matches = [...subject.matchAll(pattern)];
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount > 10 && amount < 500000) {
          console.log(`💰 Amazon: Amount from subject ₹${amount}`);
          return amount;
        }
      }
    }

    return null;
  }

  /**
   * 🔧 NEW: Aggressive amount search for edge cases
   */
  extractAmountAggressive(content) {
    // Look for any number pattern that could be an amount
    const aggressivePatterns = [
      // Numbers followed by rupee indicators
      /([\d,]+(?:\.\d{2})?)\s*(?:₹|Rs|INR|Rupees)/gi,

      // Numbers in typical amount contexts
      /(?:cost|price|amount|total|paid|charged).*?([\d,]+(?:\.\d{2})?)/gi,

      // Numbers near order context
      /order.*?([\d,]+(?:\.\d{2})?)/gi,
    ];

    const amounts = [];

    for (const pattern of aggressivePatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount >= 25 && amount <= 100000) {
          amounts.push(amount);
        }
      }
    }

    if (amounts.length > 0) {
      // Return most reasonable amount (not too small, not too large)
      const reasonableAmounts = amounts.filter((a) => a >= 50 && a <= 50000);
      if (reasonableAmounts.length > 0) {
        const selectedAmount = reasonableAmounts.sort((a, b) => b - a)[0]; // Prefer larger reasonable amounts
        console.log(`💰 Amazon: Aggressive amount ₹${selectedAmount}`);
        return selectedAmount;
      }
    }

    return null;
  }

  /**
   * 🔧 ENHANCED: Better content product extraction
   */
  extractProductFromContentEnhanced(content, orderId) {
    const products = [];
    const orderSection = this.extractOrderSection(content, orderId);

    // Enhanced content patterns with better targeting
    const enhancedContentPatterns = [
      // Clear product structure
      /(?:Item|Product):\s*([A-Z][a-zA-Z0-9\s\-&.'()]{8,100})\s*(?:Qty|Quantity|Price|₹)/gi,

      // Product with clear price
      /([A-Z][a-zA-Z0-9\s\-&.'()]{8,100})\s*(?:\([^)]*\))?\s*₹\s*([\d,]+(?:\.\d{2})?)/g,

      // Table-like structure
      /(\w[a-zA-Z0-9\s\-&.'()]{8,100})\s+₹\s*([\d,]+(?:\.\d{2})?)\s+₹\s*([\d,]+(?:\.\d{2})?)/g,

      // Quantity pattern
      /([A-Z][a-zA-Z0-9\s\-&.'()]{8,100})\s*Qty:\s*(\d+)\s*(?:₹\s*([\d,]+(?:\.\d{2})?))?/gi,

      // Brand and model pattern
      /\b([A-Z]{2,}[A-Za-z]*\s+[A-Za-z0-9\s\-&.'()]{5,80})\s*(?:₹|Price|Total)/gi,
    ];

    for (const pattern of enhancedContentPatterns) {
      const matches = [...orderSection.matchAll(pattern)];

      for (const match of matches) {
        const productName = match[1].trim();
        const price = match[2] ? parseFloat(match[2].replace(/,/g, "")) : 0;

        if (this.isValidProductNameEnhanced(productName)) {
          const cleanName = this.cleanProductNameEnhanced(productName);

          const isDuplicate = products.some((p) =>
            this.areProductsSimilar(p.name, cleanName)
          );

          if (!isDuplicate) {
            products.push({
              name: cleanName,
              quantity: match.length > 3 ? parseInt(match[2]) || 1 : 1,
              price: price || 0,
              confidence: 85,
              source: "content_enhanced",
            });

            console.log(
              `✅ Amazon enhanced content product: ${cleanName} - ₹${price}`
            );
          }
        }
      }
    }

    return products;
  }

  /**
   * 🔧 NEW: Create intelligent fallback product name
   */
  createIntelligentFallback(subject, orderId, emailType) {
    console.log(`🧠 Amazon: Creating intelligent fallback...`);

    // Try to extract ANY meaningful text from subject
    if (subject) {
      // Look for capitalized words that could be brand names
      const brandHints = subject.match(
        /\b[A-Z][A-Za-z]{2,15}(?:\s+[A-Z][A-Za-z]{2,15})?\b/g
      );

      if (brandHints) {
        for (const hint of brandHints) {
          const cleanHint = this.cleanProductNameEnhanced(hint);
          if (this.isReasonableProductHint(cleanHint)) {
            const fallbackName = `${cleanHint} (${this.getEmailTypeDescription(
              emailType
            )})`;
            console.log(
              `🎯 Amazon: Intelligent fallback with hint - "${fallbackName}"`
            );
            return {
              name: fallbackName,
              quantity: 1,
              price: 0,
              confidence: 60,
              source: "intelligent_fallback",
            };
          }
        }
      }

      // Look for any reasonable text sequence
      const textSequences = subject.match(
        /[A-Za-z][A-Za-z0-9\s\-&.'()]{4,30}/g
      );
      if (textSequences) {
        for (const sequence of textSequences) {
          const cleanSequence = this.cleanProductNameEnhanced(sequence);
          if (this.isReasonableProductHint(cleanSequence)) {
            const fallbackName = `${cleanSequence} (${this.getEmailTypeDescription(
              emailType
            )})`;
            console.log(
              `🎯 Amazon: Intelligent fallback with sequence - "${fallbackName}"`
            );
            return {
              name: fallbackName,
              quantity: 1,
              price: 0,
              confidence: 50,
              source: "intelligent_fallback",
            };
          }
        }
      }
    }

    // Final fallback
    const finalFallback = `Amazon ${this.getEmailTypeDescription(
      emailType
    )} ${orderId}`;
    console.log(`📋 Amazon: Using final fallback - "${finalFallback}"`);

    return {
      name: finalFallback,
      quantity: 1,
      price: 0,
      confidence: 30,
      source: "final_fallback",
    };
  }

  /**
   * 🔧 NEW: Get email type description for fallbacks
   */
  getEmailTypeDescription(emailType) {
    switch (emailType) {
      case "order_confirmation":
        return "Order";
      case "shipping_notification":
        return "Shipped Item";
      case "delivery_notification":
        return "Delivered Item";
      case "out_for_delivery":
        return "Out for Delivery";
      case "feedback_request":
        return "Item";
      default:
        return "Item";
    }
  }

  /**
   * 🔧 ENHANCED: Better product name validation with multiple tiers
   */
  isValidProductNameEnhanced(name) {
    if (!name || name.length < 3 || name.length > 150) return false;

    const nameLower = name.toLowerCase().trim();

    // Tier 1: Absolute rejects (unchanged)
    const absoluteRejects = [
      /^(amazon|order|delivered|shipped|confirmation|notification|email|package|item|shipment)$/i,
      /^(your|the|this|that|has|been|was|will|can|may|should|dear|hello|hi|thanks|thank|regarding)$/i,
      /background|url\(|media-amazon|\.css|\.js|font-family|DOCTYPE|html|style=|class=|src=/i,
      /^[\d\s.,;:-]+$/,
      /^[a-f0-9]{8,}$/i,
      /http|www\.|\.com|\.in|mailto|@/i,
    ];

    for (const pattern of absoluteRejects) {
      if (pattern.test(nameLower)) {
        return false;
      }
    }

    // Tier 2: Enhanced validation for real products
    return this.isValidProductNameAggressive(name);
  }

  /**
   * 🔧 NEW: More lenient validation for aggressive extraction
   */
  isValidProductNameAggressive(name) {
    if (!name || name.length < 3) return false;

    const nameLower = name.toLowerCase().trim();

    // Still reject obvious non-products but be more lenient
    const aggressiveRejects = [
      /^(amazon|order|delivered|shipped|confirmation|notification|email)$/i,
      /^(your|the|this|that|has|been|was|will)$/i,
      /^[\d\s.,;:-]+$/,
      /^[a-f0-9]{8,}$/i,
      /\.com|\.in|mailto|@/i,
    ];

    for (const pattern of aggressiveRejects) {
      if (pattern.test(nameLower)) {
        return false;
      }
    }

    // Must have some meaningful alphabetic content
    const alphaCount = (name.match(/[a-zA-Z]/g) || []).length;
    return alphaCount >= 3;
  }

  /**
   * 🔧 ENHANCED: Product name cleaning with better preservation
   */
  cleanProductNameEnhanced(name) {
    if (!name) return "";

    return (
      name
        // Remove HTML entities
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#8377;/g, "₹")
        .replace(/&[a-z]+;/gi, " ")

        // Clean whitespace and special chars (but preserve meaningful punctuation)
        .replace(/\s+/g, " ")
        .replace(/[<>]/g, "")
        .replace(/^\W+|\W+$/g, "")

        // Normalize ellipsis
        .replace(/\.{3,}/, "...")

        // Trim and limit length
        .substring(0, 120)
        .trim()
    );
  }

  /**
   * 🔧 NEW: Check if we have a real product name
   */
  hasRealProductName(products) {
    if (!products || products.length === 0) return false;

    const productName = products[0].name || "";

    return (
      productName &&
      !productName.includes("Amazon Order") &&
      !productName.includes("Delivered Item") &&
      !productName.includes("Shipped Item") &&
      !productName.includes("Data not available") &&
      productName.length > 5
    );
  }

  /**
   * 🔧 NEW: Get product extraction method for debugging
   */
  getProductExtractionMethod(products) {
    if (!products || products.length === 0) return "none";
    return products[0].source || "unknown";
  }

  /**
   * 🔧 NEW: Get amount extraction method for debugging
   */
  getAmountExtractionMethod(emailType) {
    switch (emailType) {
      case "order_confirmation":
        return "content_structured";
      case "shipping_notification":
        return "subject_or_content";
      case "delivery_notification":
        return "aggressive_search";
      default:
        return "multi_method";
    }
  }

  /**
   * 🔧 NEW: Assess overall extraction quality
   */
  assessExtractionQuality(products, amount) {
    let score = 0;

    // Product quality
    if (this.hasRealProductName(products)) {
      score += 50;
      if (products[0].name.length > 15) score += 10;
      if (products[0].name.split(" ").length >= 3) score += 10;
    } else {
      score += 20; // Some points for having any product name
    }

    // Amount quality
    if (amount && amount > 0) {
      score += 30;
    }

    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "fair";
    return "poor";
  }

  /**
   * 🔧 ENHANCED: Better confidence calculation
   */
  calculateEnhancedConfidence(orderId, amount, products, emailType) {
    let confidence = 0;

    // Order ID (essential)
    if (orderId && this.isValidAmazonOrderId(orderId)) {
      confidence += 0.3;
    }

    // Real product name (critical)
    if (this.hasRealProductName(products)) {
      confidence += 0.4; // Higher weight for real products

      // Extra for high-quality product names
      const productName = products[0].name || "";
      if (productName.length > 15) confidence += 0.1;
      if (productName.split(" ").length >= 3) confidence += 0.05;
    } else {
      confidence += 0.1; // Some points for any product
    }

    // Amount (varies by email type)
    if (amount && amount > 0) {
      if (emailType === "order_confirmation") {
        confidence += 0.2; // Expected to have amount
      } else {
        confidence += 0.1; // Bonus if other email types have amount
      }
    }

    // Email type detection
    if (emailType !== "unknown") {
      confidence += 0.05;
    }

    return Math.round(Math.min(confidence, 0.95) * 100) / 100;
  }

  // 🔧 UTILITY METHODS (enhanced)

  isReasonableProductHint(text) {
    if (!text || text.length < 3 || text.length > 80) return false;

    const textLower = text.toLowerCase();

    // Enhanced reject patterns
    const rejectPatterns = [
      /^(amazon|order|delivered|shipped|confirmation|notification|email|dear|hello|hi|thanks|thank|regarding)$/i,
      /^(your|the|this|that|has|been|was|will|can|may|should)$/i,
      /^\d+$/,
      /order|email|amazon|delivered|shipped|tracking|confirmation/i,
    ];

    const isRejected = rejectPatterns.some((pattern) =>
      pattern.test(textLower)
    );
    if (isRejected) return false;

    // Must have meaningful alphabetic content
    const hasAlpha = /[a-zA-Z]{3,}/.test(text);

    // Prefer text that looks like brand names (starts with capital)
    const looksLikeBrand = /^[A-Z]/.test(text);

    return hasAlpha && (looksLikeBrand || text.length >= 5);
  }

  extractOrderSection(content, orderId) {
    const orderIdIndex = content.indexOf(orderId);
    if (orderIdIndex === -1) return content;

    // Extract larger section for better context
    const start = Math.max(0, orderIdIndex - 1200);
    const end = Math.min(content.length, orderIdIndex + 1200);

    const section = content.substring(start, end);
    console.log(
      `📄 Amazon: Extracted section for ${orderId} (${section.length} chars)`
    );

    return section;
  }

  /**
   * 🔧 ENHANCED: All order ID extraction patterns
   */
  extractAllOrderIds(content, subject) {
    const orderIds = new Set();

    const orderIdPatterns = [
      /\b(\d{3}-\d{7,8}-\d{7,8})\b/g,
      /Order\s*#?\s*(\d{3}-\d{7,8}-\d{7,8})/gi,
      /orderID=(\d{3}-\d{7,8}-\d{7,8})/gi,
      /order\s*(?:number|id)?\s*[:=]\s*(\d{3}-\d{7,8}-\d{7,8})/gi,
    ];

    // Check subject first (higher priority)
    if (subject) {
      for (const pattern of orderIdPatterns) {
        const matches = [...subject.matchAll(pattern)];
        for (const match of matches) {
          if (this.isValidAmazonOrderId(match[1])) {
            orderIds.add(match[1]);
            console.log(`🎯 Amazon: Order ID from subject - ${match[1]}`);
          }
        }
      }
    }

    // Then check content
    for (const pattern of orderIdPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        if (this.isValidAmazonOrderId(match[1])) {
          orderIds.add(match[1]);
          console.log(`📄 Amazon: Order ID from content - ${match[1]}`);
        }
      }
    }

    console.log(
      `📋 Amazon: Found ${orderIds.size} order IDs: ${Array.from(orderIds).join(
        ", "
      )}`
    );
    return Array.from(orderIds);
  }

  isValidAmazonOrderId(orderId) {
    if (!orderId) return false;
    const amazonFormat = /^\d{3}-\d{7,8}-\d{7,8}$/;
    return (
      amazonFormat.test(orderId) && !orderId.includes("000-0000000-0000000")
    );
  }

  areProductsSimilar(name1, name2) {
    if (!name1 || !name2) return false;

    const normalize = (str) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const clean1 = normalize(name1);
    const clean2 = normalize(name2);

    return clean1.includes(clean2) || clean2.includes(clean1);
  }

  /**
   * 🔧 ENHANCED: Email type detection
   */
  detectEmailType(subject, content) {
    if (!subject) return "unknown";

    const subjectLower = subject.toLowerCase();
    const contentLower = content.toLowerCase();

    // Order confirmation emails (highest priority - usually has amounts)
    if (
      subjectLower.includes("ordered:") ||
      subjectLower.includes("thank you for your order") ||
      subjectLower.includes("order confirmation") ||
      contentLower.includes("thanks for your order") ||
      contentLower.includes("order total") ||
      contentLower.includes("amount paid")
    ) {
      return "order_confirmation";
    }

    // Shipping notification emails
    if (
      subjectLower.includes("shipped:") ||
      subjectLower.includes("dispatched") ||
      subjectLower.includes("on the way") ||
      contentLower.includes("your package was shipped") ||
      contentLower.includes("item(s) dispatched")
    ) {
      return "shipping_notification";
    }

    // Out for delivery
    if (
      subjectLower.includes("out for delivery") ||
      contentLower.includes("out for delivery") ||
      contentLower.includes("will be delivered between")
    ) {
      return "out_for_delivery";
    }

    // Delivery notification emails
    if (
      subjectLower.includes("delivered:") ||
      subjectLower.includes("package has been delivered") ||
      contentLower.includes("your package has been delivered")
    ) {
      return "delivery_notification";
    }

    // Feedback request emails
    if (
      subjectLower.includes("regarding your recent order") ||
      contentLower.includes("share your experience") ||
      contentLower.includes("rate and review")
    ) {
      return "feedback_request";
    }

    return "notification";
  }

  extractTrackingId(content) {
    const trackingPatterns = [
      /trackingId=([A-Z0-9]+)/gi,
      /Your tracking number is:\s*([A-Z0-9]{10,20})/gi,
      /tracking.*?number.*?([A-Z0-9]{10,20})/gi,
      /Track.*?package.*?([A-Z0-9]{10,20})/gi,
    ];

    for (const pattern of trackingPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        console.log(`📦 Amazon: Found tracking ID - ${match[1]}`);
        return match[1];
      }
    }

    return null;
  }

  extractOrderDate(content, emailDate) {
    const datePatterns = [
      /Order Date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
      /Placed on[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
      /Date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const extractedDate = new Date(match[1]);
        console.log(
          `📅 Amazon: Extracted order date - ${extractedDate.toDateString()}`
        );
        return extractedDate;
      }
    }

    const fallbackDate = emailDate ? new Date(emailDate) : new Date();
    return fallbackDate;
  }

  extractOrderStatus(emailType, content) {
    switch (emailType) {
      case "order_confirmation":
        return "confirmed";
      case "shipping_notification":
        return "shipped";
      case "out_for_delivery":
        return "out_for_delivery";
      case "delivery_notification":
        return "delivered";
      case "feedback_request":
        return "delivered";
      default:
        return "unknown";
    }
  }

  /**
   * 🔧 ENHANCED: Email validation
   */
  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    // Must be from Amazon
    const isAmazon =
      from.includes("amazon.in") ||
      from.includes("amazon.com") ||
      from.includes("@amazon");

    if (!isAmazon) {
      return false;
    }

    // Must have order indicators
    const orderIndicators = [
      "order",
      "delivered",
      "shipped",
      "dispatched",
      "tracking",
      "confirmation",
      "package",
      "delivery",
      "shipment",
      "ordered:",
      "shipped:",
      "delivered:",
      "regarding your recent order",
    ];

    const hasOrderKeyword = orderIndicators.some((keyword) =>
      subject.includes(keyword)
    );

    // Reject promotional emails
    const rejectPatterns = [
      "newsletter",
      "recommendation",
      "deals",
      "offer",
      "discount",
      "sale",
      "wishlist",
      "browse",
      "explore",
      "subscribe",
      "unsubscribe",
    ];

    const isPromo = rejectPatterns.some((pattern) => subject.includes(pattern));

    if (isPromo) {
      return false;
    }

    return hasOrderKeyword;
  }

  // Legacy compatibility methods
  static hasStatusChanged(existingOrder, newOrder) {
    if (!existingOrder || !newOrder) return true;
    if (existingOrder.orderId !== newOrder.orderId) return true;
    return existingOrder.status !== newOrder.status;
  }

  static getStatusPriority(status) {
    const priorities = {
      unknown: 0,
      confirmed: 1,
      processing: 2,
      shipped: 3,
      out_for_delivery: 4,
      delivered: 5,
    };
    return priorities[status] || 0;
  }

  static isStatusProgression(oldStatus, newStatus) {
    const oldPriority = this.getStatusPriority(oldStatus);
    const newPriority = this.getStatusPriority(newStatus);
    return newPriority > oldPriority;
  }

  static shouldUpdateOrder(existingOrder, newOrder) {
    if (!existingOrder) {
      return { shouldUpdate: true, reason: "new_order" };
    }

    if (existingOrder.orderId !== newOrder.orderId) {
      return { shouldUpdate: true, reason: "different_order" };
    }

    const statusChanged = existingOrder.status !== newOrder.status;
    const statusProgression = this.isStatusProgression(
      existingOrder.status,
      newOrder.status
    );
    const amountAdded = !existingOrder.amount && newOrder.amount > 0;
    const trackingAdded = !existingOrder.trackingId && newOrder.trackingId;

    const shouldUpdate =
      (statusChanged && statusProgression) || amountAdded || trackingAdded;

    if (statusChanged && !statusProgression) {
      return { shouldUpdate: false, reason: "status_regression" };
    }

    const reason = shouldUpdate
      ? statusChanged
        ? "status_progression"
        : amountAdded
        ? "amount_added"
        : "tracking_added"
      : "no_change";

    return { shouldUpdate, reason };
  }
}

module.exports = AmazonParser;
