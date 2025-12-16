# Authentication System

## Overview

VolSpike supports multiple authentication methods to accommodate different user preferences. Users can sign in with email/password, OAuth providers (Google), or Web3 wallets (EVM and Solana).

---

## Authentication Methods

### 1. Email/Password

**Flow:**
1. User enters email and password
2. Frontend calls NextAuth.js credentials provider
3. NextAuth.js calls backend `/api/auth/signin`
4. Backend verifies password with bcrypt
5. Returns JWT token and user data
6. NextAuth.js creates session cookie

**Features:**
- Case-insensitive email matching
- Password requirements: minimum 8 characters
- Email verification via SendGrid
- Password reset functionality

**Code Location:**
- Frontend: `volspike-nextjs-frontend/src/lib/auth.ts`
- Backend: `volspike-nodejs-backend/src/routes/auth.ts`

### 2. Google OAuth

**Flow:**
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth
3. Returns to callback URL
4. NextAuth.js receives OAuth data
5. Backend creates/links user via `/api/auth/oauth-link`
6. Session created with JWT

**Features:**
- Automatic account creation
- Profile picture synced from Google
- Can link to existing email account

**Code Location:**
- Frontend: `volspike-nextjs-frontend/src/lib/auth.ts` (GoogleProvider)
- Backend: `volspike-nodejs-backend/src/routes/auth.ts` (oauth-link endpoint)

### 3. EVM Wallets (Ethereum, Polygon, etc.)

**Flow:**
1. User connects wallet via RainbowKit
2. Frontend requests signature (SIWE - Sign In With Ethereum)
3. Wallet signs message
4. Backend verifies signature via `/api/auth/siwe/verify`
5. User created/linked, JWT returned
6. Session created

**Features:**
- Supports MetaMask, WalletConnect, Coinbase Wallet
- SIWE standard for secure authentication
- Can link multiple wallets to one account

**Code Location:**
- Frontend: `volspike-nextjs-frontend/src/components/web3-providers.tsx`
- Frontend: `volspike-nextjs-frontend/src/hooks/use-wallet-auth.ts`
- Backend: `volspike-nodejs-backend/src/routes/auth.ts` (SIWE endpoints)

### 4. Solana Wallets (Phantom)

**Flow:**
1. User clicks "Connect Phantom"
2. For browser: Direct wallet connection
3. For mobile: Deep link to Phantom app
4. Wallet signs message
5. Backend verifies signature via `/api/auth/solana/verify`
6. User created/linked, JWT returned

**Features:**
- Phantom wallet preferred
- Mobile deep-link support
- Universal links for iOS

**Code Location:**
- Frontend: `volspike-nextjs-frontend/src/components/phantom-signin-section.tsx`
- Frontend: `volspike-nextjs-frontend/src/hooks/use-solana-auth.ts`
- Backend: `volspike-nodejs-backend/src/routes/auth.ts` (Solana endpoints)

---

## Session Management

### JWT Tokens

VolSpike uses JWT (JSON Web Tokens) for session management:

```typescript
// Token payload structure
{
  id: string,           // User ID
  email: string,        // User email (if available)
  tier: 'free' | 'pro' | 'elite',
  role: 'USER' | 'ADMIN',
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED',
  walletAddress?: string,
  authMethod: 'password' | 'google' | 'evm' | 'solana',
  sessionId?: string,   // For single-session enforcement
  iat: number,          // Issued at timestamp
}
```

### Session Duration

- **Regular users**: 30 days
- **Admin users**: Shorter duration (configurable)

### Single-Session Enforcement

Users can only have one active session per device:
- New login invalidates previous session on same device
- `sessionId` tracked in token
- Backend checks session validity on each request

---

## NextAuth.js Configuration

Located in `volspike-nextjs-frontend/src/lib/auth.ts`:

```typescript
export const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({ ... }),
    CredentialsProvider({ ... }),  // Email/password
    CredentialsProvider({ id: 'siwe', ... }),  // EVM wallets
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,  // 30 days
  },
  callbacks: {
    jwt({ token, user, account }) { ... },
    session({ session, token }) { ... },
    redirect({ url, baseUrl }) { ... },
  },
}
```

### Key Callbacks

**jwt callback:**
- Populates token with user data on sign-in
- Refreshes tier data periodically
- Handles password change invalidation
- Self-heals OAuth accounts

**session callback:**
- Transfers token data to session
- Used by frontend to access user info

**redirect callback:**
- Handles post-login redirects
- Admin users go to /admin
- Regular users go to /dashboard

---

## Backend Auth Routes

