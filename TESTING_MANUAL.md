# VolSpike End‑to‑End Test Manual

Purpose: Verify identity rules, account linking, wallet limits, avatar, session self‑heal, and Settings UI.

Scope: Frontend (Next.js) + Backend (Hono/Prisma) in both dev and production.

Contents
- Prerequisites
- Fast Smoke
- Full Test Plan
- API Checks (prod)
- Troubleshooting
- Seed/Reset Instructions (guarded)

---

## Prerequisites

- Two browsers or one normal window + Incognito.
- Two Google accounts (G-A, G-B); at least one with a profile photo.
- One EVM wallet (MetaMask) with a test address; optional SOL wallet (Phantom).
- Production backend URL: `https://volspike-production.up.railway.app`.

Optional console helpers:
- Avatar debug: `localStorage.setItem('debugAvatar','1')`
- Force avatar image: `localStorage.setItem('vs_avatar_mode','image')`
- Reset: remove the above keys.

Quick session dump:
```
fetch('/api/auth/session').then(r=>r.json()).then(s=>console.log(s))
```

---

## Fast Smoke (5 minutes)

1) Sign in with Google (G‑A with a photo).
   - Header avatar shows the photo (not initials).
   - Settings → Account shows correct tier badge colors matching header.

2) Single identity enforced.
   - Connect MetaMask, then sign in with Google → wallet auto‑disconnects.
   - Sign in with SIWE (wallet) → any Phantom connection auto‑disconnects.

3) Wallets tab.
   - Link one ETH wallet → success, button disabled; helper text explains one ETH per user.
   - Unlink → link again → success; second ETH on same user → 400.

4) Sign out.
   - Session cleared; EVM and Phantom disconnected.

---

## Full Test Plan

### A. Settings UI
- Desktop tabs are a slim, aligned sticky toolbar (no droop). Mobile shows stacked cards.
- Tier badge styling matches header:
  - Free: gray, Pro: `sec-*`, Elite: `elite-*`.

### B. Avatar (Google photo)
1) Sign in with G‑A.
2) If initials appear, inspect `[data-vs-avatar]` in Elements:
   - `data-show-image="true"` and `data-image-url` is a `*.googleusercontent.com` URL.
3) Network → `_next/image` or `googleusercontent` requests return 200.

### C. Identity Exclusivity
- Only one active identity at a time.
  - Sign in with Google → EVM disconnects.
  - Sign in with SIWE → Phantom disconnects.
  - `fetch('/api/auth/session')` shows `authMethod: 'google' | 'evm' | 'password' | 'solana'`.

### D. Global Sign Out
- User‑menu → Sign Out disconnects wallets and clears local avatar/email prefs.

### E. Wallets (ETH/EVM)
1) Link one ETH wallet: success; button disabled.
2) Same user linking a second ETH: 400 “You can link only one ETH wallet”.
3) Another user trying to link the same ETH address (any chain): 403 “This ETH wallet is already linked to another account”.

Note: SOL follows the same rules (one per user, unique across users). If SOL UI is connected, repeat with Phantom.

### F. Accounts Panel Loads
- Settings → Wallets loads accounts; “Retry” clears transient 401s while the self‑heal binds Google to DB user.

### G. Identity Uniqueness Across Users
1) Email unique:
   - User1 owns `X`; User2 linking `X` → 400 “Email is already associated with another account”.
2) Google OAuth unique (no cross‑account transfer):
   - User1 links Google `G‑A`; User2 first‑time Google sign‑in with `G‑A` → 403.
3) Wallet unique across users: see E.3.

### H. Linking Policy Matrix
1) Email+password (Gmail): can only link same Google email.
2) Email+password (non‑Gmail): linking Google replaces primary email with the Google email and clears passwordHash (must re‑link password to new email).
3) Google OAuth first: email/password must use the same Google email.

### I. Self‑Heal after Google Sign‑in
- Immediately after sign‑in, if `/api/auth/accounts/list` is 401, within ~1s the JWT self‑heal calls `/oauth-link` and binds token to DB user → subsequent calls 200.

---

## API Checks (production backend)

Given `const api = 'https://volspike-production.up.railway.app'` and `const s = await (await fetch('/api/auth/session')).json()`:

- Accounts: `fetch(`${api}/api/auth/accounts/list`, { headers: { Authorization: \
  'Bearer ' + (s.accessToken || s.user.id) } })`
  - 200 on success; transient 401 becomes 200 after self‑heal.

- Link Google (authenticated): POST `${api}/api/auth/oauth/link`
  - JSON: `{ email, name, image, provider:'google', providerId }`
  - Errors: 400 “must match your existing Google email”, 400 “Email is already associated…”

- Link password (authenticated): POST `${api}/api/auth/email/link`
  - JSON `{ email, password }`; errors: 400 same‑email rules or email‑already‑used.

- Link wallet (authenticated): POST `${api}/api/auth/wallet/link`
  - JSON `{ message, signature, address, chainId, provider:'evm'|'solana' }`
  - Errors: 400 one‑per‑provider, 403 address already linked by another user.

---

## Troubleshooting

- Avatar initials:
  - Inspect `[data-vs-avatar]` dataset; if `isGoogleTile` → set `localStorage.setItem('vs_avatar_mode','image')` to compare.

- Accounts list fails:
  - Click “Retry” after a second (JWT self‑heal). Confirm `session.accessToken` exists.

- Wallet link silent failure:
  - Network panel → open the POST; the JSON shows the precise error message.

---

## Seed/Reset Instructions (guarded)

Warning: This script is destructive. It deletes all users and user‑related data. Do not run on production unless you have a backup and explicit approval.

Script: `volspike-nodejs-backend/scripts/seed-test-users.ts`

What it does
- Deletes user‑owned rows in safe order (audit logs, sessions, accounts, wallet_accounts, preferences, alerts, watchlists, etc.), then deletes all users.
- Seeds three accounts with hashed password `Test123456!`:
  - free-test@volspike.com  (Free)
  - pro-test@volspike.com   (Pro)
  - gmail-policy@googlemail.com (Free; for Gmail policy checks)

Run (example for development)
```
cd volspike-nodejs-backend
export DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
export DANGEROUSLY_ERASE_ALL_USERS=YES
npm run seed:test -- --really-erase
```

Production safety
- Do not paste credentials into files; export `DATABASE_URL` in your shell only.
- Ensure you have a snapshot/backup.
- Confirm you intend to delete all users by setting `DANGEROUSLY_ERASE_ALL_USERS=YES` and passing `--really-erase`.

Seeded credentials
- Email/password
  - free-test@volspike.com / Test123456!
  - pro-test@volspike.com / Test123456!
  - gmail-policy@googlemail.com / Test123456!

Notes
- Test Google OAuth accounts cannot be pre‑seeded; they are created on first OAuth sign‑in via `/oauth-link`.
- Wallet uniqueness tests should be done by linking real test wallets during the session.

