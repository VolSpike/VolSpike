# Deployment Guide

## Overview

VolSpike is deployed across multiple platforms:

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | volspike.com |
| Backend | Railway | volspike-production.up.railway.app |
| Database | Neon | PostgreSQL managed |
| Scripts | Digital Ocean | Droplet |

---

## Frontend Deployment (Vercel)

### Initial Setup

1. **Connect Repository**
   - Go to vercel.com
   - Import GitHub repository
   - Select `volspike-nextjs-frontend` directory

2. **Configure Build**
   ```
   Framework: Next.js
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

3. **Set Environment Variables**
   ```
   NEXTAUTH_URL=https://volspike.com
   NEXTAUTH_SECRET=<production-secret>
   NEXT_PUBLIC_API_URL=https://volspike-production.up.railway.app
   NEXT_PUBLIC_SOCKET_IO_URL=https://volspike-production.up.railway.app
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<project-id>
   GOOGLE_CLIENT_ID=<client-id>
   GOOGLE_CLIENT_SECRET=<client-secret>
   ```

### Deployment Process

**Automatic:**
- Push to `main` branch
- Vercel auto-deploys

**Manual:**
```bash
cd volspike-nextjs-frontend
vercel --prod
```

### Custom Domain

1. Add domain in Vercel dashboard
2. Configure DNS:
   ```
   A Record: @ → 76.76.21.21
   CNAME: www → cname.vercel-dns.com
   ```

---

## Backend Deployment (Railway)

### Initial Setup

1. **Create Project**
   - Go to railway.app
   - New Project → Deploy from GitHub
   - Select repository

2. **Configure Service**
   - Root Directory: `volspike-nodejs-backend`
   - Build Command: `npm run build`
   - Start Command: `npm start`

3. **Set Environment Variables**
   ```
   DATABASE_URL=<neon-connection-string>
   JWT_SECRET=<production-jwt-secret>
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   SENDGRID_API_KEY=SG....
   SENDGRID_FROM_EMAIL=noreply@volspike.com
   FRONTEND_URL=https://volspike.com
   NOWPAYMENTS_API_KEY=<key>
   NOWPAYMENTS_IPN_SECRET=<secret>
   NOWPAYMENTS_SANDBOX_MODE=false
   ALERT_INGEST_API_KEY=<api-key>
   DISABLE_SERVER_MARKET_POLL=true
   ENABLE_SCHEDULED_TASKS=true
   NODE_ENV=production
   PORT=3001
   ```

### Deployment Process

**Automatic:**
- Push to `main` branch
- Railway auto-deploys

**Database Migrations:**
```bash
# After schema changes, run on Railway
npx prisma migrate deploy
```

### Health Check

Verify deployment:
```bash
curl https://volspike-production.up.railway.app/health
```

---

## Database Deployment (Neon)

### Initial Setup

1. **Create Project**
   - Go to neon.tech
   - Create new project
   - Select region closest to Railway

2. **Get Connection String**
   - Dashboard → Connection Details
   - Copy PostgreSQL connection string

3. **Enable Pooling**
   - Enable connection pooling
   - Use pooler URL for production

### Schema Migration

```bash
cd volspike-nodejs-backend

# Generate migration
npx prisma migrate dev --name migration_name

# Apply to production
DATABASE_URL="<neon-url>" npx prisma migrate deploy
```

### Backups

- Neon provides automatic point-in-time recovery
- Configure retention in dashboard

---

## Digital Ocean Deployment

### Server Setup

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - Basic plan ($6/month minimum)
   - Select region

2. **SSH Access**
   ```bash
   # Add SSH key
   ssh-copy-id root@167.71.196.5

   # Configure SSH alias
   # In ~/.ssh/config:
   Host volspike-do
     HostName 167.71.196.5
     User root
     IdentityFile ~/.ssh/volspike-temp
   ```

3. **Install Dependencies**
   ```bash
   ssh volspike-do
   apt update && apt upgrade -y
   apt install python3 python3-pip python3-venv -y
   ```

4. **Create User**
   ```bash
   useradd -m -s /bin/bash trader
   mkdir -p /home/trader/volume-spike-bot
   chown trader:trader /home/trader/volume-spike-bot
   ```

5. **Setup Python Environment**
   ```bash
   su - trader
   cd /home/trader/volume-spike-bot
   python3 -m venv .venv
   source .venv/bin/activate
   pip install requests websocket-client python-dotenv
   ```

6. **Create Environment File**
   ```bash
   # /home/trader/.volspike.env
   BACKEND_URL=https://volspike-production.up.railway.app
   ALERT_INGEST_API_KEY=your-api-key
   ```

### Deploy Scripts

```bash
# Copy script
scp "Digital Ocean/hourly_volume_alert_dual_env.py" \
    volspike-do:/home/trader/volume-spike-bot/

