# Database Schema

## Overview

VolSpike uses PostgreSQL with TimescaleDB extension, managed through Prisma ORM.

- **Development**: Docker container
- **Production**: Neon (managed PostgreSQL)

---

## Schema Location

`volspike-nodejs-backend/prisma/schema.prisma`

---

## Core Models

### User

The central user model for authentication and account data.

```prisma
model User {
  id                   String         @id @default(cuid())
  email                String         @unique
  walletAddress        String?        @unique
  passwordHash         String?
  tier                 String         @default("free")
  role                 Role           @default(USER)
  status               UserStatus     @default(ACTIVE)
  emailVerified        DateTime?
  twoFactorEnabled     Boolean        @default(false)
  twoFactorSecret      String?
  stripeCustomerId     String?        @unique
  passwordChangedAt    DateTime?
  lastLoginAt          DateTime?
  refreshInterval      Int?           @default(15000)
  theme                String?        @default("dark")
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  // Relations
  accounts             Account[]
  walletAccounts       WalletAccount[]
  sessions             Session[]
  watchlists           Watchlist[]
  cryptoPayments       CryptoPayment[]
  userCrossAlerts      UserCrossAlert[]
  promoCodeUsages      PromoCodeUsage[]
  createdPromoCodes    PromoCode[]
  auditLogs            AuditLog[]     @relation("ActorLogs")
  targetedAuditLogs    AuditLog[]     @relation("TargetLogs")
}

enum Role {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
}
```

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier (cuid) |
| `email` | String | Unique email address |
| `walletAddress` | String? | Primary linked wallet |
| `passwordHash` | String? | bcrypt hash (null for OAuth-only) |
| `tier` | String | 'free', 'pro', 'elite' |
| `role` | Role | USER or ADMIN |
| `status` | UserStatus | ACTIVE, SUSPENDED, BANNED |
| `stripeCustomerId` | String? | Stripe customer ID |
| `emailVerified` | DateTime? | When email was verified |

---

### Account (OAuth)

OAuth provider accounts linked to users.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

---

### WalletAccount

Web3 wallet connections.

```prisma
model WalletAccount {
  id          String   @id @default(cuid())
  userId      String
  provider    String   // 'evm' or 'solana'
  caip10      String   // Chain-agnostic identifier
  address     String
  chainId     String?
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, caip10])
  @@index([address])
}
```

---

### Session

User session tracking.

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  deviceId     String?
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Payment Models

### CryptoPayment

Cryptocurrency payments via NowPayments.

```prisma
model CryptoPayment {
  id                   String    @id @default(cuid())
  userId               String
  paymentId            String?   @unique
  paymentStatus        String?
  payAmount            Float?
  payCurrency          String?
  actuallyPaid         Float?
  actuallyPaidCurrency String?
  tier                 String
  invoiceId            String    @unique
  orderId              String
  paymentUrl           String
  payAddress           String?
  promoCodeId          String?
  paidAt               DateTime?
  expiresAt            DateTime?
  renewalReminderSent  Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user      User       @relation(fields: [userId], references: [id])
  promoCode PromoCode? @relation(fields: [promoCodeId], references: [id])

  @@index([userId])
  @@index([paymentStatus])
  @@index([invoiceId])
}
```

**Payment Status Values:**
- `waiting` - Awaiting payment
- `confirming` - Transaction detected, awaiting confirmations
- `confirmed` - Sufficient confirmations
- `sending` - Sending to merchant
- `partially_paid` - Partial payment received
- `finished` - Payment complete
- `failed` - Payment failed
- `refunded` - Payment refunded
- `expired` - Invoice expired

---

### PromoCode

Promotional discount codes.

```prisma
model PromoCode {
  id              String             @id @default(cuid())
  code            String             @unique
  discountPercent Int
  maxUses         Int
  currentUses     Int                @default(0)
  validUntil      DateTime
  active          Boolean            @default(true)
  paymentMethod   PromoPaymentMethod @default(CRYPTO)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  createdById     String

  createdBy      User               @relation(fields: [createdById], references: [id])
  usages         PromoCodeUsage[]
  cryptoPayments CryptoPayment[]
}

enum PromoPaymentMethod {
  STRIPE
  CRYPTO
  ALL
}
```

