# Order Tracker Backend

A modern, modular backend for the Order Tracker application that fetches and parses order emails from Gmail with a scalable architecture.

## 🏗️ Clean Modular Architecture

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Database configuration
│   │   ├── emailConfig.js       # Auto-generated email filtering configuration
│   │   └── parserConfig.js      # Auto-generated parser configuration
│   ├── constants/
│   │   └── index.js             # Centralized application constants (auto-generated)
│   ├── middleware/
│   │   ├── authentication/      # Modular authentication system
│   │   │   ├── index.js         # Main auth entry point
│   │   │   ├── jwtAuth.js       # JWT authentication logic
│   │   │   └── googleAuth.js    # Google OAuth logic
│   │   ├── validation/          # Request validation middleware
│   │   │   └── orderValidation.js # Order and sync validation
│   │   └── errorHandler.js      # Global error handling
│   ├── models/                  # Sequelize database models
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── orders.js            # Order management routes
│   │   └── sync.js              # Email sync routes
│   ├── services/
│   │   ├── parsers/             # Modular email parsers (auto-discovered)
│   │   │   ├── index.js         # Parser factory with auto-discovery
│   │   │   ├── baseParser.js    # Base parser class
│   │   │   ├── amazonParser.js  # Amazon-specific parser
│   │   │   ├── flipkartParser.js # Flipkart-specific parser
│   │   │   ├── swiggyParser.js  # Swiggy-specific parser
│   │   │   ├── myntraParser.js  # Myntra-specific parser
│   │   │   ├── blinkitParser.js # Blinkit-specific parser
│   │   │   ├── nykaaParser.js   # Nykaa-specific parser
│   │   │   ├── zeptoParser.js   # Zepto-specific parser
│   │   │   └── genericParser.js # Generic fallback parser
│   │   ├── database/            # Database service layer
│   │   │   └── orderService.js  # Order database operations
│   │   ├── gmailService.js      # Gmail API integration
│   │   ├── syncService.js       # Sync orchestration
│   │   └── deduplication.js     # Order deduplication logic
│   ├── utils/
│   │   ├── logger.js            # Logging utility
│   │   ├── googleToken.js       # Google token management
│   │   ├── normalize.js         # Data normalization utilities
│   │   ├── validation.js        # Validation utilities
│   │   └── response.js          # API response utilities
│   └── server.js                # Express server setup
├── package.json
└── README.md
```

## 🚀 Key Improvements in Clean Architecture

### 1. **Auto-Discovery Parser System**

- **Zero Manual Registration**: Parsers are automatically discovered and loaded
- **Dynamic Configuration**: Platform configurations are auto-generated
- **Auto-Sync Constants**: Platform lists are dynamically populated
- **Simple Extension**: Just create a parser file and it's automatically available

### 2. **Eliminated Redundancy**

- **Removed Old Files**: Deleted redundant `emailParser.js`, `emailParserFactory.js`, `emailProcessingService.js`, `parserGenerator.js`, and old `auth.js`
- **Clean Dependencies**: Updated all imports to use new modular structure
- **Streamlined Services**: Only essential services remain

### 3. **Modular Authentication**

- **Separated Concerns**: JWT and Google OAuth in separate modules
- **Clean Interface**: Single entry point through `authentication/index.js`
- **Updated Routes**: All routes now use the new authentication system

### 4. **Centralized Configuration**

- **Auto-Generated Configs**: Email and parser configurations are dynamically generated
- **Single Source of Truth**: Constants are auto-populated from discovered parsers
- **No Manual Updates**: Adding new parsers requires no configuration changes

### 5. **Environment-Driven Configuration**

- **Comprehensive .env.example**: Complete template with all configurable values
- **No Hardcoded Values**: All configuration moved to environment variables
- **Flexible Limits**: Configurable pagination, rate limiting, and sync limits
- **Environment-Specific Settings**: Different configurations for development/production
- **Security Best Practices**: Sensitive values properly externalized

## 🔧 Adding New Email Parsers

The clean architecture makes adding new e-commerce platforms incredibly simple. Here's how to add a new parser:

### Currently Supported Platforms

The system currently supports parsing emails from:

- **Amazon** - E-commerce and marketplace orders
- **Flipkart** - E-commerce platform orders
- **Swiggy** - Food delivery and Instamart orders
- **Myntra** - Fashion and lifestyle orders
- **Blinkit** - Quick commerce and grocery delivery
- **Nykaa** - Beauty and cosmetics orders
- **Zepto** - 10-minute delivery service
- **Domino's** - Pizza and food delivery orders
- **Generic** - Fallback parser for unsupported platforms

### Simple 3-Step Process

#### Step 1: Create the Parser File

Create `src/services/parsers/yourPlatformParser.js`:

```javascript
const BaseParser = require("./baseParser");

