const logger = require("../utils/logger");

// Custom Error Classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError) {
    super(message, 500);
    this.originalError = originalError;
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg
    ? err.errmsg.match(/(["'])(\\?.)*?\1/)[0]
    : "duplicate value";
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new ValidationError(message, errors);
};

const handleJWTError = () =>
  new AuthenticationError("Invalid token. Please log in again!");

const handleJWTExpiredError = () =>
  new AuthenticationError("Your token has expired! Please log in again.");

const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map((error) => ({
    field: error.path,
    message: error.message,
    value: error.value,
  }));
  return new ValidationError("Validation failed", errors);
};

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0].path;
  const message = `${field} already exists. Please use a different value.`;
  return new AppError(message, 400);
};

const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = "Invalid reference. The referenced record does not exist.";
  return new AppError(message, 400);
};

const handleSequelizeConnectionError = (err) => {
  logger.error("Database connection error:", err);
  return new DatabaseError("Database connection failed", err);
};

// Send error response in development
const sendErrorDev = (err, req, res) => {
  logger.error("Development Error:", {
    error: err,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    stack: err.stack,
    ...(err.errors && { errors: err.errors }),
  });
};

// Send error response in production
const sendErrorProd = (err, req, res) => {
  // Log error details
  logger.error("Production Error:", {
    message: err.message,
    statusCode: err.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    ...(err.isOperational ? {} : { stack: err.stack }),
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming or other unknown error: don't leak error details
    res.status(500).json({
      success: false,
      message: "Something went wrong!",
    });
  }
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (
    process.env.NODE_ENV === "development" ||
    process.env.DEBUG_MODE === "true"
  ) {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific Sequelize errors
    if (err.name === "SequelizeValidationError") {
      error = handleSequelizeValidationError(err);
    } else if (err.name === "SequelizeUniqueConstraintError") {
      error = handleSequelizeUniqueConstraintError(err);
    } else if (err.name === "SequelizeForeignKeyConstraintError") {
      error = handleSequelizeForeignKeyConstraintError(err);
    } else if (err.name === "SequelizeConnectionError") {
      error = handleSequelizeConnectionError(err);
    }

    // Handle JWT errors
    if (err.name === "JsonWebTokenError") error = handleJWTError();
    if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

    // Handle MongoDB errors (if using MongoDB in the future)
    if (err.name === "CastError") error = handleCastErrorDB(err);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === "ValidationError") error = handleValidationErrorDB(err);

    sendErrorProd(error, req, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  globalErrorHandler,
  catchAsync,
};
