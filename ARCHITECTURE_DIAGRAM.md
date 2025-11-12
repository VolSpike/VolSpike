# VolSpike Architecture Diagram

This document contains Mermaid diagrams visualizing the VolSpike system architecture.

## System Overview

```mermaid
graph TB
    subgraph "User Browser"
        FE[Next.js Frontend<br/>Vercel]
        WS_CLIENT[Binance WebSocket Client]
        SOCKET_CLIENT[Socket.IO Client]
    end
    
    subgraph "Backend Services"
        API[Node.js + Hono API<br/>Railway]
        SOCKET_SERVER[Socket.IO Server]
        DB[(PostgreSQL + TimescaleDB<br/>Neon)]
    end
    
    subgraph "Monitoring & Ingestion"
        DO_SCRIPT[Python Scripts<br/>Digital Ocean<br/>systemd service]
    end
    
    subgraph "External Services"
        BINANCE[Binance Futures API<br/>fapi.binance.com]
        STRIPE[Stripe<br/>Payments]
        SENDGRID[SendGrid<br/>Email]
        TWILIO[Twilio<br/>SMS]
        TELEGRAM[Telegram<br/>Alerts]
    end
    
    FE -->|HTTPS| API
    FE -->|WebSocket| WS_CLIENT
    FE -->|WebSocket| SOCKET_CLIENT
    WS_CLIENT -->|wss://fstream.binance.com| BINANCE
    SOCKET_CLIENT -->|Socket.IO| SOCKET_SERVER
    API -->|Query| DB
    SOCKET_SERVER -->|Broadcast| SOCKET_CLIENT
    DO_SCRIPT -->|POST /api/volume-alerts/ingest<br/>X-API-Key| API
    DO_SCRIPT -->|POST /api/market/open-interest<br/>X-API-Key| API
    DO_SCRIPT -->|REST API| BINANCE
    DO_SCRIPT -->|Send Alerts| TELEGRAM
    API -->|Webhooks| STRIPE
    API -->|Send Emails| SENDGRID
    API -->|Send SMS| TWILIO
    
    style FE fill:#4f46e5,color:#fff
    style API fill:#059669,color:#fff
    style DB fill:#dc2626,color:#fff
    style DO_SCRIPT fill:#ea580c,color:#fff
    style BINANCE fill:#f59e0b,color:#fff
```

## Market Data Flow

```mermaid
sequenceDiagram
    participant Browser
    participant BinanceWS as Binance WebSocket
    participant FrontendHook as useClientOnlyMarketData Hook
    participant BackendAPI as Backend API
    participant DO as Digital Ocean Script
    participant BinanceAPI as Binance REST API
    
    Browser->>BinanceWS: Connect (wss://fstream.binance.com)
    BinanceWS-->>Browser: Stream: !ticker@arr, !markPrice@arr
    
    Browser->>FrontendHook: Initialize hook
    FrontendHook->>BinanceWS: Subscribe to streams
    BinanceWS-->>FrontendHook: Real-time ticker & funding data
    
    FrontendHook->>FrontendHook: Parse & merge data
    FrontendHook->>FrontendHook: Apply tier filters
    FrontendHook->>Browser: Update UI (debounced)
    
    Note over DO,BinanceAPI: Every 5 minutes
    DO->>BinanceAPI: Fetch Open Interest
    BinanceAPI-->>DO: OI data (contracts)
    DO->>BinanceAPI: Fetch Mark Prices
    BinanceAPI-->>DO: Mark prices
    DO->>DO: Calculate USD notional
    DO->>BackendAPI: POST /api/market/open-interest/ingest
    BackendAPI->>BackendAPI: Cache in memory (5min TTL)
    
    Note over FrontendHook,BackendAPI: Every 5 minutes (aligned)
    FrontendHook->>BackendAPI: GET /api/market/open-interest
    BackendAPI-->>FrontendHook: Cached OI data
    FrontendHook->>FrontendHook: Merge OI with market data
    FrontendHook->>Browser: Update table (Pro/Elite only)
```

## Volume Alerts Flow

