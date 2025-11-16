# 🚨 SECURITY INCIDENT: Database Password Exposed

## IMMEDIATE ACTIONS REQUIRED (Do these NOW):

### Step 1: Rotate Database Password (CRITICAL - Do First!)
1. Go to Neon Console: https://console.neon.tech
2. Navigate to your database project
3. Go to **Settings** → **Connection Details** or **Database** → **Reset Password**
4. Click **"Reset Password"** or **"Generate New Password"**
5. **Copy the new password immediately** (you won't see it again)
6. The new connection string will be shown - copy it

### Step 2: Update Environment Variables
1. **Railway (Backend)**:
   - Go to Railway dashboard
   - Select your backend service
   - Go to **Variables** tab
   - Update `DATABASE_URL` with the new connection string from Neon
   - Save and redeploy

2. **Local Development**:
   - Update `.env` file in `volspike-nodejs-backend/`
   - Update `DATABASE_URL` with new connection string
   - **NEVER commit .env files**

### Step 3: Remove Credentials from Git History
The password was exposed in commit `3651fbb9`. We need to remove it from history:

```bash
# Option 1: Use git-filter-repo (recommended)
git filter-repo --path volspike-nodejs-backend/scripts/investigate-payment.ts --invert-paths
git filter-repo --path volspike-nodejs-backend/scripts/fix-melnikovkk-payment.ts --invert-paths

# Option 2: Use BFG Repo-Cleaner (alternative)
# Download from https://rtyley.github.io/bfg-repo-cleaner/
bfg --replace-text passwords.txt

# Option 3: Manual removal (if above don't work)
# This requires force push - coordinate with team first
git rebase -i 3651fbb9^
# Edit the commit to remove the password
git push --force-with-lease origin main
```

**⚠️ WARNING**: Force pushing rewrites history. Coordinate with team if others have pulled these commits.

### Step 4: Verify No Other Exposed Secrets
Run these checks:

```bash
# Search for any hardcoded passwords
git log --all --full-history -p | grep -i "npg_UhnuFE0swD7A"

# Check for other potential secrets
git log --all --full-history -p | grep -E "(password|secret|key|token).*=.*['\"].*['\"]"
```

### Step 5: Add Scripts to .gitignore
Create/update `.gitignore` to prevent future commits:

```bash
# Add to volspike-nodejs-backend/.gitignore
scripts/*.ts
!scripts/*.example.ts
```

### Step 6: Monitor Database Access
1. Check Neon dashboard for unusual connection patterns
2. Review database logs for suspicious activity
3. Monitor for unauthorized access attempts

## What Was Exposed:
- **Database Password**: `npg_UhnuFE0swD7A`
- **Database Host**: `ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech`
- **Database Name**: `neondb`
- **Username**: `neondb_owner`

## Files That Contained the Password:
- `volspike-nodejs-backend/scripts/investigate-payment.ts` (REMOVED)
- `volspike-nodejs-backend/scripts/fix-melnikovkk-payment.ts` (REMOVED)

## Prevention for Future:
1. ✅ Scripts now require `DATABASE_URL` environment variable
2. ✅ Added validation to fail if DATABASE_URL is not set
3. ⚠️ Need to add scripts to .gitignore
4. ⚠️ Need to use git-secrets or similar pre-commit hooks
5. ⚠️ Never hardcode credentials in code

## Status:
- ✅ Credentials removed from current code
- ⚠️ Password rotation REQUIRED
- ⚠️ Git history cleanup REQUIRED
- ⚠️ Environment variables update REQUIRED

