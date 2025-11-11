# CRITICAL SECURITY FIX - Step-by-Step Instructions

## 🚨 PHASE 1: IMMEDIATE REMEDIATION (DO THIS FIRST!)

### Step 1: Rotate Your PostgreSQL Database Password

**This is CRITICAL - do this immediately to prevent unauthorized access!**

1. **Go to Neon Dashboard:**
   - Visit: https://console.neon.tech/
   - Log in to your account

2. **Find Your Database:**
   - Navigate to your project (likely named "VolSpike" or similar)
   - Click on your database

3. **Reset the Password:**
   - Go to "Settings" → "Connection Details" or "Database Settings"
   - Look for "Reset Password" or "Change Password" option
   - Click it and generate a NEW password
   - **IMPORTANT:** Save this new password securely (you'll need it in Step 2)

4. **Get New Connection String:**
   - After resetting, Neon will show you a new connection string
   - It will look like: `postgresql://neondb_owner:NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - Copy this entire string

5. **Verify Old Credentials Are Invalid:**
   - Try connecting with the old connection string (it should fail)
   - This confirms the old password is no longer valid

---

## 🔧 PHASE 2: Update Local Environment Files

### Step 2: Update Your Local .env Files

**Update these files with your NEW database credentials:**

1. **Backend .env file:**
   ```bash
   # Navigate to backend directory
   cd volspike-nodejs-backend
   
   # Edit .env file (create if it doesn't exist)
   nano .env  # or use your preferred editor
   ```

   **Add/Update this line:**
   ```bash
   DATABASE_URL=postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

2. **Update Railway Production Environment:**
   - Go to: https://railway.app/
   - Navigate to your VolSpike backend project
   - Go to "Variables" tab
   - Find `DATABASE_URL` variable
   - Update it with your NEW connection string
   - Click "Save"

3. **Update Any Other Services:**
   - Check Digital Ocean (if you have the ingestion service there)
   - Update any CI/CD pipelines that use DATABASE_URL
   - Update any other deployment environments

---

## 🧹 PHASE 3: Remove Secret from Git History

**WARNING:** This rewrites Git history. If you're collaborating with others, they MUST re-clone the repository after this.

### Step 3: Install git-filter-repo

```bash
# On macOS
brew install git-filter-repo

# On Linux (Ubuntu/Debian)
sudo apt install git-filter-repo

# On Windows (use WSL or Git Bash)
# Follow: https://github.com/newren/git-filter-repo#installation
```

### Step 4: Clone Fresh Copy (CRITICAL - Don't skip this!)

```bash
# Navigate to a temporary directory
cd /tmp

# Clone a fresh copy (DO NOT use your current working directory!)
git clone git@github.com:NikolaySitnikov/VolSpike.git VolSpike_cleaned
cd VolSpike_cleaned
```

### Step 5: Remove Secret from Git History

```bash
# Remove the file containing the secret from ALL Git history
git filter-repo --path volspike-nodejs-backend/check-user-tier.ts --invert-paths --force

# This removes the file from every commit in history
# The --invert-paths flag keeps everything EXCEPT that file
```

**Alternative:** If you want to remove the secret but keep the file (with credentials removed):

```bash
# This is more complex - we'll use a different approach
# First, let's check what commits contain the secret
git log --all --full-history --source -- volspike-nodejs-backend/check-user-tier.ts

# Then use filter-repo to rewrite history with the secret removed
# But since we already fixed the file, we can just force push the fixed version
```

**Actually, since we already fixed the file, let's use a simpler approach:**

```bash
# Go back to your main project
cd /Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday\ Life/AI/VolumeFunding/VolSpike

# Commit the fixed file (without credentials)
git add volspike-nodejs-backend/check-user-tier.ts
git commit -m "security: remove hardcoded database credentials"

# Now use filter-repo to remove old versions with credentials
cd /tmp/VolSpike_cleaned

# Use filter-repo to rewrite history, removing the secret string
git filter-repo --replace-text <(echo "postgresql://neondb_owner:npg_vNnMZYxs0q5l@==>REMOVED_SECRET<==") --force
```

**Actually, the safest approach is to remove the file from history entirely:**

```bash
cd /tmp/VolSpike_cleaned

# Remove check-user-tier.ts from all history
git filter-repo --path volspike-nodejs-backend/check-user-tier.ts --invert-paths --force
```

### Step 6: Force Push Cleaned History

```bash
# WARNING: This overwrites GitHub history!
git push origin --force --all
git push origin --force --tags
```

### Step 7: Verify on GitHub

1. Go to: https://github.com/NikolaySitnikov/VolSpike
2. Search for: `npg_vNnMZYxs0q5l` (the old password)
3. It should return NO results
4. Check Git history of `check-user-tier.ts` - it should not exist in old commits

### Step 8: Update Your Local Repository

```bash
# Go back to your main project
cd /Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday\ Life/AI/VolumeFunding/VolSpike

# Fetch the cleaned history
git fetch origin

# Reset to match remote (WARNING: This discards local changes!)
git reset --hard origin/main

# Re-create check-user-tier.ts with the fixed version (it should already be there)
# Verify it has NO hardcoded credentials
cat volspike-nodejs-backend/check-user-tier.ts
```

### Step 9: Clean Up Temporary Clone

```bash
cd /tmp
rm -rf VolSpike_cleaned
```

---

## ✅ PHASE 4: Verify and Prevent Future Leaks

### Step 10: Verify .gitignore Files

**Root .gitignore** (already exists, verify it includes):
```gitignore
.env
.env.local
.env.*.local
```

**Backend .gitignore** (I just created it):
```gitignore
.env
.env.local
.env.*.local
.env.backup
.env.bak
```

**Frontend .gitignore** (verify it exists):
```bash
cat volspike-nextjs-frontend/.gitignore | grep -E "\.env"
```

### Step 11: Set Up Pre-commit Hooks (Optional but Recommended)

```bash
# Install pre-commit framework
pip install pre-commit

# Create .pre-commit-config.yaml in project root
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
EOF

# Initialize baseline
detect-secrets scan > .secrets.baseline

# Install hooks
pre-commit install
```

### Step 12: Verify with GitGuardian

1. Go to GitGuardian dashboard
2. Click "Fix This Secret Leak"
3. Wait for GitGuardian to re-scan your repository
4. The alert should be marked as resolved

---

## 📋 CHECKLIST

- [ ] ✅ Rotated PostgreSQL password in Neon dashboard
- [ ] ✅ Updated DATABASE_URL in local .env files
- [ ] ✅ Updated DATABASE_URL in Railway production
- [ ] ✅ Removed hardcoded credentials from check-user-tier.ts (DONE)
- [ ] ✅ Created backend .gitignore file (DONE)
- [ ] ✅ Removed secret from Git history using git-filter-repo
- [ ] ✅ Force pushed cleaned history to GitHub
- [ ] ✅ Verified secret is gone from GitHub
- [ ] ✅ Updated local repository
- [ ] ✅ Verified .gitignore files are correct
- [ ] ✅ GitGuardian alert is resolved

---

## 🚨 IMPORTANT REMINDERS

1. **NEVER commit .env files** - Always use environment variables
2. **NEVER hardcode credentials** - Always use process.env
3. **Use git-secrets or detect-secrets** - Pre-commit hooks prevent future leaks
4. **Rotate credentials immediately** - Don't wait if secrets are exposed
5. **Review all commits** - Check for other exposed secrets

---

## 🔍 Quick Verification Commands

```bash
# Check if secret still exists in current codebase
grep -r "npg_vNnMZYxs0q5l" .

# Check if .env files are in Git
git ls-files | grep -E "\.env$"

# Verify .gitignore is working
git check-ignore .env volspike-nodejs-backend/.env
```

---

**If you need help with any step, let me know!**