# Set permissions
ssh volspike-do "chown trader:trader /home/trader/volume-spike-bot/*.py"
```

### Create Systemd Service

```bash
# Create service file: /etc/systemd/system/volspike.service
[Unit]
Description=VolSpike Volume Alert Service
After=network.target

[Service]
Type=simple
User=trader
WorkingDirectory=/home/trader/volume-spike-bot
EnvironmentFile=/home/trader/.volspike.env
ExecStart=/home/trader/volume-spike-bot/.venv/bin/python hourly_volume_alert_dual_env.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
ssh volspike-do "sudo systemctl daemon-reload"
ssh volspike-do "sudo systemctl enable volspike.service"
ssh volspike-do "sudo systemctl start volspike.service"
```

---

## Webhook Configuration

### Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint:
   ```
   URL: https://volspike-production.up.railway.app/api/payments/webhook
   Events: checkout.session.completed, customer.subscription.*, invoice.*
   ```
3. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### NowPayments IPN

1. Go to NowPayments Dashboard → Settings → IPN
2. Set callback URL:
   ```
   https://volspike-production.up.railway.app/api/payments/nowpayments/webhook
   ```
3. Copy IPN secret to `NOWPAYMENTS_IPN_SECRET`

---

## SSL/HTTPS

### Vercel (Frontend)

- Automatic SSL via Let's Encrypt
- No configuration needed

### Railway (Backend)

- Automatic SSL for *.up.railway.app domains
- Custom domain requires DNS verification

---

## Monitoring

### Vercel

- Analytics dashboard
- Function logs
- Error tracking

### Railway

- Service logs
- Metrics (CPU, memory)
- Deployment history

### Digital Ocean

```bash
# View service status
ssh volspike-do "sudo systemctl status volspike.service"

# View logs
ssh volspike-do "sudo journalctl -u volspike.service -f"

# Check memory
ssh volspike-do "free -h"

# Check disk
ssh volspike-do "df -h"
```

---

## Rollback

### Vercel

1. Go to Deployments
2. Find previous deployment
3. Click "..." → "Promote to Production"

### Railway

1. Go to Deployments
2. Find previous deployment
3. Click "Redeploy"

### Digital Ocean

```bash
# Keep backup of previous script
ssh volspike-do "cp /home/trader/volume-spike-bot/script.py /home/trader/volume-spike-bot/script.py.bak"

# Restore if needed
ssh volspike-do "cp /home/trader/volume-spike-bot/script.py.bak /home/trader/volume-spike-bot/script.py"
ssh volspike-do "sudo systemctl restart volspike.service"
```

---

## Pre-Deployment Checklist

### Frontend

- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] Environment variables set in Vercel
- [ ] Domain configured correctly

### Backend

- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] Environment variables set in Railway
- [ ] Database migrations applied
- [ ] Webhooks configured

### Digital Ocean

- [ ] Script tested locally
- [ ] Environment file updated
- [ ] Service file correct
- [ ] Permissions set correctly

---

## Post-Deployment Verification

### Frontend

1. Visit https://volspike.com
2. Check browser console for errors
3. Verify WebSocket connection
4. Test authentication flow

### Backend

1. Check `/health` endpoint
2. Verify Socket.IO connections
3. Test payment flow (sandbox)
4. Check logs for errors

### Digital Ocean

1. Check service status
2. Verify alerts are posting
3. Check backend receives alerts
4. Monitor logs for errors

---

## Disaster Recovery

### Database Backup

Neon provides automatic backups. To restore:
1. Go to Neon dashboard
2. Select project
3. Branches → Create from point in time

### Full Recovery

1. **Frontend**: Redeploy from Git
2. **Backend**: Redeploy from Git + migrate
3. **Database**: Restore from Neon backup
4. **Scripts**: Redeploy via SCP

---

## Cost Estimates

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Railway | Starter | $5-20 |
| Neon | Free/Pro | $0-25 |
| Digital Ocean | Basic | $6 |
| **Total** | | **~$50-70** |

---

## Security Checklist

- [ ] All secrets in environment variables
- [ ] No secrets in Git history
- [ ] HTTPS only (redirects configured)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Webhook signatures verified
- [ ] Admin routes protected
- [ ] Database connection pooled
