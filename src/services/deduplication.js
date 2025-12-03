const crypto = require("crypto");
const { normalizeOrderId } = require("../utils/normalize");

module.exports = {
  /**
   * 🔧 ENHANCED: Generate order hash with better normalization
   */
  getOrderHash({ platform, orderId, userId }) {
    // 🎯 CRITICAL: Ensure orderId is properly normalized
    const normId = normalizeOrderId(orderId);

    // 🔧 ENHANCED: Include platform for better separation
    const base = `${platform.toLowerCase()}-${normId}-${userId || ""}`;
    const hash = crypto.createHash("sha256").update(base).digest("hex");

    console.log(`🔑 Generated hash for ${platform} order ${orderId}:`);
    console.log(`   Normalized ID: ${normId}`);
    console.log(`   Base string: ${base}`);
    console.log(`   Hash: ${hash.substring(0, 16)}...`);

    return hash;
  },

  /**
   * 🔧 ENHANCED: Check if two orders should be considered duplicates
   */
  areOrdersDuplicate(order1, order2) {
    // Same platform and user
    if (
      order1.platform !== order2.platform ||
      order1.user_id !== order2.user_id
    ) {
      return false;
    }

    // Same order ID (primary check)
    if (order1.platform_order_id === order2.platform_order_id) {
      console.log(
        `🔍 Duplicate detected: Same order ID ${order1.platform_order_id}`
      );
      return true;
    }

    // Same tracking number (secondary check)
    if (
      order1.tracking_number &&
      order2.tracking_number &&
      order1.tracking_number === order2.tracking_number
    ) {
      console.log(
        `🔍 Duplicate detected: Same tracking ${order1.tracking_number}`
      );
      return true;
    }

    // 🆕 NEW: Same product + amount + close dates (logical duplicate)
    const product1 = order1.product_name || order1.products?.[0]?.name;
    const product2 = order2.product_name || order2.products?.[0]?.name;
    const amount1 = parseFloat(order1.total_amount || order1.amount || 0);
    const amount2 = parseFloat(order2.total_amount || order2.amount || 0);

    if (product1 && product2 && product1 === product2 && amount1 === amount2) {
      const date1 = new Date(order1.order_date || order1.orderDate);
      const date2 = new Date(order2.order_date || order2.orderDate);
      const daysDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));

      // If same product + amount within 5 days = logical duplicate
      if (daysDiff <= 5) {
        console.log(
          `🔍 Logical duplicate detected: Same product "${product1}" (₹${amount1}) within ${daysDiff.toFixed(
            1
          )} days`
        );
        console.log(
          `   Order 1: ${order1.platform_order_id} (${order1.order_date})`
        );
        console.log(
          `   Order 2: ${order2.platform_order_id} (${order2.order_date})`
        );
        return true;
      }
    }

    // Same hash (final check)
    const hash1 = this.getOrderHash({
      platform: order1.platform,
      orderId: order1.platform_order_id,
      userId: order1.user_id,
    });

    const hash2 = this.getOrderHash({
      platform: order2.platform,
      orderId: order2.platform_order_id,
      userId: order2.user_id,
    });

    if (hash1 === hash2) {
      console.log(
        `🔍 Duplicate detected: Same hash ${hash1.substring(0, 16)}...`
      );
      return true;
    }

    return false;
  },

  /**
   * 🆕 NEW: Remove duplicates from order array
   */
  removeDuplicates(orders) {
    const uniqueOrders = [];
    const duplicateLog = [];

    for (let i = 0; i < orders.length; i++) {
      const currentOrder = orders[i];
      let isDuplicate = false;

      // Check against already added unique orders
      for (let j = 0; j < uniqueOrders.length; j++) {
        if (this.areOrdersDuplicate(currentOrder, uniqueOrders[j])) {
          isDuplicate = true;
          duplicateLog.push({
            duplicate: currentOrder.platform_order_id,
            keptOrder: uniqueOrders[j].platform_order_id,
            reason: "Same product + amount + close dates",
          });
          break;
        }
      }

      if (!isDuplicate) {
        uniqueOrders.push(currentOrder);
      }
    }

    // Log results
    console.log(`🧹 DEDUPLICATION RESULTS:`);
    console.log(`   Original orders: ${orders.length}`);
    console.log(`   Unique orders: ${uniqueOrders.length}`);
    console.log(`   Duplicates removed: ${duplicateLog.length}`);

    if (duplicateLog.length > 0) {
      console.log(`📋 Duplicates removed:`);
      duplicateLog.forEach((log) => {
        console.log(
          `   ❌ ${log.duplicate} → ✅ ${log.keptOrder} (${log.reason})`
        );
      });
    }

    return uniqueOrders;
  },

  /**
   * 🔧 NEW: Generate multiple hash variants for flexible matching
   */
  getOrderHashVariants({ platform, orderId, trackingId, userId }) {
    const variants = [];

    // Primary hash with order ID
    if (orderId) {
      variants.push(this.getOrderHash({ platform, orderId, userId }));
    }

    // Secondary hash with tracking ID (for orders that only have tracking)
    if (trackingId && trackingId !== orderId) {
      variants.push(
        this.getOrderHash({ platform, orderId: trackingId, userId })
      );
    }

    return variants;
  },

  /**
   * 🔧 NEW: Validate order ID format for each platform
   */
  isValidOrderIdFormat(platform, orderId) {
    if (!orderId) return false;

    const formatValidators = {
      amazon: /^\d{3}-\d{7,8}-\d{7,8}$/,
      flipkart: /^OD\d{15,21}$/,
      myntra: /^(MYSP\d{12,15}|\d{12,15})$/,
      nykaa: /^\d{8,15}$/,
    };

    const validator = formatValidators[platform.toLowerCase()];
    if (!validator) {
      // For unknown platforms, accept any reasonable format
      return /^[\w\-]{5,25}$/.test(orderId);
    }

    const isValid = validator.test(orderId);

    if (!isValid) {
      console.log(`⚠️ Invalid ${platform} order ID format: ${orderId}`);
    }

    return isValid;
  },

  /**
   * 🔧 NEW: Enhanced order matching for finding existing orders
   */
  async findExistingOrderEnhanced(userId, platform, orderData, OrderModel) {
    const searchConditions = [];

    // Search by order ID
    if (
      orderData.orderId &&
      this.isValidOrderIdFormat(platform, orderData.orderId)
    ) {
      searchConditions.push({ platform_order_id: orderData.orderId });
    }

    // Search by tracking ID
    if (orderData.trackingId) {
      searchConditions.push({ tracking_number: orderData.trackingId });

      // Also search platform_order_id in case tracking was stored there
      searchConditions.push({ platform_order_id: orderData.trackingId });
    }

    // Search by hash
    const hashVariants = this.getOrderHashVariants({
      platform,
      orderId: orderData.orderId,
      trackingId: orderData.trackingId,
      userId,
    });

    for (const hash of hashVariants) {
      searchConditions.push({ hash });
    }

    if (searchConditions.length === 0) return null;

    try {
      const existingOrder = await OrderModel.findOne({
        where: {
          user_id: userId,
          platform: platform,
          [OrderModel.sequelize.Op.or]: searchConditions,
        },
      });

      if (existingOrder) {
        console.log(
          `🔍 Found existing order: ${existingOrder.id} (${existingOrder.platform_order_id})`
        );
      }

      return existingOrder;
    } catch (error) {
      console.error("❌ Error finding existing order:", error);
      return null;
    }
  },

  /**
   * 🔧 NEW: Debug hash generation for troubleshooting
   */
  debugHashGeneration(orders) {
    console.log(`🔍 DEBUGGING HASH GENERATION:`);
    console.log("=".repeat(40));

    orders.forEach((order, index) => {
      const hash = this.getOrderHash({
        platform: order.platform,
        orderId: order.orderId || order.platform_order_id,
        userId: order.user_id || order.userId,
      });

      console.log(`\n${index + 1}. Order Analysis:`);
      console.log(`   Platform: ${order.platform}`);
      console.log(`   Order ID: ${order.orderId || order.platform_order_id}`);
      console.log(`   User ID: ${order.user_id || order.userId}`);
      console.log(`   Hash: ${hash.substring(0, 16)}...`);
      console.log(
        `   Product: ${
          order.product_name || order.products?.[0]?.name || "N/A"
        }`
      );
      console.log(`   Amount: ₹${order.total_amount || order.amount || 0}`);
    });

    return orders.map((order) => ({
      order,
      hash: this.getOrderHash({
        platform: order.platform,
        orderId: order.orderId || order.platform_order_id,
        userId: order.user_id || order.userId,
      }),
    }));
  },
};