class YourPlatformParser extends BaseParser {
  constructor() {
    super("yourplatform");
  }

  canParse(email) {
    const sender = email.sender?.toLowerCase() || "";
    const subject = email.subject?.toLowerCase() || "";

    return (
      sender.includes("yourplatform") ||
      sender.includes("yourplatform.com") ||
      subject.includes("yourplatform") ||
      subject.includes("order confirmation")
    );
  }

  parse(email) {
    const html = email.html || "";
    const text = email.text || "";

    // Your platform-specific parsing logic
    const orderId = this.extractOrderId(html, text);
    const amount = this.extractAmount(html, text);
    const orderDate = this.extractOrderDate(html, text);
    const items = this.extractItems(html, text);

    return {
      orderId,
      amount,
      orderDate,
      items,
      platform: "yourplatform",
      confidence: this.calculateConfidence(orderId, amount, items),
    };
  }

  // Implement your platform-specific extraction methods
  extractOrderId(html, text) {
    // Your order ID extraction logic
  }

  extractAmount(html, text) {
    // Your amount extraction logic
  }

  extractOrderDate(html, text) {
    // Your date extraction logic
  }

  extractItems(html, text) {
    // Your items extraction logic
  }

  calculateConfidence(orderId, amount, items) {
    // Your confidence calculation logic
  }
}

module.exports = YourPlatformParser;
```

#### Step 2: That's It!

The system will automatically:

- ✅ Discover your new parser
- ✅ Add it to the supported platforms list
- ✅ Generate configuration for it
- ✅ Make it available for email parsing
- ✅ Update constants and configurations

#### Step 3: Test (Optional)

```bash
# Test that your parser is discovered
node -e "const { parserFactory } = require('./src/services/parsers'); console.log('Supported platforms:', parserFactory.getSupportedPlatforms());"
```

## 🚀 Features

### Core Functionality

- **Gmail Integration**: Fetch order emails using Gmail API
- **Smart Filtering**: Exclude promotional emails and focus on order-related content
- **Multi-Platform Support**: Parse orders from Amazon, Flipkart, Swiggy, Myntra, Blinkit, Nykaa, Zepto, and more
- **Generic Parser**: Fallback parser for unsupported platforms
- **Auto-Discovery**: Zero-configuration parser addition
- **Configurable Settings**: Easy-to-modify email filtering rules
- **RESTful API**: Clean API endpoints for frontend integration

### Email Processing

- **Configurable Date Range**: Fetch emails from last N days (default: 7 days)
- **Platform-Specific Parsing**: Individual parsers for each e-commerce platform
- **Promotional Filtering**: Automatically exclude marketing and promotional emails
- **Order Detection**: Focus on order confirmation, shipping, and delivery emails
- **Deduplication**: Prevent duplicate orders using intelligent hashing

## 🔧 Configuration

### Auto-Generated Email Configuration

The system automatically generates email filtering configuration based on discovered parsers:

```javascript
// Auto-generated from discovered parsers
module.exports = {
  platforms: ["amazon", "flipkart", "swiggy", "myntra", "blinkit", "nykaa", "zepto", "generic"],
  platformConfigs: { /* auto-generated */ },
  emailPatterns: { /* auto-generated */ },
  searchQueries: { /* auto-generated */ },

  // Manual configuration
  defaultDaysToFetch: 7,
  maxEmailsPerSync: 50,
  promotionalKeywords: ["newsletter", "deals", "offers", ...],
  orderKeywords: ["order", "order confirmation", "shipped", ...]
};
```

### Environment Variables

Copy the example file and configure your environment:

```bash
cp .env.example .env
# Edit .env with your configuration
```

#### Key Configuration Categories

**Server Configuration**

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `FRONTEND_URL`: Frontend URL for CORS
- `DEBUG_MODE`: Enable detailed logging (default: false)
- `DB_SYNC_ALTER`: Enable database sync in development (default: false)

**Database Configuration**

- `DB_HOST`: Database host (default: localhost)
- `DB_PORT`: Database port (default: 5432)
- `DB_USER`: Database username (default: postgres)
- `DB_PASSWORD`: Database password (default: password)
- `DB_NAME`: Database name (default: order_tracker_dev)
- `DB_NAME_TEST`: Test database name (default: order_tracker_test)
- `DB_SSL`: Enable SSL for database (default: false)

**Rate Limiting & Security**

- `RATE_LIMIT_WINDOW_MS`: Rate limit window (default: 900000ms)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)
- `AUTH_RATE_LIMIT_MAX_REQUESTS`: Auth max requests (default: 5)
- `REQUEST_BODY_LIMIT`: Request body size limit (default: 10mb)

**Pagination & Sync Limits**

- `PAGINATION_DEFAULT_LIMIT`: Default pagination limit (default: 10)
- `PAGINATION_MAX_LIMIT`: Max pagination limit (default: 100)
- `SYNC_DEFAULT_DAYS`: Default sync days (default: 7)
- `SYNC_MAX_DAYS`: Max sync days (default: 30)
- `SYNC_DEFAULT_MAX_RESULTS`: Default sync results (default: 50)
- `SYNC_MAX_RESULTS`: Max sync results (default: 100)

**Google OAuth Configuration**

- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_CALLBACK_URL`: OAuth callback URL
- `GOOGLE_TOKEN_EXPIRY_MS`: Token expiry time (default: 3600000ms)

