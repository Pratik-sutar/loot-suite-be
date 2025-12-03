// src/services/database/orderService.js

const { Order, OrderItem, User, sequelize } = require("../../models");
const { Op } = require("sequelize");
const logger = require("../../utils/logger").createModuleLogger("OrderService");
const { validatePagination } = require("../../utils/validation");

/**
 * Order Database Service
 * Handles all order-related database operations
 */
class OrderService {
  /**
   * Create a new order with items
   */
  constructor() {
    // Initialize logger for the instance
    this.logger = logger;
  }
  async createOrder(orderData, userId) {
    const transaction = await Order.sequelize.transaction();

    try {
      // Create order
      const order = await Order.create(
        {
          user_id: userId,
          platform: orderData.platform,
          platform_order_id: orderData.orderId,
          product_name: orderData.items?.[0]?.name || "Unknown Product",
          product_image: orderData.productImage,
          total_amount: orderData.amount || 0,
          currency: orderData.currency || "INR",
          order_date: orderData.orderDate || new Date(),
          status: orderData.status || "ordered",
          tracking_number: orderData.trackingId,
          carrier_name: orderData.carrierName,
          seller_name: orderData.sellerName,
          delivery_address: orderData.deliveryAddress,
          expected_delivery: orderData.expectedDelivery,
          delivered_date: orderData.deliveredDate,
          confidence_score: orderData.confidenceScore || 0.5,
          email_message_id: orderData.emailMessageId,
          raw_email_data: orderData.rawEmailData,
          parsed_data: orderData.parsedData,
          hash: orderData.hash,
          sync_id: orderData.syncId,
        },
        { transaction }
      );

      // Create order items if provided
      if (orderData.items && orderData.items.length > 0) {
        const orderItems = orderData.items.map((item) => ({
          order_id: order.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || item.price || 0,
          total_price: item.total_price || item.totalPrice || 0,
          image_url: item.image_url || item.imageUrl,
          product_url: item.product_url || item.productUrl,
          sku: item.sku,
          brand: item.brand,
          category: item.category,
          attributes: item.attributes,
        }));

        await OrderItem.bulkCreate(orderItems, { transaction });
      }

      await transaction.commit();

      logger.info("Order created successfully", {
        orderId: order.id,
        platformOrderId: order.platform_order_id,
        userId,
      });

      return order;
    } catch (error) {
      await transaction.rollback();
      logger.error("Error creating order", {
        error: error.message,
        userId,
        orderData: { platform: orderData.platform, orderId: orderData.orderId },
      });
      throw error;
    }
  }

  /**
   * Get orders for user with pagination and filtering
   */
  async getOrders(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      platform,
      status,
      startDate,
      endDate,
      includeItems = true,
      syncOnly = false,
    } = options;

    const pagination = validatePagination({ page, limit });

    // Build where clause
    const whereClause = { user_id: userId };

    if (platform) {
      whereClause.platform = platform;
    }

    if (status) {
      whereClause.status = status;
    }

