// src/middleware/validation/orderValidation.js

const { body, query, param, validationResult } = require("express-validator");
const { PLATFORMS, ORDER_STATUS } = require("../../constants");
const { validationErrorResponse } = require("../../utils/response");

/**
 * Validation middleware for order creation
 */
const validateOrderCreation = [
  body("platform")
    .isIn(Object.values(PLATFORMS))
    .withMessage("Invalid platform"),

  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isString()
    .withMessage("Order ID must be a string"),

  body("amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount must be a positive number"),

  body("status")
    .optional()
    .isIn(Object.values(ORDER_STATUS))
    .withMessage("Invalid order status"),

  body("orderDate")
    .optional()
    .isISO8601()
    .withMessage("Order date must be a valid date"),

  body("items").optional().isArray().withMessage("Items must be an array"),

  body("items.*.name")
    .optional()
    .isString()
    .withMessage("Item name must be a string"),

  body("items.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Item quantity must be a positive integer"),

  body("items.*.unit_price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Item unit price must be a positive number"),
];

/**
 * Validation middleware for order updates
 */
const validateOrderUpdate = [
  param("id").isUUID().withMessage("Invalid order ID format"),

  body("status")
    .optional()
    .isIn(Object.values(ORDER_STATUS))
    .withMessage("Invalid order status"),

  body("trackingNumber")
    .optional()
    .isString()
    .withMessage("Tracking number must be a string"),

  body("deliveryAddress")
    .optional()
    .isObject()
    .withMessage("Delivery address must be an object"),
];

/**
 * Validation middleware for order queries
 */
const validateOrderQueries = [
  query("platform")
    .optional()
    .isIn(Object.values(PLATFORMS))
    .withMessage("Invalid platform"),

  query("status")
    .optional()
    .isIn(Object.values(ORDER_STATUS))
    .withMessage("Invalid order status"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("includeItems")
    .optional()
    .isIn(["true", "false"])
    .withMessage("Include items must be true or false"),
];

/**
 * Validation middleware for order search
 */
const validateOrderSearch = [
  body("query")
    .notEmpty()
    .withMessage("Search query is required")
    .isString()
    .withMessage("Search query must be a string")
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  body("platforms")
    .optional()
    .isArray()
    .withMessage("Platforms must be an array"),

  body("platforms.*")
    .optional()
    .isIn(Object.values(PLATFORMS))
    .withMessage("Invalid platform in platforms array"),

  body("dateRange")
    .optional()
    .isObject()
    .withMessage("Date range must be an object"),

  body("dateRange.startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("dateRange.endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),
];

/**
 * Validation middleware for sync options
 */
const validateSyncOptions = [
  body("daysToFetch")
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("Days to fetch must be between 1 and 30"),

  body("maxResults")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Max results must be between 1 and 100"),

  body("platforms")
    .optional()
    .isArray()
    .withMessage("Platforms must be an array"),

  body("platforms.*")
    .optional()
    .isIn(Object.values(PLATFORMS))
    .withMessage("Invalid platform in platforms array"),
];

/**
 * Generic validation result handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    return res
      .status(400)
      .json(validationErrorResponse(errorMessages, "Validation failed"));
  }

  next();
};

module.exports = {
  validateOrderCreation,
  validateOrderUpdate,
  validateOrderQueries,
  validateOrderSearch,
  validateSyncOptions,
  handleValidationErrors,
};
