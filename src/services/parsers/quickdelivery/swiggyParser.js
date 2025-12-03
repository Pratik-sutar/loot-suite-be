const { cleanHtml, extractTextContent } = require("../../../utils/htmlCleaner");
const {
  extractAmount,
  formatAmount,
} = require("../../../utils/amountExtractor");

class SwiggyParser {
  constructor() {
    this.platform = "swiggy";
  }

  /**
   * Parse Swiggy orders - COMPLETELY REWRITTEN to fix duplicates
   */
  parse(emailData) {
    console.log("🔍 Swiggy: Starting FIXED parsing...");
    console.log(`📧 Subject: ${emailData.subject}`);

    try {
      // Step 1: Clean HTML content
      const cleanContent = cleanHtml(emailData.html || emailData.text || "");
      console.log("✅ Swiggy: HTML cleaned successfully");

      // Step 2: Extract order ID
      const orderId = this.extractOrderId(cleanContent, emailData.subject);
      if (!orderId) {
        console.log("❌ Swiggy: No order ID found");
        return null;
      }
      console.log(`✅ Swiggy: Order ID found - ${orderId}`);

      // Step 3: Extract Grand Total FIRST
      const grandTotal = this.extractGrandTotal(cleanContent);
      console.log(
        `💰 Swiggy: Grand Total extracted - ₹${grandTotal || "not found"}`
      );

      // Step 4: Extract unique items and fees (NO DUPLICATES)
      const uniqueItems = this.extractUniqueItems(cleanContent);
      const uniqueFees = this.extractUniqueFees(cleanContent);

      console.log(`📦 Swiggy: Found ${uniqueItems.length} unique items`);
      console.log(`💳 Swiggy: Found ${uniqueFees.length} unique fees`);

      // Step 5: Combine all products
      const allProducts = [...uniqueItems, ...uniqueFees];

      // Step 6: Validation logging
      const itemsTotal = uniqueItems.reduce((sum, item) => sum + item.price, 0);
      const feesTotal = uniqueFees.reduce((sum, fee) => sum + fee.price, 0);
      const calculatedTotal = itemsTotal + feesTotal;

      console.log(
        `🧮 Swiggy totals: Items=₹${itemsTotal}, Fees=₹${feesTotal}, Calculated=₹${calculatedTotal}, Grand=₹${grandTotal}`
      );

      return {
        platform: this.platform,
        orderId,
        amount: grandTotal || calculatedTotal,
        formattedAmount: formatAmount(grandTotal || calculatedTotal),
        products: allProducts,
        orderDate: this.extractOrderDate(cleanContent, emailData.date),
        status: this.extractOrderStatus(cleanContent),
        deliveryInfo: this.extractDeliveryInfo(cleanContent),
        confidence: this.calculateConfidence(orderId, grandTotal, allProducts),
      };
    } catch (error) {
      console.error("❌ Swiggy parser error:", error);
      return null;
    }
  }

  /**
   * Extract unique items - PREVENTS DUPLICATES BY DESIGN
   */
  extractUniqueItems(content) {
    console.log("📦 FIXED: Extracting unique items only...");

    const uniqueItems = new Map(); // Use Map to automatically prevent duplicates

    // SINGLE, PRECISE pattern for Swiggy items
    const itemPattern = /(\d+)\s*x\s*([^₹\n]+?)\s*₹\s*([\d,]+(?:\.\d{2})?)/gi;

    let match;
    while ((match = itemPattern.exec(content)) !== null) {
      const quantity = parseInt(match[1]) || 1;
      const rawName = match[2].trim();
      const totalPrice = parseFloat(match[3].replace(/,/g, ""));

      // Clean the product name
      const cleanName = rawName
        .replace(/\s+/g, " ")
        .replace(/\([^)]*$/, "") // Remove incomplete parentheses
        .replace(/^\W+|\W+$/g, "")
        .trim();

      // Only process valid food items
      if (this.isValidFoodItem(cleanName, totalPrice)) {
        // Use name as key to prevent duplicates
        const itemKey = cleanName.toLowerCase();

        if (!uniqueItems.has(itemKey)) {
          const item = {
            name: cleanName,
            quantity,
            price: totalPrice,
            unitPrice: Math.round((totalPrice / quantity) * 100) / 100,
            formattedPrice: formatAmount(totalPrice),
            type: "item",
          };

          uniqueItems.set(itemKey, item);
          console.log(
            `✅ Added unique item: ${quantity}x ${cleanName} = ₹${totalPrice} (unit: ₹${item.unitPrice})`
          );
        } else {
          console.log(`ℹ️ Skipped duplicate item: ${cleanName}`);
        }
      }
    }

    const items = Array.from(uniqueItems.values());
    console.log(`📦 Final unique items: ${items.length}`);
    return items;
  }

