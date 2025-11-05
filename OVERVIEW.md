# VolSpike - Binance Perpetual Futures Trading Dashboard

## 🎯 Project Overview

**VolSpike** is a comprehensive, production-ready trading dashboard specifically designed for Binance Perpetual Futures markets. It provides real-time market data, volume spike alerts, advanced analytics, and tiered access control for cryptocurrency traders and institutions.

### What VolSpike Does

VolSpike serves as a **"Binance Perps Guru Dashboard"** that:

1. **Real-Time Market Monitoring**: Continuously tracks Binance perpetual futures markets with **client-side WebSocket** connection
2. **Volume Spike Detection**: Identifies unusual trading volume patterns that often precede significant price movements
3. **Tiered Access Control**: Provides Free, Pro, and Elite tiers with different refresh rates and features
4. **Multi-Channel Alerts**: Sends notifications via email, SMS, Telegram, and Discord
5. **Web3 Integration**: Supports wallet-based authentication and Web3-native features
6. **Payment Processing**: Integrated Stripe subscription management for premium tiers

### Target Users

- **Retail Traders**: Individual cryptocurrency traders seeking edge in perpetual futures
- **Institutional Traders**: Trading firms and hedge funds requiring reliable market data
- **Algorithmic Traders**: Developers building trading bots and automated strategies
- **Market Analysts**: Professionals analyzing cryptocurrency market dynamics

---

## 🏗️ Client-Only Architecture (No Redis Dependency)

### Core Technology Stack

VolSpike uses a modern **client-side WebSocket architecture** with the following components:

#### Frontend: Next.js 15+ with Client-Side WebSocket
- **Framework**: Next.js 15+ with App Router for optimal performance
- **Language**: TypeScript for type safety and better developer experience
- **Styling**: Tailwind CSS + shadcn/ui for modern, responsive design
- **State Management**: React hooks for client state management
- **Web3 Integration**: Wagmi + Viem + RainbowKit for wallet connectivity
- **Authentication**: NextAuth.js v5 with email magic links and Web3 wallet auth
- **Real-time Data**: **Direct Binance WebSocket** from user's browser (no server dependency)

#### Backend: Node.js with Hono Framework (Auth/Payments Only)
- **Framework**: Hono (lightweight, edge-compatible, high-performance)
- **Language**: TypeScript for consistency across the stack
- **Database**: PostgreSQL with TimescaleDB extension (for user data only)
- **ORM**: Prisma for type-safe database operations
- **Payments**: Stripe integration with webhook handling
- **Purpose**: User authentication and payment processing only
 - **Email**: SendGrid for email verification and welcome emails

