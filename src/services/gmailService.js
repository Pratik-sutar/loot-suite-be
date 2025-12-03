// src/services/gmailService.js - CLEAN APPROACH: from:(sources) + subject:(keywords) - promotional

const { google } = require("googleapis");
const logger = require("../utils/logger");
const fs = require("fs");
const path = require("path");
const { parseGmailApiMessage } = require("../utils/parseGmailMessage");

function sanitizeFilename(str) {
  return String(str)
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 60)
    .toLowerCase();
}

class GmailService {
  constructor() {
    this.gmail = null;
    // Create debug directory outside nodemon coverage
    this.debugDir = path.join(require("os").homedir(), "gmail_debug_logs");
    this.ensureDebugDirectory();
  }

  /**
   * Ensure debug directory exists outside nodemon coverage
   */
  ensureDebugDirectory() {
    try {
      if (!fs.existsSync(this.debugDir)) {
        fs.mkdirSync(this.debugDir, { recursive: true });
        console.log(`ðŸ“ Created email logs directory: ${this.debugDir}`);
      }
    } catch (error) {
      console.error("Error creating debug directory:", error);
    }
  }

  async initializeClient(accessToken, refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
      logger.info("Gmail client initialized successfully");
    } catch (error) {
      logger.error("Error initializing Gmail client:", error);
      throw error;
    }
  }

  /**
   * ðŸŽ¯ SMART HYBRID APPROACH: exact_trusted_sources + content_validation + spam_inclusion
   * Uses your exact trusted source list + your existing parser validation logic
   */
  async getEmailsFromDateRange(daysToFetch, maxResults) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysToFetch);
    const dateTo = new Date();

    const dateString = dateFrom.toISOString().split("T")[0].replace(/-/g, "/");
    const endDateString = dateTo.toISOString().split("T")[0].replace(/-/g, "/");

    console.log(
      `ðŸŽ¯ SMART HYBRID ORDER & COURIER SEARCH for last ${daysToFetch} days`
    );
    console.log(`ðŸ“… Search from: ${dateString} to ${endDateString}`);
    console.log(
      `ðŸ” Strategy: exact_trusted_sources + content_validation + spam_inclusion`
    );

    // ðŸ¢ YOUR EXACT TRUSTED SOURCES (as specified in your requirements)
    const trustedSources = {
      ecommerce: [
        "amazon.in",
        "amazon.com",
        "auto-confirm@amazon.com",
        "shipment-tracking@amazon.com",
        "flipkart.com",
        "noreply@flipkart.com",
        "myntra.com",
        "noreply@myntra.com",
        "nykaa.com",
        "noreply@nykaa.com",
        "ajio.com",
        "noreply@ajio.com",
        "meesho.com",
        "noreply@meesho.com",
        "bigbasket.com",
        "noreply@bigbasket.com",
        "tatacliq.com",
        "noreply@tatacliq.com",
        "firstcry.com",
        "noreply@firstcry.com",
        "snapdeal.com",
        "noreply@snapdeal.com",
        "paytmmall.com",
        "reliancedigital.in",
        "swiggy.in",
        "noreply@swiggy.in",
      ],
      courier: [
        "dtdc.in",
        "dtdc.com",
        "noreply@dtdc.in",
        "bluedart.com",
        "bluedart.in",
        "noreply@bluedart.com",
        "fedex.com",
        "fedex.in",
        "noreply@fedex.com",
        "delhivery.com",
        "noreply@delhivery.com",
        "ecomexpress.in",
        "noreply@ecomexpress.in",
        "aramex.com",
        "aramex.in",
        "noreply@aramex.com",
        "indianpost.gov.in",
        "indiapost.gov.in",
        "tciexpress.in",
        "safexpress.com",
        "gati.com",
        "xpressbees.com",
        "ekart.in",
      ],
    };

    // ðŸ” IMPORTANT: Add discovered sender variations to handle your specific findings
    const discoveredSenders = [
      // Your actual findings
      "shipment-tracking@amazon.in",
      "order-update@amazon.in",
      "noreply@nct.flipkart.com", // The actual Flipkart sender you found
      "noreply@swiggy.in",
    ];

    // Merge discovered senders with trusted sources (avoid duplicates)
    trustedSources.ecommerce.push(
      ...discoveredSenders.filter(
        (s) =>
          !trustedSources.ecommerce.includes(s) &&
          !trustedSources.courier.includes(s)
      )
    );

    // ðŸ“§ SUBJECT KEYWORDS (Positive + Negative)
    const positiveSubjects = [
      "order",
      "shipped",
      "delivered",
      "package",
      "tracking",
      "dispatched",
      "courier",
      "awb",
      "consignment",
      "shipment",
      "confirmation",
      "placed",
    ];

    const negativeSubjects = [
      "offer",
      "sale",
      "discount",
      "deals",
      "promotion",
      "cashback",
      "newsletter",
      "unsubscribe",
      "marketing",
      "advertisement",
      "promo",
      "review",
      "feedback",
      "rate",
      "survey", // Added from your parser logic
    ];

    // ðŸ” BUILD OPTIMIZED SEARCH QUERIES (with discovered senders + spam inclusion)
    const searchQueries = this.buildOptimizedQueries(
      trustedSources,
      positiveSubjects,
      negativeSubjects,
      dateString
    );

    const allEmails = [];
    const seenMessageIds = new Set();
    const platformStats = this.initializePlatformStats();

    console.log(
      `ðŸš€ Executing ${searchQueries.length} optimized search queries...`
    );

    // Log search session
    this.logSearchSession(dateString, endDateString, searchQueries);

    for (let i = 0; i < searchQueries.length; i++) {
      const { query, category, description } = searchQueries[i];
      console.log(
        `\nðŸ“§ Query ${i + 1}/${searchQueries.length} [${category}]:`
      );
      console.log(`   ${description}`);
      console.log(`   ${query}`);

      try {
        const response = await this.gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: Math.min(100, Math.ceil(maxResults / 2)), // Higher limit per query
        });

        const messages = response.data.messages || [];
        console.log(`  âž¡ï¸ Found ${messages.length} emails`);

        // Deduplicate and categorize by actual sender
        let newEmails = 0; // âœ… FIXED: Declare newEmails variable
        for (const message of messages) {
          if (!seenMessageIds.has(message.id)) {
            seenMessageIds.add(message.id);

            allEmails.push({
              ...message,
              queryCategory: category,
              queryDescription: description,
              querySources: searchQueries[i].sources || [], // Track which sources found this
            });
            newEmails++;
          }
        }

        console.log(`  âœ… Added ${newEmails} new unique emails`);

        // Rate limiting between queries
        if (i < searchQueries.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      } catch (error) {
        console.error(`âŒ Error with query ${i + 1}:`, error.message);
        this.logError(query, error.message, category);
      }
    }

    // ðŸ“Š ANALYZE ACTUAL SENDERS (not query-based guessing)
    console.log(
      `\nðŸ” Analyzing actual email senders for accurate platform stats...`
    );

    // We'll get platform stats when we fetch email details
    // For now, sort by date and limit results
    const sortedEmails = allEmails
      .sort(
        (a, b) => parseInt(b.internalDate || 0) - parseInt(a.internalDate || 0)
      )
      .slice(0, maxResults);

    console.log(`\nðŸ“Š SEARCH RESULTS SUMMARY:`);
    console.log(`ðŸŽ¯ Total unique emails found: ${allEmails.length}`);
    console.log(`ðŸ“‹ Returning top ${sortedEmails.length} emails`);
    console.log(`ðŸ“ˆ Query category breakdown:`);

    // Count by query category
    const queryStats = {};
    allEmails.forEach((email) => {
      const category = email.queryCategory || "unknown";
      queryStats[category] = (queryStats[category] || 0) + 1;
    });

    Object.entries(queryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} emails`);
    });

    console.log(`\nâœ… SMART HYBRID ADVANTAGES:`);
    console.log(`ðŸŽ¯ Only emails from your EXACT trusted source list`);
    console.log(
      `ðŸ“§ Includes spam folder (in:anywhere) to catch Swiggy emails`
    );
    console.log(
      `ðŸš« Explicit promotional filtering (-subject:offer, -sale, etc.)`
    );
    console.log(`ðŸ” Content validation will be done by your existing parsers`);
    console.log(`ðŸ“ All sender variations logged for future optimization`);

    // Log final results with source tracking
    this.logSearchResults(
      allEmails.length,
      sortedEmails.length,
      queryStats,
      trustedSources
    );

    return sortedEmails;
  }

  /**
   * Build optimized search queries using the clean approach + spam inclusion + discovered senders
   */
  buildOptimizedQueries(
    trustedSources,
    positiveSubjects,
    negativeSubjects,
    dateString
  ) {
    const queries = [];

    // Create source groups for manageable query length
    const ecommerceChunks = this.chunkArray(trustedSources.ecommerce, 8);
    const courierChunks = this.chunkArray(trustedSources.courier, 8);

    // ðŸ›’ E-COMMERCE PLATFORM QUERIES (with spam inclusion)
    ecommerceChunks.forEach((sourceChunk, index) => {
      const fromClause = `from:(${sourceChunk.join(" OR ")})`;
      const subjectClause = `(${positiveSubjects
        .map((s) => `subject:${s}`)
        .join(" OR ")})`;
      const excludeClause = negativeSubjects
        .map((s) => `-subject:${s}`)
        .join(" ");

      queries.push({
        query: `${fromClause} ${subjectClause} ${excludeClause} in:anywhere after:${dateString}`,
        category: "ecommerce",
        description: `E-commerce chunk ${index + 1}: ${sourceChunk
          .slice(0, 3)
          .join(", ")}...`,
        sources: sourceChunk,
      });
    });

    // ðŸšš COURIER COMPANY QUERIES (with spam inclusion)
    courierChunks.forEach((sourceChunk, index) => {
      const fromClause = `from:(${sourceChunk.join(" OR ")})`;
      const courierSubjects = [
        "tracking",
        "delivered",
        "package",
        "shipment",
        "awb",
        "consignment",
        "dispatched",
      ];
      const subjectClause = `(${courierSubjects
        .map((s) => `subject:${s}`)
        .join(" OR ")})`;
      const excludeClause = negativeSubjects
        .map((s) => `-subject:${s}`)
        .join(" ");

      queries.push({
        query: `${fromClause} ${subjectClause} ${excludeClause} in:anywhere after:${dateString}`,
        category: "courier",
        description: `Courier chunk ${index + 1}: ${sourceChunk
          .slice(0, 3)
          .join(", ")}...`,
        sources: sourceChunk,
      });
    });

    // ðŸŽ¯ COMBINED BROAD SEARCHES (safety net with spam inclusion)
    const allSources = [...trustedSources.ecommerce, ...trustedSources.courier];
    const allSourcesChunks = this.chunkArray(allSources, 15);

    allSourcesChunks.forEach((sourceChunk, index) => {
      const fromClause = `from:(${sourceChunk.join(" OR ")})`;
      const broadSubjects = ["order", "delivered", "shipped", "tracking"];
      const subjectClause = `(${broadSubjects
        .map((s) => `subject:${s}`)
        .join(" OR ")})`;
      const excludeClause = negativeSubjects
        .map((s) => `-subject:${s}`)
        .join(" ");

      queries.push({
        query: `${fromClause} ${subjectClause} ${excludeClause} in:anywhere after:${dateString}`,
        category: "combined",
        description: `Combined safety net ${index + 1}: ${sourceChunk
          .slice(0, 2)
          .join(", ")}...`,
        sources: sourceChunk,
      });
    });

    // ðŸŒ DOMAIN BACKUP QUERIES (for sender variations we might miss)
    const majorDomains = [
      "amazon.in",
      "amazon.com",
      "flipkart.com",
      "nct.flipkart.com",
      "swiggy.in",
      "myntra.com",
      "nykaa.com",
    ];

    majorDomains.forEach((domain) => {
      queries.push({
        query: `from:${domain} (subject:order OR subject:shipped OR subject:delivered OR subject:confirmation) -subject:offer -subject:sale -subject:discount -subject:deals -subject:review -subject:feedback -subject:rate -subject:survey in:anywhere after:${dateString}`,
        category: "domain_backup",
        description: `Domain backup: ${domain}`,
        sources: [domain],
      });
    });

    console.log(`ðŸ—ï¸ Built ${queries.length} optimized queries:`);
    console.log(`   ðŸ“¦ E-commerce chunks: ${ecommerceChunks.length}`);
    console.log(`   ðŸšš Courier chunks: ${courierChunks.length}`);
    console.log(`   ðŸ”„ Combined chunks: ${allSourcesChunks.length}`);
    console.log(`   ðŸŒ Domain backups: ${majorDomains.length}`);
    console.log(`   ðŸ” All include 'in:anywhere' to catch spam folder emails`);

    return queries;
  }

  /**
   * Utility: Split array into chunks
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Initialize comprehensive platform statistics
   */
  initializePlatformStats() {
    return {
      // E-commerce platforms
      amazon: 0,
      flipkart: 0,
      myntra: 0,
      nykaa: 0,
      swiggy: 0,
      ajio: 0,
      meesho: 0,
      bigbasket: 0,
      firstcry: 0,
      tatacliq: 0,
      snapdeal: 0,

      // Courier companies
      dtdc: 0,
      bluedart: 0,
      fedex: 0,
      indianpost: 0,
      ecomexpress: 0,
      delhivery: 0,
      aramex: 0,
      xpressbees: 0,
      ekart: 0,

      others: 0,
    };
  }

  /**
   * Enhanced platform detection from actual email sender
   */
  detectPlatformFromEmail(fromEmail) {
    const fromLower = fromEmail.toLowerCase();

    // E-commerce platforms
    if (fromLower.includes("amazon")) return "amazon";
    if (fromLower.includes("flipkart")) return "flipkart";
    if (fromLower.includes("myntra")) return "myntra";
    if (fromLower.includes("nykaa")) return "nykaa";
    if (fromLower.includes("swiggy")) return "swiggy";
    if (fromLower.includes("ajio")) return "ajio";
    if (fromLower.includes("meesho")) return "meesho";
    if (fromLower.includes("bigbasket")) return "bigbasket";
    if (fromLower.includes("firstcry")) return "firstcry";
    if (fromLower.includes("tatacliq")) return "tatacliq";
    if (fromLower.includes("snapdeal")) return "snapdeal";

    // Courier companies
    if (fromLower.includes("dtdc")) return "dtdc";
    if (fromLower.includes("bluedart")) return "bluedart";
    if (fromLower.includes("fedex")) return "fedex";
    if (fromLower.includes("indiapost") || fromLower.includes("indianpost"))
      return "indianpost";
    if (fromLower.includes("ecomexpress")) return "ecomexpress";
    if (fromLower.includes("delhivery")) return "delhivery";
    if (fromLower.includes("aramex")) return "aramex";
    if (fromLower.includes("xpressbees")) return "xpressbees";
    if (fromLower.includes("ekart")) return "ekart";

    return "others";
  }

  /**
   * Log search session with clean approach details
   */
  logSearchSession(startDate, endDate, queries) {
    const sessionLog = {
      timestamp: new Date().toISOString(),
      searchRange: { startDate, endDate },
      totalQueries: queries.length,
      searchType: "clean_source_subject_approach",
      strategy:
        "from:(trusted_sources) + subject:(order_keywords) - promotional",
      queryBreakdown: {
        ecommerce: queries.filter((q) => q.category === "ecommerce").length,
        courier: queries.filter((q) => q.category === "courier").length,
        combined: queries.filter((q) => q.category === "combined").length,
      },
      sampleQueries: queries
        .slice(0, 3)
        .map((q) => ({ query: q.query, category: q.category })),
    };

    try {
      const logFile = path.join(this.debugDir, "search_sessions.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(sessionLog) + "\n");
    } catch (error) {
      console.error("Error logging search session:", error);
    }
  }

  /**
   * ENHANCED: Search specifically for order confirmations
   */
  async getOrderConfirmationEmails(daysToFetch, maxResults = 50) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysToFetch);
    const dateString = dateFrom.toISOString().split("T")[0].replace(/-/g, "/");

    console.log(
      `ðŸŽ¯ SEARCHING FOR ORDER CONFIRMATIONS (last ${daysToFetch} days)`
    );
    console.log(
      `ðŸ” Using clean approach: trusted sources + confirmation keywords`
    );

    // Clean confirmation queries
    const confirmationQueries = [
      {
        query: `from:(amazon.in OR amazon.com OR auto-confirm@amazon.com) (subject:"order confirmation" OR subject:"order placed" OR subject:"thank you for your order") -subject:offer -subject:promotion after:${dateString}`,
        category: "amazon_confirmations",
      },
      {
        query: `from:(flipkart.com OR noreply@flipkart.com) (subject:"order confirmation" OR subject:"order placed" OR subject:"order confirmed") -subject:offer -subject:sale after:${dateString}`,
        category: "flipkart_confirmations",
      },
      {
        query: `from:(myntra.com OR noreply@myntra.com) (subject:"order confirmation" OR subject:"order placed") -subject:offer -subject:sale after:${dateString}`,
        category: "myntra_confirmations",
      },
      {
        query: `from:(nykaa.com OR noreply@nykaa.com) (subject:"order confirmation" OR subject:"order placed") -subject:offer -subject:discount after:${dateString}`,
        category: "nykaa_confirmations",
      },
      {
        query: `from:(swiggy.in OR noreply@swiggy.in) (subject:"order placed" OR subject:"order confirmed" OR subject:"thank you") -subject:offer after:${dateString}`,
        category: "swiggy_confirmations",
      },
      {
        query: `(subject:"order confirmation" OR subject:"order placed" OR subject:"order confirmed") -subject:offer -subject:sale -subject:discount after:${dateString}`,
        category: "generic_confirmations",
      },
    ];

    const confirmationEmails = [];
    const seenIds = new Set();

    for (const { query, category } of confirmationQueries) {
      try {
        console.log(`ðŸ” ${category}: ${query}`);
        const response = await this.gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: Math.ceil(maxResults / confirmationQueries.length),
        });

        const messages = response.data.messages || [];
        let newCount = 0;

        for (const message of messages) {
          if (!seenIds.has(message.id)) {
            seenIds.add(message.id);
            confirmationEmails.push({
              ...message,
              queryCategory: category,
            });
            newCount++;
          }
        }

        console.log(
          `  âž¡ï¸ Found ${messages.length} emails (${newCount} new)`
        );
      } catch (error) {
        console.error(`âŒ Error searching ${category}:`, error.message);
        this.logError(query, error.message, category);
      }
    }

    console.log(
      `ðŸ“§ Total confirmation emails found: ${confirmationEmails.length}`
    );

    // Log confirmation results
    this.logConfirmationResults(
      confirmationEmails.length,
      confirmationQueries.length
    );

    return confirmationEmails;
  }

  // Keep all existing methods unchanged...
  async getEmailDetails(messageIds) {
    const emailDetails = [];
    const batchSize = 10;
    const actualPlatformStats = this.initializePlatformStats();

    console.log(
      `ðŸ“¥ Fetching details for ${messageIds.length} emails (batch size: ${batchSize})`
    );

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchPromises = batch.map((messageId) =>
        this.getSingleEmailDetails(messageId)
      );

      try {
        console.log(
          `ðŸ“¦ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            messageIds.length / batchSize
          )}`
        );

        const batchResults = await Promise.allSettled(batchPromises);
        const successfulResults = batchResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((email) => email !== null);

        emailDetails.push(...successfulResults);

        // Update actual platform stats based on email senders
        successfulResults.forEach((email) => {
          const platform = this.detectPlatformFromEmail(
            email.headers.from || ""
          );
          if (actualPlatformStats.hasOwnProperty(platform)) {
            actualPlatformStats[platform]++;
          } else {
            actualPlatformStats.others++;
          }
        });

        console.log(
          `  âœ… Successfully fetched ${successfulResults.length}/${batch.length} emails from this batch`
        );

        // Save debug emails to organized directories
        successfulResults.forEach((email, idx) => {
          this.saveDebugEmail(email, i + idx);
        });
      } catch (error) {
        logger.error(`Error fetching batch ${i / batchSize + 1}:`, error);
      }
    }

    console.log(
      `ðŸ“¥ Total email details fetched: ${emailDetails.length}/${messageIds.length}`
    );

    // Log ACTUAL platform statistics based on email senders
    console.log(`\nðŸ“Š ACTUAL PLATFORM BREAKDOWN (based on email senders):`);
    Object.entries(actualPlatformStats).forEach(([platform, count]) => {
      if (count > 0) {
        console.log(`  ${platform}: ${count} emails`);
      }
    });

    // Log email details summary with actual platform stats
    this.logEmailDetailsSummary(
      emailDetails.length,
      messageIds.length,
      actualPlatformStats
    );

    return emailDetails;
  }

  /**
   * Enhanced debug email saving with better organization
   */
  saveDebugEmail(email, index) {
    if (!email) return;

    try {
      const { headers, body } = email;
      const subject = headers.subject || "no_subject";
      const fromEmail = headers.from || "unknown_sender";
      const date = headers.date
        ? headers.date.replace(/[\s:,]/g, "_").slice(0, 20)
        : "no_date";

      // Detect platform for folder organization based on actual sender
      const platform = this.detectPlatformFromEmail(fromEmail);
      const platformDir = path.join(this.debugDir, "emails", platform);

      // Ensure platform directory exists
      if (!fs.existsSync(platformDir)) {
        fs.mkdirSync(platformDir, { recursive: true });
      }

      const safeName = sanitizeFilename(`${subject}`);
      const ext = body && body.html ? ".html" : ".txt";
      const filePath = path.join(
        platformDir,
        `${String(index).padStart(3, "0")}_${date}_${safeName}${ext}`
      );

      const content =
        body && body.html
          ? body.html
          : body && body.text
          ? body.text
          : JSON.stringify(email, null, 2);

      fs.writeFileSync(filePath, content);

      // Save comprehensive metadata
      const metadataPath = path.join(
        platformDir,
        `${String(index).padStart(3, "0")}_${date}_${safeName}_metadata.json`
      );
      const metadata = {
        id: email.id,
        subject: headers.subject,
        from: headers.from,
        date: headers.date,
        platform,
        internalDate: email.internalDate,
        queryCategory: email.queryCategory || "unknown",
        queryDescription: email.queryDescription || "unknown",
        hasOrderKeywords: this.hasOrderKeywords(subject, content),
        hasTrackingKeywords: this.hasTrackingKeywords(subject, content),
        emailSize: email.sizeEstimate || 0,
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error("Error saving debug email:", error);
    }
  }

  /**
   * Check if email contains order-related keywords
   */
  hasOrderKeywords(subject, content) {
    const text = (subject + " " + content).toLowerCase();
    const orderKeywords = [
      "order",
      "purchase",
      "confirmation",
      "placed",
      "confirmed",
    ];
    return orderKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Check if email contains tracking-related keywords
   */
  hasTrackingKeywords(subject, content) {
    const text = (subject + " " + content).toLowerCase();
    const trackingKeywords = [
      "tracking",
      "awb",
      "shipped",
      "dispatched",
      "delivered",
      "consignment",
    ];
    return trackingKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Log search results with trusted source validation
   */
  logSearchResults(totalFound, returned, queryStats, trustedSources) {
    const resultsLog = {
      timestamp: new Date().toISOString(),
      results: {
        totalFound,
        returned,
        queryStats,
        approach: "optimized_exact_sources_with_spam_inclusion",
      },
      trustedSourcesUsed: {
        ecommerceCount: trustedSources.ecommerce.length,
        courierCount: trustedSources.courier.length,
        totalTrustedSources:
          trustedSources.ecommerce.length + trustedSources.courier.length,
      },
    };

    try {
      const logFile = path.join(this.debugDir, "search_results.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(resultsLog) + "\n");

      // Human-readable summary
      const summaryFile = path.join(
        this.debugDir,
        `search_summary_${Date.now()}.txt`
      );
      const summary = `