```mermaid
sequenceDiagram
    participant DO as Digital Ocean Script
    participant BackendAPI as Backend API
    participant DB as PostgreSQL
    participant SocketIO as Socket.IO Server
    participant Frontend as Frontend Client
    
    Note over DO: Every 5 minutes (:00, :05, :10, etc.)
    DO->>DO: Scan all USDT perpetuals
    DO->>DO: Detect volume spikes (≥3x, ≥$3M)
    DO->>DO: Determine candle direction (bullish/bearish)
    
    alt Volume Spike Detected
        DO->>BackendAPI: POST /api/volume-alerts/ingest<br/>(X-API-Key header)
        BackendAPI->>BackendAPI: Validate API key
        BackendAPI->>DB: Store VolumeAlert
        DB-->>BackendAPI: Alert saved
        
        BackendAPI->>SocketIO: broadcastVolumeAlert(alert)
        
        alt Elite Tier
            SocketIO->>Frontend: Emit 'volume-alert'<br/>(tier-elite room)
            Note over Frontend: Instant delivery
        else Pro Tier
            SocketIO->>SocketIO: Queue for batch (:00, :05, :10, etc.)
            Note over SocketIO: Wall-clock synchronized
            SocketIO->>Frontend: Emit 'volume-alert'<br/>(tier-pro room)
        else Free Tier
            SocketIO->>SocketIO: Queue for batch (:00, :15, :30, :45)
            Note over SocketIO: Wall-clock synchronized
            SocketIO->>Frontend: Emit 'volume-alert'<br/>(tier-free room)
        end
        
        Frontend->>Frontend: Update alerts panel
        Frontend->>Frontend: Play sound & animation
    end
    
    alt Update Alert (XX:30 or XX:00)
        DO->>DO: Check if alert already sent this hour
        DO->>BackendAPI: POST /api/volume-alerts/ingest<br/>(alertType: HALF_UPDATE/FULL_UPDATE)
        BackendAPI->>DB: Store update alert
        BackendAPI->>SocketIO: Broadcast update
        SocketIO->>Frontend: Emit update alert
    end
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js Frontend
    participant NextAuth as NextAuth.js
    participant BackendAPI as Backend API
    participant DB as PostgreSQL
    participant Stripe as Stripe
    participant SendGrid as SendGrid
    
    alt Email/Password Signup
        User->>Frontend: Enter email & password
        Frontend->>BackendAPI: POST /api/auth/signup
        BackendAPI->>DB: Create user (hash password)
        BackendAPI->>SendGrid: Send verification email
        SendGrid->>User: Email with verification link
        BackendAPI-->>Frontend: User created (unverified)
        
        User->>Frontend: Click verification link
        Frontend->>BackendAPI: POST /api/auth/verify-email
        BackendAPI->>DB: Mark email as verified
        BackendAPI-->>Frontend: Email verified
        
        User->>Frontend: Login
        Frontend->>BackendAPI: POST /api/auth/signin
        BackendAPI->>DB: Verify credentials
        BackendAPI->>BackendAPI: Generate JWT token
        BackendAPI-->>Frontend: User + JWT token
        
        Frontend->>NextAuth: Create session
        NextAuth->>Frontend: Session cookie set
    end
    
    alt OAuth (Google)
        User->>Frontend: Click "Sign in with Google"
        Frontend->>NextAuth: Initiate OAuth flow
        NextAuth->>Google: OAuth redirect
        Google->>User: Login prompt
        User->>Google: Authorize
        Google->>NextAuth: OAuth callback
        NextAuth->>BackendAPI: POST /api/auth/oauth-link
        BackendAPI->>DB: Create/update user
        BackendAPI-->>NextAuth: User data
        NextAuth->>Frontend: Session created
    end
    
    alt Web3 Wallet (EVM)
        User->>Frontend: Connect wallet (MetaMask)
        Frontend->>BackendAPI: POST /api/auth/siwe/nonce
        BackendAPI-->>Frontend: Nonce
        Frontend->>User: Sign message (SIWE)
        User->>Frontend: Signed message
        Frontend->>BackendAPI: POST /api/auth/siwe/verify
        BackendAPI->>BackendAPI: Verify signature
        BackendAPI->>DB: Create/update user
        BackendAPI-->>Frontend: User + JWT token
        Frontend->>NextAuth: Create session
    end
    
    alt Web3 Wallet (Solana)
        User->>Frontend: Connect Phantom wallet
        Frontend->>BackendAPI: POST /api/auth/solana/nonce
        BackendAPI-->>Frontend: Nonce
        Frontend->>User: Sign message (Phantom)
        User->>Frontend: Signed message
        Frontend->>BackendAPI: POST /api/auth/solana/verify
        BackendAPI->>BackendAPI: Verify Ed25519 signature
        BackendAPI->>DB: Create/update user
        BackendAPI-->>Frontend: User + JWT token
        Frontend->>NextAuth: Create session
    end
```

