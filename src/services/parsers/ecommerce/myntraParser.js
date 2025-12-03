// src/services/parsers/myntraParser.js - UPDATED WITH PRECISE PATTERNS

const { PLATFORMS, ORDER_STATUS } = require("../../../constants");

/**
 * Myntra-specific email parser - Updated for accurate extraction
 */
class MyntraParser {
  constructor() {
    this.platform = PLATFORMS.MYNTRA;
  }

  /**
   * Check if email is from Myntra
   */
  isFromMyntra(from) {
    if (!from) return false;
    const fromLower = from.toLowerCase();
    return (
      fromLower.includes("myntra.com") ||
      fromLower.includes("@myntra") ||
      fromLower.includes("updates@myntra")
    );
  }

  /**
   * Check if subject indicates order email
   */
  isOrderEmail(subject) {
    if (!subject) return false;
    const subjectLower = subject.toLowerCase();

    const orderKeywords = [
      "order",
      "delivered",
      "shipped",
      "out for delivery",
      "dispatched",
      "confirmation",
      "myntra order",
    ];

    return orderKeywords.some((keyword) => subjectLower.includes(keyword));
  }

  /**
   * Check if this parser can handle the given email
   */
  canParse(email) {
    return this.isFromMyntra(email.sender) && this.isOrderEmail(email.subject);
  }