**JWT Configuration**

- `JWT_SECRET`: JWT secret key
- `JWT_EXPIRES_IN`: JWT expiration time (default: 7d)

## 📡 API Endpoints

### Authentication

- `POST /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/me` - Get current user

### Email Sync

- `POST /api/sync/trigger` - Start email sync
- `GET /api/sync/status` - Get sync status
- `GET /api/sync/history` - Get sync history

### Orders

- `GET /api/orders` - List orders (paginated)
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/search` - Search orders

## 🔄 Sync Process

1. **Authentication**: Verify user has valid Gmail access tokens
2. **Email Fetching**: Search Gmail for order-related emails from specified platforms
3. **Filtering**: Exclude promotional emails using configurable rules
4. **Auto-Parser Selection**: Automatically select appropriate parser based on email content
5. **Parsing**: Parse emails using platform-specific parsers
6. **Data Extraction**: Extract order details (ID, amount, items, status)
7. **Deduplication**: Check for existing orders to prevent duplicates
8. **Response**: Return structured JSON with parsed orders

### Sync Request Example

```javascript
POST /api/sync/trigger
{
  "daysToFetch": 7,
  "maxResults": 100,
  "platforms": ["amazon", "flipkart", "swiggy", "myntra", "blinkit", "nykaa", "zepto"]
}
```

### Sync Response Example

```javascript
{
  "success": true,
  "message": "Email sync started successfully",
  "data": {
    "syncId": "sync_user123_1234567890",
    "estimatedDuration": "2-5 minutes",
    "options": {
      "daysToFetch": 7,
      "maxResults": 100,
      "platforms": ["amazon", "flipkart", "swiggy", "myntra", "blinkit", "nykaa", "zepto"]
    }
  }
}
```

## 🧩 Services Architecture

### Parser Factory (`parsers/index.js`)

- **Auto-Discovery**: Automatically discovers and loads parser classes
- **Dynamic Selection**: Chooses the right parser based on email content
- **Zero Configuration**: No manual registration required
- **Fallback Handling**: Graceful degradation when no parser matches

### Base Parser (`parsers/baseParser.js`)

- **Common Functionality**: Shared methods for all parsers
- **Data Validation**: Ensures parsed data meets requirements
- **Confidence Scoring**: Calculates parsing confidence levels
- **Item Deduplication**: Prevents duplicate items in orders

### Database Service Layer (`database/orderService.js`)

- **Abstraction**: Clean separation between business logic and database
- **Transaction Support**: Ensures data consistency
- **Pagination**: Efficient handling of large datasets
- **Search Capabilities**: Advanced order search functionality

### Authentication Middleware (`middleware/authentication/`)

- **Modular Design**: Separate JWT and Google OAuth handling
- **Rate Limiting**: Protection against abuse
- **Token Management**: Automatic token refresh and validation

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed database (if needed)
npm run db:seed
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## 📊 Monitoring

### Logging

- Winston logger with structured logging
- Different log levels (error, warn, info, debug)
- Request/response logging with Morgan

### Health Checks

- `GET /health` - Application health status
- Database connection monitoring
- Gmail API connectivity checks

## 🔒 Security

- **Authentication**: Google OAuth 2.0 with JWT tokens
- **Rate Limiting**: Express rate limiting for API endpoints
- **CORS**: Configured for frontend domain
- **Helmet**: Security headers
- **Input Validation**: Request validation middleware

## 🚀 Deployment

### Production Setup

```bash
# Build and start
npm start

