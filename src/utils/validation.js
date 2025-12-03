// src/utils/validation.js

const { VALIDATION, PLATFORMS, ORDER_STATUS } = require("../constants");

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates order amount
 * @param {number} amount - Amount to validate
 * @returns {boolean} - True if valid amount
 */
const isValidOrderAmount = (amount) => {
  return (
    typeof amount === "number" &&
    amount >= VALIDATION.MIN_ORDER_AMOUNT &&
    !isNaN(amount)
  );
};

/**
 * Validates confidence score
 * @param {number} score - Confidence score to validate
 * @returns {boolean} - True if valid score
 */
const isValidConfidenceScore = (score) => {
  return (
    typeof score === "number" &&
    score >= VALIDATION.MIN_CONFIDENCE_SCORE &&
    score <= VALIDATION.MAX_CONFIDENCE_SCORE
  );
};

/**
 * Validates quantity
 * @param {number} quantity - Quantity to validate
 * @returns {boolean} - True if valid quantity
 */
const isValidQuantity = (quantity) => {
  return (
    typeof quantity === "number" &&
    quantity >= VALIDATION.MIN_QUANTITY &&
    Number.isInteger(quantity)
  );
};

/**
 * Validates platform
 * @param {string} platform - Platform to validate
 * @returns {boolean} - True if valid platform
 */
const isValidPlatform = (platform) => {
  return Object.values(PLATFORMS).includes(platform);
};

/**
 * Validates order status
 * @param {string} status - Status to validate
 * @returns {boolean} - True if valid status
 */
const isValidOrderStatus = (status) => {
  return Object.values(ORDER_STATUS).includes(status);
};

/**
 * Validates UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} - True if valid UUID
 */
const isValidUUID = (uuid) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validates date format
 * @param {string|Date} date - Date to validate
 * @returns {boolean} - True if valid date
 */
const isValidDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid URL
 */
const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates pagination parameters
 * @param {Object} params - Pagination parameters
 * @returns {Object} - Validated pagination object
 */
const validatePagination = (params = {}) => {
  const defaultLimit = parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 10;
  const maxLimit = parseInt(process.env.PAGINATION_MAX_LIMIT) || 100;
  const { page = 1, limit = defaultLimit } = params;

  return {
    page: Math.max(1, parseInt(page) || 1),
    limit: Math.min(maxLimit, Math.max(1, parseInt(limit) || defaultLimit)),
    offset:
      (Math.max(1, parseInt(page) || 1) - 1) *
      Math.min(maxLimit, Math.max(1, parseInt(limit) || defaultLimit)),
  };
};

/**
 * Validates sync options
 * @param {Object} options - Sync options to validate
 * @returns {Object} - Validated sync options
 */
const validateSyncOptions = (options = {}) => {
  const defaultDays = parseInt(process.env.SYNC_DEFAULT_DAYS) || 7;
  const maxDays = parseInt(process.env.SYNC_MAX_DAYS) || 30;
  const defaultMaxResults = parseInt(process.env.SYNC_DEFAULT_MAX_RESULTS) || 50;
  const maxResults = parseInt(process.env.SYNC_MAX_RESULTS) || 100;
  
  const {
    daysToFetch = defaultDays,
    maxResults: userMaxResults = defaultMaxResults,
    platforms = Object.values(PLATFORMS),
  } = options;

  return {
    daysToFetch: Math.min(maxDays, Math.max(1, parseInt(daysToFetch) || defaultDays)),
    maxResults: Math.min(maxResults, Math.max(1, parseInt(userMaxResults) || defaultMaxResults)),
    platforms: Array.isArray(platforms)
      ? platforms.filter(isValidPlatform)
      : Object.values(PLATFORMS),
  };
};

module.exports = {
  isValidEmail,
  isValidOrderAmount,
  isValidConfidenceScore,
  isValidQuantity,
  isValidPlatform,
  isValidOrderStatus,
  isValidUUID,
  isValidDate,
  isValidURL,
  validatePagination,
  validateSyncOptions,
};
