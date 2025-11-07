# Ad Integration Guide for VolSpike

## 📋 Overview

The ad placeholder system is designed for **Free Tier users only** and is modular to allow easy integration with real ad providers.

---

## 🎯 Current Implementation

### **Ad Placement:**
- **Location:** Below the "Unlock Pro Features" banner, above main content
- **Visibility:** Free tier users only
- **Size:** Horizontal leaderboard (728x90 equivalent)
- **Style:** Matches VolSpike's design with gradients and shadows

### **Features:**
- ✅ **Dismissible** - Users can close the ad (persists per session)
- ✅ **"Upgrade to Pro"** CTA - Encourages conversion
- ✅ **Responsive** - Adapts to different screen sizes
- ✅ **Modular** - Easy to swap with real ad providers

---

## 🔌 Integration Options

### **Option 1: Google AdSense (Recommended)**

**Best for:** Automatic ad optimization, high fill rates, trusted by users

#### **Setup Steps:**

1. **Apply for Google AdSense:**
   - Visit: https://www.google.com/adsense/
   - Sign up with your VolSpike domain
   - Wait for approval (usually 1-3 days)

2. **Get Ad Code:**
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
        crossorigin="anonymous"></script>
   <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="YYYYYYYYYY"
        data-ad-format="horizontal"
        data-full-width-responsive="true"></ins>
   <script>
        (adsbygoogle = window.adsbygoogle || []).push({});
   </script>
   ```

3. **Update `ad-placeholder.tsx`:**

```tsx
'use client'

import { useEffect } from 'react'
import Script from 'next/script'

export function AdPlaceholder({ variant = 'horizontal' }: AdPlaceholderProps) {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, []);

  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      
      <Card className="relative overflow-hidden">
        <div className="p-2">
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
            data-ad-slot="YYYYYYYYYY"
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
      </Card>
    </>
  );
}
```

4. **Add to Next.js config** (`next.config.js`):
```js
module.exports = {
  // ... existing config
  images: {
    domains: ['pagead2.googlesyndication.com'],
  },
}
```

---

### **Option 2: Carbon Ads**

**Best for:** Tech/developer audience, clean aesthetic, privacy-focused

#### **Setup Steps:**

1. **Apply for Carbon Ads:**
   - Visit: https://www.carbonads.net/
   - Apply with your VolSpike domain
   - Wait for approval

2. **Get Embed Code:**
   ```html
   <script async type="text/javascript" src="//cdn.carbonads.com/carbon.js?serve=XXXXXX&placement=volspikecom" id="XXXXXX"></script>
   ```

3. **Update `ad-placeholder.tsx`:**

```tsx
import Script from 'next/script'

export function AdPlaceholder({ variant = 'horizontal' }: AdPlaceholderProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="p-4">
        <Script
          async
          type="text/javascript"
          src="//cdn.carbonads.com/carbon.js?serve=XXXXXX&placement=volspikecom"
          id="XXXXXX"
          strategy="afterInteractive"
        />
      </div>
    </Card>
  );
}
```

---

### **Option 3: EthicalAds**

**Best for:** Privacy-first, no tracking, developer-friendly

#### **Setup Steps:**

1. **Apply for EthicalAds:**
   - Visit: https://www.ethicalads.io/
   - Sign up as a publisher
   - Get approval

2. **Get Ad Code:**
   ```html
   <div data-ea-publisher="volspikecom" data-ea-type="image"></div>
   <script async src="https://media.ethicalads.io/media/client/ethicalads.min.js"></script>
   ```

3. **Update `ad-placeholder.tsx`:**

```tsx
import Script from 'next/script'