#### Data Processing: Client-Side WebSocket
- **Language**: TypeScript for consistency
- **WebSocket**: Direct Binance WebSocket connection from user's browser
- **Processing**: Client-side data filtering and tier-based throttling
- **Storage**: localStorage fallback for region-blocked users
- **No Server Dependency**: Eliminates Redis, ingestion service, and IP blocking issues

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    VolSpike Client-Only Architecture            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Next.js 15+ Frontend                        │ │
│  │                                                             │ │
│  │ • TypeScript + Tailwind CSS                                │ │
│  │ • NextAuth.js (Email + Web3)                               │ │
│  │ • RainbowKit (Wallet Integration)                          │ │
│  │ • Direct Binance WebSocket                                 │ │
│  │ • Client-Side Data Processing                              │ │
│  │ • Tier-Based Throttling                                    │ │
│  │ • localStorage Fallback                                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           │ (Optional - Auth/Payments Only)                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Node.js + Hono Backend                     │ │
│  │                                                             │ │
│  │ • TypeScript + Prisma ORM                                  │ │
│  │ • Stripe Integration                                        │ │
│  │ • User Authentication                                       │ │
│  │ • Payment Processing                                        │ │
│  │ • PostgreSQL Database (User Data Only)                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                PostgreSQL + TimescaleDB                    │ │
│  │                                                             │ │
│  │ • User Data Only                                           │ │
│  │ • Authentication Records                                   │ │
│  │ • Payment History                                           │ │
│  │ • User Preferences                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                External Services                            │ │
│  │                                                             │ │
│  │ • Binance WebSocket (Direct from Browser)                  │ │
│  │ • Stripe (Payments)                                        │ │
│  │ • SendGrid (Email Alerts)                                  │ │
│  │ • Twilio (SMS Alerts)                                      │ │
│  │ • Telegram/Discord (Webhooks)                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- ✅ **No Redis dependency** (eliminates costs and rate limits)
- ✅ **No server-side data ingestion** (eliminates IP blocking issues)
- ✅ **Direct Binance connection** (uses user's residential IP)
- ✅ **Simplified infrastructure** (frontend + optional auth backend)
- ✅ **Real-time data** for all tiers with client-side throttling

---

## 🚀 Key Features

### Tier-Based Access Control (Client-Side Throttling)

#### Free Tier
- **Refresh Rate**: 15-minute intervals (client-side throttling)
- **Features**: Basic market data, USDT pairs only, no Open Interest column
- **Alerts**: None
- **Data Source**: Direct Binance WebSocket with throttling

#### Pro Tier ($29/month)
- **Refresh Rate**: 5-minute intervals (client-side throttling)
- **Features**: All symbols, advanced filters, Open Interest visible
- **Alerts**: Email notifications
- **Data Source**: Direct Binance WebSocket with throttling

#### Elite Tier ($99/month)
- **Refresh Rate**: Real-time updates (no throttling)
- **Features**: All Pro features + advanced analytics
- **Alerts**: Email + SMS + Telegram + Discord
- **Data Source**: Direct Binance WebSocket (live data)

### Real-Time Data Pipeline (Client-Side)

1. **Direct Binance WebSocket** → User's browser
2. **Client-Side Processing** → Volume spike detection and filtering
3. **Tier-Based Throttling** → Frontend controls update frequency
4. **localStorage Fallback** → For region-blocked users
5. **Real-Time Updates** → No server dependency for market data
6. **Automatic Reconnection** → Exponential backoff on connection loss

### Authentication & Security

#### Multi-Modal Authentication
- ✅ **Email/Password**: Fully working with proper password verification and error handling
- ✅ **Email Verification Flow**: SendGrid-powered verification with hidden preheader, site-hosted PNG logo (`/email/volspike-badge@2x.png`), and bulletproof table CTA (VML fallback for Outlook). After verification, users are taken to `/auth` to sign in. Resend available on `/auth` and error state of `/auth/verify`.
- ✅ **Web3 Wallets**: MetaMask, WalletConnect, Coinbase Wallet via RainbowKit
- ✅ **OAuth Providers**: Google, GitHub integration
- ✅ **SIWE**: Sign-In with Ethereum for Web3 authentication
- ✅ **Error Messages**: User-friendly error display for invalid credentials
- ✅ **Password Toggle**: Working eye icon for password visibility
- ✅ **Admin Authentication**: Role-based access with proper redirects

#### Security Features
- **JWT Tokens**: Stateless, scalable authentication
- **Rate Limiting**: Frontend-based throttling for WebSocket updates by tier
- **CORS Protection**: Configured for frontend domains
- **Input Validation**: Zod schemas for all user inputs
- **Row-Level Security**: User data isolation
- **HTTPS Enforcement**: Required in production

### Payment Processing

#### Stripe Integration
- **Subscription Management**: Automated billing cycles
- **Webhook Handling**: Real-time payment event processing
- **Tier Upgrades**: Automatic feature unlocking
- **Billing Portal**: Self-service subscription management
- **Multiple Payment Methods**: Credit cards, bank transfers, crypto

### Notification System

#### Multi-Channel Alerts
- **Email**: SendGrid integration for reliable delivery
- **SMS**: Twilio integration (Elite tier only)
- **Telegram**: Bot notifications via webhooks
- **Discord**: Channel notifications via webhooks
- **In-App**: Real-time browser notifications

#### Alert Types
- **Volume Spikes**: Unusual trading volume detection
- **Price Movements**: Significant price change alerts
- **Funding Rate Changes**: Funding rate threshold alerts
- **Open Interest**: Large position changes
- **Custom Alerts**: User-defined conditions

### Admin Dashboard (Role-Based Access Control)

#### Admin Authentication & Authorization
- **Role-Based Access**: ADMIN vs USER roles with tier system (FREE, PRO, ELITE)
- **Admin Routes**: `/admin/*` with server-side protection
- **Session Policy**: Shorter session duration for admin accounts
- **2FA Enforcement**: Mandatory two-factor authentication for admin access
- **IP Allowlisting**: Optional IP restriction for admin access
- **Audit Logging**: Complete activity tracking for all admin actions

#### User Management
- **User CRUD Operations**: Create, read, update, delete user accounts
- **Status Control**: Manage user status (ACTIVE, SUSPENDED, BANNED)
- **Account Security**: Monitor login attempts, lockout management
- **User Analytics**: Track last login, IP addresses, user agents
- **Bulk Operations**: Mass user management and status updates
- **User Invitations**: Send invitation emails for new user accounts

#### Subscription Oversight
- **Stripe Integration Monitoring**: Real-time subscription status tracking
- **Tier Management**: Upgrade/downgrade user subscription tiers
- **Payment Monitoring**: Track failed payments, billing issues
- **Revenue Analytics**: Monthly recurring revenue, churn analysis
- **Subscription Sync**: Manual sync with Stripe for data consistency
- **Billing Portal Access**: Admin access to user billing information

#### System Health & Metrics
- **Health Monitoring**: Database, API, WebSocket connection status
- **User Growth Analytics**: Signup trends, retention metrics
- **Performance Metrics**: Response times, error rates, uptime
- **Resource Monitoring**: CPU, memory, storage usage
- **Alert Management**: System alerts, notification delivery status
- **Capacity Planning**: User growth projections, scaling requirements

#### Security & Compliance
- **Audit Logging**: Complete activity tracking with timestamps
- **Security Monitoring**: Failed login attempts, suspicious activity
- **Data Export**: Export audit logs for compliance reporting
- **Access Control**: Granular permissions for different admin functions
- **Session Management**: Admin session monitoring and termination
- **Security Policies**: Configurable security settings and thresholds

---

## 📊 Market Data & Analytics

### Supported Markets
- **Binance Perpetual Futures**: All active perpetual contracts
- **Major Cryptocurrencies**: BTC, ETH, SOL, AVAX, MATIC, etc.
- **Altcoins**: 200+ supported perpetual contracts
- **Cross-Margins**: BTC, ETH, USDT margin pairs

### Data Points Tracked
- **Price Data**: Real-time bid/ask, last price, 24h change
- **Volume Metrics**: 24h volume, volume spikes, volume ratios
- **Funding Rates**: Current and historical funding rates with visual alerts (±0.03% threshold)
- **Open Interest**: Total open interest and changes
- **Liquidation Data**: Estimated liquidation levels
- **Market Depth**: Order book snapshots
- **UI Enhancements**: Clean column layout (Ticker, Price, Price Change, Funding Rate, 24h Volume)

### Volume Spike Detection Algorithm

```typescript
interface VolumeSpikeDetection {
  // Calculate volume ratio vs historical average
  volumeRatio: number;
  
  // Time window for comparison (default: 1 hour)
  timeWindow: number;
  
  // Threshold for spike detection (default: 2.5x)
  spikeThreshold: number;
  
  // Minimum volume requirement
  minVolume: number;
  
  // Price movement correlation
  priceMovement: number;
}
```

### Analytics Features
- **Historical Analysis**: Price and volume correlation over time
- **Pattern Recognition**: Identify recurring market patterns
- **Risk Metrics**: Volatility and correlation analysis
- **Performance Tracking**: Portfolio performance metrics
- **Custom Indicators**: User-defined technical indicators

---

## 🛠️ Development & Deployment

### Development Setup

#### Prerequisites
- Node.js 18+ (LTS recommended)
- Docker & Docker Compose (for PostgreSQL only)
- PostgreSQL (or use Docker)
- Stripe account (for payments)
- SendGrid account (for email notifications)
  - Domain Authentication enabled; from address `noreply@volspike.com`
- **No Redis needed** (client-side WebSocket solution)

#### Quick Start (Frontend Only)
```bash
# Clone the repository
git clone https://github.com/NikolaySitnikov/VolSpike.git
cd VolSpike

# Start PostgreSQL (for auth/payments only)
docker run -d \
  --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15

# Start frontend (includes client-side WebSocket)
cd volspike-nextjs-frontend
npm install && npm run dev

# Market data loads automatically via Binance WebSocket
# No backend needed for market data
```

#### Full Stack Setup (Optional)
```bash
# Add backend for auth/payments
cd volspike-nodejs-backend
npm install && npm run dev

# Frontend with auth/payments
cd volspike-nextjs-frontend
npm install && npm run dev
```

### Production Deployment

#### Frontend Deployment (Vercel - Recommended)
```bash
# Deploy frontend to Vercel
cd volspike-nextjs-frontend
vercel --prod

# Market data works immediately via client-side WebSocket
# No backend needed for market data
```

#### Backend Deployment (Railway - Optional)
```bash
# Deploy backend for auth/payments only
cd volspike-nodejs-backend
railway deploy

# Only needed if you want user authentication and payments
```

#### Cloud Deployment Options
- **Frontend**: Deploy to Vercel (includes client-side WebSocket)
- **Backend**: Deploy to Railway or Fly.io (auth/payments only)
- **Database**: Use managed PostgreSQL (Neon, Supabase)
- **No Redis needed** (client-side WebSocket solution)
- **No ingestion service needed** (direct Binance connection)

### Environment Variables

#### Backend (.env) - Auth/Payments Only
```bash
# Database (user data only)
DATABASE_URL=postgresql://username:password@localhost:5432/volspike

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SendGrid)
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@volspike.com
SENDGRID_VERIFICATION_TEMPLATE_ID= # optional, we send our own HTML
SENDGRID_WELCOME_TEMPLATE_ID=      # optional, we send our own HTML

# SMS (Twilio - Elite tier)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Market Data Polling (set to true to disable backend market polling in production)
DISABLE_SERVER_MARKET_POLL=false

# Environment
NODE_ENV=development
LOG_LEVEL=info
PORT=3001
```

#### Frontend (.env.local) - Client-Side WebSocket
```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key

# API Configuration (for auth/payments only)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:3001

# Binance WebSocket (direct from browser)
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# WalletConnect Configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# Note: No Redis or WebSocket server URLs needed
# Market data comes directly from Binance WebSocket
```

---

## 📈 Performance & Scalability

### Performance Targets (Client-Side WebSocket)

#### Real-Time Latency
- **Free Tier**: 15-minute refresh (client-side throttling)
- **Pro Tier**: 5-minute refresh (client-side throttling)
- **Elite Tier**: Real-time updates (<150ms latency)

#### Client-Side Performance
- **WebSocket Connection**: <100ms establishment time
- **Data Processing**: <10ms client-side filtering
- **UI Updates**: <50ms React re-renders
- **Memory Usage**: <100MB browser memory

#### Scalability Metrics
- **Concurrent Users**: Unlimited (client-side processing)
- **Database**: PostgreSQL with read replicas (user data only)
- **No Redis Dependency**: Eliminates cache bottlenecks
- **Throughput**: Limited only by Binance WebSocket capacity

### Optimization Strategies (Client-Side)

#### WebSocket Optimization
- **Direct Binance Connection**: No server intermediary
- **Automatic Reconnection**: Exponential backoff on failures
- **Message Batching**: Efficient data processing
- **Selective Updates**: Only process relevant data

#### Client-Side Caching
- **localStorage Fallback**: For region-blocked users
- **Memory Caching**: In-memory data storage
- **Tier-Based Throttling**: Efficient update frequency control
- **Data Filtering**: Client-side USDT pair filtering

#### Performance Monitoring
- **Browser Console**: WebSocket connection status
- **Memory Usage**: Client-side memory monitoring
- **Update Frequency**: Tier-based throttling verification
- **Error Handling**: Automatic reconnection on failures

---

## 🔒 Security & Compliance

### Security Measures

#### Authentication Security
- **JWT Tokens**: Secure, stateless authentication
- **Session Management**: Proper session handling
- **Rate Limiting**: Prevent abuse and DDoS
- **CORS Protection**: Cross-origin request security

#### Data Protection
- **Encryption**: Data encryption at rest and in transit
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy headers

#### API Security
- **API Key Management**: Secure API key handling
- **Request Signing**: HMAC request signing
- **IP Whitelisting**: Restrict access by IP
- **Audit Logging**: Track all sensitive operations

### Compliance Considerations

#### Data Privacy
- **GDPR Compliance**: European data protection
- **CCPA Compliance**: California privacy rights
- **Data Retention**: Configurable retention policies
- **User Consent**: Explicit consent mechanisms

#### Financial Compliance
- **KYC/AML**: Know Your Customer procedures
- **Transaction Monitoring**: Suspicious activity detection
- **Audit Trails**: Comprehensive logging
- **Regulatory Reporting**: Automated compliance reporting

---

## 🧪 Testing & Quality Assurance

### Testing Strategy

#### Unit Testing
```bash
# Backend tests
cd volspike-nodejs-backend
npm test

# Frontend tests
cd volspike-nextjs-frontend
npm test
```

#### Integration Testing
```bash
# Test database connections (auth/payments only)
npm run test:db

# Test WebSocket connectivity (client-side)
npm run test:websocket
```

#### End-to-End Testing
- **User Authentication**: Login/logout flows
- **Payment Processing**: Stripe integration testing
- **Real-Time Data**: WebSocket connection testing
- **Alert System**: Notification delivery testing

### Quality Assurance

#### Code Quality
- **TypeScript**: Type safety across the stack
- **ESLint**: Code linting and formatting
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks

#### Performance Monitoring
- **Sentry**: Error tracking and monitoring
- **LogRocket**: User session recording
- **New Relic**: Application performance monitoring
- **Custom Metrics**: Business-specific metrics

---

## 📚 API Documentation

### REST API Endpoints

#### Authentication
```typescript
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/web3/signin
```

#### Market Data
```typescript
GET  /api/market/symbols
GET  /api/market/data/:symbol
GET  /api/market/history/:symbol
GET  /api/market/volume-spikes
```

#### User Management
```typescript
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
POST   /api/admin/users/:id/suspend
POST   /api/admin/users/:id/activate
POST   /api/admin/users/invite
```

#### Subscription Management
```typescript
GET    /api/admin/subscriptions
GET    /api/admin/subscriptions/:id
PUT    /api/admin/subscriptions/:id/tier
POST   /api/admin/subscriptions/sync-stripe
GET    /api/admin/subscriptions/revenue
```

#### Audit & Security
```typescript
GET    /api/admin/audit/logs
GET    /api/admin/audit/export
GET    /api/admin/audit/security-events
POST   /api/admin/audit/log-action
```

#### System Metrics
```typescript
GET    /api/admin/metrics/health
GET    /api/admin/metrics/users
GET    /api/admin/metrics/revenue
GET    /api/admin/metrics/performance
```

#### Admin Settings
```typescript
GET    /api/admin/settings
PUT    /api/admin/settings
GET    /api/admin/settings/security
PUT    /api/admin/settings/security
POST   /api/admin/settings/2fa/setup
POST   /api/admin/settings/2fa/verify
```

#### Watchlists
```typescript
GET    /api/watchlists
POST   /api/watchlists
PUT    /api/watchlists/:id
DELETE /api/watchlists/:id
```

#### Alerts
```typescript
GET    /api/alerts
POST   /api/alerts
PUT    /api/alerts/:id
DELETE /api/alerts/:id
```

### WebSocket Events

#### Client → Server
```typescript
// Subscribe to market data
socket.emit('subscribe', { symbol: 'BTCUSDT' });

// Subscribe to volume spikes
socket.emit('subscribe', { type: 'volume-spikes' });

// Unsubscribe
socket.emit('unsubscribe', { symbol: 'BTCUSDT' });
```

#### Server → Client
```typescript
// Market data update
socket.emit('market-update', {
  symbol: 'BTCUSDT',
  price: 45000,
  volume: 1000000,
  timestamp: '2024-01-01T00:00:00Z'
});

// Volume spike alert
socket.emit('volume-spike', {
  symbol: 'BTCUSDT',
  volumeRatio: 3.2,
  price: 45000,
  timestamp: '2024-01-01T00:00:00Z'
});
```

---

## 🚀 Getting Started

### For Developers

1. **Clone the Repository**
   ```bash
   git clone https://github.com/NikolaySitnikov/VolSpike.git
   cd VolSpike
   ```

2. **Start Development Environment**
   ```bash
   docker-compose up -d
   ```

3. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001 (auth/payments only)
   - Database: localhost:5432

### For Users

1. **Sign Up**: Create an account with email or Web3 wallet
2. **Choose Tier**: Start with Free tier or upgrade to Pro/Elite
3. **Configure Alerts**: Set up volume spike alerts
4. **Monitor Markets**: Track your favorite symbols
5. **Receive Notifications**: Get real-time alerts via your preferred channels

### For AI Models

When working with VolSpike, AI models should understand:

1. **Architecture**: TypeScript-first stack with Next.js frontend, optional Node.js backend (auth/payments), PostgreSQL database, and client-only WebSocket market data
2. **Authentication**: NextAuth.js v5 with email and Web3 wallet support
3. **Real-Time**: Direct Binance WebSocket in the browser (no Socket.io needed)
4. **Payments**: Stripe integration for subscription management
5. **Data Flow**: Binance WebSocket → Browser (client-side processing)
6. **Tier System**: Free (15min), Pro (5min), Elite (real-time)
7. **Key Features**: Volume spike detection, multi-channel alerts, Web3 integration

---

## 📞 Support & Community

### Documentation
- **API Documentation**: Auto-generated from Hono routes
- **Database Schema**: Prisma schema with relationships
- **Deployment Guides**: Step-by-step deployment instructions
- **Troubleshooting**: Common issues and solutions

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time community support
- **Telegram**: Announcements and updates
- **Twitter**: Project updates and news

### Professional Support
- **Elite Tier**: Dedicated support channel
- **Custom Development**: Enterprise features and integrations
- **Training**: Team training and onboarding
- **Consulting**: Architecture and implementation consulting

---

## 🎯 Roadmap & Future Features

### Phase 1: Core Platform (Completed)
- ✅ Next.js frontend with TypeScript
- ✅ Node.js backend with Hono
- ✅ PostgreSQL + TimescaleDB database
- ✅ Client-side WebSocket market data (no Redis)
- ✅ Authentication and payments
- ✅ Admin dashboard with role-based access control
- ✅ User management and subscription oversight
- ✅ Audit logging and security monitoring
- ✅ **Password verification enabled and working**
- ✅ **Error handling implemented for all auth flows**
- ✅ **Web3 wallet integration with RainbowKit**
- ✅ **Production-ready authentication system**
- ✅ **Dynamic routes configured** (dashboard, home, admin marked as force-dynamic)
- ✅ **Backend resilience** - Binance REST failures no longer crash the server
- ✅ **Production deployment** - Vercel frontend + Railway backend working
- ✅ **Production database synced** - Neon schema updated with all required fields
- ✅ **Build errors resolved** - All DYNAMIC_SERVER_USAGE errors fixed

### Phase 2: Advanced Features (In Progress)
- 🔄 Advanced analytics and indicators
- 🔄 Machine learning volume spike detection
- 🔄 Mobile application (React Native)
- 🔄 API rate limiting and usage analytics
- 🔄 Advanced alert conditions

### Phase 3: Enterprise Features (Planned)
- 📋 White-label solutions
- 📋 Custom integrations
- 📋 Advanced reporting and analytics
- 📋 Multi-exchange support
- 📋 Institutional features

### Phase 4: Ecosystem (Future)
- 📋 Third-party integrations
- 📋 Developer marketplace
- 📋 Community indicators
- 📋 Social trading features
- 📋 Advanced portfolio management

---

## 📊 Business Model

### Revenue Streams
1. **Subscription Fees**: Monthly recurring revenue from Pro ($29) and Elite ($99) tiers
2. **API Access**: Usage-based pricing for API access
3. **Enterprise Licenses**: Custom pricing for institutional clients
4. **White-Label Solutions**: Licensing fees for custom implementations

### Market Opportunity
- **Target Market**: 100M+ cryptocurrency traders globally
- **Addressable Market**: $50B+ cryptocurrency trading volume daily
- **Competitive Advantage**: Real-time volume spike detection with sub-second latency
- **Growth Strategy**: Freemium model with viral growth through Web3 integration

---

## 🔧 Technical Specifications

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores, 2.4GHz
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100Mbps connection

#### Recommended Requirements
- **CPU**: 4 cores, 3.0GHz
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: 1Gbps connection

### Browser Support
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Mobile Support
- **iOS**: 14+
- **Android**: 8.0+
- **Progressive Web App**: Full PWA support

---

## 📈 Metrics & KPIs

### Technical Metrics
- **Uptime**: 99.9% target
- **Response Time**: <100ms average
- **Error Rate**: <0.1%
- **Concurrent Users**: 1000+ supported

### Business Metrics
- **User Acquisition**: Monthly active users
- **Retention**: Monthly retention rate
- **Revenue**: Monthly recurring revenue
- **Churn**: Monthly churn rate

### Performance Metrics
- **Database Query Time**: <50ms average
- **Cache Hit Rate**: >90%
- **WebSocket Latency**: <150ms p95
- **API Response Time**: <200ms average

---

## 🏆 Competitive Advantages

### Technical Advantages
1. **Real-Time Performance**: Sub-second latency with WebSocket
2. **TypeScript Stack**: Type safety and better developer experience
3. **Modern Architecture**: Client-only WebSocket + optional auth backend
4. **Scalable Infrastructure**: Simplified infra without Redis/ingestion service

### Feature Advantages
1. **Volume Spike Detection**: Proprietary algorithm for early signal detection
2. **Multi-Channel Alerts**: Email, SMS, Telegram, Discord integration
3. **Web3 Integration**: Native wallet authentication and Web3 features
4. **Tier-Based Access**: Flexible pricing with feature differentiation
5. **Admin Dashboard**: Comprehensive user management and system oversight
6. **Role-Based Security**: Granular access control with audit logging

### Business Advantages
1. **Freemium Model**: Low barrier to entry with upgrade path
2. **Developer-Friendly**: Comprehensive API and documentation
3. **Community-Driven**: Open source components with community support
4. **Institutional Ready**: Enterprise features and compliance considerations

---

## 📝 License & Legal

### Open Source Components
- **Frontend**: MIT License
- **Backend**: MIT License
- **Documentation**: Creative Commons
- **Examples**: MIT License

### Proprietary Components
- **Volume Spike Algorithm**: Proprietary
- **Advanced Analytics**: Proprietary
- **Enterprise Features**: Proprietary
- **White-Label Solutions**: Proprietary

### Legal Considerations
- **Terms of Service**: Standard SaaS terms
- **Privacy Policy**: GDPR and CCPA compliant
- **Data Processing**: Secure data handling
- **Intellectual Property**: Protected algorithms and methods

---

## 🎉 Conclusion

VolSpike represents a modern, scalable solution for cryptocurrency trading analytics and market monitoring. Built with **client-side WebSocket architecture**, it provides:

- **Real-time market data** with sub-second latency via direct Binance WebSocket
- **Advanced volume spike detection** for early signal identification
- **Multi-channel alert system** for comprehensive notification coverage
- **Web3 integration** for modern cryptocurrency users
- **Unlimited scalability** with client-side data processing
- **Zero Redis dependency** eliminating costs and rate limits
- **Professional-grade security** and compliance features
- **✅ Production-ready authentication** with proper password verification and error handling
- **✅ Complete Web3 wallet integration** with RainbowKit and Wagmi
- **✅ Admin dashboard** with role-based access control and audit logging

The platform is designed to grow with its users, from individual traders to institutional clients, providing the tools and insights needed to succeed in the fast-paced world of cryptocurrency trading.

**Key Architecture Benefits:**
- ✅ **80% cost reduction** vs Redis-based stack
- ✅ **No IP blocking issues** (uses user's residential IP)
- ✅ **Simplified infrastructure** (frontend + optional auth backend)
- ✅ **Real-time data** for all tiers with client-side throttling
- ✅ **Unlimited concurrent users** (client-side processing)

For more information, visit the [GitHub repository](https://github.com/NikolaySitnikov/VolSpike) or contact the development team.

---

*Last Updated: November 2025*
*Version: 4.0.0 (Client-Only Architecture + Volume Alerts)*
*Status: Production Ready - Volume Alerts Live, Professional UI/UX, Testing Infrastructure Complete*

### Recent Production Updates (November 2025)

#### Volume Alerts System - COMPLETED ✅
- ✅ **Digital Ocean Integration** - Script running on DO server posting alerts to VolSpike backend
- ✅ **Backend API Endpoints** - `/api/volume-alerts/ingest` (authenticated) and `/api/volume-alerts` (tier-based)
- ✅ **WebSocket Broadcasting** - Real-time Socket.IO delivery with tier-based rooms
- ✅ **Wall-Clock Synchronization** - Free (15min at :00, :15, :30, :45), Pro (5min at :00, :05, :10, etc.), Elite (instant)
- ✅ **Database Schema** - `VolumeAlert` and `AlertSubscription` models with Prisma
- ✅ **UI Components** - Volume Alerts panel with countdown timers, color-coded alerts (green/red by candle direction)
- ✅ **Initial Alert Loading** - New users see last 10 alerts immediately upon login
- ✅ **Alert Display** - "Exact Time (Relative Time ago)" format, two-line volume display, directional arrows

#### UI/UX Improvements - COMPLETED ✅
- ✅ **Pricing Page** - Beautiful tier comparison with feature breakdown, mobile-responsive
- ✅ **Terms of Service** - Comprehensive legal page with 18 sections
- ✅ **Privacy Policy** - Updated contact to support@volspike.com
- ✅ **Mobile Navigation** - Hamburger menu with active state indicators
- ✅ **Market Data Table** - Tier-based symbol limits (50 Free, 100 Pro, all Elite), removed >$100M filter
- ✅ **"Unlock Pro Features" Banner** - Enhanced with 6 detailed feature highlights
- ✅ **Gradient Text Fix** - Resolved "g" clipping with padding-bottom
- ✅ **Footer Consolidation** - Removed duplicate footers across all pages
- ✅ **Active Navigation** - Green highlighting for current page in desktop/mobile menus
- ✅ **Smooth Transitions** - Removed flickering animations, unified fade-in effects

#### Testing Infrastructure - COMPLETED ✅
- ✅ **Test Accounts** - `free-test@volspike.com` and `pro-test@volspike.com` (password: Test123456!) in dev and prod
- ✅ **PRO_TIER_TEST_PLAN.md** - Comprehensive 100+ check test plan for Free vs Pro functionality
- ✅ **TESTING_STRATEGY.md** - Feature branch workflow with Vercel preview deployments
- ✅ **Debug Mode** - `?debug=true` query param for test buttons and diagnostic features
- ✅ **Elite Tier Marked "Coming Soon"** - All UI references updated, purchase disabled

#### Authentication Improvements - COMPLETED ✅
- ✅ **Case-Insensitive Login** - Email lookup uses `mode: 'insensitive'` for better UX
- ✅ **Email Normalization** - All signups normalized to lowercase for consistency
- ✅ **Tier Defaults** - Users default to `free` tier with fallbacks in all auth callbacks
- ✅ **Production Auth** - `NEXTAUTH_URL` fallback ensures production backend connectivity
- ✅ **Phantom Wallet Fix** - Removed "Not Found" error for undetected wallets

#### Alert Sounds & Animations - IN PROGRESS 🚧
- ✅ **useAlertSounds Hook** - Web Audio API implementation (placeholder for MP3s)
- ✅ **SOUND_DESIGN_BRIEF.md** - Detailed expert brief for professional sound design
- ✅ **Animation Classes** - Tailwind animations for slide-in, scale, fade effects
- ✅ **Test Buttons** - Debug mode buttons for testing sounds and animations
- 🚧 **Awaiting Expert** - Professional MP3 files for spike, 30m update, and hourly update sounds

### Previous Updates (October 2025)
- ✅ **Dynamic route fixes** - Dashboard, home, and admin routes marked as force-dynamic
- ✅ **Backend resilience** - Binance REST failures gracefully handled
- ✅ **Production database synced** - Neon schema updated with all required fields
- ✅ **Build stability** - All Vercel build errors resolved
- ✅ **Email Verification UX** - Gmail-safe preheader, bulletproof CTA, site-hosted logo