GMAIL SEARCH SUMMARY - ${new Date().toISOString()}
==========================================

ðŸ” SEARCH APPROACH: from:(exact_trusted_sources) + subject:(keywords) - promotional + in:anywhere

ðŸ“Š SEARCH RESULTS:
- Total unique emails found: ${totalFound}
- Emails returned: ${returned}

ðŸ“ˆ QUERY CATEGORY BREAKDOWN:
${Object.entries(queryStats)
  .filter(([category, count]) => count > 0)
  .map(([category, count]) => `  ${category}: ${count} emails`)
  .join("\n")}

ðŸŽ¯ SEARCH STRATEGY:
âœ… EXACT trusted source filtering (${
        trustedSources.ecommerce.length + trustedSources.courier.length
      } specific senders)
âœ… Subject keyword targeting (order, shipped, delivered, tracking, etc.)
âœ… Explicit promotional exclusion (-subject:offer -subject:sale -subject:deals -subject:review)
âœ… Spam folder inclusion (in:anywhere) to catch Swiggy-type emails
âœ… Your discovered senders included (noreply@nct.flipkart.com, etc.)
âœ… Domain backup queries for sender variations
âœ… Content validation by existing parsers (Amazon, Flipkart, Swiggy parsers)

ðŸ¢ TRUSTED SOURCES USED:
- E-commerce senders: ${trustedSources.ecommerce.length}
- Courier senders: ${trustedSources.courier.length}

