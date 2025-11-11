# Git History Cleanup - Step by Step

## ✅ Step 1: Clone Complete!

The repository has been cloned to `/tmp/VolSpike_cleaned`

---

## 📋 Next Steps

### Step 2: Install git-filter-repo (if not installed)

```bash
brew install git-filter-repo
```

### Step 3: Remove Secret from Git History

```bash
cd /tmp/VolSpike_cleaned

# Remove the file containing the secret from ALL Git history
git filter-repo --path volspike-nodejs-backend/check-user-tier.ts --invert-paths --force
```

### Step 4: Force Push Cleaned History

**⚠️ WARNING: This overwrites GitHub history!**

```bash
# Push cleaned history to GitHub
git push origin --force --all
git push origin --force --tags
```

**Note:** Since we used HTTPS, GitHub might ask for your username/password or personal access token.

### Step 5: Update Your Local Repository

```bash
# Go back to your main project
cd /Users/nikolaysitnikov/Documents/Documents_Nik_MacBook/Everyday\ Life/AI/VolumeFunding/VolSpike

# Fetch the cleaned history
git fetch origin

# Reset to match remote
git reset --hard origin/main
```

### Step 6: Clean Up

```bash
# Delete the temporary clone
cd /tmp
rm -rf VolSpike_cleaned
```

---

## 🎯 Ready to Continue?

Run these commands one by one:

1. `brew install git-filter-repo` (if needed)
2. `cd /tmp/VolSpike_cleaned`
3. `git filter-repo --path volspike-nodejs-backend/check-user-tier.ts --invert-paths --force`
4. `git push origin --force --all`
5. `git push origin --force --tags`
6. Update your local repo (commands above)

Let me know when you're ready for the next step!

