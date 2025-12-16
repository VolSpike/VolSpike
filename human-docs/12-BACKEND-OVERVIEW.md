# Backend Overview

## Technology Stack

The backend is a Node.js application using the Hono framework.

| Technology | Version | Purpose |
|------------|---------|---------|
| Hono | 4.10.3 | Web framework |
| Node.js | 18+ | Runtime |
| TypeScript | 5.3.2 | Type safety |
| Prisma | 6.18.0 | ORM |
| Socket.IO | 4.7.4 | Real-time |
| Stripe | 14.0.0 | Payments |
| SendGrid | 8.1.6 | Email |
| Pino | 8.16.0 | Logging |

---

## Project Structure

```
volspike-nodejs-backend/
├── src/
│   ├── index.ts              # Application entry point
│   ├── config/
│   │   └── chains.ts         # Blockchain configuration
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── admin-auth.ts     # Admin authorization
│   │   ├── rate-limit.ts     # Rate limiting
│   │   └── audit-logger.ts   # Audit logging
│   ├── routes/
│   │   ├── auth.ts           # Authentication endpoints
│   │   ├── payments.ts       # Stripe/NowPayments
│   │   ├── volume-alerts.ts  # Alert endpoints
│   │   ├── watchlist.ts      # Watchlist CRUD
│   │   ├── market.ts         # Market data endpoints
│   │   ├── assets.ts         # Asset metadata
│   │   ├── open-interest.ts  # OI endpoints
│   │   ├── telegram.ts       # Telegram integration
│   │   └── admin/            # Admin routes (14 files)
│   ├── services/
│   │   ├── email.ts          # SendGrid integration
│   │   ├── alert-broadcaster.ts
│   │   ├── payment-sync.ts
│   │   ├── nowpayments.ts
│   │   ├── renewal-reminder.ts
│   │   ├── asset-metadata.ts
│   │   ├── news.ts
│   │   └── admin/            # Admin services
│   ├── websocket/
│   │   ├── handlers.ts       # Socket.IO handlers
│   │   └── broadcast-user-alert.ts
│   ├── openInterest/
│   │   ├── openInterest.service.ts
│   │   └── openInterest.routes.ts
│   ├── lib/
│   │   ├── logger.ts         # Pino logger
│   │   ├── pricing.ts        # Tier pricing
│   │   └── rss/              # RSS feed handling
│   └── types/
│       ├── index.ts          # Main types
│       ├── hono.ts           # Hono types
│       └── admin.ts          # Admin types
├── prisma/
│   └── schema.prisma         # Database schema
├── scripts/
│   └── seed-test-users.ts    # Test data seeding
└── package.json
```

---

## Entry Point (`src/index.ts`)

The main file sets up:

1. **Prisma client** - Database connection
2. **Hono app** - HTTP server
3. **CORS** - Cross-origin configuration
4. **Routes** - All API endpoints
5. **Socket.IO** - Real-time connections
6. **Scheduled tasks** - Background jobs

```typescript
// Initialize
const app = new Hono()
const prisma = new PrismaClient()

// Middleware
app.use('*', cors({ ... }))
app.use('*', logger())

// Routes
app.route('/api/auth', authRoutes)
app.route('/api/payments', paymentRoutes)
app.route('/api/admin', adminRoutes)
// ... more routes

// Start server
serve({ fetch: app.fetch, port: 3001 })

// Socket.IO
const io = new SocketIOServer(httpServer, { ... })
setupSocketHandlers(io)
```

---

## Middleware

### Auth Middleware (`middleware/auth.ts`)

Validates JWT tokens and populates user context.

```typescript
export async function authMiddleware(c: Context, next: Next) {
  // Extract token
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Verify token
  const payload = await jose.jwtVerify(token, secret)

  // Load user from database
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      tier: true,
      role: true,
      status: true,
      stripeCustomerId: true,  // Important for billing!
    }
  })

  if (!user || user.status === 'BANNED') {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Set user in context
  c.set('user', user)

  return next()
}
```

### Admin Auth Middleware (`middleware/admin-auth.ts`)

