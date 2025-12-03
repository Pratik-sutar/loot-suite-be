// src/utils/htmlCleaner.js - COMPLETE ENHANCED VERSION WITH FLIPKART FIXES

/**
 * 🧹 Enhanced HTML Cleaner - Fixes Flipkart encoding + improves all platforms
 * SAFE: All changes are additive and improve existing functionality
 */

/**
 * Clean HTML content and fix all encoding issues (ENHANCED)
 */
function cleanHtml(htmlContent) {
  if (!htmlContent) return "";

  console.log(
    "🧹 HTML Cleaner: Processing content with enhanced encoding fixes..."
  );

  let cleaned = htmlContent;

  // Step 1: Fix character encoding issues (ENHANCED - helps all platforms)
  cleaned = fixEnhancedCharacterEncoding(cleaned);

  // Step 2: Remove scripts and styles (UNCHANGED)
  cleaned = removeScriptsAndStyles(cleaned);

  // Step 3: Clean HTML tags (ENHANCED)
  cleaned = removeHtmlTagsEnhanced(cleaned);

  // Step 4: Fix whitespace and normalize (UNCHANGED)
  cleaned = normalizeWhitespace(cleaned);

  // Step 5: Remove HTML entities (ENHANCED)
  cleaned = decodeHtmlEntitiesEnhanced(cleaned);

  // Step 6: Final platform-agnostic cleanup
  cleaned = finalGeneralCleanup(cleaned);

  console.log(
    "✅ HTML Cleaner: Content cleaned successfully with enhanced patterns"
  );
  return cleaned;
}

/**
 * 🔧 ENHANCED character encoding fixes (SAFE for all platforms)
 */
function fixEnhancedCharacterEncoding(content) {
  console.log("🔧 Applying enhanced character encoding fixes...");

  return (
    content
      // ✅ ENHANCED: Rupee symbol variations (helps ALL Indian e-commerce)
      .replace(/â‚¨/g, "₹") // Flipkart encoding issue
      .replace(/â‚¹/g, "₹") // Alternative encoding
      .replace(/&#8377;/g, "₹") // HTML entity (EXISTING)
      .replace(/&₹/g, "₹") // Broken entity (EXISTING)
      .replace(/₹\./g, "₹ ") // ✅ NEW: "₹." → "₹ " (helps Flipkart)
      .replace(/Rs\./g, "₹") // ✅ NEW: "Rs." → "₹" (helps Amazon India too)
      .replace(/Rs\s/g, "₹ ") // ✅ NEW: "Rs " → "₹ " (helps all platforms)

      // ✅ ENHANCED: Quote and symbol fixes (EXISTING + IMPROVED)
      .replace(/â€™/g, "'") // Smart single quote (EXISTING)
      .replace(/â€œ/g, '"') // Smart double quote left (EXISTING)
      .replace(/â€/g, '"') // Smart double quote right (EXISTING)
      .replace(/â€¦/g, "...") // Ellipsis (EXISTING)
      .replace(/â€"/g, "–") // En dash (EXISTING)
      .replace(/â€"/g, "—") // Em dash (EXISTING)

      // ✅ ENHANCED: Complex encoding fixes (EXISTING + IMPROVED)
      .replace(/Ã¢â€šÂ¹/g, "₹") // Complex rupee encoding (EXISTING)
      .replace(/Ã¢â€™/g, "'") // Complex quote encoding (EXISTING)
      .replace(/Ã¢â€œ/g, '"') // Complex quote encoding (EXISTING)
      .replace(/Ã¢â€/g, '"') // Complex quote encoding (EXISTING)
      .replace(/Ã¢â€¦/g, "...") // Complex ellipsis (EXISTING)

      // ✅ ENHANCED: UTF-8 double encoding (EXISTING + IMPROVED)
      .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/g, "'")
      .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã…"/g, '"')
      .replace(/ÃƒÂ¢Ã¢â€šÂ¬/g, '"')

      // ✅ NEW: Additional Indian e-commerce encoding fixes
      .replace(/â‚¹\s*\./g, "₹ ") // "₹." with space
      .replace(/INR\s*/g, "₹") // "INR" → "₹"
      .replace(/â‚¹\s*Rs/g, "₹") // Mixed currency symbols
      .replace(/Rs\s*₹/g, "₹")
  ); // Mixed currency symbols
}

/**
 * Remove script and style tags (UNCHANGED - safe)
 */
function removeScriptsAndStyles(content) {
  return content
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<noscript[^>]*>.*?<\/noscript>/gis, "")
    .replace(/\/\*.*?\*\//gs, "") // CSS comments
    .replace(/<!--.*?-->/gs, ""); // HTML comments
}

/**
 * 🔧 ENHANCED HTML tag removal with better content preservation
 */
function removeHtmlTagsEnhanced(content) {
  return (
    content
      // Preserve line breaks (EXISTING)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n")
      .replace(/<\/?(td|th)[^>]*>/gi, " ")

      // ✅ ENHANCED: Extract valuable content from attributes
      .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " $1 ") // Extract alt text (helps product names)
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, " $1 ") // Extract link text
      .replace(/<span[^>]*>([^<]*)<\/span>/gi, " $1 ") // Extract span content

      // Remove all remaining tags (EXISTING)
      .replace(/<[^>]+>/g, " ")
  );
}

