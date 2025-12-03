// src/utils/response.js

const { API_RESPONSES } = require("../constants");

/**
 * Creates a successful API response
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} - Formatted success response
 */
const successResponse = (
  data = null,
  message = "Success",
  statusCode = 200
) => {
  return {
    success: true,
    message,
    data,
    statusCode,
  };
};

/**
 * Creates an error API response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} error - Error details
 * @returns {Object} - Formatted error response
 */
const errorResponse = (
  message = "Error occurred",
  statusCode = 500,
  error = null
) => {
  const response = {
    success: false,
    message,
    statusCode,
  };

  if (error && (process.env.NODE_ENV === "development" || process.env.DEBUG_MODE === "true")) {
    response.error = error;
  }

  return response;
};

/**
 * Creates a paginated response
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination metadata
 * @param {string} message - Success message
 * @returns {Object} - Formatted paginated response
 */
const paginatedResponse = (
  data,
  pagination,
  message = "Data retrieved successfully"
) => {
  return {
    success: true,
    message,
    data: {
      items: data,
      pagination: {
        currentPage: pagination.page,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        totalCount: pagination.total,
        hasNext:
          pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    },
  };
};

/**
 * Creates a sync response
 * @param {Object} syncData - Sync operation data
 * @param {string} message - Success message
 * @returns {Object} - Formatted sync response
 */
const syncResponse = (syncData, message = "Sync operation completed") => {
  return {
    success: true,
    message,
    data: {
      syncId: syncData.syncId,
      status: syncData.status,
      estimatedDuration: syncData.estimatedDuration,
      options: syncData.options,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Creates an authentication error response
 * @param {string} message - Error message
 * @param {string} action - Required action
 * @returns {Object} - Formatted auth error response
 */
const authErrorResponse = (
  message = "Authentication failed",
  action = null
) => {
  const response = {
    success: false,
    message,
    statusCode: 401,
  };

  if (action) {
    response.action = action;
  }

  return response;
};

/**
 * Creates a validation error response
 * @param {Array} errors - Validation errors
 * @param {string} message - Error message
 * @returns {Object} - Formatted validation error response
 */
const validationErrorResponse = (
  errors = [],
  message = "Validation failed"
) => {
  return {
    success: false,
    message,
    errors,
    statusCode: 400,
  };
};

/**
 * Creates a not found response
 * @param {string} resource - Resource name
 * @returns {Object} - Formatted not found response
 */
const notFoundResponse = (resource = "Resource") => {
  return {
    success: false,
    message: `${resource} not found`,
    statusCode: 404,
  };
};

/**
 * Creates a rate limit response
 * @param {string} message - Rate limit message
 * @returns {Object} - Formatted rate limit response
 */
const rateLimitResponse = (message = "Too many requests") => {
  return {
    success: false,
    message,
    statusCode: 429,
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  syncResponse,
  authErrorResponse,
  validationErrorResponse,
  notFoundResponse,
  rateLimitResponse,
};
