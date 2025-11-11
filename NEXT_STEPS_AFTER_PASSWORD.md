# Next Steps After Getting New Password

## ✅ Step 1: Update Local .env File

You have two options:

### Option A: Use the Script (Easiest)
```bash
cd volspike-nodejs-backend
./update-database-url.sh 'postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

**Replace `YOUR_NEW_PASSWORD` with your actual new password!**

### Option B: Manual Edit
```bash
cd volspike-nodejs-backend
nano .env  # or use your preferred editor (code, vim, etc.)
```

Find the line:
```
DATABASE_URL=postgresql://neondb_owner:OLD_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Replace `OLD_PASSWORD` with your **NEW password** and save.

---

## ✅ Step 2: Update Railway Production Environment

**CRITICAL:** Your production app is still using the old password. Update it now!

1. **Go to Railway Dashboard:**
   - Visit: https://railway.app/
   - Log in to your account

2. **Find Your Backend Project:**
   - Click on your VolSpike backend project
   - It should be named something like "volspike-nodejs-backend" or "VolSpike Backend"

3. **Go to Variables Tab:**
   - Click on "Variables" tab (or "Environment" tab)
   - Look for `DATABASE_URL` variable

4. **Update DATABASE_URL:**
   - Click on `DATABASE_URL` to edit it
   - Replace the entire value with your NEW connection string:
     ```
     postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   - Click "Save" or "Update"

5. **Redeploy (if needed):**
   - Railway should automatically redeploy when you update environment variables
   - Check the "Deployments" tab to confirm it's redeploying
   - Wait for deployment to complete (usually 1-2 minutes)

---

## ✅ Step 3: Test the Connection

Test that your new password works:

```bash
cd volspike-nodejs-backend

# Test connection (replace YOUR_NEW_PASSWORD with actual password)
psql 'postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -c "SELECT 1;"
```

If you see `?column?` with `1`, the connection works! ✅

---

## ✅ Step 4: Verify Backend Can Connect

```bash
cd volspike-nodejs-backend

# Test Prisma connection
npx prisma db push --skip-generate
```

If this succeeds, your backend can connect to the database! ✅

---

## ✅ Step 5: Remove Secret from Git History

**ONLY AFTER** you've updated all environments, proceed with Git history cleanup:

See `SECURITY_FIX_INSTRUCTIONS.md` for detailed steps, or run:

```bash
# 1. Install git-filter-repo (if not already installed)
brew install git-filter-repo

# 2. Clone fresh copy (IMPORTANT - don't use current directory!)
cd /tmp
git clone git@github.com:NikolaySitnikov/VolSpike.git VolSpike_cleaned
cd VolSpike_cleaned

# 3. Remove file from all history
git filter-repo --path volspike-nodejs-backend/check-user-tier.ts --invert-paths --force

# 4. Force push cleaned history
git push origin --force --all
git push origin --force --tags

# 5. Update your local repo
cd /Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday\ Life/AI/VolumeFunding/VolSpike
git fetch origin
git reset --hard origin/main
```

---

## 📋 Checklist

- [ ] Updated local `.env` file with new password
- [ ] Updated Railway production `DATABASE_URL` variable
- [ ] Tested connection locally (psql command works)
- [ ] Verified backend can connect (prisma db push works)
- [ ] Railway deployment completed successfully
- [ ] Removed secret from Git history (Step 5)

---

## ⚠️ Important Notes

1. **Don't commit .env files** - They're already in .gitignore
2. **Old password is still in Git history** - Must remove it (Step 5)
3. **Test everything** - Make sure production app still works after password change
4. **Monitor Railway logs** - Check for any connection errors after update

---

**Start with Step 1 (update local .env), then Step 2 (Railway), then test!**