/**
 * Normalize whitespace (UNCHANGED - safe)
 */
function normalizeWhitespace(content) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n\s*\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\s+\n/g, "\n")
    .trim();
}

/**
 * 🔧 ENHANCED HTML entity decoding (EXISTING + IMPROVED)
 */
function decodeHtmlEntitiesEnhanced(content) {
  const entities = {
    // EXISTING entities (safe)
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#39;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",

    // ✅ ENHANCED: Additional entities (helps all platforms)
    "&hellip;": "...",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&apos;": "'",
    "&cent;": "¢",
    "&pound;": "£",
    "&yen;": "¥",
    "&euro;": "€",
  };

  let decoded = content;
  for (const [entity, replacement] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), replacement);
  }

  // Decode numeric entities (EXISTING)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });

  // ✅ ENHANCED: Decode hex entities (improves all platforms)
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}

/**
 * 🧹 ENHANCED final cleanup (platform-agnostic improvements)
 */
function finalGeneralCleanup(content) {
  return (
    content
      // Remove common e-commerce footer text (helps all platforms)
      .replace(/This email was sent from a notification-only address.*$/gm, "")
      .replace(/Please do not reply to this message.*$/gm, "")
      .replace(/Got Questions\? Please get in touch.*$/gm, "")
      .replace(/24x7 Customer Care.*$/gm, "")
      .replace(/Customer Care.*$/gm, "")
      .replace(/Read More.*$/gm, "")
      .replace(/Unsubscribe.*$/gm, "")

      // Remove tracking and management links (helps all platforms)
      .replace(/Track your (?:Order|Shipment|Package).*$/gm, "")
      .replace(/Manage Your Order.*$/gm, "")
      .replace(/View (?:Order|Invoice).*$/gm, "")

      // Clean up URLs and tracking pixels (EXISTING + ENHANCED)
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/src="[^"]*"/g, "")
      .replace(/href="[^"]*"/g, "")

      // ✅ ENHANCED: Remove platform-specific garbage (helps all)
      .replace(/(?:amazon|flipkart|myntra|nykaa)\.com[^\s]*/gi, "")
      .replace(/auto-confirm@|noreply@|no-reply@/gi, "")

      // Remove excessive whitespace (EXISTING)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\s{3,}/g, " ")
      .trim()
  );
}

/**
 * Extract clean text content from HTML (ENHANCED)
 */
function extractTextContent(htmlContent) {
  if (!htmlContent) return "";

  // Use the enhanced cleanHtml function
  const cleaned = cleanHtml(htmlContent);

  // ✅ ENHANCED: Additional text extraction with garbage filtering
  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isGarbageLine(line)) // ✅ Enhanced garbage filtering
    .join("\n");
}

