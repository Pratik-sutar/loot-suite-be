// backend/src/routes/orders.js - ENHANCED WITH ORDER ITEMS
const express = require("express");
const { Op } = require("sequelize");
const { authenticateJWT } = require("../middleware/auth");
const {
  catchAsync,
  AppError,
  NotFoundError,
} = require("../middleware/errorHandler");
const { Order, OrderItem, User } = require("../models");
const logger = require("../utils/logger").createModuleLogger("OrderRoutes");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateJWT);

// @route   GET /api/orders
// @desc    Get paginated orders for authenticated user WITH ITEMS
// @access  Private
router.get(
  "/",
  authenticateJWT,
  catchAsync(async (req, res) => {
    try {
      const userId = req.user.id;
      const includeItems = req.query.includeItems !== "false"; // Default to true
      const syncOnly = req.query.syncOnly === "true"; // New parameter to show only latest sync orders

      console.log("=== ENHANCED ORDERS API DEBUG ===");
      console.log("User ID:", userId);
      console.log("Include Items:", includeItems);
      console.log("Sync Only:", syncOnly);
      console.log("===============================");

      logger.info("Fetching orders for user", {
        userId,
        includeItems,
        syncOnly,
      });

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
            "brand",
            "category",
            "attributes",
          ],
        });
      }

      // Build where clause
      const whereClause = {
        user_id: userId,
      };

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
          console.log(`Filtering by latest sync ID: ${latestSync.sync_id}`);
        }
      }

      // Get orders with pagination and items
      const { count, rows: orders } = await Order.findAndCountAll({
        where: whereClause,
        include: includeArray,
        order: [["created_at", "DESC"]],
        // No limit - fetch all orders
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

      console.log("📊 Enhanced database query results:");
      console.log("Total count:", count);
      console.log("Orders returned:", orders.length);
      console.log(
        "Orders with items:",
        orders.filter((o) => o.OrderItems?.length > 0).length
      );

      // Log sample order with items
      if (orders.length > 0) {
        const sampleOrder = orders[0];
        console.log("Sample order:", {
          id: sampleOrder.id,
          platform: sampleOrder.platform,
          orderId: sampleOrder.platform_order_id,
          productName: sampleOrder.product_name,
          amount: sampleOrder.total_amount,
          itemsCount: sampleOrder.OrderItems?.length || 0,
        });

        if (sampleOrder.OrderItems?.length > 0) {
          console.log(
            "Sample items:",
            sampleOrder.OrderItems.slice(0, 3).map((item) => ({
              name: item.name?.substring(0, 50),
              quantity: item.quantity,
              price: item.unit_price,
            }))
          );
        }
      }

      logger.info("Enhanced orders fetched successfully", {
        userId,
        count,
        ordersWithItems: orders.filter((o) => o.OrderItems?.length > 0).length,
      });

      // Format response with enhanced data
      const formattedOrders = orders.map((order) => {
        const baseOrder = {
          id: order.id,
          platform: order.platform,
          platform_order_id: order.platform_order_id,
          orderId: order.platform_order_id, // For frontend compatibility
          product_name: order.product_name,
          productName: order.product_name, // For frontend compatibility
          product_image: order.product_image,
          total_amount: parseFloat(order.total_amount), // Ensure it's a number
          totalAmount: parseFloat(order.total_amount), // For frontend compatibility
          currency: order.currency,
          status: order.status,
          order_date: order.order_date,
          orderDate: order.order_date, // For frontend compatibility
          expected_delivery: order.expected_delivery,
          delivered_date: order.delivered_date,
          tracking_number: order.tracking_number,
          trackingId: order.tracking_number, // For frontend compatibility
          carrier_name: order.carrier_name,
          seller_name: order.seller_name,
          confidence_score: order.confidence_score,
          created_at: order.created_at,
          updated_at: order.updated_at,
        };

        // FIXED: Proper items mapping for frontend compatibility
        if (includeItems && order.OrderItems && order.OrderItems.length > 0) {
          baseOrder.items = order.OrderItems.map((item) => ({
            id: item.id,
            name: item.name || "Unknown Item",
            description: item.description,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.unit_price) || 0, // Frontend expects 'price' not 'unit_price'
            unit_price: parseFloat(item.unit_price) || 0,
            unitPrice: parseFloat(item.unit_price) || 0, // Frontend compatibility
            total_price: parseFloat(item.total_price) || 0,
            totalPrice: parseFloat(item.total_price) || 0, // Frontend compatibility
            image_url: item.image_url,
            imageUrl: item.image_url, // Frontend compatibility
            product_url: item.product_url,
            productUrl: item.product_url, // Frontend compatibility
            brand: item.brand,
            category: item.category,
            attributes: item.attributes,
          }));

          baseOrder.itemsCount = order.OrderItems.length;
          baseOrder.itemsTotal = order.OrderItems.reduce(
            (sum, item) => sum + parseFloat(item.total_price || 0),
            0
          );
        } else {
          baseOrder.items = []; // Always provide items array, even if empty
          baseOrder.itemsCount = 0;
          baseOrder.itemsTotal = 0;
        }

        return baseOrder;
      });

      console.log("📊 ITEMS MAPPING DEBUG:");
      if (
        formattedOrders.length > 0 &&
        formattedOrders[0].items &&
        formattedOrders[0].items.length > 0
      ) {
        console.log("✅ Sample formatted order with items:");
        console.log("Order ID:", formattedOrders[0].orderId);
        console.log("Items count:", formattedOrders[0].items.length);
        console.log(
          "Sample items:",
          formattedOrders[0].items.slice(0, 2).map((item) => ({
            name: item.name?.substring(0, 40) + "...",
            quantity: item.quantity,
            price: item.price, // This should match frontend expectation
            unit_price: item.unit_price,
          }))
        );
      } else {
        console.log("⚠️  No items found in formatted orders");
        console.log("Raw order items:", orders[0]?.OrderItems?.length || 0);
      }

      res.json({
        success: true,
        data: {
          orders: formattedOrders,
          pagination: {
            currentPage: 1,
            totalPages: 1, // All orders on one page
            totalCount: count,
            hasNext: false, // No pagination
            hasPrev: false, // No pagination
          },
          summary: {
            totalOrders: count,
            ordersWithItems: orders.filter((o) => o.OrderItems?.length > 0)
              .length,
            totalItems: orders.reduce(
              (sum, o) => sum + (o.OrderItems?.length || 0),
              0
            ),
          },
          lastSync: new Date(),
        },
      });
    } catch (error) {
      console.error("❌ Enhanced Orders API error:", {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
      });

      logger.error("Error fetching enhanced orders:", {
        userId: req.user?.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: "Failed to fetch orders",
        error:
          process.env.NODE_ENV === "development" ||
          process.env.DEBUG_MODE === "true"
            ? error.message
            : undefined,
      });
    }
  })
);