## Payment & Subscription Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as Next.js Frontend
    participant BackendAPI as Backend API
    participant Stripe as Stripe
    participant DB as PostgreSQL
    
    User->>Frontend: Select tier on /pricing
    Frontend->>BackendAPI: POST /api/payments/checkout<br/>(priceId, successUrl, cancelUrl)
    BackendAPI->>DB: Get user (check Stripe customer)
    
    alt New Stripe Customer
        BackendAPI->>Stripe: Create customer
        Stripe-->>BackendAPI: Customer ID
        BackendAPI->>DB: Update user.stripeCustomerId
    end
    
    BackendAPI->>Stripe: Create checkout session
    Stripe-->>BackendAPI: Checkout session URL
    BackendAPI-->>Frontend: Checkout URL
    
    Frontend->>Stripe: Redirect to Stripe Checkout
    User->>Stripe: Enter payment details
    User->>Stripe: Complete payment
    Stripe->>BackendAPI: Webhook: checkout.session.completed
    BackendAPI->>DB: Update user.tier (pro/elite)
    BackendAPI->>DB: Create/update subscription record
    
    Stripe->>Frontend: Redirect to /checkout/success
    Frontend->>Frontend: Show success message
    Frontend->>BackendAPI: GET /api/auth/session (refresh)
    BackendAPI->>DB: Get updated user
    BackendAPI-->>Frontend: User with new tier
    
    Note over Stripe,BackendAPI: Ongoing subscription events
    Stripe->>BackendAPI: Webhook: customer.subscription.updated
    BackendAPI->>DB: Update subscription status
    
    Stripe->>BackendAPI: Webhook: customer.subscription.deleted
    BackendAPI->>DB: Downgrade user.tier to 'free'
    
    Stripe->>BackendAPI: Webhook: invoice.payment_failed
    BackendAPI->>DB: Mark subscription as past_due
```

## Tier-Based Features

```mermaid
graph LR
    subgraph "Free Tier"
        F1[50 Symbols]
        F2[15-min Refresh]
        F3[10 Alerts]
        F4[Basic Features]
    end
    
    subgraph "Pro Tier"
        P1[100 Symbols]
        P2[5-min Refresh]
        P3[50 Alerts]
        P4[Email Alerts]
        P5[Open Interest]
        P6[Alert Subscriptions]
    end
    
    subgraph "Elite Tier"
        E1[Unlimited Symbols]
        E2[Real-time Updates]
        E3[100 Alerts]
        E4[Email + SMS Alerts]
        E5[Open Interest]
        E6[Alert Subscriptions]
        E7[Instant Alert Delivery]
    end
    
    F1 --> P1
    F2 --> P2
    F3 --> P3
    F4 --> P4
    P1 --> E1
    P2 --> E2
    P3 --> E3
    P4 --> E4
    P5 --> E5
    P6 --> E6
    
    style F1 fill:#94a3b8
    style F2 fill:#94a3b8
    style F3 fill:#94a3b8
    style F4 fill:#94a3b8
    style P1 fill:#3b82f6
    style P2 fill:#3b82f6
    style P3 fill:#3b82f6
    style P4 fill:#3b82f6
    style P5 fill:#3b82f6
    style P6 fill:#3b82f6
    style E1 fill:#f59e0b
    style E2 fill:#f59e0b
    style E3 fill:#f59e0b
    style E4 fill:#f59e0b
    style E5 fill:#f59e0b
    style E6 fill:#f59e0b
    style E7 fill:#f59e0b