/**
 * 🗑️ ENHANCED garbage line detection (helps all platforms)
 */
function isGarbageLine(line) {
  const garbagePatterns = [
    /^[\s\-_=.]{3,}$/, // Lines of punctuation (EXISTING)
    /^(width|height|margin|padding|font)/i, // CSS properties (EXISTING)
    /^(img|div|span|table|td|tr)$/i, // HTML tag names only (EXISTING)
    /^https?:\/\//, // URLs (EXISTING)
    /^[a-f0-9]{20,}$/i, // Long hex strings (EXISTING)
    /^[\d\s.,;:-]+$/, // Only numbers and punctuation (EXISTING)

    // ✅ ENHANCED: E-commerce specific garbage (helps all platforms)
    /(?:amazon|flipkart|myntra|nykaa)\.com/i,
    /notification-only|customer care|unsubscribe/i,
    /track\s+(?:order|shipment|package)/i,
    /manage\s+(?:order|account)/i,
    /view\s+(?:order|invoice)/i,
    /download\s+(?:app|invoice)/i,
    /^\s*(?:terms|privacy|policy)\s*$/i,
    /^\s*(?:copyright|all rights reserved)\s*$/i,
  ];

  return garbagePatterns.some((pattern) => pattern.test(line.trim()));
}

/**
 * Clean product names specifically (ENHANCED for all platforms)
 */
function cleanProductName(productName) {
  if (!productName) return "";

  return productName
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/^\W+|\W+$/g, "")
    .replace(/\.{3,}$/, "") // ✅ NEW: Remove trailing ellipsis (helps Flipkart)
    .replace(
      /^(img|div|span|table|td|tr|class|id|style|width|height|align|center|src|href|background|font|color|margin|padding|border)$/i,
      ""
    )
    .trim();
}

/**
 * 🔍 ENHANCED content validation (helps all platforms)
 */