---

### PromoCodeUsage

Tracks promo code redemptions.

```prisma
model PromoCodeUsage {
  id             String    @id @default(cuid())
  promoCodeId    String
  userId         String
  paymentId      String
  discountAmount Float
  originalAmount Float
  finalAmount    Float
  createdAt      DateTime  @default(now())

  promoCode PromoCode @relation(fields: [promoCodeId], references: [id])
  user      User      @relation(fields: [userId], references: [id])
}
```

---

## Alert Models

### VolumeAlert

Volume spike alerts detected by Digital Ocean scripts.

```prisma
model VolumeAlert {
  id              String    @id @default(cuid())
  symbol          String
  asset           String
  currentVolume   Float
  previousVolume  Float
  volumeRatio     Float
  price           Float?
  fundingRate     Float?
  alertType       AlertType @default(SPIKE)
  message         String
  timestamp       DateTime  @default(now())
  hourTimestamp   DateTime
  isUpdate        Boolean   @default(false)
  candleDirection String?
  detectionTime   DateTime?
  oiChange        Float?
  priceChange     Float?

  @@index([symbol, timestamp])
  @@index([timestamp])
}

enum AlertType {
  SPIKE
  HALF_UPDATE
  FULL_UPDATE
}
```

---

### OpenInterestAlert

OI change alerts.

```prisma
model OpenInterestAlert {
  id          String   @id @default(cuid())
  symbol      String
  direction   String
  baseline    Decimal  @db.Decimal(30, 8)
  current     Decimal  @db.Decimal(30, 8)
  pctChange   Decimal  @db.Decimal(10, 6)
  absChange   Decimal  @db.Decimal(30, 8)
  priceChange Decimal? @db.Decimal(10, 6)
  fundingRate Decimal? @db.Decimal(10, 6)
  timeframe   String   @default("5 min")
  source      String
  ts          DateTime
  createdAt   DateTime @default(now())

  @@index([symbol, ts])
  @@index([direction, ts])
}
```

---

### UserCrossAlert

User-defined custom alerts.

```prisma
model UserCrossAlert {
  id               String              @id @default(cuid())
  userId           String
  symbol           String
  alertType        CrossAlertType
  threshold        Float
  lastCheckedValue Float?
  lastCheckedAt    DateTime?
  deliveryMethod   AlertDeliveryMethod @default(DASHBOARD)
  isActive         Boolean             @default(true)
  triggeredCount   Int                 @default(0)
  triggeredAt      DateTime?
  triggeredValue   Float?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isActive])
  @@index([symbol])
}

enum CrossAlertType {
  PRICE_CROSS
  FUNDING_CROSS
  OI_CROSS
}

enum AlertDeliveryMethod {
  DASHBOARD
  EMAIL
  BOTH
}
```

---

## Watchlist Models

### Watchlist

User-created watchlists.

```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  name      String
  symbols   String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Note:** Watchlists store **symbols only**, not market data.

---

## Asset Models

### Asset

Cryptocurrency asset metadata.

```prisma
model Asset {
  id              String       @id @default(cuid())
  symbol          String       @unique
  name            String?
  coingeckoId     String?
  logoUrl         String?
  description     String?      @db.Text
  website         String?
  whitepaper      String?
  twitter         String?
  discord         String?
  github          String?
  reddit          String?
  telegram        String?
  categories      String[]
  marketCapRank   Int?
  status          AssetStatus  @default(ACTIVE)
  isComplete      Boolean      @default(false)
  lastEnrichError String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([coingeckoId])
  @@index([status])
}