```

## Database Schema Relationships

```mermaid
erDiagram
    User ||--o{ Watchlist : has
    User ||--o{ Alert : creates
    User ||--o{ VolumeAlert : receives
    User ||--o{ AlertSubscription : subscribes
    User ||--|| Preference : has
    User ||--o{ Session : has
    User ||--o{ Account : links
    User ||--o{ AuditLog : "performs (admin)"
    User ||--o{ AdminSession : "has (admin)"
    User ||--o{ WalletAccount : owns
    
    Watchlist ||--o{ WatchlistItem : contains
    WatchlistItem }o--|| Contract : references
    
    Contract ||--o{ MarketSnapshot : "has snapshots"
    Contract ||--o{ Alert : triggers
    
    VolumeAlert }o--o| AlertSubscription : "matches subscription"
    
    User {
        string id PK
        string email UK
        string passwordHash
        string walletAddress UK
        string tier
        string role
        string status
        string stripeCustomerId UK
        datetime emailVerified
    }
    
    VolumeAlert {
        string id PK
        string symbol
        string asset
        float currentVolume
        float previousVolume
        float volumeRatio
        float price
        float fundingRate
        string candleDirection
        string alertType
        string message
        datetime timestamp
        datetime hourTimestamp
    }
    
    AlertSubscription {
        string id PK
        string userId FK
        string symbol
    }
    
    MarketSnapshot {
        string id PK
        string contractId FK
        float price
        float volume24h
        float fundingRate
        float openInterest
        datetime timestamp
    }
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Frontend Deployment"
        VERCEL[Vercel<br/>Next.js 15+<br/>Edge Runtime]
        VERCEL_GIT[GitHub Integration<br/>Auto-deploy on push]
    end
    
    subgraph "Backend Deployment"
        RAILWAY[Railway<br/>Node.js + Hono<br/>Docker]
        RAILWAY_DB[Neon PostgreSQL<br/>TimescaleDB Extension]
    end
    
    subgraph "Monitoring Deployment"
        DO_SERVER[Digital Ocean Droplet<br/>Ubuntu Server]
        DO_SCRIPT[Python Scripts<br/>systemd service]
    end
    
    subgraph "External Services"
        BINANCE_API[Binance API]
        STRIPE_API[Stripe API]
        SENDGRID_API[SendGrid API]
        TWILIO_API[Twilio API]
    end
    
    VERCEL_GIT -->|Deploy| VERCEL
    VERCEL -->|HTTPS| RAILWAY
    VERCEL -->|WebSocket| RAILWAY
    RAILWAY -->|Query| RAILWAY_DB
    DO_SCRIPT -->|POST| RAILWAY
    DO_SCRIPT -->|REST| BINANCE_API
    RAILWAY -->|Webhooks| STRIPE_API
    RAILWAY -->|Send| SENDGRID_API
    RAILWAY -->|Send| TWILIO_API
    
    style VERCEL fill:#000,color:#fff
    style RAILWAY fill:#0dbd8b,color:#fff
    style RAILWAY_DB fill:#dc2626,color:#fff
    style DO_SERVER fill:#0080ff,color:#fff
```

## Socket.IO Room Architecture

```mermaid
graph TB
    subgraph "Socket.IO Server"
        SERVER[Socket.IO Server<br/>In-Memory Adapter]
        
        subgraph "Tier-Based Rooms"
            ROOM_FREE[tier-free<br/>15-min batches]
            ROOM_PRO[tier-pro<br/>5-min batches]
            ROOM_ELITE[tier-elite<br/>Real-time]
        end
        
        subgraph "User Rooms"
            USER_ROOMS[user-{userId}<br/>Individual delivery]
        end
        
        subgraph "Symbol Rooms"
            SYMBOL_ROOMS[symbol-{symbol}<br/>Symbol subscriptions]
        end
    end
    
    subgraph "Alert Broadcasting"
        BROADCASTER[Alert Broadcaster Service]
        QUEUE_FREE[Free Queue<br/>:00, :15, :30, :45]
        QUEUE_PRO[Pro Queue<br/>:00, :05, :10, etc.]
    end
    
    subgraph "Clients"
        CLIENT_FREE[Free Tier Client]
        CLIENT_PRO[Pro Tier Client]
        CLIENT_ELITE[Elite Tier Client]
    end
    
    BROADCASTER -->|Instant| ROOM_ELITE
    BROADCASTER -->|Queue| QUEUE_PRO
    BROADCASTER -->|Queue| QUEUE_FREE
    
    QUEUE_PRO -->|Wall-clock sync| ROOM_PRO
    QUEUE_FREE -->|Wall-clock sync| ROOM_FREE
    
    ROOM_ELITE -->|Real-time| CLIENT_ELITE
    ROOM_PRO -->|Batched| CLIENT_PRO
    ROOM_FREE -->|Batched| CLIENT_FREE
    
    SERVER --> ROOM_FREE
    SERVER --> ROOM_PRO
    SERVER --> ROOM_ELITE
    SERVER --> USER_ROOMS
    SERVER --> SYMBOL_ROOMS
    
    style ROOM_ELITE fill:#f59e0b,color:#fff
    style ROOM_PRO fill:#3b82f6,color:#fff
    style ROOM_FREE fill:#94a3b8,color:#fff
```

## Complete System Data Flow

```mermaid
flowchart TD
    START([User Opens Dashboard])
    
    subgraph "Frontend Initialization"
        INIT[Initialize NextAuth Session]
        WS_CONNECT[Connect Binance WebSocket]
        SOCKET_CONNECT[Connect Socket.IO]
        FETCH_OI[Fetch Open Interest]
    end
    
    subgraph "Real-Time Market Data"
        WS_RECEIVE[Receive WebSocket Messages]
        PARSE[Parse ticker & funding data]
        FILTER[Apply tier filters]
        MERGE[Merge with Open Interest]
        RENDER[Render Market Table]
    end
    
    subgraph "Volume Alerts"
        ALERT_RECEIVE[Receive Socket.IO Alert]
        CHECK_TIER{User Tier?}
        ELITE[Elite: Instant Display]
        PRO[Pro: Queue for :00, :05, etc.]
        FREE[Free: Queue for :00, :15, :30, :45]
        DISPLAY[Display Alert + Sound]
    end
    
    subgraph "Background Processing"
        DO_SCAN[Digital Ocean: Scan Volume]
        DETECT[Detect Spike ≥3x, ≥$3M]
        POST_ALERT[POST to Backend]
        STORE[Store in Database]
        BROADCAST[Broadcast via Socket.IO]
    end
    
    START --> INIT
    INIT --> WS_CONNECT
    INIT --> SOCKET_CONNECT
    INIT --> FETCH_OI
    
    WS_CONNECT --> WS_RECEIVE
    WS_RECEIVE --> PARSE
    PARSE --> FILTER
    FETCH_OI --> MERGE
    FILTER --> MERGE
    MERGE --> RENDER
    
    SOCKET_CONNECT --> ALERT_RECEIVE
    ALERT_RECEIVE --> CHECK_TIER
    CHECK_TIER -->|Elite| ELITE
    CHECK_TIER -->|Pro| PRO
    CHECK_TIER -->|Free| FREE
    ELITE --> DISPLAY
    PRO --> DISPLAY
    FREE --> DISPLAY
    
    DO_SCAN --> DETECT
    DETECT --> POST_ALERT
    POST_ALERT --> STORE
    STORE --> BROADCAST
    BROADCAST --> ALERT_RECEIVE
    
    style START fill:#4f46e5,color:#fff
    style DISPLAY fill:#059669,color:#fff
    style BROADCAST fill:#ea580c,color:#fff
```

---

**Note:** These diagrams are best viewed in a Markdown viewer that supports Mermaid rendering (GitHub, GitLab, VS Code with Mermaid extension, etc.).

