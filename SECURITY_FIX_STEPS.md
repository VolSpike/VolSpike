# 🔒 Security Fix - Step-by-Step Guide

## ⚠️ CRITICAL: Your database password was exposed on GitHub

**Password exposed:** `npg_xrRg5IhoZa6d`  
**Database:** Neon PostgreSQL (production)

---

## Step 1: Rotate Database Password (DO THIS FIRST!)

### 1.1 Go to Neon Dashboard

1. Open your browser
2. Go to: https://console.neon.tech/
3. Sign in to your Neon account

### 1.2 Change the Password

1. In Neon dashboard, find your project: `neondb`
2. Click on your project
3. Go to **Settings** → **Connection Details** (or **Database** → **Settings**)
4. Look for **Password** section
5. Click **"Reset Password"** or **"Change Password"**
6. Generate a new strong password (or create your own)
7. **Copy the new password** - you'll need it in the next steps
8. Save/Confirm the change

**⚠️ Important:** Write down the new password somewhere secure (password manager, notes app)

---

## Step 2: Update Password in Railway (Backend)

### 2.1 Go to Railway Dashboard

1. Open: https://railway.app/
2. Sign in
3. Find your **VolSpike backend** project

### 2.2 Update Environment Variable

1. Click on your backend project
2. Go to **Variables** tab (or **Settings** → **Variables**)
3. Find `DATABASE_URL` in the list
4. Click on it to edit
5. Replace the old password (`npg_xrRg5IhoZa6d`) with your **new password**
6. The URL should look like:
   ```
   postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
7. Click **Save** or **Update**

### 2.3 Redeploy (if needed)

- Railway usually auto-redeploys when env vars change
- If not, go to **Deployments** → **Redeploy**

---

## Step 3: Update Local .env File (If You Have One)

### 3.1 Find Your .env File

1. Open terminal
2. Navigate to backend directory:
   ```bash
   cd volspike-nodejs-backend
   ```

### 3.2 Update .env File

1. Open `.env` file:
   ```bash
   # On Mac/Linux:
   nano .env
   # Or use your preferred editor
   ```

2. Find `DATABASE_URL` line
3. Replace the old password with your **new password**
4. Save the file (Ctrl+X, then Y, then Enter if using nano)

**⚠️ Important:** Make sure `.env` is in `.gitignore` (it should be already)

---

## Step 4: Verify Everything Works

### 4.1 Test Backend Connection

1. In terminal, test the connection:
   ```bash
   cd volspike-nodejs-backend
   DATABASE_URL="postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx tsx scripts/view-users.ts
   ```

2. If it works, you'll see user data
3. If it fails, double-check the password

### 4.2 Test Production Site

1. Visit: https://volspike.com
2. Try logging in
3. If login works, database connection is good
4. If login fails, check Railway logs

---

## Step 5: Clean Up Git History (Optional but Recommended)

**⚠️ Warning:** This rewrites git history. Only do this if you're comfortable with git.

### Option A: Use GitHub's Secret Scanning (Easier)

1. The password is already exposed in git history
2. GitHub may have already revoked it (if it was a GitHub token)
3. For database passwords, you need to manually rotate (which you did in Step 1)

### Option B: Remove from Git History (Advanced)

**⚠️ Only do this if you understand git history rewriting**

1. Install `git-filter-repo`:
   ```bash
   pip3 install git-filter-repo
   ```

2. Remove the file from all history:
   ```bash
   cd /path/to/VolSpike
   git filter-repo --path volspike-nodejs-backend/scripts/view-users-prod.sh --invert-paths
   ```

3. Force push (⚠️ This rewrites history):
   ```bash
   git push origin --force --all
   ```

**⚠️ Warning:** Force pushing rewrites history. Anyone who cloned the repo will have issues.

### Option C: Contact GitHub Support (Safest)

1. Go to: https://support.github.com/
2. Explain that you accidentally committed database credentials
3. They can help remove it from history safely
4. This is the safest option if you're not comfortable with git

---

## Step 6: Prevent Future Issues

### 6.1 Add .env to .gitignore

Check if `.env` is in `.gitignore`:

```bash
cd volspike-nodejs-backend
cat .gitignore | grep -E "^\.env$|^\.env\.local$"
```

If not, add it:
```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

### 6.2 Use Environment Variables Only

- ✅ **DO:** Use `DATABASE_URL` environment variable
- ✅ **DO:** Store passwords in Railway/Vercel env vars
- ❌ **DON'T:** Hardcode passwords in scripts
- ❌ **DON'T:** Commit `.env` files

### 6.3 Use GitGuardian (Optional)

Consider using GitGuardian to scan for secrets:
- https://www.gitguardian.com/
- Free tier available
- Scans commits automatically

---

## ✅ Checklist

- [ ] Step 1: Changed password in Neon dashboard
- [ ] Step 2: Updated `DATABASE_URL` in Railway
- [ ] Step 3: Updated local `.env` file (if exists)
- [ ] Step 4: Tested connection - works!
- [ ] Step 5: Decided on git history cleanup (optional)
- [ ] Step 6: Verified `.env` is in `.gitignore`

---

## 🆘 If Something Goes Wrong

### Backend Won't Connect

1. Check Railway logs: Railway Dashboard → Your Project → Deployments → View Logs
2. Verify password is correct (no typos)
3. Check if database is accessible from Railway

### Can't Access Neon Dashboard

1. Check your email for Neon account
2. Try password reset
3. Contact Neon support if needed

### Git History Issues

1. If force push caused problems, you can restore:
   ```bash
   git reflog
   # Find the commit before force push
   git reset --hard <commit-hash>
   ```

---

## 📞 Need Help?

- **Neon Support:** https://neon.tech/docs/support
- **Railway Support:** https://railway.app/help
- **GitHub Support:** https://support.github.com/

---

**Priority Order:**
1. ✅ Rotate password (Step 1) - **DO THIS NOW**
2. ✅ Update Railway (Step 2) - **DO THIS NOW**
3. ✅ Test connection (Step 4) - **DO THIS NOW**
4. ⏳ Clean git history (Step 5) - Can do later

**The most important thing is rotating the password and updating it everywhere!**

