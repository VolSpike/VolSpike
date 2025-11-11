# How to Get Fresh Connection String After Password Reset

## Issue: Connection string still shows old password

If you see the old password in the connection string, try these steps:

### Step 1: Verify Password Was Actually Changed

1. **Go to Neon Dashboard Settings:**
   - Click on your project name at the top
   - Go to "Settings" or "Project Settings"
   - Look for "Database" or "Connection" settings
   - Check if there's a "Reset Password" or "Change Password" option

2. **Try to Reset Password Again:**
   - If you see "Reset Password", click it
   - Generate a NEW password
   - **Important:** Make sure you click "Save" or "Apply" after generating

### Step 2: Get Fresh Connection String

**Option A: Regenerate Connection String**
1. In the "Connect" modal, look for a "Regenerate" or "Refresh" button
2. Or close the modal and click "Connect" again
3. The connection string should update with the new password

**Option B: Use Separate Fields**
1. In the "Connect" modal, look for separate fields:
   - Host
   - Database
   - User
   - Password (this should show your NEW password)
2. Copy each field and construct the connection string manually:
   ```
   postgresql://USERNAME:PASSWORD@HOST/DATABASE?sslmode=require&channel_binding=require
   ```

**Option C: Check Roles & Databases Tab**
1. Click on "Roles & Databases" tab (next to "Computes")
2. Find your database user (likely `neondb_owner`)
3. There might be a "Reset Password" option there
4. Reset it and get the new connection string

### Step 3: Test the Connection

Once you have the new connection string, test it:

```bash
# Test connection (replace with your new connection string)
psql 'postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

If it connects successfully, you have the right password!

### Step 4: Alternative - Check Email

1. Check your email inbox for emails from Neon
2. They might have sent you the new connection string after password reset
3. Look for subject like "Password reset" or "Database credentials updated"

---

## Quick Checklist

- [ ] Did you click "Save" after generating new password?
- [ ] Did you refresh the page after password reset?
- [ ] Are you looking at the correct database branch?
- [ ] Did you check the "Roles & Databases" tab?
- [ ] Did you check your email for Neon notifications?

---

## If Still Showing Old Password

1. **Try logging out and back into Neon**
2. **Clear browser cache** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. **Try incognito/private browsing mode**
4. **Contact Neon support** if the issue persists

Let me know what you see when you try these steps!

