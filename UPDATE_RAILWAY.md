# 🚂 Update Database Password in Railway

## Step-by-Step Instructions

### Step 1: Go to Railway Dashboard

1. Open your browser
2. Go to: https://railway.app/
3. Sign in to your Railway account

### Step 2: Find Your Backend Project

1. In Railway dashboard, you should see your projects
2. Find and click on your **VolSpike backend** project
   - It might be named something like "volspike-backend" or "volspike-nodejs-backend"

### Step 3: Go to Variables

1. Once in your project, look for tabs at the top:
   - **Variables** (this is what you need)
   - Or **Settings** → **Variables**
   - Or look for an "Environment Variables" section

2. Click on **Variables** tab

### Step 4: Find DATABASE_URL

1. In the Variables list, look for `DATABASE_URL`
2. You should see it in the list with the old password visible (or masked)

### Step 5: Edit DATABASE_URL

1. Click on `DATABASE_URL` to edit it
2. You'll see the full connection string:
   ```
   postgresql://neondb_owner:OLD_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

3. **Replace the old password** (`npg_xrRg5IhoZa6d` or whatever was there) with your **NEW password** from Neon

4. The new connection string should look like:
   ```
   postgresql://neondb_owner:YOUR_NEW_PASSWORD@ep-snowy-sunset-ahlodmvx-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

5. Click **Save** or **Update**

### Step 6: Verify Deployment

1. Railway should automatically redeploy when you change environment variables
2. Go to **Deployments** tab
3. You should see a new deployment starting
4. Wait for it to complete (usually 1-2 minutes)

### Step 7: Check Logs (Optional)

1. Go to **Deployments** → Click on the latest deployment
2. Click **View Logs**
3. Look for any database connection errors
4. If you see connection errors, double-check the password

---

## ✅ Quick Checklist

- [ ] Opened Railway dashboard
- [ ] Found backend project
- [ ] Went to Variables tab
- [ ] Found `DATABASE_URL`
- [ ] Replaced old password with new password
- [ ] Saved changes
- [ ] Verified deployment completed
- [ ] Checked logs (no errors)

---

## 🆘 Troubleshooting

### Can't Find Variables Tab?

- Look for **Settings** → **Variables**
- Or **Environment** → **Variables**
- Or click on your service → **Variables**

### Password Not Working?

1. Double-check you copied the entire new password (no spaces)
2. Make sure you're using the password from Neon (not the old one)
3. Check Railway logs for specific error messages

### Deployment Failed?

1. Check Railway logs for errors
2. Verify the connection string format is correct
3. Make sure there are no extra spaces or characters

---

**Once Railway is updated, your backend will automatically reconnect with the new password!**