enum AssetStatus {
  ACTIVE
  HIDDEN
  DELISTED
}
```

---

## Open Interest Models

### OpenInterestCache

Cached OI data from Digital Ocean poller.

```prisma
model OpenInterestCache {
  id          String   @id @default(cuid())
  symbol      String   @unique
  oiUsd       Decimal  @db.Decimal(30, 8)
  asOf        DateTime
  isLiquid    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([symbol])
  @@index([isLiquid])
}
```

---

### LiquidSymbol

Liquid symbol classification.

```prisma
model LiquidSymbol {
  id        String   @id @default(cuid())
  symbol    String   @unique
  asOf      DateTime
  updatedAt DateTime @updatedAt

  @@index([symbol])
}
```

---

## News Models

### NewsSource

RSS feed sources.

```prisma
model NewsSource {
  id        String       @id @default(cuid())
  name      String
  url       String       @unique
  category  NewsCategory @default(NEWS)
  enabled   Boolean      @default(true)
  lastFetch DateTime?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  articles NewsArticle[]
}

enum NewsCategory {
  NEWS
  ANALYSIS
  ANNOUNCEMENT
}
```

---

### NewsArticle

Fetched news articles.

```prisma
model NewsArticle {
  id          String     @id @default(cuid())
  sourceId    String
  title       String
  url         String     @unique
  description String?    @db.Text
  content     String?    @db.Text
  author      String?
  imageUrl    String?
  publishedAt DateTime
  isRead      Boolean    @default(false)
  isFlagged   Boolean    @default(false)
  createdAt   DateTime   @default(now())

  source NewsSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([publishedAt(sort: Desc)])
  @@index([sourceId])
}
```

---

## Telegram Models

### TelegramMessage

Telegram channel messages.

```prisma
model TelegramMessage {
  id         String   @id @default(cuid())
  messageId  Int
  channelId  String
  text       String   @db.Text
  mediaType  String?
  mediaUrl   String?
  date       DateTime
  views      Int?
  isRelevant Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@unique([channelId, messageId])
  @@index([channelId, date])
  @@index([isRelevant])
}
```

---

## Admin Models

### AuditLog

Admin action audit trail.

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  action       String
  actorId      String?
  actorEmail   String?
  targetId     String?
  targetType   String?
  targetEmail  String?
  details      Json?
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())

  actor  User? @relation("ActorLogs", fields: [actorId], references: [id])
  target User? @relation("TargetLogs", fields: [targetId], references: [id])

  @@index([actorId])
  @@index([targetId])
  @@index([action])
  @@index([createdAt(sort: Desc)])
}
```

---

### AdminSetting

Platform settings.

```prisma
model AdminSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?
}
```

---

### AdminNotification

Admin panel notifications.

```prisma
model AdminNotification {
  id        String   @id @default(cuid())
  type      String
  title     String
  message   String
  severity  String   @default("info")
  isRead    Boolean  @default(false)
  data      Json?
  createdAt DateTime @default(now())

  @@index([isRead])
  @@index([createdAt(sort: Desc)])
}
```

---

## Verification Tokens

### VerificationToken

Email verification and password reset tokens.

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

---

## Database Commands

### Push Schema

Apply schema changes directly (development):

```bash
npx prisma db push
```

### Run Migrations

Create and apply migrations (production):

```bash
npx prisma migrate dev --name migration_name
npx prisma migrate deploy
```

### Generate Client

Regenerate Prisma client:

```bash
npx prisma generate
```

### Open Studio

Browse database with GUI:

```bash
npx prisma studio
```

---

## Indexes

Key indexes for performance:

| Table | Index | Purpose |
|-------|-------|---------|
| User | email | Fast lookup by email |
| User | stripeCustomerId | Payment lookups |
| VolumeAlert | symbol, timestamp | Alert queries |
| VolumeAlert | timestamp | Recent alerts |
| CryptoPayment | paymentStatus | Sync pending |
| AuditLog | createdAt | Recent logs |
| OpenInterestCache | symbol | Fast OI lookup |

---

## Next: [Admin Panel](16-ADMIN-OVERVIEW.md)