Located in `volspike-nodejs-backend/src/routes/auth.ts`:

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create new account |
| `/api/auth/signin` | POST | Email/password login |
| `/api/auth/signout` | POST | End session |
| `/api/auth/oauth-link` | POST | Create/link OAuth account |
| `/api/auth/siwe/prepare` | POST | Prepare SIWE message |
| `/api/auth/siwe/verify` | POST | Verify SIWE signature |
| `/api/auth/solana/nonce` | GET | Get Solana nonce |
| `/api/auth/solana/verify` | POST | Verify Solana signature |
| `/api/auth/verify-email` | GET | Verify email token |
| `/api/auth/resend-verification` | POST | Resend verification email |
| `/api/auth/forgot-password` | POST | Send password reset email |
| `/api/auth/reset-password` | POST | Reset password with token |

### Protected Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/me` | GET | Get current user data |
| `/api/auth/link-wallet` | POST | Link wallet to account |
| `/api/auth/unlink-wallet` | POST | Unlink wallet from account |
| `/api/auth/change-password` | POST | Change password |
| `/api/auth/delete-account` | DELETE | Delete user account |

---

## Auth Middleware

Located in `volspike-nodejs-backend/src/middleware/auth.ts`:

```typescript
export async function authMiddleware(c: Context, next: Next) {
  // Extract token from Authorization header or query param
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '') || c.req.query('token')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Verify JWT
  const payload = await verifyToken(token)

  // Check user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id, email, tier, role, status, ... }
  })

  // Set user in context
  c.set('user', user)

  return next()
}
```

---

## User Data Model

```prisma
model User {
  id                   String    @id @default(cuid())
  email                String    @unique
  walletAddress        String?   @unique
  passwordHash         String?
  tier                 String    @default("free")
  role                 Role      @default(USER)
  status               UserStatus @default(ACTIVE)
  emailVerified        DateTime?
  twoFactorEnabled     Boolean   @default(false)
  twoFactorSecret      String?
  passwordChangedAt    DateTime?
  lastLoginAt          DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // Relations
  accounts             Account[]
  walletAccounts       WalletAccount[]
  sessions             Session[]
  ...
}

model WalletAccount {
  id          String   @id @default(cuid())
  userId      String
  provider    String   // 'evm' or 'solana'
  caip10      String   // Chain-agnostic identifier
  address     String
  chainId     String?
  user        User     @relation(...)
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // 'google', etc.
  providerAccountId String
  user              User    @relation(...)
}
```

---

## Email Verification

### Flow
1. User signs up with email
2. Backend sends verification email via SendGrid
3. Email contains link with verification token
4. User clicks link, token verified
5. `emailVerified` timestamp set

### Email Template Features
- Site-hosted logo image
- Bulletproof CTA button (VML fallback for Outlook)
- Hidden preheader text
- Responsive design

**Code Location:**
- `volspike-nodejs-backend/src/services/email.ts`

---

## Password Security

### Password Requirements
- Minimum 8 characters
- Checked on frontend and backend

### Password Hashing
- bcrypt with salt rounds = 10
- Never stored in plain text

### Password Change Detection
- `passwordChangedAt` timestamp updated on change
- JWT tokens issued before password change are invalidated
- Forces re-login on all devices

---

## Role-Based Access Control

### Roles

| Role | Access |
|------|--------|
| USER | Standard user features |
| ADMIN | Admin panel + all user features |

### User Status

| Status | Effect |
|--------|--------|
| ACTIVE | Full access |
| SUSPENDED | Limited access |
| BANNED | No access, session invalidated |

### Admin Protection

Admin routes require:
1. Valid JWT token
2. `role === 'ADMIN'`
3. Status is ACTIVE

```typescript
// Admin middleware
export async function adminAuthMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (user.role !== 'ADMIN') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  return next()
}
```

---

## Guest Access

Unauthenticated users can:
- View limited market data (top 5 rows)
- See limited alerts (top 2)
- Preview dashboard features

Guest Socket.IO connection:
- Token: `'guest'`
- Joins room: `tier-free`
- Receives 15-minute batched alerts

---

## Common Authentication Issues

### "Invalid credentials"
- Check email case (should be case-insensitive)
- Verify password meets requirements
- Check if account exists

### "Email not verified"
- Check spam folder
- Use resend verification endpoint
- Check SendGrid logs

### "Session expired"
- Token older than 30 days
- Password was changed
- Account status changed
- Single-session enforcement kicked in

### "OAuth linking failed"
- Check backend logs
- Verify OAuth provider configuration
- Check database for existing account

---

## Security Best Practices Implemented

1. **Passwords**: bcrypt hashing, never logged
2. **Tokens**: JWT with expiration, signed with secret
3. **Sessions**: Single-session enforcement per device
4. **Validation**: Zod schemas on all inputs
5. **Rate Limiting**: On auth endpoints
6. **CORS**: Strict origin checking
7. **CSRF**: Protection on sensitive endpoints
8. **2FA**: Available for admin accounts

---

## Next: [Payment System](05-PAYMENTS.md)
