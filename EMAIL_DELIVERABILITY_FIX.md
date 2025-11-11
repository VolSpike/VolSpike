# Email Deliverability Fix Guide - Gmail "Suspicious" Flag

## Why Gmail Flags Emails as Suspicious

Gmail shows "This message appears suspicious" and hides images when emails fail certain security checks. Here's why it happens and how to fix it:

---

## 🔴 Critical Issues (Must Fix)

### 1. **Missing or Incorrect Email Authentication (SPF/DKIM/DMARC)**

**Problem:** Gmail checks if your domain has proper email authentication records. Without them, emails are flagged as suspicious.

**How to Fix:**

#### Step 1: Set Up Domain Authentication in SendGrid
1. Log in to SendGrid Dashboard: https://app.sendgrid.com
2. Go to **Settings → Sender Authentication**
3. Click **Authenticate Your Domain**
4. Enter `volspike.com` (or your domain)
5. Select your DNS provider (e.g., Vercel, Cloudflare, Namecheap)
6. SendGrid will provide DNS records to add

#### Step 2: Add DNS Records
You'll need to add these records to your domain's DNS:

**SPF Record:**
```
Type: TXT
Name: @ (or volspike.com)
Value: v=spf1 include:sendgrid.net ~all
TTL: 3600
```

**DKIM Records:**
SendGrid will provide 3 CNAME records like:
```
Type: CNAME
Name: s1._domainkey.volspike.com
Value: s1.domainkey.u1234567.wl123.sendgrid.net
TTL: 3600
```

**DMARC Record:**
```
Type: TXT
Name: _dmarc.volspike.com
Value: v=DMARC1; p=none; rua=mailto:dmarc@volspike.com
TTL: 3600
```

#### Step 3: Verify in SendGrid
- Wait 24-48 hours for DNS propagation
- Check SendGrid Dashboard → Domain Authentication status
- Should show ✅ **Verified**

#### Step 4: Verify DNS Records
Use these tools to verify your records are correct:
- **SPF Checker:** https://mxtoolbox.com/spf.aspx
- **DKIM Checker:** https://mxtoolbox.com/dkim.aspx
- **DMARC Checker:** https://mxtoolbox.com/dmarc.aspx

---

### 2. **Sender Email Not Verified**

**Problem:** `noreply@volspike.com` must be verified in SendGrid.

**How to Fix:**
1. SendGrid Dashboard → **Settings → Sender Authentication**
2. If using **Domain Authentication** (recommended): The entire domain is verified, so `noreply@volspike.com` works automatically
3. If using **Single Sender Verification**: Verify `noreply@volspike.com` individually
4. Ensure `SENDGRID_FROM_EMAIL=noreply@volspike.com` matches the verified sender

---

### 3. **Low Domain Reputation**

**Problem:** New domains or domains with low email volume get flagged more often.

**How to Fix:**
- **Warm up your domain:** Start sending small volumes (10-20 emails/day) and gradually increase
- **Use Domain Authentication** (not Single Sender) - builds better reputation
- **Monitor SendGrid Activity Feed** - ensure high delivery rates
- **Avoid spam triggers:** Don't send to invalid emails, maintain low bounce rates

---

## 🟡 Important Issues (Should Fix)

### 4. **External Image Hosting**

**Problem:** Images hosted on `volspike.com` might not load if domain reputation is low.

**Current Setup:**
- Image URL: `https://volspike.com/email/volspike-badge@2x.png`

**How to Fix:**
- **Option 1:** Use SendGrid's image hosting (recommended)
  - Upload image to SendGrid → Content → Images
  - Use SendGrid's CDN URL in email template
- **Option 2:** Use a CDN (Cloudflare, Cloudinary)
  - Better caching and reliability
- **Option 3:** Embed image as base64 (not recommended - increases email size)

**Temporary Fix:** The email template now includes proper `alt` text, so if images don't load, users still see "VolSpike" text.

---

### 5. **Email Template Structure**

