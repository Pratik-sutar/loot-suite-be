// routes/analytics.js - PRODUCTION VERSION WITH CALCULATIONS
const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middleware/authentication/index");
const { globalErrorHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger").createModuleLogger("AnalyticsAPI");

// Import OrderService
const OrderService = require("../services/database/orderService");

/**
 * GET /api/analytics/health
 * Public health check endpoint
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "operational",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/analytics
 * Main analytics endpoint - gets comprehensive analytics data
 */
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    const { timeRange = "12months", forceRefresh = false } = req.query;

    logger.info("Analytics request received", {
      userId,
      email: req.user.email,
      timeRange,
      forceRefresh,
    });

    // Validate time range
    const validTimeRanges = [
      "7days",
      "30days",
      "3months",
      "6months",
      "12months",
      "2years",
      "all",
    ];

    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        error: "Invalid time range",
        validRanges: validTimeRanges,
      });
    }

    // Initialize OrderService
    const orderService = new OrderService();

    // Fetch all analytics data in parallel
    const [orders, stats, dataQuality] = await Promise.all([
      // Get detailed orders for analytics
      orderService.getOrdersForAnalytics(userId, timeRange, {
        onlyWithAmounts: false,
        includeItems: true,
      }),
      // Get aggregated statistics
      orderService.getOrderAnalyticsStats(userId, timeRange),
      // Get data quality assessment
      orderService.testAnalyticsDataQuality(userId, timeRange),
    ]);

    // Calculate additional analytics metrics
    const analyticsMetrics = calculateAnalyticsMetrics(orders);

    // Prepare comprehensive response
    const analyticsData = {
      // Core data
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        platform: order.platform,
        date: order.date,
        amount: order.amount || 0,
        currency: order.currency || "INR",
        status: order.status,
        itemCount: order.items ? order.items.length : 0,
        items: order.items || [],
        trackingId: order.trackingId,
        deliveryStatus: order.deliveryStatus,
      })),

      // Statistics
      stats: {
        ...stats,
        ...analyticsMetrics,
      },

      // Data quality
      dataQuality,

      // Metadata
      timeRange,
      generatedAt: new Date().toISOString(),
      metadata: {
        totalOrdersFound: orders.length,
        ordersWithAmounts: orders.filter((o) => o.amount > 0).length,
        ordersWithoutAmounts: orders.filter((o) => !o.amount || o.amount === 0)
          .length,
        uniquePlatforms: [...new Set(orders.map((o) => o.platform))].filter(
          Boolean
        ),
        dateRange:
          orders.length > 0
            ? {
                oldest: orders[0].date,
                newest: orders[orders.length - 1].date,
              }
            : null,
        requestedBy: req.user.email,
      },
    };

    logger.info("Analytics data generated successfully", {
      userId,
      totalOrders: orders.length,
      timeRange,
      dataQualityScore: dataQuality.overallScore,
      ordersWithAmounts: analyticsData.metadata.ordersWithAmounts,
    });

    res.json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    logger.error("Analytics generation failed:", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: "Failed to generate analytics",
      message: error.message,
    });
  }
});

/**
 * GET /api/analytics/test-data-quality
 * Test data quality for analytics
 */
router.get("/test-data-quality", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    const { timeRange = "30days" } = req.query;

    const orderService = new OrderService();
    const dataQuality = await orderService.testAnalyticsDataQuality(
      userId,
      timeRange
    );

    res.json({
      success: true,
      dataQuality,
      metadata: {
        requestedBy: req.user.email,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Data quality test failed:", {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: "Data quality test failed",
      message: error.message,
    });
  }
});

/**
 * GET /api/analytics/summary
 * Quick summary endpoint for dashboard widgets
 */
router.get("/summary", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    const orderService = new OrderService();

    // Get quick stats for last 30 days
    const stats = await orderService.getOrderAnalyticsStats(userId, "30days");

    res.json({
      success: true,
      summary: {
        totalSpend: stats.totalSpend || 0,
        orderCount: stats.totalOrders || 0,
        avgOrderValue: stats.averageOrderValue || 0,
        topPlatform: stats.topPlatform || null,
        lastOrderDate: stats.lastOrderDate || null,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Summary generation failed:", {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: "Failed to generate summary",
    });
  }
});