export function AdPlaceholder({ variant = 'horizontal' }: AdPlaceholderProps) {
  return (
    <>
      <Script
        async
        src="https://media.ethicalads.io/media/client/ethicalads.min.js"
        strategy="afterInteractive"
      />
      
      <Card className="relative overflow-hidden">
        <div className="p-4">
          <div data-ea-publisher="volspikecom" data-ea-type="image"></div>
        </div>
      </Card>
    </>
  );
}
```

---

## 📐 Ad Sizes Supported

The current `AdPlaceholder` component supports two variants:

### **Horizontal (Default):**
- Best for: Top/bottom placement
- Recommended size: 728x90 (Leaderboard) or 970x90 (Large Leaderboard)
- Current implementation: Full-width responsive

### **Vertical:**
- Best for: Sidebar placement
- Recommended size: 300x250 (Medium Rectangle) or 160x600 (Wide Skyscraper)
- To use: `<AdPlaceholder variant="vertical" />`

---

## 🎨 Customization

### **Change Placement:**

Currently placed in `dashboard.tsx` after the "Unlock Pro" banner:

```tsx
{/* Ad Placeholder for Free Tier Users */}
{userTier === 'free' && (
  <div className="animate-fade-in">
    <AdPlaceholder variant="horizontal" />
  </div>
)}
```

**Alternative placements:**
- **Footer:** Move to the bottom of `<main>`
- **Sidebar:** Use `variant="vertical"` and place in Volume Alerts area
- **Between sections:** Place between Market Data and other content

### **Change Style:**

Edit `ad-placeholder.tsx`:
- Adjust padding: Change `p-6` to `p-4` or `p-8`
- Change background: Modify gradient in `bg-gradient-to-r`
- Remove dismiss button: Delete the `X` button component

---

## 💰 Revenue Optimization Tips

1. **A/B Test Placement:**
   - Try above-the-fold vs. below-the-fold
   - Test sidebar vs. horizontal placement

2. **Use Multiple Ad Units:**
   - Horizontal banner at top
   - Vertical sidebar ad (if space allows)
   - Footer ad at bottom

3. **Monitor Performance:**
   - Track CTR (Click-Through Rate)
   - Monitor conversion to Pro tier
   - Use Google Analytics to track user behavior

4. **Balance UX and Revenue:**
   - Too many ads = users annoyed → upgrade or leave
   - Too few ads = low revenue
   - Sweet spot: 1-2 ads per page

---

## 🔒 Privacy & Compliance

### **GDPR Compliance:**
Add cookie consent before showing ads:

```tsx
import { useEffect, useState } from 'react'

export function AdPlaceholder() {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    setHasConsent(consent === 'accepted')
  }, [])

  if (!hasConsent) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Please accept cookies to view ads.
        </p>
      </Card>
    )
  }

  // Render ad...
}
```

### **Add Privacy Policy:**
Ensure your privacy policy mentions:
- Third-party ad providers
- Cookie usage
- User tracking
- Opt-out options

---

## 🧪 Testing

### **Test in Development:**

1. **With Placeholder:**
   ```bash
   npm run dev
   ```
   Login as free tier user, verify ad placeholder shows

2. **With Real Ads:**
   - Most ad providers have test mode
   - Use test publisher IDs during development
   - Switch to production IDs when deploying

### **Test Ad Blocking:**
```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    const adElement = document.querySelector('.adsbygoogle')
    if (adElement && adElement.innerHTML === '') {
      console.warn('Ad blocked detected')
      // Show fallback or alternative content
    }
  }, 2000)
  
  return () => clearTimeout(timer)
}, [])
```

---

## 📊 Performance Considerations

### **Lazy Loading:**
```tsx
'use client'

import dynamic from 'next/dynamic'

const AdPlaceholder = dynamic(() => import('@/components/ad-placeholder').then(mod => mod.AdPlaceholder), {
  loading: () => <div className="h-24 bg-muted/20 animate-pulse rounded-xl" />,
  ssr: false
})
```

### **Script Loading Strategy:**
- Use `strategy="afterInteractive"` for ads (current implementation)
- This ensures ads don't block initial page render
- Improves Lighthouse performance scores

---

## 🚀 Go Live Checklist

- [ ] Choose ad provider (Google AdSense recommended)
- [ ] Apply and get approved
- [ ] Get publisher ID and ad slot IDs
- [ ] Update `ad-placeholder.tsx` with real ad code
- [ ] Add privacy policy section about ads
- [ ] Add cookie consent banner (if not already present)
- [ ] Test on staging environment
- [ ] Monitor CTR and revenue in ad provider dashboard
- [ ] Track conversion rate (Free → Pro)
- [ ] Optimize placement based on data

---

## 📝 Current File Structure

```
volspike-nextjs-frontend/
├── src/
│   ├── components/
│   │   ├── ad-placeholder.tsx       # 🆕 Ad placeholder component
│   │   ├── ad-banner.tsx             # Existing "Unlock Pro" banner
│   │   └── dashboard.tsx             # Where ad is rendered
│   └── app/
│       └── (dashboard)/
│           └── page.tsx
```

---

## 🆘 Troubleshooting

### **Ads Not Showing:**
1. Check browser console for errors
2. Verify publisher ID is correct
3. Check ad provider dashboard for approval status
4. Ensure domain is added to ad provider whitelist
5. Check if ad blocker is active

### **Layout Breaks:**
1. Wrap ad in fixed-height container
2. Add `min-height` to prevent layout shift
3. Use skeleton loader while ad loads

### **Revenue Too Low:**
1. Increase ad visibility (better placement)
2. Add more ad units (don't overdo it)
3. Try different ad providers
4. Optimize for higher CPC keywords

---

## 💡 Next Steps

1. **Apply to ad provider** (start with Google AdSense)
2. **Get approved** (usually takes 1-3 days)
3. **Replace placeholder** with real ad code
4. **Monitor performance** for first week
5. **Optimize** based on data
6. **Track Pro conversions** to balance ad revenue vs. subscription revenue

---

**Questions?** Check the ad provider's documentation or reach out to their support team for integration help!