// @route   GET /api/orders/:id
// @desc    Get specific order details WITH ITEMS
// @access  Private
router.get(
  "/:id",
  catchAsync(async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      console.log("🔍 Fetching order details with items:", id);

      const order = await Order.findOne({
        where: { id, user_id: userId },
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
        throw new NotFoundError("Order not found");
      }

      console.log(
        "✅ Order found with",
        order.OrderItems?.length || 0,
        "items"
      );

      logger.info("Order details fetched", {
        orderId: id,
        userId,
        itemsCount: order.OrderItems?.length || 0,
      });

      res.json({
        success: true,
        data: {
          order: {
            id: order.id,
            platform: order.platform,
            platform_order_id: order.platform_order_id,
            orderId: order.platform_order_id, // Frontend compatibility
            product_name: order.product_name,
            productName: order.product_name, // Frontend compatibility
            product_image: order.product_image,
            total_amount: parseFloat(order.total_amount),
            totalAmount: parseFloat(order.total_amount), // Frontend compatibility
            currency: order.currency,
            status: order.status,
            order_date: order.order_date,
            orderDate: order.order_date, // Frontend compatibility
            expected_delivery: order.expected_delivery,
            delivered_date: order.delivered_date,
            tracking_number: order.tracking_number,
            trackingId: order.tracking_number, // Frontend compatibility
            carrier_name: order.carrier_name,
            seller_name: order.seller_name,
            confidence_score: order.confidence_score,
            created_at: order.created_at,
            updated_at: order.updated_at,

            // FIXED: Proper items mapping
            items:
              order.OrderItems?.map((item) => ({
                id: item.id,
                name: item.name || "Unknown Item",
                description: item.description,
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.unit_price) || 0, // Frontend expects 'price'
                unit_price: parseFloat(item.unit_price) || 0,
                unitPrice: parseFloat(item.unit_price) || 0,
                total_price: parseFloat(item.total_price) || 0,
                totalPrice: parseFloat(item.total_price) || 0,
                image_url: item.image_url,
                imageUrl: item.image_url,
                product_url: item.product_url,
                productUrl: item.product_url,
                sku: item.sku,
                brand: item.brand,
                category: item.category,
                attributes: item.attributes,
              })) || [],

            itemsCount: order.OrderItems?.length || 0,
            itemsTotal:
              order.OrderItems?.reduce(
                (sum, item) => sum + parseFloat(item.total_price || 0),
                0
              ) || 0,
          },
        },
      });
    } catch (error) {
      logger.error("Error fetching order details:", {
        orderId: req.params.id,
        userId: req.user?.id,
        error: error.message,
      });
      throw error;
    }
  })
);

router.get(
  "/debug/items",
  catchAsync(async (req, res) => {
    const userId = req.user.id;

    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: "OrderItems",
          required: false,
        },
      ],
      limit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 3,
      order: [["created_at", "DESC"]],
    });

    const debug = orders.map((order) => ({
      orderId: order.platform_order_id,
      platform: order.platform,
      rawItemsCount: order.OrderItems?.length || 0,
      rawItems:
        order.OrderItems?.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          dataTypes: {
            name: typeof item.name,
            quantity: typeof item.quantity,
            unit_price: typeof item.unit_price,
          },
        })) || [],
    }));

    res.json({
      success: true,
      debug: debug,
      message: "Raw database structure for debugging",
    });
  })
);

// Keep all other existing routes unchanged...
// (stats, search, update status, delete routes remain the same)

module.exports = router;