/**
 * POST /api/analytics/refresh
 * Force refresh analytics data
 */
router.post("/refresh", authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    logger.info("Analytics refresh requested", {
      userId,
      email: req.user.email,
    });

    // Here you could trigger a re-sync of email data if needed
    // For now, just return success

    res.json({
      success: true,
      message: "Analytics refresh initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Analytics refresh failed:", {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: "Failed to refresh analytics",
    });
  }
});

/**
 * Helper function to calculate additional analytics metrics
 */
function calculateAnalyticsMetrics(orders) {
  if (!orders || orders.length === 0) {
    return {
      monthlyTrend: [],
      platformBreakdown: [],
      categoryBreakdown: [],
      deliveryStats: {},
    };
  }

  // Monthly spending trend - FIXED VERSION
  const monthlySpend = {};
  orders.forEach((order) => {
    if (order.date && order.amount > 0) {
      const month = new Date(order.date).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlySpend[month]) {
        monthlySpend[month] = {
          totalSpend: 0,
          orderCount: 0,
        };
      }
      monthlySpend[month].totalSpend += order.amount;
      monthlySpend[month].orderCount += 1;
    }
  });

  // Platform breakdown - FIXED to identify top platform by ORDER COUNT
  const platformStats = {};
  orders.forEach((order) => {
    if (order.platform) {
      if (!platformStats[order.platform]) {
        platformStats[order.platform] = {
          count: 0,
          totalSpend: 0,
          avgValue: 0,
        };
      }
      platformStats[order.platform].count++;
      platformStats[order.platform].totalSpend += order.amount || 0;
    }
  });

  // Calculate averages for platforms
  Object.keys(platformStats).forEach((platform) => {
    const stats = platformStats[platform];
    stats.avgValue = stats.count > 0 ? stats.totalSpend / stats.count : 0;
  });

  // Find top platform by ORDER COUNT (not spend)
  const topPlatformByCount = Object.entries(platformStats).sort(
    (a, b) => b[1].count - a[1].count
  )[0];

  const topPlatformBySpend = Object.entries(platformStats).sort(
    (a, b) => b[1].totalSpend - a[1].totalSpend
  )[0];

  // Category breakdown (from items)
  const categoryStats = {};
  orders.forEach((order) => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const category = item.category || "Uncategorized";
        if (!categoryStats[category]) {
          categoryStats[category] = {
            count: 0,
            totalSpend: 0,
          };
        }
        categoryStats[category].count++;
        categoryStats[category].totalSpend += parseFloat(
          item.total_price || item.price || 0
        );
      });
    }
  });

  // Delivery status breakdown
  const deliveryStats = {
    delivered: 0,
    inTransit: 0,
    pending: 0,
    cancelled: 0,
  };

  orders.forEach((order) => {
    const status = order.deliveryStatus || order.status || "pending";
    if (status.toLowerCase().includes("delivered")) {
      deliveryStats.delivered++;
    } else if (
      status.toLowerCase().includes("transit") ||
      status.toLowerCase().includes("shipped")
    ) {
      deliveryStats.inTransit++;
    } else if (status.toLowerCase().includes("cancel")) {
      deliveryStats.cancelled++;
    } else {
      deliveryStats.pending++;
    }
  });

  return {
    monthlyTrend: Object.entries(monthlySpend)
      .map(([month, data]) => ({
        month,
        totalSpend: data.totalSpend,
        orderCount: data.orderCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    platformBreakdown: Object.entries(platformStats)
      .map(([platform, stats]) => ({ platform, ...stats }))
      .sort((a, b) => b.totalSpend - a.totalSpend),
    categoryBreakdown: Object.entries(categoryStats)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.totalSpend - a.totalSpend),
    deliveryStats,
    topPlatformByCount: topPlatformByCount ? topPlatformByCount[0] : null,
    topPlatformBySpend: topPlatformBySpend ? topPlatformBySpend[0] : null,
  };
}

// Error handling middleware
router.use(globalErrorHandler);

module.exports = router;