ðŸ“ DEBUG FILES: Check ~/gmail_debug_logs/emails/[platform]/ for organized email samples
ðŸš« GUARANTEE: Only emails from your specified trusted source list will be processed
`;

      fs.writeFileSync(summaryFile, summary);
      console.log(`ðŸ“„ Detailed logs saved to: ${this.debugDir}`);
    } catch (error) {
      console.error("Error logging search results:", error);
    }
  }

  /**
   * Log email details processing with actual platform stats
   */
  logEmailDetailsSummary(successful, total, actualPlatformStats) {
    const detailsLog = {
      timestamp: new Date().toISOString(),
      emailDetailsProcessing: {
        successful,
        total,
        successRate: Math.round((successful / total) * 100),
        actualPlatformStats,
      },
    };

    try {
      const logFile = path.join(this.debugDir, "email_details.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(detailsLog) + "\n");
    } catch (error) {
      console.error("Error logging email details summary:", error);
    }
  }

  /**
   * Log confirmation search results
   */
  logConfirmationResults(totalFound, queriesExecuted) {
    const confirmationLog = {
      timestamp: new Date().toISOString(),
      searchType: "order_confirmations_clean",
      totalFound,
      queriesExecuted,
      approach: "platform_specific_confirmation_targeting",
    };

    try {
      const logFile = path.join(this.debugDir, "confirmation_searches.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(confirmationLog) + "\n");
    } catch (error) {
      console.error("Error logging confirmation results:", error);
    }
  }

  /**
   * Log search errors for debugging
   */
  logError(query, errorMessage, category) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      query,
      category,
      error: errorMessage,
    };

    try {
      const logFile = path.join(this.debugDir, "search_errors.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(errorLog) + "\n");
    } catch (error) {
      console.error("Error logging search error:", error);
    }
  }

  /**
   * Fallback to original search method (kept for compatibility)
   */
  async getEmailsFromDateRangeOriginal(daysToFetch, maxResults) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysToFetch);
    const dateString = dateFrom.toISOString().split("T")[0].replace(/-/g, "/");

    const query = `(subject:order OR subject:shipped OR subject:delivered) after:${dateString} in:anywhere`;

    logger.info(`Fallback search with query: ${query}`);

    try {
      const response = await this.gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults,
      });

      return response.data.messages || [];
    } catch (error) {
      logger.error("Error in fallback search:", error);
      return [];
    }
  }

  async getSingleEmailDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId.id || messageId,
        format: "full",
      });

      const message = response.data;
      const headers = message.payload.headers;
      const extractedHeaders = this.extractHeaders(headers);
      const body = this.extractEmailBody(message.payload);

      return {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        internalDate: message.internalDate,
        sizeEstimate: message.sizeEstimate,
        headers: extractedHeaders,
        body: body,
        messageId: extractedHeaders["message-id"] || null,
      };
    } catch (error) {
      logger.error(`Error fetching email details for ${messageId}:`, error);
      return null;
    }
  }

  extractHeaders(headers) {
    const extracted = {};
    const importantHeaders = ["from", "to", "subject", "date", "message-id"];
    headers.forEach((header) => {
      if (importantHeaders.includes(header.name.toLowerCase())) {
        extracted[header.name.toLowerCase()] = header.value;
      }
    });
    return extracted;
  }

  extractEmailBody(payload) {
    if (!payload) return { text: "", html: "" };

    let text = "";
    let html = "";

    function walkParts(part) {
      if (part.body && part.body.data) {
        const content = Buffer.from(part.body.data, "base64").toString("utf-8");
        if (part.mimeType === "text/plain" && !text) text = content;
        if (part.mimeType === "text/html" && !html) html = content;
      }
      if (part.parts) {
        part.parts.forEach(walkParts);
      }
    }
    walkParts(payload);

    return { text, html };
  }
}

module.exports = GmailService;
