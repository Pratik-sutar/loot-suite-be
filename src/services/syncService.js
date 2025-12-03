// src/services/syncService.js - ENHANCED WITH CHRONOLOGICAL PROCESSING & SMART UPDATES

const GmailService = require("./gmailService");
const { parserFactory } = require("./parsers");
const { getOrderHash } = require("./deduplication");
const { User, Order, OrderItem, EmailSync } = require("../models");
const logger = require("../utils/logger");
const emailConfig = require("../config/emailConfig");
const { ensureFreshGoogleToken } = require("../utils/googleToken");

class SyncService {
  constructor() {
    this.gmailService = new GmailService();
  }

  async syncUserOrders(userId, options = {}) {
    let syncRecord = null;
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error("User not found");
      if (!user.access_token) throw new Error("User has no access token");

      const refreshResult = await ensureFreshGoogleToken(user);
      if (!refreshResult.ok) {
        const err = new Error("Failed to refresh Google token");
        err.code =
          refreshResult.reason === "INVALID_GRANT" ||
          refreshResult.reason === "NO_REFRESH_TOKEN"
            ? "REAUTH_REQUIRED"
            : "REFRESH_FAILED";
        throw err;
      }

      const daysToFetch =
        options.daysToFetch || emailConfig.defaultDaysToFetch || 7;
      const maxResults =
        options.maxResults || emailConfig.maxEmailsPerSync || 50;

      console.log("📋 ENHANCED SYNC SERVICE PARAMETERS:");
      console.log("=".repeat(60));
      console.log("👤 User:", user.email);
      console.log("📅 Days to fetch:", daysToFetch);
      console.log("📧 Max results:", maxResults);
      console.log("🔄 Processing strategy: CHRONOLOGICAL with smart updates");
      console.log("=".repeat(60));

      syncRecord = await EmailSync.create({
        user_id: userId,
        status: "in_progress",
        started_at: new Date(),
        metadata: {
          options,
          strategy: "chronological_with_smart_updates",
          resolvedParameters: { daysToFetch, maxResults },
        },
      });

      const syncId = syncRecord.id;
      logger.info(
        `Starting enhanced chronological sync for user ${user.email} with sync ID: ${syncId}`
      );

      await this.gmailService.initializeClient(
        user.access_token,
        user.refresh_token
      );

      // Step 1: Get emails from Gmail
      console.log(`🔍 Searching emails from last ${daysToFetch} days...`);
      const emails = await this.gmailService.getEmailsFromDateRange(
        daysToFetch,
        maxResults
      );

      if (emails.length === 0) {
        return await this.handleNoEmailsFound(
          syncRecord,
          daysToFetch,
          maxResults
        );
      }

      // Step 2: Fetch email details
      console.log(`📥 Fetching details for ${emails.length} emails...`);
      const emailDetails = await this.gmailService.getEmailDetails(emails);

      // Step 3: 📅 CHRONOLOGICAL PROCESSING (oldest first)
      console.log(
        `\n🕒 CHRONOLOGICAL PROCESSING: Sorting ${emailDetails.length} emails by date...`
      );
      const chronologicalEmails = this.sortEmailsChronologically(emailDetails);

      console.log(
        `📅 Date range: ${this.getEmailDateRange(chronologicalEmails)}`
      );
      console.log(
        `🔄 Processing strategy: Process oldest emails first for proper order lifecycle`
      );

      // Step 4: Process emails chronologically with smart update logic
      const processResult = await this.processEmailsChronologically(
        chronologicalEmails,
        userId,
        syncId
      );

      // Step 5: Update sync record and return results
      return await this.completeSyncWithResults(
        syncRecord,
        processResult,
        daysToFetch,
        maxResults
      );
    } catch (error) {
      logger.error(`Sync failed for user ${userId}:`, error);
      if (syncRecord) {
        await syncRecord.update({
          status: "failed",
          completed_at: new Date(),
          errors: [
            {
              timestamp: new Date(),
              message: error.message,
              stack: error.stack,
            },
          ],
        });
      }
      throw error;
    }
  }

  /**
   * 📅 Sort emails chronologically (oldest first) for proper order lifecycle processing
   */
  sortEmailsChronologically(emailDetails) {
    console.log(`🕒 Sorting emails chronologically...`);

    const sorted = emailDetails.sort((a, b) => {
      // Primary sort: by internal date (oldest first)
      const dateA = parseInt(a.internalDate || 0);
      const dateB = parseInt(b.internalDate || 0);

      if (dateA !== dateB) {
        return dateA - dateB; // Ascending (oldest first)
      }

      // Secondary sort: by email type priority (confirmations first)
      const priorityA = this.getEmailTypePriority(a.headers.subject || "");
      const priorityB = this.getEmailTypePriority(b.headers.subject || "");

      return priorityA - priorityB;
    });

    console.log(`✅ Emails sorted chronologically (${sorted.length} emails)`);
    console.log(`📅 Oldest: ${this.formatEmailDate(sorted[0])}`);
    console.log(
      `📅 Newest: ${this.formatEmailDate(sorted[sorted.length - 1])}`
    );

    return sorted;
  }

  /**
   * Get email type priority for secondary sorting (confirmations first)
   */
  getEmailTypePriority(subject) {
    const subjectLower = subject.toLowerCase();

    if (
      subjectLower.includes("confirmation") ||
      subjectLower.includes("placed") ||
      subjectLower.includes("thank you")
    ) {
      return 1; // Highest priority - order confirmations
    }
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("dispatched")
    ) {
      return 2; // Medium priority - shipping updates
    }
    if (subjectLower.includes("delivered")) {
      return 3; // Lower priority - delivery confirmations
    }

    return 4; // Lowest priority - other updates
  }

  /**
   * 🔄 Process emails chronologically with smart update logic
   */
  async processEmailsChronologically(chronologicalEmails, userId, syncId) {
    console.log(
      `\n🔄 CHRONOLOGICAL PROCESSING: ${chronologicalEmails.length} emails`
    );
    console.log(`📋 Strategy: Process oldest→newest, smart update detection`);

    const results = {
      ordersCreated: 0,
      ordersUpdated: 0,
      ordersSkipped: 0,
      parsingErrors: 0,
      emailsProcessed: 0,
      processedOrders: [],
      skippedEmails: [],
      errorEmails: [],
    };

    // Track processed orders by platform-orderId for update detection
    const orderTracker = new Map(); // "platform-orderId" → orderRecord

    for (let i = 0; i < chronologicalEmails.length; i++) {
      const email = chronologicalEmails[i];
      const emailIndex = i + 1;

      console.log(
        `\n--- 📧 Processing Email ${emailIndex}/${chronologicalEmails.length} ---`
      );
      console.log(`📅 Date: ${this.formatEmailDate(email)}`);
      console.log(`📨 From: ${email.headers.from}`);
      console.log(`📋 Subject: ${email.headers.subject}`);

      try {
        // Step 1: Parse email content
        const parsedData = this.parseEmailWithValidation(email);

        if (!parsedData) {
          console.log(
            "⚠️ Parser returned null - email not recognized as order"
          );
          results.skippedEmails.push({
            reason: "not_parseable",
            from: email.headers.from,
            subject: email.headers.subject,
          });
          results.ordersSkipped++;
          continue;
        }

        console.log(
          `✅ Parsed as ${parsedData.platform} order: ${parsedData.orderId}`
        );
        console.log(
          `📊 Status: ${parsedData.status}, Amount: ₹${
            parsedData.amount || "N/A"
          }`
        );

        // Step 2: Determine if this is new order or update
        const orderKey = `${parsedData.platform}-${parsedData.orderId}`;
        const existingOrderInSync = orderTracker.get(orderKey);
        const existingOrderInDB = await this.findExistingOrder(
          userId,
          parsedData.platform,
          parsedData.orderId
        );

        // Step 3: Process based on email type and existing data
        const processingResult = await this.processOrderEmail(
          parsedData,
          email,
          existingOrderInSync,
          existingOrderInDB,
          userId,
          syncId,
          emailIndex
        );

        if (processingResult.action === "created") {
          results.ordersCreated++;
          orderTracker.set(orderKey, processingResult.order);
          results.processedOrders.push(processingResult.order);
        } else if (processingResult.action === "updated") {
          results.ordersUpdated++;
          orderTracker.set(orderKey, processingResult.order);
          results.processedOrders.push(processingResult.order);
        } else {
          results.ordersSkipped++;
          results.skippedEmails.push({
            reason: processingResult.reason,
            from: email.headers.from,
            subject: email.headers.subject,
          });
        }

        results.emailsProcessed++;
      } catch (error) {
        console.error(
          `❌ Error processing email ${emailIndex}:`,
          error.message
        );
        results.parsingErrors++;
        results.errorEmails.push({
          error: error.message,
          from: email.headers.from,
          subject: email.headers.subject,
        });
      }
    }

    console.log(`\n📊 CHRONOLOGICAL PROCESSING COMPLETE:`);
    console.log(`✅ Orders created: ${results.ordersCreated}`);
    console.log(`🔄 Orders updated: ${results.ordersUpdated}`);
    console.log(`⏭️ Orders skipped: ${results.ordersSkipped}`);
    console.log(`❌ Parsing errors: ${results.parsingErrors}`);

    return results;
  }

  /**
   * Parse email with comprehensive validation and garbage filtering
   */
  parseEmailWithValidation(email) {
    try {
      // Use your existing parser factory
      const parsedData = parserFactory.parseEmail({
        from: email.headers.from,
        subject: email.headers.subject,
        html: email.body.html,
        text: email.body.text,
        date: email.headers.date,
        messageId: email.messageId,
      });

      if (!parsedData) return null;

      // Additional validation to ensure data quality
      const validatedData = this.validateParsedData(parsedData);

      // Clean and standardize the data
      return this.cleanParsedData(validatedData);
    } catch (error) {
      console.error("❌ Parsing error:", error.message);
      return null;
    }
  }

  /**
   * Validate parsed data quality and completeness
   */
  validateParsedData(parsedData) {
    // Validate order ID
    if (!parsedData.orderId || !this.isValidOrderId(parsedData.orderId)) {
      throw new Error(`Invalid order ID: ${parsedData.orderId}`);
    }

    // Validate platform
    if (!parsedData.platform) {
      throw new Error("Missing platform information");
    }

    // Validate products array
    if (parsedData.products && Array.isArray(parsedData.products)) {
      parsedData.products = parsedData.products.filter((product) =>
        this.isValidProduct(product)
      );
    }

    return parsedData;
  }

  /**
   * Clean parsed data and mark missing fields appropriately
   */
  cleanParsedData(parsedData) {
    return {
      platform: parsedData.platform,
      orderId: parsedData.orderId,
      amount: parsedData.amount || null,
      formattedAmount: parsedData.amount
        ? `₹${parsedData.amount}`
        : "Data not available in email",
      products: this.cleanProductsData(parsedData.products || []),
      orderDate: parsedData.orderDate || new Date(),
      status: this.standardizeOrderStatus(parsedData.status),
      trackingId: parsedData.trackingId || "Data not available in email",
      emailType: parsedData.emailType || "unknown",
      confidence: parsedData.confidence || 0.7,
      extractedAt: new Date().toISOString(),
      dataAvailability: this.assessDataAvailability(parsedData),
    };
  }

  /**
   * Clean products data and remove garbage
   */
  cleanProductsData(products) {
    if (!Array.isArray(products) || products.length === 0) {
      return [
        {
          name: "Data not available in email",
          quantity: "Data not available in email",
          price: "Data not available in email",
          formattedPrice: "Data not available in email",
        },
      ];
    }

    return products.map((product) => ({
      name: product.name || "Data not available in email",
      quantity: product.quantity || "Data not available in email",
      price: product.price || null,
      formattedPrice: product.price
        ? `₹${product.price}`
        : "Data not available in email",
      type: product.type || "item",
    }));
  }

  /**
   * Assess what data is available vs missing
   */
  assessDataAvailability(parsedData) {
    return {
      hasOrderId: !!parsedData.orderId,
      hasAmount: !!parsedData.amount,
      hasProducts: !!(parsedData.products && parsedData.products.length > 0),
      hasTrackingId: !!parsedData.trackingId,
      hasOrderDate: !!parsedData.orderDate,
      dataCompleteness: this.calculateDataCompleteness(parsedData),
    };
  }

  /**
   * Calculate data completeness score
   */
  calculateDataCompleteness(parsedData) {
    const fields = ["orderId", "amount", "products", "trackingId", "orderDate"];
    const availableFields = fields.filter((field) => {
      if (field === "products")
        return parsedData.products && parsedData.products.length > 0;
      return !!parsedData[field];
    });

    return Math.round((availableFields.length / fields.length) * 100);
  }

  /**
   * 🔄 Process individual order email with smart update logic
   */
  async processOrderEmail(
    parsedData,
    email,
    existingOrderInSync,
    existingOrderInDB,
    userId,
    syncId,
    emailIndex
  ) {
    const orderKey = `${parsedData.platform}-${parsedData.orderId}`;

    console.log(`🔍 Processing order: ${orderKey}`);
    console.log(`📧 Email type: ${parsedData.emailType}`);
    console.log(`📊 Current status: ${parsedData.status}`);

    // Case 1: First time seeing this order in current sync
    if (!existingOrderInSync && !existingOrderInDB) {
      console.log(`🆕 NEW ORDER: Creating first entry for ${orderKey}`);
      const newOrder = await this.createNewOrder(
        parsedData,
        userId,
        syncId,
        email
      );

      return {
        action: "created",
        order: newOrder,
        reason: "first_time_order_creation",
      };
    }

    // Case 2: Order exists in current sync - check for updates
    if (existingOrderInSync) {
      console.log(`🔄 SYNC UPDATE: Checking updates for ${orderKey}`);
      return await this.handleOrderUpdateInSync(
        existingOrderInSync,
        parsedData,
        email,
        emailIndex
      );
    }

    // Case 3: Order exists in DB from previous sync - check for updates
    if (existingOrderInDB) {
      console.log(
        `🔄 DB UPDATE: Checking updates for existing DB order ${orderKey}`
      );
      return await this.handleOrderUpdateInDB(
        existingOrderInDB,
        parsedData,
        email,
        syncId
      );
    }

    return {
      action: "skipped",
      reason: "unknown_case",
      order: null,
    };
  }

  /**
   * Handle order updates within current sync
   */
  async handleOrderUpdateInSync(existingOrder, parsedData, email, emailIndex) {
    const updates = this.detectOrderChanges(existingOrder, parsedData);

    if (updates.hasChanges) {
      console.log(
        `✅ SYNC UPDATE: Changes detected for ${existingOrder.platform}-${existingOrder.platform_order_id}`
      );
      console.log(`📝 Changes: ${updates.changes.join(", ")}`);

      // Update the order with new information
      const updatedOrder = await this.applyOrderUpdates(
        existingOrder,
        parsedData,
        updates.updateData
      );

      return {
        action: "updated",
        order: updatedOrder,
        reason: "sync_update",
        changes: updates.changes,
      };
    } else {
      console.log(
        `⏭️ SYNC SKIP: No changes detected for ${existingOrder.platform}-${existingOrder.platform_order_id}`
      );
      return {
        action: "skipped",
        reason: "no_changes_in_sync",
        order: existingOrder,
      };
    }
  }

  /**
   * Handle order updates for existing DB records
   */
  async handleOrderUpdateInDB(existingOrder, parsedData, email, syncId) {
    const updates = this.detectOrderChanges(existingOrder, parsedData);

    if (updates.hasChanges) {
      console.log(
        `✅ DB UPDATE: Changes detected for ${existingOrder.platform}-${existingOrder.platform_order_id}`
      );
      console.log(`📝 Changes: ${updates.changes.join(", ")}`);

      // Update database record
      const updateData = {
        ...updates.updateData,
        sync_id: syncId,
        last_updated: new Date(),
      };

      await existingOrder.update(updateData);

      return {
        action: "updated",
        order: await existingOrder.reload(),
        reason: "db_update",
        changes: updates.changes,
      };
    } else {
      console.log(
        `⏭️ DB SKIP: No changes detected for ${existingOrder.platform}-${existingOrder.platform_order_id}`
      );
      return {
        action: "skipped",
        reason: "no_changes_in_db",
        order: existingOrder,
      };
    }
  }

  /**
   * 🔍 Detect meaningful changes between existing and new order data
   */
  detectOrderChanges(existingOrder, newParsedData) {
    const changes = [];
    const updateData = {};

    // Check status progression (only update if more advanced)
    if (this.shouldUpdateStatus(existingOrder.status, newParsedData.status)) {
      changes.push(`status: ${existingOrder.status} → ${newParsedData.status}`);
      updateData.status = newParsedData.status;

      // Update delivery date if status is delivered
      if (
        newParsedData.status === "delivered" &&
        !existingOrder.delivered_date
      ) {
        updateData.delivered_date = new Date();
        changes.push("delivery_date: added");
      }
    }

    // Add tracking information if missing
    if (newParsedData.trackingId && !existingOrder.tracking_number) {
      changes.push(`tracking: added ${newParsedData.trackingId}`);
      updateData.tracking_number = newParsedData.trackingId;
    }

    // Update amount if missing and new data has it
    if (
      newParsedData.amount &&
      (!existingOrder.total_amount || existingOrder.total_amount === 0)
    ) {
      changes.push(`amount: added ₹${newParsedData.amount}`);
      updateData.total_amount = newParsedData.amount;
    }

    // Update product name if missing and new data has better info
    if (newParsedData.products && newParsedData.products.length > 0) {
      const newProductName = newParsedData.products[0].name;
      if (
        newProductName &&
        newProductName !== "Data not available in email" &&
        (!existingOrder.product_name ||
          existingOrder.product_name.includes("Order") ||
          existingOrder.product_name === "Data not available in email")
      ) {
        changes.push(
          `product: updated to ${newProductName.substring(0, 30)}...`
        );
        updateData.product_name = newProductName;
      }
    }

    return {
      hasChanges: changes.length > 0,
      changes,
      updateData,
    };
  }

  /**
   * Apply updates to existing order
   */
  async applyOrderUpdates(existingOrder, parsedData, updateData) {
    // If it's a database record, update it
    if (existingOrder.update) {
      await existingOrder.update({
        ...updateData,
        last_updated: new Date(),
      });
      return await existingOrder.reload();
    }

    // If it's an in-memory object, merge the updates
    return {
      ...existingOrder,
      ...updateData,
      last_updated: new Date(),
    };
  }

  /**
   * Find existing order in database
   */
  async findExistingOrder(userId, platform, orderId) {
    return await Order.findOne({
      where: {
        user_id: userId,
        platform: platform,
        platform_order_id: orderId,
      },
    });
  }

  /**
   * Create new order with comprehensive data handling
   */
  async createNewOrder(parsedData, userId, syncId, email) {
    console.log(
      `🆕 Creating new order: ${parsedData.platform}-${parsedData.orderId}`
    );

    const orderData = {
      user_id: userId,
      platform: parsedData.platform,
      order_id: parsedData.orderId,
      platform_order_id: parsedData.orderId,
      product_name: this.getCleanProductName(parsedData),
      total_amount: parsedData.amount || 0,
      currency: "INR",
      order_date: parsedData.orderDate || new Date(),
      status: parsedData.status || "ordered",
      tracking_number: parsedData.trackingId || null,
      delivered_date: parsedData.status === "delivered" ? new Date() : null,
      email_message_id: email.messageId,
      raw_email_data: JSON.stringify(email),
      parsed_data: parsedData,
      confidence_score: parsedData.confidence || 0.8,
      sync_id: syncId,
      last_updated: new Date(),
      hash: getOrderHash({
        platform: parsedData.platform,
        orderId: parsedData.orderId,
        userId,
      }),
    };

    const order = await Order.create(orderData);

    // Create order items if available
    if (parsedData.products && parsedData.products.length > 0) {
      await this.createOrderItems(order.id, parsedData.products);
    }

    console.log(`✅ Order created successfully: ${order.id}`);
    return order;
  }

  /**
   * Get clean product name with fallbacks
   */
  getCleanProductName(parsedData) {
    if (parsedData.products && parsedData.products.length > 0) {
      const productName = parsedData.products[0].name;
      if (productName && productName !== "Data not available in email") {
        return productName.length > 100
          ? productName.substring(0, 100) + "..."
          : productName;
      }
    }

    // Fallback to platform + order ID
    const platform =
      parsedData.platform.charAt(0).toUpperCase() +
      parsedData.platform.slice(1);
    return `${platform} Order ${parsedData.orderId}`;
  }

  /**
   * Create order items with validation
   */
  async createOrderItems(orderId, products) {
    const validItems = products.filter(
      (item) =>
        item.name &&
        item.name !== "Data not available in email" &&
        item.name.length > 2
    );

    if (validItems.length === 0) return;

    const itemsToCreate = validItems.map((item) => ({
      order_id: orderId,
      name: item.name,
      quantity: parseInt(item.quantity) || 1,
      unit_price: parseFloat(item.price) || 0,
      total_price: parseFloat(item.price) * (parseInt(item.quantity) || 1) || 0,
    }));

    await OrderItem.bulkCreate(itemsToCreate);
    console.log(`📦 Created ${itemsToCreate.length} order items`);
  }

  /**
   * Standardize order status across platforms
   */
  standardizeOrderStatus(status) {
    if (!status) return "ordered";

    const statusLower = status.toLowerCase();

    if (statusLower.includes("delivered")) return "delivered";
    if (statusLower.includes("shipped") || statusLower.includes("dispatched"))
      return "shipped";
    if (statusLower.includes("confirmed") || statusLower.includes("placed"))
      return "confirmed";
    if (statusLower.includes("cancelled")) return "cancelled";
    if (statusLower.includes("returned")) return "returned";

    return "ordered";
  }

  /**
   * Determine if status should be updated (status progression)
   */
  shouldUpdateStatus(currentStatus, newStatus) {
    const statusHierarchy = {
      ordered: 1,
      confirmed: 2,
      shipped: 3,
      out_for_delivery: 4,
      delivered: 5,
      cancelled: 0,
      returned: 0,
    };

    const currentLevel = statusHierarchy[currentStatus] || 1;
    const newLevel = statusHierarchy[newStatus] || 1;

    return newLevel > currentLevel;
  }

  /**
   * Validate product data quality
   */
  isValidProduct(product) {
    if (!product || !product.name) return false;

    const name = product.name.toString().trim();

    // Reject empty or too short names
    if (name.length < 3) return false;

    // Reject HTML/CSS garbage using your existing patterns
    const garbagePatterns = [
      /background-image/i,
      /url\(https?/i,
      /media-amazon\.com/i,
      /\.css/i,
      /\.js/i,
      /font-family/i,
      /<!DOCTYPE/i,
      /<html/i,
      /align\s*=\s*/i,
      /center/i,
      /feedback/i,
      /src\s*=/i,
      /style\s*=/i,
      /class\s*=/i,
      /^[\d\s.,;:-]+$/,
      /^[a-f0-9]{10,}$/i,
    ];

    return !garbagePatterns.some((pattern) => pattern.test(name));
  }

  /**
   * Enhanced order ID validation
   */
  isValidOrderId(orderId) {
    if (!orderId || typeof orderId !== "string") return false;

    // Platform-specific validation
    if (/^\d{3}-\d{7,8}-\d{7,8}$/.test(orderId)) return true; // Amazon
    if (/^OD\d{15,21}$/i.test(orderId)) return true; // Flipkart
    if (/^\d{12,18}$/.test(orderId)) return true; // Swiggy/others
    if (/^[A-Z]{2,4}\d{10,20}$/i.test(orderId)) return true; // Generic letter+number

    // Reject invalid patterns
    const invalidPatterns = [
      /^(value|table|radius|ffffff|style|width|height|px)$/i,
      /^.{0,2}$/,
      /^.{101,}$/,
      /^[\d.]+$/,
      /^[a-f0-9]{32,}$/i,
    ];

    return !invalidPatterns.some((pattern) => pattern.test(orderId));
  }

  /**
   * Get email date range for logging
   */
  getEmailDateRange(emails) {
    if (emails.length === 0) return "No emails";

    const oldest = emails[0];
    const newest = emails[emails.length - 1];

    return `${this.formatEmailDate(oldest)} → ${this.formatEmailDate(newest)}`;
  }

  /**
   * Format email date for display
   */
  formatEmailDate(email) {
    if (!email || !email.internalDate) return "No date";

    const date = new Date(parseInt(email.internalDate));
    return (
      date.toLocaleDateString("en-IN") +
      " " +
      date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  /**
   * Handle case when no emails are found
   */
  async handleNoEmailsFound(syncRecord, daysToFetch, maxResults) {
    console.log("⚠️ No emails found matching search criteria");

    await syncRecord.update({
      status: "completed",
      completed_at: new Date(),
      emails_processed: 0,
      orders_found: 0,
      orders_created: 0,
      metadata: {
        ...syncRecord.metadata,
        summary: {
          message: `No emails found in last ${daysToFetch} days`,
          searchConfiguration: { daysToFetch, maxResults },
        },
      },
    });

    return {
      success: true,
      syncId: syncRecord.id,
      ordersSaved: 0,
      ordersUpdated: 0,
      emailsProcessed: 0,
      message: `No order emails found in the last ${daysToFetch} days`,
      configuration: { daysToFetch, maxResults },
    };
  }

  /**
   * Complete sync and return results for frontend
   */
  async completeSyncWithResults(
    syncRecord,
    processResult,
    daysToFetch,
    maxResults
  ) {
    const syncSummary = {
      totalEmails: processResult.emailsProcessed,
      emailsProcessed: processResult.emailsProcessed,
      ordersCreated: processResult.ordersCreated,
      ordersUpdated: processResult.ordersUpdated,
      ordersSkipped: processResult.ordersSkipped,
      parsingErrors: processResult.parsingErrors,
      platforms: this.getProcessedPlatforms(processResult.processedOrders),
      processingStrategy: "chronological_with_smart_updates",
      dataQuality: this.assessOverallDataQuality(processResult.processedOrders),
      success: processResult.ordersCreated + processResult.ordersUpdated > 0,
    };

    await syncRecord.update({
      status: "completed",
      completed_at: new Date(),
      emails_processed: processResult.emailsProcessed,
      orders_found: processResult.ordersCreated + processResult.ordersUpdated,
      orders_created: processResult.ordersCreated,
      metadata: {
        ...syncRecord.metadata,
        summary: syncSummary,
        detailedResults: {
          skippedEmails: processResult.skippedEmails,
          errorEmails: processResult.errorEmails,
        },
      },
    });

    logger.info(
      `Enhanced chronological sync completed: ${processResult.ordersCreated} created, ${processResult.ordersUpdated} updated`
    );

    return {
      success: true,
      syncId: syncRecord.id,
      ordersSaved: processResult.ordersCreated,
      ordersUpdated: processResult.ordersUpdated,
      emailsProcessed: processResult.emailsProcessed,
      summary: syncSummary,
      configuration: { daysToFetch, maxResults },
      orders: processResult.processedOrders.map((order) =>
        this.formatOrderForFrontend(order)
      ),
    };
  }

  /**
   * Format order data for frontend consumption
   */
  formatOrderForFrontend(order) {
    return {
      id: order.id,
      platform: order.platform,
      orderId: order.platform_order_id,
      productName: order.product_name,
      amount: order.total_amount,
      formattedAmount: order.total_amount
        ? `₹${order.total_amount}`
        : "Data not available in email",
      status: order.status,
      orderDate: order.order_date,
      trackingNumber: order.tracking_number || "Data not available in email",
      deliveredDate: order.delivered_date,
      confidence: order.confidence_score,
      dataCompleteness: this.calculateDataCompletenessFromOrder(order),
      lastUpdated: order.last_updated,
    };
  }

  /**
   * Calculate data completeness from order record
   */
  calculateDataCompletenessFromOrder(order) {
    const fields = [
      "platform_order_id",
      "total_amount",
      "product_name",
      "tracking_number",
      "order_date",
    ];
    const availableFields = fields.filter((field) => {
      const value = order[field];
      return value && value !== 0 && value !== "Data not available in email";
    });

    return Math.round((availableFields.length / fields.length) * 100);
  }

  /**
   * Assess overall data quality for the sync
   */
  assessOverallDataQuality(processedOrders) {
    if (processedOrders.length === 0)
      return { completeness: 0, quality: "no_data" };

    const avgCompleteness =
      processedOrders.reduce(
        (sum, order) => sum + this.calculateDataCompletenessFromOrder(order),
        0
      ) / processedOrders.length;

    return {
      completeness: Math.round(avgCompleteness),
      quality:
        avgCompleteness >= 80
          ? "high"
          : avgCompleteness >= 60
          ? "medium"
          : "low",
      ordersWithFullData: processedOrders.filter(
        (order) => this.calculateDataCompletenessFromOrder(order) >= 80
      ).length,
    };
  }

  /**
   * Get platforms that were processed in this sync
   */
  getProcessedPlatforms(processedOrders) {
    const platforms = new Set();
    processedOrders.forEach((order) => platforms.add(order.platform));
    return Array.from(platforms);
  }

  // Keep existing methods for compatibility...
  async getSyncStatus(userId, syncId) {
    const syncRecord = await EmailSync.findOne({
      where: { id: syncId, user_id: userId },
    });

    if (!syncRecord) {
      throw new Error("Sync record not found");
    }

    return {
      syncId: syncRecord.id,
      status: syncRecord.status,
      startedAt: syncRecord.started_at,
      completedAt: syncRecord.completed_at,
      emailsProcessed: syncRecord.emails_processed,
      ordersFound: syncRecord.orders_found,
      ordersCreated: syncRecord.orders_created,
      metadata: syncRecord.metadata,
      errors: syncRecord.errors,
      searchConfiguration: syncRecord.metadata?.resolvedParameters,
    };
  }

  async getSyncHistory(userId, limit = 10) {
    const syncRecords = await EmailSync.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
    });

    return syncRecords.map((record) => ({
      syncId: record.id,
      status: record.status,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      emailsProcessed: record.emails_processed || 0,
      ordersFound: record.orders_found || 0,
      ordersCreated: record.orders_created || 0,
      summary: record.metadata?.summary || {},
      processingStrategy: record.metadata?.strategy || "unknown",
    }));
  }

  /**
   * Get sync statistics for a user
   */
  async getSyncStats(userId) {
    const [totalSyncs, completedSyncs, totalOrders] = await Promise.all([
      EmailSync.count({ where: { user_id: userId } }),
      EmailSync.count({ where: { user_id: userId, status: "completed" } }),
      Order.count({ where: { user_id: userId } }),
    ]);

    const lastSync = await EmailSync.findOne({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      attributes: ["created_at", "status", "orders_created", "metadata"],
    });

    return {
      totalSyncs,
      completedSyncs,
      failedSyncs: totalSyncs - completedSyncs,
      totalOrders,
      lastSyncAt: lastSync?.created_at,
      lastSyncStatus: lastSync?.status,
      lastSyncOrdersCreated: lastSync?.orders_created || 0,
      lastSyncConfiguration: lastSync?.metadata?.resolvedParameters,
      processingStrategy: lastSync?.metadata?.strategy || "unknown",
    };
  }
}

module.exports = new SyncService();