Requires ADMIN role.

```typescript
export async function adminAuthMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (user?.role !== 'ADMIN') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  return next()
}
```

### Rate Limit Middleware (`middleware/rate-limit.ts`)

Prevents API abuse.

```typescript
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
})
```

### Audit Logger (`middleware/audit-logger.ts`)

Logs admin actions for compliance.

```typescript
export async function logAuditEvent(params: AuditLogParams) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      targetId: params.targetId,
      targetType: params.targetType,
      details: params.details,
      ipAddress: params.ipAddress,
    }
  })
}
```

---

## Route Structure

### Auth Routes (`routes/auth.ts`)

75+ KB of authentication logic.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/signup` | POST | Create account |
| `/signin` | POST | Email/password login |
| `/signout` | POST | End session |
| `/me` | GET | Get current user |
| `/oauth-link` | POST | OAuth account linking |
| `/siwe/prepare` | POST | Prepare SIWE message |
| `/siwe/verify` | POST | Verify SIWE signature |
| `/solana/nonce` | GET | Get Solana nonce |
| `/solana/verify` | POST | Verify Solana signature |
| `/verify-email` | GET | Verify email token |
| `/forgot-password` | POST | Password reset request |
| `/reset-password` | POST | Set new password |
| `/link-wallet` | POST | Link wallet to account |
| `/unlink-wallet` | POST | Remove wallet |
| `/change-password` | POST | Change password |
| `/delete-account` | DELETE | Delete user account |

### Payment Routes (`routes/payments.ts`)

131+ KB of payment logic.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/checkout` | POST | Create Stripe Checkout |
| `/portal` | POST | Create Customer Portal |
| `/subscription` | GET | Get subscription status |
| `/webhook` | POST | Stripe webhook handler |
| `/nowpayments/checkout` | POST | Create crypto invoice |
| `/nowpayments/webhook` | POST | NowPayments IPN |
| `/validate-promo` | POST | Validate promo code |

### Volume Alerts Routes (`routes/volume-alerts.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Get recent alerts |
| `/ingest` | POST | Ingest new alert (API key) |
| `/stats` | GET | Alert statistics |

### Watchlist Routes (`routes/watchlist.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | List user's watchlists |
| `/` | POST | Create watchlist |
| `/:id` | GET | Get watchlist |
| `/:id` | PUT | Update watchlist |
| `/:id` | DELETE | Delete watchlist |
| `/:id/symbols` | POST | Add symbol |
| `/:id/symbols/:symbol` | DELETE | Remove symbol |

### Admin Routes (`routes/admin/`)

14 files covering:
- User management
- Subscription management
- Payment management
- Promo codes
- Audit logs
- Metrics
- Settings
- Asset management
- Notifications
- News management
- Telegram settings

---

## Services

### Email Service (`services/email.ts`)

SendGrid integration for transactional emails.

**Templates:**
- Email verification
- Password reset
- Subscription confirmation
- Renewal reminder
- Account deletion

```typescript
export async function sendVerificationEmail(to: string, token: string) {
  const link = `${FRONTEND_URL}/auth/verify?token=${token}`

  await sendgrid.send({
    to,
    from: FROM_EMAIL,
    subject: 'Verify your VolSpike account',
    html: verificationTemplate(link),
  })
}
```

### Alert Broadcaster (`services/alert-broadcaster.ts`)

Manages alert delivery via Socket.IO.

```typescript
class AlertBroadcaster {
  private io: SocketIOServer
  private queues: Map<string, Alert[]>

  broadcast(alert: VolumeAlert) {
    // Elite: instant
    this.io.to('tier-elite').emit('volume-alert', alert)

    // Pro/Free: queue for batching
    this.queueForTier('tier-pro', alert)
    this.queueForTier('tier-free', alert)
  }

  flushTier(tierRoom: string) {
    const queue = this.queues.get(tierRoom)
    if (queue?.length) {
      this.io.to(tierRoom).emit('volume-alerts-batch', queue)
      this.queues.set(tierRoom, [])
    }
  }
}
```

### Payment Sync (`services/payment-sync.ts`)