  /**
   * Extract unique fees - PREVENTS DUPLICATES BY DESIGN
   */
  extractUniqueFees(content) {
    console.log("💳 FIXED: Extracting unique fees only...");

    const uniqueFees = new Map(); // Use Map to automatically prevent duplicates

    // SINGLE, PRECISE pattern for fees
    const feePattern = /([A-Za-z\s]+Fee)\s*₹\s*([\d,]+(?:\.\d{2})?)/gi;

    let match;
    while ((match = feePattern.exec(content)) !== null) {
      const rawFeeName = match[1].trim();
      const feeAmount = parseFloat(match[2].replace(/,/g, ""));

      // Only process valid, non-zero fees
      if (feeAmount > 0 && feeAmount < 500) {
        // Create normalized key for deduplication
        const feeKey = rawFeeName.toLowerCase().replace(/\s+/g, "");

        if (!uniqueFees.has(feeKey)) {
          const fee = {
            name: rawFeeName,
            quantity: 1,
            price: Math.round(feeAmount * 100) / 100,
            formattedPrice: formatAmount(feeAmount),
            type: "fee",
          };

          uniqueFees.set(feeKey, fee);
          console.log(`✅ Added unique fee: ${rawFeeName} = ₹${feeAmount}`);
        } else {
          console.log(`ℹ️ Skipped duplicate fee: ${rawFeeName}`);
        }
      } else if (feeAmount === 0) {
        console.log(`ℹ️ Skipped zero fee: ${rawFeeName}`);
      }
    }

    const fees = Array.from(uniqueFees.values());
    console.log(`💳 Final unique fees: ${fees.length}`);
    return fees;
  }

  /**
   * Extract Grand Total - ENHANCED with better patterns
   */
  extractGrandTotal(content) {
    console.log("💰 Swiggy: Looking for Grand Total...");

    // Ordered by priority - most specific first
    const grandTotalPatterns = [
      /Grand\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /Grand\s*total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi, // lowercase variant
      /Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      /Final\s*Amount[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
    ];

    for (const pattern of grandTotalPatterns) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(content);

      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(amount) && amount > 0 && amount < 10000) {
          console.log(
            `✅ Found Grand Total: ₹${amount} using pattern: ${pattern.source}`
          );
          return amount;
        }
      }
    }

    console.log("❌ No Grand Total found");
    return null;
  }

  /**
   * Validate if item is a food item (not fee or invalid)
   */
  isValidFoodItem(name, price) {
    if (!name || name.length < 3) return false;
    if (price && (isNaN(price) || price < 1 || price > 5000)) return false;

    // Filter out fees and system text
    const invalidPatterns = [
      /fee$/i,
      /charge$/i,
      /tax$/i,
      /gst$/i,
      /total$/i,
      /summary$/i,
      /bill$/i,
      /^(handling|convenience|delivery|service|platform)/i,
      /^(grand|final|amount|payment|order)/i,
      /^[x\s]*$/i, // Just "x" or spaces
    ];

    const isInvalid = invalidPatterns.some((pattern) =>
      pattern.test(name.trim())
    );

    if (isInvalid) {
      console.log(`❌ Rejected invalid item: "${name}"`);
      return false;
    }

    return true;
  }

  /**
   * Extract Swiggy order ID
   */
  extractOrderId(content, subject) {
    const orderIdPatterns = [
      /order\s*id[:\s]*(\d{12,18})/gi,
      /order\s*number[:\s]*(\d{12,18})/gi,
      /(\d{12,18})/g,
    ];

    // Try subject first
    if (subject) {
      for (const pattern of orderIdPatterns.slice(0, 2)) {
        // Use specific patterns for subject
        pattern.lastIndex = 0;
        const match = pattern.exec(subject);
        if (match && this.isValidSwiggyOrderId(match[1])) {
          return match[1];
        }
      }
    }

    // Then try content
    for (const pattern of orderIdPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (this.isValidSwiggyOrderId(match[1])) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Validate Swiggy order ID
   */
  isValidSwiggyOrderId(orderId) {
    return orderId && /^\d{12,18}$/.test(orderId) && orderId !== "000000000000";
  }

  /**
   * Extract delivery information
   */
  extractDeliveryInfo(content) {
    const addressPattern = /Deliver\s*To[:\s]*([^\n]{10,200})/gi;
    const addressMatch = content.match(addressPattern);

    return {
      address: addressMatch
        ? addressMatch[0].replace(/^[^:]*:\s*/, "").trim()
        : null,
      time: null,
    };
  }

  /**
   * Extract order date
   */
  extractOrderDate(content, emailDate) {
    return emailDate ? new Date(emailDate) : new Date();
  }

  /**
   * Extract order status
   */
  extractOrderStatus(content) {
    return content.toLowerCase().includes("delivered")
      ? "delivered"
      : "confirmed";
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(orderId, grandTotal, products) {
    let confidence = 0;
    if (orderId) confidence += 0.4;
    if (grandTotal && grandTotal > 0) confidence += 0.3;
    if (products && products.length > 0) confidence += 0.2;
    if (products && products.some((p) => p.price > 0)) confidence += 0.1;
    return Math.round(Math.min(confidence, 1.0) * 100) / 100;
  }

  /**
   * Check if email can be parsed - SAME AS BEFORE
   */
  static canParse(emailData) {
    if (!emailData.from || !emailData.subject) return false;

    const from = emailData.from.toLowerCase();
    const subject = emailData.subject.toLowerCase();

    // Must be from Swiggy
    const isSwiggy = from.includes("swiggy.in") || from.includes("swiggy");
    if (!isSwiggy) return false;

    // Check for order indicators
    const orderIndicators = ["order", "delivered", "confirmed", "instamart"];
    return orderIndicators.some((keyword) => subject.includes(keyword));
  }
}

module.exports = SwiggyParser;