    if (startDate && endDate) {
      whereClause.order_date = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // If syncOnly is true, get the latest sync ID and filter by it
    if (syncOnly) {
      const latestSync = await Order.findOne({
        where: { user_id: userId },
        attributes: ["sync_id"],
        order: [["created_at", "DESC"]],
        raw: true,
      });

      if (latestSync?.sync_id) {
        whereClause.sync_id = latestSync.sync_id;
      }
    }

    // Build include array
    const includeArray = [];
    if (includeItems) {
      includeArray.push({
        model: OrderItem,
        as: "OrderItems",
        attributes: [
          "id",
          "name",
          "description",
          "quantity",
          "unit_price",
          "total_price",
          "image_url",
          "product_url",
          "sku",
          "brand",
          "category",
          "attributes",
        ],
      });
    }

    // Execute query
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: includeArray,
      order: [["created_at", "DESC"]],
      limit: pagination.limit,
      offset: pagination.offset,
      attributes: [
        "id",
        "platform",
        "platform_order_id",
        "product_name",
        "product_image",
        "total_amount",
        "currency",
        "status",
        "order_date",
        "expected_delivery",
        "delivered_date",
        "tracking_number",
        "carrier_name",
        "seller_name",
        "confidence_score",
        "sync_id",
        "created_at",
        "updated_at",
      ],
    });

    logger.info("Orders retrieved successfully", {
      userId,
      count,
      page: pagination.page,
      limit: pagination.limit,
    });

    return {
      orders,
      pagination: {
        ...pagination,
        total: count,
        totalPages: Math.ceil(count / pagination.limit),
      },
    };
  }

  /**
   * Get order by ID with items
   */
  async getOrderById(orderId, userId) {
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
      include: [
        {
          model: OrderItem,
          as: "OrderItems",
          attributes: [
            "id",
            "name",
            "description",
            "quantity",
            "unit_price",
            "total_price",
            "image_url",
            "product_url",
            "sku",
            "brand",
            "category",
            "attributes",
          ],
        },
      ],
    });

    if (!order) {
      throw new Error("Order not found");
    }

    logger.info("Order retrieved successfully", {
      orderId,
      userId,
      itemsCount: order.OrderItems?.length || 0,
    });

    return order;
  }

  /**
   * Update order
   */
  async updateOrder(orderId, userId, updateData) {
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    const updatedOrder = await order.update(updateData);

    logger.info("Order updated successfully", {
      orderId,
      userId,
      updatedFields: Object.keys(updateData),
    });

    return updatedOrder;
  }

  /**
   * Delete order
   */
  async deleteOrder(orderId, userId) {
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    await order.destroy();

    logger.info("Order deleted successfully", {
      orderId,
      userId,
    });

    return true;
  }

  /**
   * Search orders
   */
  async searchOrders(userId, searchQuery, options = {}) {
    const { platforms = [], dateRange = {}, limit = 20 } = options;

    const whereClause = {
      user_id: userId,
      [Op.or]: [
        { platform_order_id: { [Op.iLike]: `%${searchQuery}%` } },
        { product_name: { [Op.iLike]: `%${searchQuery}%` } },
        { tracking_number: { [Op.iLike]: `%${searchQuery}%` } },
      ],
    };

    if (platforms.length > 0) {
      whereClause.platform = { [Op.in]: platforms };
    }

    if (dateRange.startDate && dateRange.endDate) {
      whereClause.order_date = {
        [Op.between]: [
          new Date(dateRange.startDate),
          new Date(dateRange.endDate),
        ],
      };
    }

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          as: "OrderItems",
          attributes: ["id", "name", "quantity", "unit_price"],
        },
      ],
      order: [["order_date", "DESC"]],
      limit,
    });

    logger.info("Orders search completed", {
      userId,
      searchQuery,
      resultsCount: orders.length,
    });

    return orders;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(userId, dateRange = {}) {
    const whereClause = { user_id: userId };

    if (dateRange.startDate && dateRange.endDate) {
      whereClause.order_date = {
        [Op.between]: [
          new Date(dateRange.startDate),
          new Date(dateRange.endDate),
        ],
      };
    }

    const stats = await Order.findAll({
      where: whereClause,
      attributes: [
        "platform",
        "status",
        [Order.sequelize.fn("COUNT", "*"), "count"],
        [
          Order.sequelize.fn("SUM", Order.sequelize.col("total_amount")),
          "total_spent",
        ],
      ],
      group: ["platform", "status"],
      raw: true,
    });

    return stats;
  }

  /**
   * Check if order exists by platform order ID
   */
  async orderExists(userId, platform, platformOrderId) {
    const order = await Order.findOne({
      where: {
        user_id: userId,
        platform,
        platform_order_id: platformOrderId,
      },
      attributes: ["id"],
    });

    return !!order;
  }

  /**
   * Get orders by sync ID
   */
  async getOrdersBySyncId(userId, syncId) {
    const orders = await Order.findAll({
      where: {
        user_id: userId,
        sync_id: syncId,
      },
      include: [
        {
          model: OrderItem,
          as: "OrderItems",
          attributes: ["id", "name", "quantity", "unit_price", "total_price"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return orders;
  }

  /**
   * 📊 NEW: Get orders for analytics with optimized queries
   */
  // async getOrdersForAnalytics(userId, timeRange = "12months", options = {}) {
  //   try {
  //     const cutoffDate = this.calculateAnalyticsCutoffDate(timeRange);

  //     logger.info("Fetching orders for analytics", {
  //       userId,
  //       timeRange,
  //       cutoffDate,
  //       module: "OrderService",
  //     });

  //     // Build where clause
  //     const whereClause = {
  //       user_id: userId,
  //       order_date: {
  //         [Op.gte]: cutoffDate,
  //       },
  //     };

  //     // Optional: Filter by platforms
  //     if (options.platforms && options.platforms.length > 0) {
  //       whereClause.platform = { [Op.in]: options.platforms };
  //     }

  //     // Optional: Only orders with amounts
  //     if (options.onlyWithAmounts) {
  //       whereClause.total_amount = { [Op.gt]: 0 };
  //     }

  //     const orders = await Order.findAll({
  //       where: whereClause,
  //       include: [
  //         {
  //           model: OrderItem,
  //           as: "OrderItems",
  //           attributes: [
  //             "id",
  //             "name",
  //             "quantity",
  //             "unit_price",
  //             "total_price",
  //             "brand",
  //             "category",
  //             "attributes",
  //           ],
  //           required: false, // LEFT JOIN to include orders without items
  //         },
  //       ],
  //       attributes: [
  //         "id",
  //         "platform",
  //         "platform_order_id",
  //         "product_name",
  //         "total_amount",
  //         "currency",
  //         "order_date",
  //         "status",
  //         "tracking_number",
  //         "expected_delivery",
  //         "delivered_date",
  //         "confidence_score",
  //         "created_at",
  //         "updated_at",
  //       ],
  //       order: [["order_date", "DESC"]],
  //       raw: false, // Need full objects for analytics
  //       nest: true,
  //     });

  //     // Transform data for analytics consumption
  //     const analyticsOrders = orders.map((order) => {
  //       const orderJson = order.toJSON();

  //       return {
  //         id: orderJson.id,
  //         platform: orderJson.platform,
  //         orderId: orderJson.platform_order_id,
  //         amount: parseFloat(orderJson.total_amount) || 0,
  //         date: orderJson.order_date,
  //         timestamp: orderJson.order_date, // Alias for compatibility
  //         status: orderJson.status,
  //         items: this.formatOrderItemsForAnalytics(orderJson.OrderItems || []),
  //         trackingId: orderJson.tracking_number,
  //         expectedDelivery: orderJson.expected_delivery,
  //         deliveredDate: orderJson.delivered_date,
  //         confidence: orderJson.confidence_score || 0.5,
  //         createdAt: orderJson.created_at,
  //         updatedAt: orderJson.updated_at,
  //       };
  //     });

  //     logger.info("Analytics orders fetched successfully", {
  //       userId,
  //       orderCount: analyticsOrders.length,
  //       timeRange,
  //       module: "OrderService",
  //     });

  //     return analyticsOrders;
  //   } catch (error) {
  //     logger.error("Failed to fetch orders for analytics", {
  //       error: error.message,
  //       userId,
  //       timeRange,
  //       module: "OrderService",
  //     });
  //     throw new Error(`Analytics data fetch failed: ${error.message}`);
  //   }
  // }

  // /**
  //  * 📊 NEW: Get aggregated order statistics for analytics
  //  */
  // async getOrderAnalyticsStats(userId, timeRange = "12months") {
  //   try {
  //     const cutoffDate = this.calculateAnalyticsCutoffDate(timeRange);

  //     // Get aggregated stats using Sequelize aggregation
  //     const stats = await Order.findAll({
  //       where: {
  //         user_id: userId,
  //         order_date: { [Op.gte]: cutoffDate },
  //       },
  //       attributes: [
  //         "platform",
  //         "status",
  //         [Order.sequelize.fn("COUNT", "*"), "orderCount"],
  //         [
  //           Order.sequelize.fn("SUM", Order.sequelize.col("total_amount")),
  //           "totalSpent",
  //         ],
  //         [
  //           Order.sequelize.fn("AVG", Order.sequelize.col("total_amount")),
  //           "avgOrderValue",
  //         ],
  //         [
  //           Order.sequelize.fn("MIN", Order.sequelize.col("order_date")),
  //           "earliestOrder",
  //         ],
  //         [
  //           Order.sequelize.fn("MAX", Order.sequelize.col("order_date")),
  //           "latestOrder",
  //         ],
  //       ],
  //       group: ["platform", "status"],
  //       raw: true,
  //     });

  //     // Get monthly breakdown
  //     const monthlyStats = await Order.findAll({
  //       where: {
  //         user_id: userId,
  //         order_date: { [Op.gte]: cutoffDate },
  //       },
  //       attributes: [
  //         [
  //           Order.sequelize.fn(
  //             "DATE_TRUNC",
  //             "month",
  //             Order.sequelize.col("order_date")
  //           ),
  //           "month",
  //         ],
  //         [Order.sequelize.fn("COUNT", "*"), "orderCount"],
  //         [
  //           Order.sequelize.fn("SUM", Order.sequelize.col("total_amount")),
  //           "totalSpent",
  //         ],
  //       ],
  //       group: [
  //         Order.sequelize.fn(
  //           "DATE_TRUNC",
  //           "month",
  //           Order.sequelize.col("order_date")
  //         ),
  //       ],
  //       order: [
  //         [
  //           Order.sequelize.fn(
  //             "DATE_TRUNC",
  //             "month",
  //             Order.sequelize.col("order_date")
  //           ),
  //           "ASC",
  //         ],
  //       ],
  //       raw: true,
  //     });

  //     return {
  //       platformStats: stats,
  //       monthlyStats: monthlyStats,
  //     };
  //   } catch (error) {
  //     logger.error("Failed to get analytics stats", {
  //       error: error.message,
  //       userId,
  //       timeRange,
  //       module: "OrderService",
  //     });
  //     throw error;
  //   }
  // }

  // /**
  //  * 📊 NEW: Create analytics performance indexes
  //  */
  // async createAnalyticsIndexes() {
  //   try {
  //     logger.info("Creating analytics performance indexes", {
  //       module: "OrderService",
  //     });

  //     // These indexes will speed up analytics queries significantly
  //     const indexes = [
  //       "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_date ON orders(user_id, order_date)",
  //       "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_platform_amount ON orders(platform, total_amount)",
  //       "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_date ON orders(status, order_date)",
  //       "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_analytics ON orders(user_id, order_date, platform, total_amount)",
  //     ];

  //     // Execute each index creation
  //     for (const indexQuery of indexes) {
  //       try {
  //         await Order.sequelize.query(indexQuery);
  //         logger.info("Created analytics index", {
  //           index: indexQuery.match(/idx_[\w]+/)?.[0] || "unknown",
  //           module: "OrderService",
  //         });
  //       } catch (indexError) {
  //         // Index might already exist - log but don't fail
  //         logger.warn("Index creation skipped", {
  //           error: indexError.message,
  //           module: "OrderService",
  //         });
  //       }
  //     }

  //     logger.info("Analytics indexes setup completed", {
  //       module: "OrderService",
  //     });
  //   } catch (error) {
  //     logger.error("Failed to create analytics indexes", {
  //       error: error.message,
  //       module: "OrderService",
  //     });
  //     // Don't throw - indexes are performance optimization, not critical
  //   }
  // }

  // /**
  //  * 📊 NEW: Calculate cutoff date for analytics time ranges
  //  */
  // calculateAnalyticsCutoffDate(timeRange) {
  //   const now = new Date();
  //   const cutoff = new Date();

  //   switch (timeRange) {
  //     case "7days":
  //       cutoff.setDate(now.getDate() - 7);
  //       break;
  //     case "30days":
  //       cutoff.setDate(now.getDate() - 30);
  //       break;
  //     case "3months":
  //       cutoff.setMonth(now.getMonth() - 3);
  //       break;
  //     case "6months":
  //       cutoff.setMonth(now.getMonth() - 6);
  //       break;
  //     case "12months":
  //       cutoff.setFullYear(now.getFullYear() - 1);
  //       break;
  //     case "2years":
  //       cutoff.setFullYear(now.getFullYear() - 2);
  //       break;
  //     default:
  //       // Default to 12 months
  //       cutoff.setFullYear(now.getFullYear() - 1);
  //   }

  //   return cutoff;
  // }

  // /**
  //  * 📊 NEW: Format order items for analytics
  //  */
  // formatOrderItemsForAnalytics(orderItems) {
  //   if (!orderItems || orderItems.length === 0) {
  //     return ["Order details not available"];
  //   }

  //   return orderItems.map((item) => ({
  //     name: item.name || "Item name not available",
  //     quantity: item.quantity || 1,
  //     price: parseFloat(item.unit_price) || 0,
  //     totalPrice: parseFloat(item.total_price) || 0,
  //     brand: item.brand,
  //     category: item.category,
  //   }));
  // }

  // /**
  //  * 📊 NEW: Test analytics data quality
  //  */
  // async testAnalyticsDataQuality(userId, timeRange = "30days") {
  //   try {
  //     logger.info("Testing analytics data quality", {
  //       userId,
  //       timeRange,
  //       module: "OrderService",
  //     });

  //     const orders = await this.getOrdersForAnalytics(userId, timeRange);

  //     const qualityStats = {
  //       totalOrders: orders.length,
  //       ordersWithAmount: orders.filter((o) => o.amount > 0).length,
  //       ordersWithPlatform: orders.filter(
  //         (o) => o.platform && o.platform !== "unknown"
  //       ).length,
  //       ordersWithDate: orders.filter((o) => o.date).length,
  //       ordersWithItems: orders.filter((o) => o.items && o.items.length > 0)
  //         .length,
  //       platforms: [...new Set(orders.map((o) => o.platform))],
  //       dateRange:
  //         orders.length > 0
  //           ? {
  //               oldest: new Date(
  //                 Math.min(...orders.map((o) => new Date(o.date).getTime()))
  //               ),
  //               newest: new Date(
  //                 Math.max(...orders.map((o) => new Date(o.date).getTime()))
  //               ),
  //             }
  //           : null,
  //       totalSpent: orders.reduce((sum, order) => sum + (order.amount || 0), 0),
  //       averageOrderValue:
  //         orders.length > 0
  //           ? orders.reduce((sum, order) => sum + (order.amount || 0), 0) /
  //             orders.length
  //           : 0,
  //     };

  //     // Calculate quality percentages
  //     const qualityPercentages = {
  //       amountAvailability:
  //         orders.length > 0
  //           ? (qualityStats.ordersWithAmount / qualityStats.totalOrders) * 100
  //           : 0,
  //       platformAvailability:
  //         orders.length > 0
  //           ? (qualityStats.ordersWithPlatform / qualityStats.totalOrders) * 100
  //           : 0,
  //       itemsAvailability:
  //         orders.length > 0
  //           ? (qualityStats.ordersWithItems / qualityStats.totalOrders) * 100
  //           : 0,
  //     };

  //     // Generate warnings
  //     const warnings = [];
  //     if (qualityPercentages.amountAvailability < 80) {
  //       warnings.push(
  //         `${Math.round(
  //           100 - qualityPercentages.amountAvailability
  //         )}% of orders missing amount data`
  //       );
  //     }
  //     if (qualityPercentages.platformAvailability < 90) {
  //       warnings.push(
  //         `${Math.round(
  //           100 - qualityPercentages.platformAvailability
  //         )}% of orders missing platform data`
  //       );
  //     }
  //     if (qualityStats.totalOrders === 0) {
  //       warnings.push(
  //         `No orders found for the selected time range (${timeRange})`
  //       );
  //     }

  //     const dataQuality = {
  //       ...qualityStats,
  //       qualityPercentages,
  //       warnings,
  //       overallScore: Math.round(
  //         (qualityPercentages.amountAvailability +
  //           qualityPercentages.platformAvailability +
  //           qualityPercentages.itemsAvailability) /
  //           3
  //       ),
  //       recommendation: this.getDataQualityRecommendation(qualityPercentages),
  //     };

  //     logger.info("Analytics data quality assessment completed", {
  //       userId,
  //       overallScore: dataQuality.overallScore,
  //       totalOrders: qualityStats.totalOrders,
  //       warnings: warnings.length,
  //       module: "OrderService",
  //     });

  //     return dataQuality;
  //   } catch (error) {
  //     logger.error("Analytics data quality test failed", {
  //       error: error.message,
  //       userId,
  //       timeRange,
  //       module: "OrderService",
  //     });
  //     throw error;
  //   }
  // }

  // /**
  //  * Get data quality recommendation
  //  */
  // getDataQualityRecommendation(percentages) {
  //   const avgScore =
  //     (percentages.amountAvailability +
  //       percentages.platformAvailability +
  //       percentages.itemsAvailability) /
  //     3;

  //   if (avgScore >= 90) return "excellent";
  //   if (avgScore >= 75) return "good";
  //   if (avgScore >= 60) return "fair";
  //   return "poor";
  // }
  async getOrdersForAnalytics(userId, timeRange = "12months", options = {}) {
    try {
      const { onlyWithAmounts = false, includeItems = true } = options;

      logger.info("Fetching orders for analytics", {
        userId,
        timeRange,
        options,
      });

      // Build where clause with correct column names
      const whereClause = {
        user_id: userId,
      };

      // Add date filter using order_date column
      if (timeRange !== "all") {
        const startDate = this.getStartDateForTimeRange(timeRange);
        whereClause.order_date = {
          [Op.gte]: startDate,
        };
      }

      // Filter only orders with amounts if requested
      if (onlyWithAmounts) {
        whereClause.total_amount = {
          [Op.gt]: 0,
        };
      }

      // Build include array - check your association alias
      const include = [];
      if (includeItems) {
        include.push({
          model: OrderItem,
          as: "OrderItems", // Make sure this matches your association
          attributes: [
            "id",
            "name",
            "quantity",
            "unit_price",
            "total_price",
            "description",
            "category",
            "brand",
          ],
          required: false, // Don't exclude orders without items
        });
      }

      const orders = await Order.findAll({
        where: whereClause,
        include,
        order: [["order_date", "DESC"]],
        raw: false, // Need nested data
      });

      // Transform to expected format
      const transformedOrders = orders.map((order) => {
        const orderData = order.get({ plain: true });
        return {
          id: orderData.id,
          orderNumber: orderData.platform_order_id || orderData.order_id,
          platform: orderData.platform,
          date: orderData.order_date,
          amount: parseFloat(orderData.total_amount) || 0,
          currency: orderData.currency || "INR",
          status: orderData.status,
          trackingId: orderData.tracking_id || orderData.tracking_number,
          deliveryStatus: orderData.status,
          items: orderData.OrderItems || [], // Note: OrderItems not items
          // Additional fields
          sellerName: orderData.seller_name,
          deliveredDate: orderData.delivered_date,
          expectedDelivery: orderData.expected_delivery,
          emailMessageId: orderData.email_message_id,
        };
      });

      logger.info("Analytics orders fetched successfully", {
        userId,
        orderCount: transformedOrders.length,
        ordersWithAmounts: transformedOrders.filter((o) => o.amount > 0).length,
      });

      return transformedOrders;
    } catch (error) {
      logger.error("Failed to fetch orders for analytics", {
        error: error.message,
        stack: error.stack,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get aggregated statistics with correct column names
   */
  async getOrderAnalyticsStats(userId, timeRange = "12months") {
    try {
      logger.info("Calculating order analytics stats", {
        userId,
        timeRange,
      });

      // Build where clause
      const whereClause = {
        user_id: userId,
      };

      if (timeRange !== "all") {
        const startDate = this.getStartDateForTimeRange(timeRange);
        whereClause.order_date = {
          [Op.gte]: startDate,
        };
      }

      // Get basic stats using correct column names
      const stats = await Order.findOne({
        where: whereClause,
        attributes: [
          [sequelize.fn("COUNT", sequelize.col("id")), "totalOrders"],
          [sequelize.fn("SUM", sequelize.col("total_amount")), "totalSpend"],
          [
            sequelize.fn("AVG", sequelize.col("total_amount")),
            "averageOrderValue",
          ],
          [sequelize.fn("MAX", sequelize.col("order_date")), "lastOrderDate"],
          [sequelize.fn("MIN", sequelize.col("order_date")), "firstOrderDate"],
        ],
        raw: true,
      });

      // Get platform breakdown
      const platformStats = await Order.findAll({
        where: whereClause,
        attributes: [
          "platform",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("total_amount")), "total"],
        ],
        group: ["platform"],
        raw: true,
      });

      // Get top platform
      const topPlatform =
        platformStats.length > 0
          ? platformStats.reduce((prev, current) =>
              parseFloat(current.total || 0) > parseFloat(prev.total || 0)
                ? current
                : prev
            ).platform
          : null;

      // Get monthly breakdown - use appropriate date formatting based on your DB
      let monthlyStats = [];

      try {
        // Try MySQL/MariaDB format first
        monthlyStats = await Order.findAll({
          where: whereClause,
          attributes: [
            [
              sequelize.fn("DATE_FORMAT", sequelize.col("order_date"), "%Y-%m"),
              "month",
            ],
            [sequelize.fn("COUNT", sequelize.col("id")), "orderCount"],
            [sequelize.fn("SUM", sequelize.col("total_amount")), "totalSpend"],
          ],
          group: [
            sequelize.fn("DATE_FORMAT", sequelize.col("order_date"), "%Y-%m"),
          ],
          order: [
            [
              sequelize.fn("DATE_FORMAT", sequelize.col("order_date"), "%Y-%m"),
              "ASC",
            ],
          ],
          raw: true,
        });
      } catch (e) {
        // If DATE_FORMAT fails, try a simpler approach
        logger.warn("DATE_FORMAT failed, using fallback method", {
          error: e.message,
        });
        monthlyStats = await Order.findAll({
          where: whereClause,
          attributes: [
            "order_date",
            [sequelize.fn("COUNT", sequelize.col("id")), "orderCount"],
            [sequelize.fn("SUM", sequelize.col("total_amount")), "totalSpend"],
          ],
          group: ["order_date"],
          order: [["order_date", "ASC"]],
          raw: true,
        });

        // Group by month manually
        const monthlyMap = {};
        monthlyStats.forEach((stat) => {
          const month = new Date(stat.order_date).toISOString().slice(0, 7);
          if (!monthlyMap[month]) {
            monthlyMap[month] = {
              month,
              orderCount: 0,
              totalSpend: 0,
            };
          }
          monthlyMap[month].orderCount += parseInt(stat.orderCount) || 0;
          monthlyMap[month].totalSpend += parseFloat(stat.totalSpend) || 0;
        });
        monthlyStats = Object.values(monthlyMap).sort((a, b) =>
          a.month.localeCompare(b.month)
        );
      }

      return {
        totalOrders: parseInt(stats?.totalOrders) || 0,
        totalSpend: parseFloat(stats?.totalSpend) || 0,
        averageOrderValue: parseFloat(stats?.averageOrderValue) || 0,
        lastOrderDate: stats?.lastOrderDate,
        firstOrderDate: stats?.firstOrderDate,
        topPlatform,
        platformBreakdown: platformStats.map((p) => ({
          platform: p.platform,
          count: parseInt(p.count) || 0,
          totalSpend: parseFloat(p.total) || 0,
        })),
        monthlyTrend: monthlyStats.map((m) => ({
          month: m.month,
          orderCount: parseInt(m.orderCount) || 0,
          totalSpend: parseFloat(m.totalSpend) || 0,
        })),
      };
    } catch (error) {
      logger.error("Failed to calculate analytics stats", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Test data quality with correct column names
   */
  async testAnalyticsDataQuality(userId, timeRange = "30days") {
    try {
      logger.info("Testing analytics data quality", {
        userId,
        timeRange,
      });

      const whereClause = {
        user_id: userId,
      };

      if (timeRange !== "all") {
        const startDate = this.getStartDateForTimeRange(timeRange);
        whereClause.order_date = {
          [Op.gte]: startDate,
        };
      }

      // Count different data quality aspects
      const [
        totalOrders,
        ordersWithAmount,
        ordersWithPlatform,
        ordersWithTracking,
        ordersWithItems,
      ] = await Promise.all([
        Order.count({ where: whereClause }),
        Order.count({
          where: {
            ...whereClause,
            total_amount: { [Op.gt]: 0 },
          },
        }),
        Order.count({
          where: {
            ...whereClause,
            platform: { [Op.ne]: null },
          },
        }),
        Order.count({
          where: {
            ...whereClause,
            [Op.or]: [
              { tracking_id: { [Op.ne]: null } },
              { tracking_number: { [Op.ne]: null } },
            ],
          },
        }),
        Order.count({
          where: whereClause,
          include: [
            {
              model: OrderItem,
              as: "OrderItems", // Make sure this matches your association
              required: true,
            },
          ],
          distinct: true, // Count distinct orders, not total rows
        }),
      ]);

      const scores = {
        amountCompleteness:
          totalOrders > 0 ? (ordersWithAmount / totalOrders) * 100 : 0,
        platformCompleteness:
          totalOrders > 0 ? (ordersWithPlatform / totalOrders) * 100 : 0,
        trackingCompleteness:
          totalOrders > 0 ? (ordersWithTracking / totalOrders) * 100 : 0,
        itemCompleteness:
          totalOrders > 0 ? (ordersWithItems / totalOrders) * 100 : 0,
      };

      const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / 4;

      logger.info("Analytics data quality assessment completed", {
        userId,
        totalOrders,
        overallScore,
      });

      return {
        totalOrders,
        ordersWithAmount,
        ordersWithPlatform,
        ordersWithTracking,
        ordersWithItems,
        scores,
        overallScore,
        timeRange,
        assessedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to assess data quality", {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Helper method to get start date for time range
   */
  getStartDateForTimeRange(timeRange) {
    const now = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case "7days":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30days":
        startDate.setDate(now.getDate() - 30);
        break;
      case "3months":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "12months":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case "2years":
        startDate.setFullYear(now.getFullYear() - 2);
        break;
      case "all":
        return new Date("2000-01-01"); // Far past date to get all
      default:
        startDate.setFullYear(now.getFullYear() - 1);
    }

    return startDate;
  }
}

module.exports = OrderService;