Syncs pending crypto payments with NowPayments API.

```typescript
export async function syncPendingPayments() {
  const pending = await prisma.cryptoPayment.findMany({
    where: { paymentStatus: { in: ['waiting', 'confirming'] } }
  })

  for (const payment of pending) {
    const status = await nowpayments.getPaymentStatus(payment.paymentId)

    if (status === 'finished') {
      await prisma.cryptoPayment.update({
        where: { id: payment.id },
        data: { paymentStatus: 'finished', paidAt: new Date() }
      })

      await prisma.user.update({
        where: { id: payment.userId },
        data: { tier: payment.tier }
      })

      // Emit tier change
      io.to(`user:${payment.userId}`).emit('tier-change', { tier: payment.tier })
    }
  }
}
```

### Renewal Reminder (`services/renewal-reminder.ts`)

Sends renewal reminders and handles expirations.

```typescript
export async function checkAndSendRenewalReminders() {
  const sevenDaysFromNow = addDays(new Date(), 7)

  const expiringSoon = await prisma.cryptoPayment.findMany({
    where: {
      paymentStatus: 'finished',
      expiresAt: { lte: sevenDaysFromNow },
      renewalReminderSent: false,
    },
    include: { user: true }
  })

  for (const payment of expiringSoon) {
    await sendRenewalReminderEmail(payment.user.email, payment.expiresAt)

    await prisma.cryptoPayment.update({
      where: { id: payment.id },
      data: { renewalReminderSent: true }
    })
  }
}
```

### Asset Metadata (`services/asset-metadata.ts`)

Fetches and caches cryptocurrency metadata from CoinGecko.

---

## WebSocket Handlers

Located in `websocket/handlers.ts`:

```typescript
export function setupSocketHandlers(io: SocketIOServer, prisma: PrismaClient) {
  io.on('connection', async (socket) => {
    const token = socket.handshake.auth.token

    // Guest connection
    if (token === 'guest') {
      socket.join('tier-free')
      return
    }

    // Authenticated user
    try {
      const payload = await verifyToken(token)
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })

      if (user) {
        socket.join(`tier-${user.tier}`)
        socket.join(`user:${user.id}`)
      }
    } catch {
      socket.disconnect()
    }
  })
}
```

---

## Background Jobs

Scheduled tasks run at intervals:

| Task | Interval | Purpose |
|------|----------|---------|
| Payment sync | 30 seconds | Sync crypto payments |
| Renewal reminders | 6 hours | Send expiration notices |
| Expiration check | 24 hours | Downgrade expired users |
| Asset refresh | 1 hour | Update asset metadata |
| Rate limit retry | 30 minutes | Retry rate-limited assets |
| RSS refresh | 5 minutes | Fetch new articles |
| RSS cleanup | 1 hour | Keep last 200 articles |

---

## Error Handling

Global error handler:

```typescript
app.onError((err, c) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })

  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }, 500)
})
```

---

## Logging

Using Pino for structured logging:

```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
})

// Usage
logger.info('User signed in', { userId, email })
logger.error('Payment failed', { error, paymentId })
```

---

## Database Access

All database access through Prisma:

```typescript
// Create
const user = await prisma.user.create({
  data: { email, passwordHash, tier: 'free' }
})

// Read
const user = await prisma.user.findUnique({
  where: { id },
  include: { walletAccounts: true }
})

// Update
await prisma.user.update({
  where: { id },
  data: { tier: 'pro' }
})

// Delete
await prisma.user.delete({ where: { id } })
```

---

## CORS Configuration

```typescript
const allowedOrigins = [
  'https://volspike.com',
  'https://www.volspike.com',
  'https://vol-spike.vercel.app',
  process.env.FRONTEND_URL,
]

app.use('*', cors({
  origin: allowedOrigins,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'stripe-signature',
  ],
}))
```

---

## Health Check

```typescript
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
  })
})
```

---

## Graceful Shutdown

```typescript
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down...`)

  io.close()
  httpServer.close()
  await prisma.$disconnect()

  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

---

## Next: [API Reference](13-API-REFERENCE.md)
