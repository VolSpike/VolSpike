# Troubleshooting Guide

## Common Issues and Solutions

This guide covers the most common issues encountered when developing or operating VolSpike.

---

## Frontend Issues

### "WebSocket not connecting"

**Symptoms:**
- Market table empty or stuck on "Connecting..."
- Console shows WebSocket errors

**Solutions:**

1. Check environment variable:
   ```bash
   # In .env.local
   NEXT_PUBLIC_WS_URL=wss://fstream.binance.com/stream?streams=!ticker@arr/!markPrice@arr
   ```

2. Check if Binance is accessible from your network:
   ```bash
   curl -I https://fstream.binance.com
   ```

3. Check browser console for specific errors:
   - `403` = Likely region blocked
   - `1006` = Connection closed abnormally

4. Try localStorage fallback:
   - The hook automatically falls back to cached data after 3 seconds

---

### "Authentication not working"

**Symptoms:**
- Sign-in fails
- Session not persisting
- "Unauthorized" errors

**Solutions:**

1. Verify backend is running:
   ```bash
   curl http://localhost:3001/health
   ```

2. Check `NEXT_PUBLIC_API_URL`:
   ```bash
   # Should point to your backend
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. Verify `NEXTAUTH_SECRET` is set:
   ```bash
   # Must be 32+ characters
   NEXTAUTH_SECRET=your-very-long-secret-key-at-least-32-chars
   ```

4. Clear cookies and try again:
   - Browser DevTools → Application → Cookies → Clear

5. Check backend logs for auth errors:
   ```bash
   cd volspike-nodejs-backend
   npm run dev
   # Watch for [Auth] logs
   ```

---

### "Session appears unauthenticated after login"

**Symptoms:**
- Login succeeds but header shows "Sign In"
- Brief flash of unauthenticated state

**Root Cause:** NextAuth credentials login uses client-side navigation which leaves session state stale.

**Solution:** After credentials login, use hard navigation:
```typescript
// After successful signIn:
await update() // Refresh session
window.location.href = '/dashboard' // Hard navigation, not router.push
```

---

### "Dark theme not working"

**Solutions:**

1. Check theme provider in `providers.tsx`:
   ```typescript
   <ThemeProvider attribute="class" defaultTheme="dark">
   ```

2. Clear localStorage:
   ```javascript
   localStorage.removeItem('theme')
   ```

3. Verify Tailwind dark classes:
   ```css
   .dark .bg-background { ... }
   ```

---

### "Tooltip clipped by container"

**Symptoms:**
- Tooltips cut off at container boundaries

**Solution:** Use Portal wrapper:
```typescript
// In ui/tooltip.tsx
<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content ... />
</TooltipPrimitive.Portal>
```

---

## Backend Issues

### "Database connection failed"

**Symptoms:**
- `PrismaClientInitializationError`
- "Can't reach database server"

**Solutions:**

1. Check Docker is running:
   ```bash
   docker ps | grep postgres
   ```

2. Start database if stopped:
   ```bash
   docker start volspike-postgres
   ```

3. Verify connection string:
   ```bash
   DATABASE_URL=postgresql://volspike:password@localhost:5432/volspike
   ```

4. Test connection:
   ```bash
   npx prisma db pull
   ```

5. Check for port conflicts:
   ```bash
   lsof -i :5432
   ```

---

### "Stripe webhooks failing"

**Symptoms:**
- Payments complete but user not upgraded
- Webhook errors in Stripe dashboard

**Solutions:**

1. Verify webhook secret:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

2. For local testing, use Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3001/api/payments/webhook
   ```

3. Check backend logs for signature errors:
   ```
   [Error] Stripe webhook signature verification failed
   ```

4. Ensure raw body is used (not JSON parsed):
   ```typescript
   // Webhook handler must receive raw body
   const rawBody = await c.req.text()
   ```

---

### "NowPayments webhook not working"

**Symptoms:**
- Crypto payment completes but user not upgraded
- No IPN received

**Solutions:**

1. Check IPN secret:
   ```bash
   NOWPAYMENTS_IPN_SECRET=your_ipn_secret
   ```

2. Verify webhook URL in NowPayments dashboard:
   ```
   https://volspike-production.up.railway.app/api/payments/nowpayments/webhook
   ```

3. Check backend logs for IPN:
   ```
   [Info] NowPayments IPN received: { ... }
   ```

4. Verify HMAC signature calculation:
   ```typescript
   const hmac = crypto.createHmac('sha512', IPN_SECRET)
     .update(JSON.stringify(body))
     .digest('hex')
   ```

---

### "500 on admin endpoints"

**Symptoms:**
- Admin pages return 500 errors
- Prisma errors in logs

**Solutions:**

1. Run database migrations:
   ```bash
   cd volspike-nodejs-backend
   npx prisma migrate deploy
   ```

2. Or push schema directly:
   ```bash
   npx prisma db push
   ```

3. Check Railway logs:
   ```bash
   railway logs
   ```

---

### "Billing page shows 'No customer found'"

**Symptoms:**
- Pro user sees "No active subscription found"
- Stripe portal link doesn't work

**Root Cause:** Auth middleware not selecting `stripeCustomerId`.