  /**
   * Extract text content from HTML
   */
  extractTextFromHtml(html) {
    if (!html) return "";

    return html
      .replace(/<script[^>]*>.*?<\/script>/gis, "")
      .replace(/<style[^>]*>.*?<\/style>/gis, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#8377;/g, "₹")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract order ID from Myntra email - Updated with precise patterns
   */
  extractOrderId(content) {
    console.log("🔍 Myntra: Extracting order ID...");

    // Primary pattern: Look for id="OrderId" elements
    const orderIdPattern = /id="OrderId"[^>]*>([^<]+)</i;
    const orderIdMatch = content.match(orderIdPattern);

    if (orderIdMatch) {
      const orderId = orderIdMatch[1].trim();
      // Check if this looks like a tracking ID (starts with MYSP) vs order ID
      if (orderId.startsWith("MYSP")) {
        console.log(
          `🔗 Found tracking ID: ${orderId} (will use as order reference)`
        );
      } else {
        console.log(`✅ Found Myntra order ID: ${orderId}`);
      }
      return orderId;
    }

    // Fallback patterns for different email formats
    const fallbackPatterns = [
      /order\s*(?:id|number|#)\s*[:\-]?\s*([A-Z0-9\-]{8,30})/gi,
      /myntra\s*order\s*[:\-]?\s*([A-Z0-9\-]{8,30})/gi,
      /orderid[=%]([A-Z0-9\-]{8,30})/gi,
    ];

    for (const pattern of fallbackPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const orderId = match[1];
        if (this.isValidMyntraOrderId(orderId)) {
          console.log(`✅ Found valid Myntra order ID (fallback): ${orderId}`);
          return orderId;
        }
      }
    }

    console.log("❌ No valid Myntra order ID found");
    return null;
  }

  /**
   * Extract tracking ID from Myntra email
   */
  extractTrackingId(content) {
    // Look for tracking ID pattern
    const trackingPattern =
      /Your Tracking Id\s*:\s*<\/li>\s*<li[^>]*>([^<]+)</i;
    const trackingMatch = content.match(trackingPattern);

    if (trackingMatch) {
      const trackingId = trackingMatch[1].trim();
      console.log(`✅ Found tracking ID: ${trackingId}`);
      return trackingId;
    }

    return null;
  }

  /**
   * Validate Myntra order ID format
   */
  isValidMyntraOrderId(orderId) {
    if (!orderId || typeof orderId !== "string") return false;

    // Invalid patterns to reject
    const invalidValues = [
      "value",
      "table",
      "radius",
      "ffffff",
      "style",
      "width",
      "height",
      "myntra",
      "order",
      "email",
      "delivery",
      "update",
      "feedback",
      "delivered",
      "shipped",
      "html",
      "body",
      "head",
      "script",
    ];

    const orderIdLower = orderId.toLowerCase();

    // Reject common invalid values
    if (invalidValues.includes(orderIdLower)) {
      return false;
    }

    // Myntra order IDs can be:
    // 1. Traditional format: XXXXXXX-XXXXXXX-XXXXXXX (like 1305941-2745460-2374103)
    // 2. Tracking ID format: MYSXXXXXXXXX (like MYSP1275849951)
    if (orderId.length < 6 || orderId.length > 35) {
      return false;
    }

    // Must contain at least some alphanumeric characters
    if (!/[A-Z0-9]/i.test(orderId)) {
      return false;
    }

    // Accept both traditional order IDs and tracking IDs
    return true;
  }

  /**
   * Extract order amount from Myntra email - Updated with precise patterns
   */
  extractOrderAmount(content) {
    console.log("💰 Extracting order amount...");

    // Primary pattern: Look for Net Paid amount
    const netPaidPattern = /Net Paid[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const netPaidMatch = content.match(netPaidPattern);

    if (netPaidMatch) {
      const amount = parseFloat(netPaidMatch[1].replace(/,/g, ""));
      console.log(`✅ Found Net Paid amount: ₹${amount}`);
      return amount;
    }

    // Secondary pattern: Look for Total paid amount
    const totalPaidPattern = /Total paid[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const totalPaidMatch = content.match(totalPaidPattern);

    if (totalPaidMatch) {
      const amount = parseFloat(totalPaidMatch[1].replace(/,/g, ""));
      console.log(`✅ Found Total Paid amount: ₹${amount}`);
      return amount;
    }

    // Fallback: Look for Total Amount
    const totalAmountPattern = /Total Amount[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const totalAmountMatch = content.match(totalAmountPattern);

    if (totalAmountMatch) {
      const amount = parseFloat(totalAmountMatch[1].replace(/,/g, ""));
      console.log(`✅ Found Total Amount: ₹${amount}`);
      return amount;
    }

    // Other fallback patterns
    const fallbackPatterns = [
      /(?:total|amount|paid|grand total)\s*[:\-]?\s*&#8377;\s*([\d,]+\.?\d*)/gi,
      /&#8377;\s*([\d,]+\.?\d*)/g,
    ];

    for (const pattern of fallbackPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount > 0 && amount < 1000000) {
          console.log(`✅ Found amount (fallback): ₹${amount}`);
          return amount;
        }
      }
    }

    console.log("❌ No valid amount found in Myntra email");
    return null;
  }

  /**
   * Extract order status from Myntra email - Updated patterns
   */
  extractOrderStatus(content, subject) {
    const contentLower = content.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Check for specific status patterns in content first (more reliable)
    if (contentLower.includes("arriving today")) {
      return ORDER_STATUS.OUT_FOR_DELIVERY;
    }
    if (
      contentLower.includes("delivered") ||
      contentLower.includes("successfully delivered")
    ) {
      return ORDER_STATUS.DELIVERED;
    }
    if (
      contentLower.includes("we've shipped") ||
      contentLower.includes("shipped your")
    ) {
      return ORDER_STATUS.SHIPPED;
    }
    if (
      contentLower.includes("order is confirmed") ||
      contentLower.includes("sit back and relax")
    ) {
      return ORDER_STATUS.CONFIRMED;
    }
    if (
      contentLower.includes("cancelled") ||
      contentLower.includes("canceled")
    ) {
      return ORDER_STATUS.CANCELLED;
    }

    // Check subject for status indicators
    if (subjectLower.includes("confirmation")) {
      return ORDER_STATUS.CONFIRMED;
    }
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("has been shipped")
    ) {
      return ORDER_STATUS.SHIPPED;
    }
    if (
      subjectLower.includes("out for delivery") ||
      subjectLower.includes("delivery")
    ) {
      return ORDER_STATUS.OUT_FOR_DELIVERY;
    }
    if (subjectLower.includes("delivered")) {
      return ORDER_STATUS.DELIVERED;
    }

    return ORDER_STATUS.ORDERED;
  }

  /**
   * Extract order date from Myntra email
   */
  extractOrderDate(content) {
    // Look for date patterns in the status text
    const datePatterns = [
      /on\s+([\w,\s\d]+)/i,
      /PacketCreationTimeId[^>]*>\s*on\s+([\w,\s\d]+)/i,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const dateStr = match[1].trim();
        console.log(`📅 Found date string: ${dateStr}`);

        // Parse the date string (e.g., "Fri, 01 Aug")
        const currentYear = new Date().getFullYear();
        const parsedDate = new Date(`${dateStr} ${currentYear}`);

        if (!isNaN(parsedDate.getTime())) {
          console.log(`✅ Parsed order date: ${parsedDate.toISOString()}`);
          return parsedDate;
        }
      }
    }

    console.log("❌ No valid order date found, using current date");
    return new Date();
  }

  /**
   * Extract product information from Myntra email - Updated with precise patterns
   */
  extractProductInfo(content) {
    console.log("🛍️ Extracting product information...");

    // Extract brand name
    const brandPattern = /ItemProductBrandName[^>]*>([^<]+)</i;
    const brandMatch = content.match(brandPattern);
    const brand = brandMatch ? brandMatch[1].trim() : "";

    // Extract product name
    const productNamePattern = /ItemProductName[^>]*>([^<]+)</i;
    const productNameMatch = content.match(productNamePattern);
    const productName = productNameMatch
      ? productNameMatch[1].trim().replace(/&nbsp;/g, " ")
      : "";

    // Extract size - handle multiple patterns
    let size = "";
    const sizePatterns = [
      /Size<span[^>]*>([^<]+)</i,
      /Size\s+<span[^>]*>([^<]+)</i,
      /Size\s*<span[^>]*>\s*([^<]+)</i,
    ];

    for (const pattern of sizePatterns) {
      const sizeMatch = content.match(pattern);
      if (sizeMatch) {
        size = sizeMatch[1].trim();
        break;
      }
    }

    // Extract quantity - handle multiple patterns
    let quantity = 1;
    const qtyPatterns = [
      /Qty<span[^>]*>([^<]+)</i,
      /Qty\s+<span[^>]*>([^<]+)</i,
      /Qty\s*<span[^>]*>\s*([^<]+)</i,
    ];

    for (const pattern of qtyPatterns) {
      const qtyMatch = content.match(pattern);
      if (qtyMatch) {
        const parsedQty = parseInt(qtyMatch[1].trim());
        if (!isNaN(parsedQty)) {
          quantity = parsedQty;
          break;
        }
      }
    }

    // Extract item price (discounted price)
    const itemPricePattern = /ItemTotal[^>]*>\s*&#8377;([\d,]+\.?\d*)/i;
    const itemPriceMatch = content.match(itemPricePattern);
    const itemPrice = itemPriceMatch
      ? parseFloat(itemPriceMatch[1].replace(/,/g, ""))
      : 0;

    // Extract original price
    const originalPricePattern = /ItemPrice[^>]*>\s*&#8377;([\d,]+\.?\d*)/i;
    const originalPriceMatch = content.match(originalPricePattern);
    const originalPrice = originalPriceMatch
      ? parseFloat(originalPriceMatch[1].replace(/,/g, ""))
      : itemPrice;

    // Build full product name
    const fullProductName =
      brand && productName
        ? `${brand} - ${productName}`
        : brand || productName || "Myntra Order";

    const productInfo = {
      name: fullProductName,
      brand: brand,
      size: size,
      quantity: quantity,
      price: itemPrice,
      original_price: originalPrice,
      unit_price: itemPrice,
      total_price: itemPrice * quantity,
    };

    console.log(
      `🎯 Extracted product: ${JSON.stringify(productInfo, null, 2)}`
    );
    return productInfo;
  }

  /**
   * Extract seller information
   */
  extractSellerInfo(content) {
    const sellerPattern = /Sold by:\s*([^<]+)/i;
    const sellerMatch = content.match(sellerPattern);
    return sellerMatch ? sellerMatch[1].trim() : null;
  }

  /**
   * Extract delivery address
   */
  extractDeliveryAddress(content) {
    // Look for address in the "Delivering to" or "Shipped to" section
    const addressPattern =
      /(?:Delivering|Shipped)\s+(?:at|to)[\s\S]*?<span[^>]*><strong[^>]*>([^<]+)<\/strong>,<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>,[\s\S]*?<span[^>]*>([^<]+)<\/span>,[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>(\d+)<\/span>/i;
    const addressMatch = content.match(addressPattern);

    if (addressMatch) {
      return {
        name: addressMatch[1].trim(),
        address: addressMatch[2].trim(),
        locality: addressMatch[3].trim(),
        city: addressMatch[4].trim(),
        state: addressMatch[5].trim(),
        pincode: addressMatch[6].trim(),
      };
    }

    // Fallback: Simpler pattern
    const simpleAddressPattern =
      /ReceiverName[^>]*>([^<]+)[\s\S]*?AddressId[^>]*>([^<]+)[\s\S]*?LocalityId[^>]*>([^<]+)[\s\S]*?CityId[^>]*>([^<]+)[\s\S]*?StateId[^>]*>([^<]+)[\s\S]*?ZipcodeId[^>]*>(\d+)/i;
    const simpleAddressMatch = content.match(simpleAddressPattern);

    if (simpleAddressMatch) {
      return {
        name: simpleAddressMatch[1].trim().replace(/<[^>]+>/g, ""),
        address: simpleAddressMatch[2].trim(),
        locality: simpleAddressMatch[3].trim(),
        city: simpleAddressMatch[4].trim(),
        state: simpleAddressMatch[5].trim(),
        pincode: simpleAddressMatch[6].trim(),
      };
    }

    return null;
  }

  /**
   * Main parsing method - Updated with order linking support
   */
  parse({ from, subject, html, text }) {
    console.log("\n🏷️ Myntra Parser - Starting enhanced parse...");
    console.log(`From: ${from}`);
    console.log(`Subject: ${subject}`);

    if (!this.isFromMyntra(from)) {
      console.log("❌ Not from Myntra");
      return null;
    }

    if (!this.isOrderEmail(subject)) {
      console.log("❌ Not a Myntra order email");
      return null;
    }

    const content = html || text || "";
    console.log(`Content length: ${content.length}`);

    // Extract core information
    const orderId = this.extractOrderId(content);
    const trackingId = this.extractTrackingId(content);

    // For linking purposes, we need at least one ID
    if (!orderId && !trackingId) {
      console.log("❌ No valid order or tracking ID found - cannot parse");
      return null;
    }

    const status = this.extractOrderStatus(content, subject);
    const amount = this.extractOrderAmount(content);
    const orderDate = this.extractOrderDate(content);
    const productInfo = this.extractProductInfo(content);
    const sellerInfo = this.extractSellerInfo(content);
    const deliveryAddress = this.extractDeliveryAddress(content);

    const items = [productInfo];

    // Generate order key for linking
    const orderKey = this.generateOrderKey(
      productInfo.name,
      amount,
      deliveryAddress
    );

    // Determine email type
    const emailType = this.determineEmailType(content, subject);

    const parsedOrder = {
      platform: this.platform,
      orderId: orderId || null,
      trackingId: trackingId || null,
      orderKey: orderKey, // For linking related emails
      amount: amount || null,
      items,
      status,
      orderDate: orderDate,
      seller: sellerInfo,
      deliveryAddress: deliveryAddress,
      emailType: emailType,
      confidence: this.calculateConfidenceScore({
        orderId,
        trackingId,
        amount,
        items,
        status,
      }),
      rawData: {
        subject,
        from,
        extractedAt: new Date(),
      },
    };

    console.log("✅ Myntra Parser - Successfully parsed:");
    console.log(`  Order ID: ${parsedOrder.orderId || "Not available"}`);
    console.log(`  Tracking ID: ${parsedOrder.trackingId || "Not available"}`);
    console.log(`  Order Key: ${parsedOrder.orderKey}`);
    console.log(`  Email Type: ${parsedOrder.emailType}`);
    console.log(`  Status: ${parsedOrder.status}`);
    console.log(
      `  Amount: ${
        parsedOrder.amount ? `₹${parsedOrder.amount}` : "Not available"
      }`
    );
    console.log(`  Order Date: ${parsedOrder.orderDate.toDateString()}`);
    console.log(`  Product: ${items[0].name}`);
    console.log(`  Quantity: ${items[0].quantity}`);
    console.log(`  Size: ${items[0].size || "Not specified"}`);
    console.log(`  Seller: ${parsedOrder.seller || "Not available"}`);
    console.log(`  Confidence: ${(parsedOrder.confidence * 100).toFixed(1)}%`);

    return parsedOrder;
  }

  /**
   * Determine email type based on content and subject
   */
  determineEmailType(content, subject) {
    const contentLower = content.toLowerCase();
    const subjectLower = subject.toLowerCase();

    if (
      subjectLower.includes("confirmation") ||
      contentLower.includes("sit back and relax")
    ) {
      return "order_confirmation";
    }
    if (
      subjectLower.includes("shipped") ||
      contentLower.includes("we've shipped")
    ) {
      return "shipping_notification";
    }
    if (
      subjectLower.includes("out for delivery") ||
      contentLower.includes("arriving today")
    ) {
      return "delivery_notification";
    }
    if (
      subjectLower.includes("delivered") ||
      contentLower.includes("delivered")
    ) {
      return "delivery_confirmation";
    }

    return "order_update";
  }

  /**
   * Enhanced parse method with complete order breakdown and linking support
   */
  parseComplete({ from, subject, html, text }) {
    const basicParse = this.parse({ from, subject, html, text });

    if (!basicParse) return null;

    const content = html || text || "";
    const orderBreakdown = this.extractOrderBreakdown(content);
    const paymentInfo = this.extractPaymentInfo(content);
    const deliveryAgentInfo = this.extractDeliveryAgentInfo(content);

    return {
      ...basicParse,
      orderBreakdown,
      paymentInfo,
      deliveryAgentInfo,
    };
  }

  /**
   * Static method to link related orders
   * Use this to merge orders with same orderKey but different IDs
   */
  static linkOrders(orders) {
    const linkedOrders = {};
    const parser = new MyntraParser();

    for (const order of orders) {
      const key = order.orderKey;

      if (!linkedOrders[key]) {
        linkedOrders[key] = order;
      } else {
        // Merge with existing order
        const existingOrder = linkedOrders[key];

        // Determine which is confirmation and which is shipping
        const isConfirmation = order.emailType === "order_confirmation";
        const isShipping = order.emailType === "shipping_notification";

        if (
          isConfirmation &&
          existingOrder.emailType === "shipping_notification"
        ) {
          // Current is confirmation, existing is shipping
          linkedOrders[key] = parser.mergeOrderData(order, existingOrder);
        } else if (
          isShipping &&
          existingOrder.emailType === "order_confirmation"
        ) {
          // Current is shipping, existing is confirmation
          linkedOrders[key] = parser.mergeOrderData(existingOrder, order);
        } else {
          // Both same type or different types - use the one with more complete data
          const currentScore = parser.calculateConfidenceScore({
            orderId: order.orderId,
            trackingId: order.trackingId,
            amount: order.amount,
            items: order.items,
            status: order.status,
          });

          if (currentScore > existingOrder.confidence) {
            linkedOrders[key] = order;
          }
        }
      }
    }

    return Object.values(linkedOrders);
  }

  /**
   * Calculate confidence score for parsed data - Updated scoring
   */
  calculateConfidenceScore(data) {
    let score = 0;

    if (data.orderId) score += 0.3;
    if (data.status) score += 0.2;
    if (data.amount && data.amount > 0) score += 0.2;
    if (data.items && data.items.length > 0) score += 0.1;
    if (data.trackingId) score += 0.1;
    if (data.items[0] && data.items[0].brand) score += 0.1;

    return Math.min(score, 1);
  }

  /**
   * Extract additional order details like discounts, platform fees, etc.
   */
  extractOrderBreakdown(content) {
    const breakdown = {};

    // Extract MRP
    const mrpPattern = /MRP[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const mrpMatch = content.match(mrpPattern);
    if (mrpMatch) {
      breakdown.mrp = parseFloat(mrpMatch[1].replace(/,/g, ""));
    }

    // Extract discount
    const discountPattern = /Discount[\s\S]*?-\s*&#8377;([\d,]+\.?\d*)/i;
    const discountMatch = content.match(discountPattern);
    if (discountMatch) {
      breakdown.discount = parseFloat(discountMatch[1].replace(/,/g, ""));
    }

    // Extract platform fee
    const platformFeePattern = /Platform Fee[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const platformFeeMatch = content.match(platformFeePattern);
    if (platformFeeMatch) {
      breakdown.platformFee = parseFloat(platformFeeMatch[1].replace(/,/g, ""));
    }

    // Extract savings
    const savingsPattern = /You saved[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const savingsMatch = content.match(savingsPattern);
    if (savingsMatch) {
      breakdown.totalSavings = parseFloat(savingsMatch[1].replace(/,/g, ""));
    }

    // Extract discounted price
    const discountedPricePattern =
      /Discounted Price[\s\S]*?&#8377;([\d,]+\.?\d*)/i;
    const discountedPriceMatch = content.match(discountedPricePattern);
    if (discountedPriceMatch) {
      breakdown.discountedPrice = parseFloat(
        discountedPriceMatch[1].replace(/,/g, "")
      );
    }

    return breakdown;
  }

  /**
   * Extract payment method information
   */
  extractPaymentInfo(content) {
    const paymentPattern = /Payment mode[\s\S]*?<span[^>]*>([^<]+)</i;
    const paymentMatch = content.match(paymentPattern);

    if (paymentMatch) {
      return {
        method: paymentMatch[1].trim(),
        mode: paymentMatch[1].trim(),
      };
    }

    // Fallback: Look for PaymentOptionNameId
    const paymentIdPattern = /PaymentOptionNameId[^>]*>([^<]+)</i;
    const paymentIdMatch = content.match(paymentIdPattern);

    if (paymentIdMatch) {
      return {
        method: paymentIdMatch[1].trim(),
        mode: paymentIdMatch[1].trim(),
      };
    }

    return null;
  }

  /**
   * Extract delivery agent contact info
   */
  extractDeliveryAgentInfo(content) {
    const agentPattern = /delivery agent[\s\S]*?\((\d+)\)/i;
    const agentMatch = content.match(agentPattern);

    if (agentMatch) {
      return {
        phone: agentMatch[1].trim(),
      };
    }

    return null;
  }

  /**
   * Generate a unique order key for linking related emails
   * Uses product name, amount, and delivery address to create consistent key
   */
  generateOrderKey(productName, amount, deliveryAddress) {
    const normalizedProduct = productName
      .replace(/[^\w\s]/g, "")
      .trim()
      .toLowerCase();
    const normalizedAmount = amount ? Math.floor(amount).toString() : "0";
    const normalizedAddress =
      deliveryAddress && deliveryAddress.pincode
        ? deliveryAddress.pincode
        : "unknown";

    return `myntra_${normalizedProduct.replace(
      /\s+/g,
      "_"
    )}_${normalizedAmount}_${normalizedAddress}`;
  }

  /**
   * Check if two orders should be linked (same order, different emails)
   */
  shouldLinkOrders(order1, order2) {
    if (!order1 || !order2) return false;

    // Check if products match (allowing for minor variations)
    const product1 = order1.items[0]?.name
      ?.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();
    const product2 = order2.items[0]?.name
      ?.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

    if (!product1 || !product2) return false;

    const productMatch =
      product1 === product2 ||
      product1.includes(product2) ||
      product2.includes(product1);

    // Check if amounts match (within ₹1 tolerance for rounding)
    const amount1 = order1.amount || 0;
    const amount2 = order2.amount || 0;
    const amountMatch = Math.abs(amount1 - amount2) <= 1;

    // Check if delivery addresses match (same pincode)
    const pincode1 = order1.deliveryAddress?.pincode;
    const pincode2 = order2.deliveryAddress?.pincode;
    const addressMatch = pincode1 && pincode2 && pincode1 === pincode2;

    return productMatch && amountMatch && addressMatch;
  }

  /**
   * Merge information from multiple emails of the same order
   */
  mergeOrderData(confirmationOrder, shippingOrder) {
    // Use confirmation order as base (it has the original order ID)
    const mergedOrder = { ...confirmationOrder };

    // Add tracking information from shipping order
    if (shippingOrder.trackingId && !mergedOrder.trackingId) {
      mergedOrder.trackingId = shippingOrder.trackingId;
    }

    // Update status to the latest (shipping status is more recent)
    if (shippingOrder.status && shippingOrder.status !== "ORDERED") {
      mergedOrder.status = shippingOrder.status;
      mergedOrder.lastUpdated = shippingOrder.orderDate;
    }

    // Merge any missing product details
    if (shippingOrder.items[0] && mergedOrder.items[0]) {
      const shippingProduct = shippingOrder.items[0];
      const mergedProduct = mergedOrder.items[0];

      // Fill in any missing details
      if (!mergedProduct.size && shippingProduct.size) {
        mergedProduct.size = shippingProduct.size;
      }
      if (!mergedProduct.quantity && shippingProduct.quantity) {
        mergedProduct.quantity = shippingProduct.quantity;
      }
    }

    // Add order history
    mergedOrder.orderHistory = [
      {
        status: confirmationOrder.status,
        date: confirmationOrder.orderDate,
        type: "confirmation",
      },
      {
        status: shippingOrder.status,
        date: shippingOrder.orderDate,
        type: "shipping",
      },
    ];

    // Update confidence score
    mergedOrder.confidence = this.calculateConfidenceScore({
      orderId: mergedOrder.orderId,
      trackingId: mergedOrder.trackingId,
      amount: mergedOrder.amount,
      items: mergedOrder.items,
      status: mergedOrder.status,
    });

    return mergedOrder;
  }
}

module.exports = MyntraParser;