function isValidTextContent(content) {
  if (!content || content.length < 3) return false;

  // Enhanced garbage patterns for all e-commerce platforms
  const garbagePatterns = [
    /^(img|div|span|table|td|tr|style|class|id|src|href|width|height|align|center|background|font|color|margin|padding|border)\s/i,
    /^\d+px$/i,
    /^#[a-f0-9]{6}$/i,
    /^url\(/i,
    /\.(css|js)$/i,
    /^\s*[{}();,]\s*$/,
    /^[\d\s.,;:-]+$/, // Only numbers and punctuation (EXISTING)

    // ✅ ENHANCED: E-commerce platform detection (helps all)
    /(?:amazon|flipkart|myntra|nykaa|ajio|meesho)\.com/i,
    /notification-only|customer\s+care|unsubscribe/i,
    /track\s+(?:order|shipment)|manage\s+order/i,
    /download\s+app|view\s+invoice/i,
    /^(order|item|delivery|shipment|tracking)$/i, // Single generic words only
  ];

  return !garbagePatterns.some((pattern) => pattern.test(content.trim()));
}

/**
 * 📊 ENHANCED structured data extraction for e-commerce emails
 */
function extractEcommerceStructuredData(htmlContent, platform = "generic") {
  const cleaned = cleanHtml(htmlContent);
  const data = {};

  // ✅ ENHANCED: Platform-specific order ID extraction
  const orderIdPatterns = {
    flipkart: [/Order\s*ID[:\s]*(OD\d{15,21})/i, /(OD\d{15,21})/i],
    amazon: [
      /Order\s*#[:\s]*(\d{3}-\d{7,8}-\d{7,8})/i,
      /(\d{3}-\d{7,8}-\d{7,8})/,
    ],
    myntra: [/Order\s*(?:ID|Number)[:\s]*([A-Z0-9\-]{8,20})/i],
    generic: [/Order\s*(?:ID|#|Number)[:\s]*([A-Z0-9\-]{6,25})/i],
  };

  const patterns = orderIdPatterns[platform] || orderIdPatterns.generic;
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      data.orderId = match[1];
      break;
    }
  }

  // ✅ ENHANCED: Amount extraction with flexible currency handling
  const amountPatterns = [
    // High priority - specific amount labels
    /(?:Amount\s*Paid|Order\s*Total|Total\s*Amount|Grand\s*Total|Shipment\s*[Tt]otal)[:\s]*(?:₹|Rs\.?)[.\s]*([\d,]+(?:\.\d{2})?)/i,

    // Medium priority - payment related
    /(?:Payment|Billing\s*Total|Final\s*Amount)[:\s]*(?:₹|Rs\.?)[.\s]*([\d,]+(?:\.\d{2})?)/i,

    // Generic currency patterns
    /(?:₹|Rs\.?)[.\s]*([\d,]+(?:\.\d{2})?)/,
  ];

  for (const pattern of amountPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      data.amount = parseFloat(match[1].replace(/,/g, ""));
      break;
    }
  }

  // ✅ ENHANCED: Product name extraction (helps all platforms)
  const productPatterns = [
    // From alt text (common in e-commerce emails)
    /alt="([^"]{10,80})"/i,

    // From structured content
    /([A-Z][a-zA-Z\s&-]{10,80}(?:\.\.\.)?)(?:\s+Seller:|$)/,

    // From order line items
    /(?:Item|Product)[:\s]*([A-Z][a-zA-Z\s&-]{10,80})/i,
  ];

  for (const pattern of productPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      data.productName = match[1].trim();
      break;
    }
  }

  // ✅ ENHANCED: Delivery date extraction (helps all platforms)
  const deliveryPatterns = [
    /Delivery\s+by[:\s]*([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /Expected\s+delivery[:\s]*([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /by\s+([A-Z][a-z]+,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of deliveryPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const deliveryDate = new Date(match[1]);
      if (!isNaN(deliveryDate.getTime())) {
        data.expectedDelivery = deliveryDate;
        break;
      }
    }
  }

  // ✅ ENHANCED: Tracking/carrier extraction (helps all platforms)
  const trackingPatterns = [
    /(?:shipped|dispatched)\s+via\s+([^.\n]+)/i,
    /(?:carrier|logistics)[:\s]*([^.\n]+)/i,
    /tracking\s*(?:id|number)[:\s]*([A-Z0-9]{8,25})/i,
    /awb\s*(?:number)?[:\s]*([A-Z0-9]{8,25})/i,
  ];

  for (const pattern of trackingPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      if (
        !data.carrierName &&
        pattern.toString().includes("via|carrier|logistics")
      ) {
        data.carrierName = match[1].trim();
      }
      if (!data.trackingId && pattern.toString().includes("tracking|awb")) {
        data.trackingId = match[1].trim();
      }
    }
  }

  return data;
}

/**
 * 🔧 Platform-specific HTML cleaning (SAFE - additive only)
 */
function cleanHtmlForPlatform(htmlContent, platform) {
  const baseClean = cleanHtml(htmlContent);

  // Platform-specific enhancements (additive only)
  switch (platform) {
    case "flipkart":
      return baseClean
        .replace(/SuperCoin.*$/gm, "") // Remove Flipkart rewards text
        .replace(/Flipkart Plus.*$/gm, ""); // Remove Plus member text

    case "amazon":
      return baseClean
        .replace(/Amazon Prime.*$/gm, "") // Remove Prime text
        .replace(/Your account.*$/gm, ""); // Remove account text

    case "myntra":
      return baseClean
        .replace(/Myntra Insider.*$/gm, "") // Remove loyalty program text
        .replace(/Fashion advice.*$/gm, ""); // Remove fashion content

    default:
      return baseClean;
  }
}

/**
 * 🧪 Debug HTML cleaning process (for troubleshooting)
 */
function debugHtmlCleaning(htmlContent, platform = "generic") {
  console.log(`🔍 DEBUG: HTML cleaning for ${platform}`);
  console.log(`📝 Original length: ${htmlContent.length} characters`);

  const steps = [
    { name: "Raw HTML", content: htmlContent.substring(0, 200) },
    {
      name: "After encoding fix",
      content: fixEnhancedCharacterEncoding(htmlContent).substring(0, 200),
    },
    {
      name: "After tag removal",
      content: removeHtmlTagsEnhanced(
        fixEnhancedCharacterEncoding(htmlContent)
      ).substring(0, 200),
    },
    { name: "Final result", content: cleanHtml(htmlContent).substring(0, 200) },
  ];

  steps.forEach((step) => {
    console.log(`\n${step.name}:`);
    console.log(`"${step.content}..."`);
  });

  // Extract structured data for validation
  const structuredData = extractEcommerceStructuredData(htmlContent, platform);
  console.log(`\n📊 Extracted structured data:`, structuredData);

  return structuredData;
}

/**
 * 🆔 Extract order IDs with platform-specific patterns
 */
function extractOrderIds(content, platform = "generic") {
  const patterns = {
    flipkart: [/\b(OD\d{15,21})\b/gi, /(OD\d{15,21})/gi],
    amazon: [
      /\b(\d{3}-\d{7,8}-\d{7,8})\b/g,
      /Order\s*#[:\s]*(\d{3}-\d{7,8}-\d{7,8})/i,
    ],
    myntra: [/Order\s*(?:ID|Number)[:\s]*([A-Z0-9\-]{8,20})/i],
    generic: [/Order\s*(?:ID|#|Number)[:\s]*([A-Z0-9\-]{6,25})/i],
  };

  const platformPatterns = patterns[platform] || patterns.generic;
  const orderIds = [];

  for (const pattern of platformPatterns) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      if (match[1] && !orderIds.includes(match[1])) {
        orderIds.push(match[1]);
      }
    }
  }

  return orderIds;
}

/**
 * 💰 Extract amounts with platform-specific currency handling
 */
function extractAmounts(content, platform = "generic") {
  const amounts = [];

  // Enhanced amount patterns for all platforms
  const amountPatterns = [
    /(?:Amount\s*Paid|Order\s*Total|Total\s*Amount|Grand\s*Total|Shipment\s*[Tt]otal)[:\s]*(?:₹|Rs\.?)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
    /(?:Payment|Billing\s*Total|Final\s*Amount)[:\s]*(?:₹|Rs\.?)[.\s]*([\d,]+(?:\.\d{2})?)/gi,
    /(?:₹|Rs\.?)[.\s]*([\d,]+(?:\.\d{2})?)/g,
  ];

  for (const pattern of amountPatterns) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(amount) && amount > 0) {
        amounts.push({
          amount,
          context: match[0],
          pattern: pattern.toString().substring(0, 30) + "...",
        });
      }
    }
  }

  return amounts.sort((a, b) => b.amount - a.amount);
}

// BACKWARD COMPATIBILITY: Export existing function names
module.exports = {
  cleanHtml,
  extractTextContent,
  cleanProductName,
  isValidTextContent,

  // EXISTING exports (unchanged)
  fixCharacterEncoding: fixEnhancedCharacterEncoding, // Alias for compatibility
  removeHtmlTags: removeHtmlTagsEnhanced, // Alias for compatibility
  normalizeWhitespace,
  decodeHtmlEntities: decodeHtmlEntitiesEnhanced, // Alias for compatibility

  // ✅ NEW enhanced exports
  extractEcommerceStructuredData,
  cleanHtmlForPlatform,
  debugHtmlCleaning,
  extractOrderIds,
  extractAmounts,
  isGarbageLine,
  finalGeneralCleanup,

  // Internal functions for testing
  fixEnhancedCharacterEncoding,
  removeHtmlTagsEnhanced,
  decodeHtmlEntitiesEnhanced,
};
