// src/utils/amountExtractor.js - CRITICAL UTILITY FOR FIXING AMOUNT EXTRACTION

/**
 * 💰 Amount Extractor Utility - Handles all spacing variations and currency symbols
 * Fixes issues like ₹804 vs ₹44, ₹ 804 vs ₹804, etc.
 */

/**
 * Extract amount with flexible patterns for all platforms
 */
function extractAmount(content, platform = "generic") {
  if (!content) return null;

  console.log(`💰 Amount Extractor: Processing ${platform} content...`);

  // Get platform-specific patterns
  const patterns = getAmountPatterns(platform);
  const foundAmounts = [];

  // Try each pattern and collect candidates
  for (const patternGroup of patterns) {
    const { patterns: groupPatterns, priority, description } = patternGroup;

    for (const pattern of groupPatterns) {
      const matches = [...content.matchAll(pattern)];

      for (const match of matches) {
        const amountStr = match[1] || match[2] || match[3]; // Different capture groups
        const amount = parseAmount(amountStr);

        if (amount && isValidAmount(amount, platform)) {
          foundAmounts.push({
            amount,
            priority,
            context: match[0],
            description,
            pattern: pattern.toString(),
          });
        }
      }
    }
  }

  if (foundAmounts.length === 0) {
    console.log(`❌ Amount Extractor: No valid amounts found for ${platform}`);
    return null;
  }

  // Sort by priority (highest first), then by amount (highest first)
  foundAmounts.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.amount - a.amount;
  });

  const selected = foundAmounts[0];
  console.log(
    `✅ Amount Extractor: Selected ₹${selected.amount} (${selected.description})`
  );
  console.log(
    `💡 All candidates:`,
    foundAmounts
      .slice(0, 3)
      .map((a) => `₹${a.amount} (${a.description}, priority: ${a.priority})`)
  );

  return selected.amount;
}

/**
 * Get amount extraction patterns for different platforms
 */
function getAmountPatterns(platform) {
  const commonPatterns = [
    {
      patterns: [
        // Grand Total patterns (highest priority)
        /Grand\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /Order\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /Total\s*Amount[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /Final\s*Amount[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      ],
      priority: 100,
      description: "Grand Total",
    },
    {
      patterns: [
        // Billing/Payment patterns
        /Billing\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /Payment\s*Amount[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /Amount\s*Paid[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /Amount\s*to\s*Pay[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
      ],
      priority: 90,
      description: "Payment Total",
    },
    {
      patterns: [
        // Generic Total patterns
        /Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        /₹\s*([\d,]+(?:\.\d{2})?)\s*Total/gi,
      ],
      priority: 80,
      description: "Generic Total",
    },
  ];

  // Platform-specific patterns
  const platformPatterns = {
    amazon: [
      ...commonPatterns,
      {
        patterns: [
          // Amazon-specific patterns
          /Subtotal[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
          /Order\s*Subtotal[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        ],
        priority: 85,
        description: "Amazon Subtotal",
      },
    ],

    swiggy: [
      ...commonPatterns,
      {
        patterns: [
          // Swiggy-specific patterns (Grand Total is priority)
          /Grand\s*total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi, // lowercase 'total'
          /Item\s*Bill[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
          /Bill\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        ],
        priority: 95,
        description: "Swiggy Grand Total",
      },
    ],

    flipkart: [
      ...commonPatterns,
      {
        patterns: [
          // Flipkart-specific patterns
          /Order\s*Value[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
          /Cart\s*Total[:\s]*₹\s*([\d,]+(?:\.\d{2})?)/gi,
        ],
        priority: 85,
        description: "Flipkart Order Value",
      },
    ],
  };

  // Add low-priority individual amount patterns as fallback
  const fallbackPatterns = {
    patterns: [
      // Generic currency patterns (lowest priority)
      /₹\s*([\d,]+(?:\.\d{2})?)/g,
      /Rs\.?\s*([\d,]+(?:\.\d{2})?)/g,
      /INR\s*([\d,]+(?:\.\d{2})?)/g,
    ],
    priority: 30,
    description: "Generic Amount",
  };

  const result = platformPatterns[platform] || commonPatterns;
  result.push(fallbackPatterns);

  return result;
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr) {
  if (!amountStr) return null;

  // Remove commas and parse
  const cleaned = amountStr.replace(/,/g, "");
  const amount = parseFloat(cleaned);

  return isNaN(amount) ? null : amount;
}

/**
 * Validate if amount is reasonable for the platform
 */
function isValidAmount(amount, platform) {
  if (!amount || amount <= 0) return false;

  // Platform-specific amount ranges
  const ranges = {
    amazon: { min: 1, max: 100000 },
    flipkart: { min: 1, max: 100000 },
    swiggy: { min: 10, max: 5000 }, // Food orders typically smaller
    myntra: { min: 100, max: 50000 }, // Fashion items
    blinkit: { min: 10, max: 3000 }, // Grocery orders
    generic: { min: 1, max: 100000 },
  };

  const range = ranges[platform] || ranges.generic;
  return amount >= range.min && amount <= range.max;
}

/**
 * Format amount for display
 */
function formatAmount(amount) {
  if (!amount || amount === 0) return "₹0";

  // Format with commas for large numbers
  if (amount >= 1000) {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  return `₹${amount}`;
}

/**
 * Extract amounts with context (for debugging)
 */
function extractAmountsWithContext(content, platform = "generic") {
  const patterns = getAmountPatterns(platform);
  const results = [];

  for (const patternGroup of patterns) {
    for (const pattern of patternGroup.patterns) {
      const matches = [...content.matchAll(pattern)];

      for (const match of matches) {
        const amountStr = match[1] || match[2] || match[3];
        const amount = parseAmount(amountStr);

        if (amount && isValidAmount(amount, platform)) {
          results.push({
            amount,
            context: match[0],
            priority: patternGroup.priority,
            description: patternGroup.description,
            position: match.index,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.priority - a.priority);
}

/**
 * Debug amount extraction (for troubleshooting)
 */
function debugAmountExtraction(content, platform) {
  console.log(`🔍 DEBUG: Amount extraction for ${platform}`);
  console.log(`📝 Content length: ${content.length} characters`);

  const amounts = extractAmountsWithContext(content, platform);

  console.log(`💰 Found ${amounts.length} potential amounts:`);
  amounts.forEach((item, index) => {
    console.log(
      `  ${index + 1}. ₹${item.amount} - ${item.description} (priority: ${
        item.priority
      })`
    );
    console.log(`     Context: "${item.context}"`);
  });

  const selected = amounts[0];
  if (selected) {
    console.log(`✅ Selected: ₹${selected.amount} (${selected.description})`);
  } else {
    console.log(`❌ No valid amounts found`);
  }

  return selected?.amount || null;
}

module.exports = {
  extractAmount,
  formatAmount,
  extractAmountsWithContext,
  debugAmountExtraction,
  parseAmount,
  isValidAmount,
};