# Environment variables for production
NODE_ENV=production
DB_SSL=true
```

### Docker Deployment

```bash
# Build image
docker build -t order-tracker-backend .

# Run container
docker run -p 3000:3000 order-tracker-backend
```

## 📈 Performance

### Optimizations

- Batch email fetching (20 emails per batch)
- Configurable result limits
- Efficient Gmail search queries
- Parallel processing where possible
- Modular parsing for better performance

### Monitoring

- Sync duration tracking
- Email parsing success rates
- API response times
- Error rate monitoring
- Parser performance metrics

## 🔧 Customization

### Adding New Platforms

The clean architecture makes adding new platforms incredibly simple:

1. **Create Parser**: Extend `BaseParser` with platform-specific logic
2. **Auto-Discovery**: System automatically discovers and registers the parser
3. **Test**: Verify parsing works correctly

### Modifying Email Filters

Edit `src/config/emailConfig.js` to:

- Add/remove promotional keywords
- Modify search parameters
- Adjust sync settings

### Extending Base Parser

The `BaseParser` class provides common functionality that can be extended:

- **Data Validation**: Override validation methods
- **Confidence Scoring**: Customize confidence calculation
- **Item Processing**: Modify item extraction logic

## 🆘 Troubleshooting

### Common Issues

- **Gmail API Errors**: Check OAuth tokens and permissions
- **Database Connection**: Verify database credentials and connectivity
- **Parsing Failures**: Review email structure and parser logic
- **Parser Not Found**: Ensure parser file follows naming convention

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev
```

### Parser Debugging

To debug parser issues:

1. Check if `canParse()` returns true for target emails
2. Verify regex patterns match email content
3. Test individual parser methods
4. Review confidence scores

## 🔄 Migration Guide

### From Old Architecture

If migrating from the old monolithic structure:

1. **Update Imports**: Change import paths to use new modular structure
2. **Update Middleware**: Use new authentication middleware
3. **Update Services**: Use new database service layer
4. **Test Thoroughly**: Verify all functionality works as expected

### Breaking Changes

- Authentication middleware path changed to `middleware/authentication`
- Email parser service structure updated to auto-discovery
- Database operations now use service layer
- Constants moved to centralized location

## 🧹 Clean Architecture Benefits

### What Was Removed

- ❌ `src/services/emailParser.js` - Old monolithic parser
- ❌ `src/services/emailParserFactory.js` - Old factory system
- ❌ `src/services/emailProcessingService.js` - Unused service
- ❌ `src/utils/parserGenerator.js` - Manual generation utility
- ❌ `src/middleware/auth.js` - Old authentication file
- ❌ NPM scripts for parser generation - Manual process preferred

### What Was Improved

- ✅ **Auto-Discovery**: Zero manual configuration required
- ✅ **Clean Dependencies**: All imports updated to new structure
- ✅ **Modular Authentication**: Separated JWT and OAuth concerns
- ✅ **Dynamic Configuration**: Auto-generated from discovered parsers
- ✅ **Simplified Extension**: Just create a parser file

---

**Happy Tracking! 📦✨**