**Problem:** Simple HTML emails without proper email client compatibility can trigger filters.

**What I Fixed:**
✅ Added proper email meta tags (`x-apple-disable-message-reformatting`, `format-detection`)
✅ Added preheader text (hidden preview text)
✅ Added Outlook/MSO compatibility (VML fallback for buttons)
✅ Improved responsive design with media queries
✅ Changed background from dark (`#0f172a`) to light (`#f1f5f9`) - better for email clients
✅ Added proper plain text version
✅ Added `replyTo` header
✅ Added email categories and custom args for tracking

**Status:** ✅ **FIXED** - Email template now matches verification email structure

---

## 🟢 Additional Improvements

### 6. **Email Headers**

**What I Added:**
- `replyTo: support@volspike.com` - Allows users to reply
- `categories: ['password-reset']` - Helps SendGrid track email types
- `customArgs` - For tracking and analytics

---

### 7. **Monitor Email Deliverability**

**Tools to Use:**
1. **SendGrid Activity Feed:**
   - Check delivery rates
   - Monitor bounces, blocks, spam reports
   - Review open/click rates

2. **Mail-Tester:** https://www.mail-tester.com
   - Send test email to get spam score (aim for 9-10/10)
   - Identifies specific issues

3. **Gmail Postmaster Tools:** https://postmaster.google.com
   - Add `volspike.com` domain
   - Monitor Gmail-specific deliverability
   - Check spam rate, IP reputation

---

## 📋 Action Items Checklist

### Immediate (Critical):
- [ ] Set up **Domain Authentication** in SendGrid for `volspike.com`
- [ ] Add **SPF record** to DNS
- [ ] Add **DKIM records** (3 CNAME records) to DNS
- [ ] Add **DMARC record** to DNS
- [ ] Wait 24-48 hours for DNS propagation
- [ ] Verify all records in SendGrid Dashboard
- [ ] Test email delivery with Mail-Tester

### Short-term (Important):
- [ ] Set up **Gmail Postmaster Tools** for `volspike.com`
- [ ] Monitor **SendGrid Activity Feed** for delivery issues
- [ ] Consider moving email images to SendGrid CDN or Cloudflare
- [ ] Warm up domain by sending small volumes initially

### Long-term (Best Practices):
- [ ] Build domain reputation over time (consistent sending)
- [ ] Monitor spam complaint rates (keep < 0.1%)
- [ ] Maintain low bounce rates (< 2%)
- [ ] Use consistent sender name and email
- [ ] Avoid spam trigger words in subject lines

---

## 🧪 Testing After Fixes

### Test Email Deliverability:
1. Send password reset email to your Gmail account
2. Check if "suspicious" warning is gone
3. Verify images load automatically
4. Check email appears in inbox (not spam)

### Use Mail-Tester:
1. Go to https://www.mail-tester.com
2. Get test email address
3. Send password reset email to that address
4. Check spam score (should be 9-10/10)
5. Review specific issues if score is lower

---

## 📚 Resources

- **SendGrid Domain Authentication:** https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication
- **SPF Record Guide:** https://www.sendgrid.com/blog/what-is-an-spf-record/
- **DKIM Guide:** https://www.sendgrid.com/blog/what-is-dkim/
- **DMARC Guide:** https://www.sendgrid.com/blog/what-is-dmarc/
- **Gmail Postmaster Tools:** https://postmaster.google.com
- **Mail-Tester:** https://www.mail-tester.com

---

## Summary

**Main Issue:** Gmail flags emails as suspicious because:
1. ❌ **Missing SPF/DKIM/DMARC records** (most critical)
2. ❌ **Domain not authenticated in SendGrid**
3. ⚠️ **Low domain reputation** (new domain)
4. ✅ **Email template structure** (now fixed)

**Priority Fix:** Set up Domain Authentication in SendGrid and add DNS records. This will resolve 80% of deliverability issues.

**Timeline:** DNS changes take 24-48 hours to propagate. After that, emails should no longer be flagged as suspicious.