**Solution:** Ensure auth middleware includes field:
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    tier: true,
    role: true,
    stripeCustomerId: true,  // Must be included!
  },
})
```

---

## Digital Ocean Issues

### "Script not running"

**Solutions:**

1. Check service status:
   ```bash
   ssh volspike-do "sudo systemctl status volspike.service"
   ```

2. View logs:
   ```bash
   ssh volspike-do "sudo journalctl -u volspike.service -n 50"
   ```

3. Check script file exists:
   ```bash
   ssh volspike-do "ls -la /home/trader/volume-spike-bot/"
   ```

4. Check Python environment:
   ```bash
   ssh volspike-do "ls -la /home/trader/volume-spike-bot/.venv/bin/python"
   ```

---

### "Alerts not posting to backend"

**Solutions:**

1. Check environment file:
   ```bash
   ssh volspike-do "cat /home/trader/.volspike.env"
   ```

2. Test backend connectivity:
   ```bash
   ssh volspike-do "curl https://volspike-production.up.railway.app/health"
   ```

3. Check API key matches:
   - Digital Ocean: `ALERT_INGEST_API_KEY`
   - Backend: `ALERT_INGEST_API_KEY`

4. Check script logs for HTTP errors:
   ```bash
   ssh volspike-do "sudo journalctl -u volspike.service | grep -i error"
   ```

---

### "Wrong service name"

**Common Mistake:**
```bash
# WRONG
ssh volspike-do "sudo systemctl restart hourly-volume-alert-dual-env.service"
```

**Correct:**
```bash
# RIGHT
ssh volspike-do "sudo systemctl restart volspike.service"
```

Find actual service name:
```bash
ssh volspike-do "sudo systemctl list-units --type=service | grep -i volume"
```

---

## Socket.IO Issues

### "Not receiving alerts"

**Solutions:**

1. Check Socket.IO connection:
   - Browser DevTools → Network → WS
   - Should show `socket.io` connection

2. Verify user is in correct room:
   ```javascript
   // Console
   socket.rooms // Should show tier-{free|pro|elite}
   ```

3. Check backend is emitting:
   ```typescript
   logger.info('Broadcasting alert to room', { room, alertId })
   ```

4. Verify token is sent:
   ```typescript
   // Frontend
   auth: { token: session?.accessToken || 'guest' }
   ```

---

### "Guest not receiving alerts"

**Solutions:**

1. Guest should use token `'guest'`:
   ```typescript
   auth: { token: 'guest' }
   ```

2. Guest joins `tier-free` room automatically

3. Check server-side handler:
   ```typescript
   if (token === 'guest') {
     socket.join('tier-free')
   }
   ```

---

## Payment Issues

### "User not upgraded after payment"

**Diagnostic Steps:**

1. Check payment status in admin panel
2. Check backend logs for webhook
3. Check Stripe/NowPayments dashboard
4. Verify webhook URL is correct
5. Run manual sync from admin panel

**Manual Fix:**
```bash
# Admin panel → Payments → Create Payment (for crypto)
# Or use tier mismatch repair
```

---

### "Promo code not applying"

**Solutions:**

1. Check code is active in admin panel
2. Check code hasn't reached max uses
3. Check code hasn't expired
4. Check payment method restriction (Stripe/Crypto/All)
5. Check validation endpoint response:
   ```bash
   curl -X POST http://localhost:3001/api/payments/validate-promo \
     -H "Content-Type: application/json" \
     -d '{"code": "TEST20"}'
   ```

---

## Build Issues

### "TypeScript errors on build"

**Solutions:**

1. Run type check locally:
   ```bash
   npm run type-check
   ```

2. Fix any type errors before pushing

3. Common fixes:
   - Add missing types
   - Use `as` for type assertions
   - Add null checks

---

### "Next.js build fails"

**Solutions:**

1. Check for dynamic usage in static pages:
   ```typescript
   export const dynamic = 'force-dynamic'
   ```

2. Check for missing dependencies:
   ```bash
   rm -rf node_modules
   npm install
   ```

3. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run build
   ```

---

## Performance Issues

### "Dashboard loading slowly"

**Solutions:**

1. Check WebSocket connection time
2. Check OI fetch time
3. Reduce tier limit temporarily
4. Check browser DevTools → Performance

---

### "High memory usage"

**Solutions:**

1. Check for memory leaks in hooks
2. Verify cleanup in useEffect
3. Check Socket.IO listeners are removed
4. Check for circular references

---

## Getting Help

### Information to Gather

When debugging:

1. **Browser console logs**
2. **Network tab requests/responses**
3. **Backend logs**
4. **Environment variables (redacted)**
5. **Steps to reproduce**

### Useful Commands

```bash
# Frontend logs
npm run dev 2>&1 | tee frontend.log

# Backend logs
npm run dev 2>&1 | tee backend.log

# Database state
npx prisma studio

# Stripe events
stripe events list --limit 10

# Digital Ocean logs
ssh volspike-do "sudo journalctl -u volspike.service -n 100"
```

---

## Quick Reference

| Issue | First Check |
|-------|-------------|
| WebSocket fails | `NEXT_PUBLIC_WS_URL` |
| Auth fails | `NEXTAUTH_SECRET`, backend running |
| DB fails | Docker running, `DATABASE_URL` |
| Webhook fails | Correct secret, raw body |
| Alerts missing | Socket.IO connection, room |
| Build fails | `npm run type-check` |
| DO script fails | Service status, env file |
