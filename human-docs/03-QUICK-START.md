# Quick Start Guide

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **Docker** installed (for database)
- **Git** installed
- A terminal/command line

---

## 5-Minute Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/VolSpike/VolSpike.git
cd VolSpike
```

### Step 2: Start the Database

```bash
docker run -d \
  --name volspike-postgres \
  -e POSTGRES_DB=volspike \
  -e POSTGRES_USER=volspike \
  -e POSTGRES_PASSWORD=volspike_password \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15
```

### Step 3: Setup Frontend

```bash
cd volspike-nextjs-frontend

# Install dependencies
npm install

# Copy environment file
cp env.example .env.local

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000

### Step 4: Setup Backend (Optional)

Only needed for authentication and payments:

```bash
cd volspike-nodejs-backend

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

The backend will be available at http://localhost:3001

---

## Environment Configuration

### Frontend (.env.local)

```bash
# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-at-least-32-characters

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_IO_URL=http://localhost:3001

# Binance WebSocket
NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream

# Stripe (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key

# WalletConnect (for Web3)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://volspike:volspike_password@localhost:5432/volspike

# JWT
JWT_SECRET=your-jwt-secret-at-least-32-characters

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# SendGrid
SENDGRID_API_KEY=SG.your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
PORT=3001
```

---

## Verify Installation

### Check Frontend
1. Open http://localhost:3000
2. You should see the VolSpike dashboard
3. Market data should load automatically (via Binance WebSocket)

### Check Backend
1. Open http://localhost:3001/health
2. You should see: `{ "status": "ok", ... }`

### Check Database
```bash
cd volspike-nodejs-backend
npx prisma studio
```
This opens a GUI to browse your database at http://localhost:5555

---

## Common Commands

### Frontend

```bash
cd volspike-nextjs-frontend

# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm run test
```

### Backend

```bash
cd volspike-nodejs-backend

# Development server (with hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Database operations
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
npm run db:studio      # Open Prisma Studio

# Seed test users
npm run seed:test
```

---

## Test Accounts

After running the seed script, you'll have these test accounts:

| Email | Password | Tier |
|-------|----------|------|
| free-test@volspike.com | Test123456! | Free |
| pro-test@volspike.com | Test123456! | Pro |

---

## Development Workflow

### Making Frontend Changes

1. Edit files in `volspike-nextjs-frontend/src/`
2. Changes hot-reload automatically
3. Check browser console for errors

### Making Backend Changes

1. Edit files in `volspike-nodejs-backend/src/`
2. Server restarts automatically
3. Check terminal for errors

### Database Changes

1. Edit `volspike-nodejs-backend/prisma/schema.prisma`
2. Run `npm run db:push` to apply changes
3. Run `npx prisma generate` to update client

---

## Troubleshooting

### "Cannot connect to database"
```bash
# Check if Docker container is running
docker ps

# Start container if stopped
docker start volspike-postgres
```

### "Module not found"
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### "WebSocket connection failed"
- Check if your network blocks WebSocket connections
- The frontend has localStorage fallback for blocked regions

### "Authentication errors"
- Ensure backend is running
- Check `NEXT_PUBLIC_API_URL` in frontend .env.local
- Verify `NEXTAUTH_SECRET` is set

---

## Project Structure Overview

```
VolSpike/
├── volspike-nextjs-frontend/
│   ├── src/
│   │   ├── app/           # Pages
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utilities
│   └── package.json
│
├── volspike-nodejs-backend/
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, rate limiting
│   │   └── websocket/     # Socket.IO
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
│
└── Digital Ocean/         # Python scripts (production only)
```

---

## What's Next?

Now that you have the project running locally:

1. **Explore the codebase**: Start with the frontend dashboard
2. **Read the architecture**: Understand how data flows
3. **Try making changes**: Edit a component and see it update

### Recommended Reading

- [Architecture](02-ARCHITECTURE.md) - Understand the system design
- [Authentication](04-AUTHENTICATION.md) - How login works
- [Frontend Overview](08-FRONTEND-OVERVIEW.md) - React components guide
- [Backend Overview](12-BACKEND-OVERVIEW.md) - API structure

---

## Getting Help

- Check [Troubleshooting](21-TROUBLESHOOTING.md) for common issues
- Review the code comments for detailed explanations
- The codebase has comprehensive TypeScript types
