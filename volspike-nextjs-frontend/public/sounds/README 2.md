# VolSpike Alert Sounds

This directory contains the professional alert sound file for the VolSpike trading dashboard.

## 📁 Required File

Place your MP3 file in this directory:

```
public/sounds/
└── alert.mp3       # Single alert sound for all notification types
```

**Note**: VolSpike uses **one unified sound** for all alert types (spike, 30m update, hourly update). This creates a consistent audio brand and simplifies the user experience.

## 🔊 Sound Specifications

### `alert.mp3` (Universal Alert Sound)
- **Purpose**: Notifies user of all volume alerts (spike, 30m update, hourly update)
- **Character**: Professional, attention-grabbing but not annoying
- **Duration**: 200-400ms (short and snappy)
- **Pitch**: Mid (500-1000Hz)
- **Volume**: Moderate (comfortable for repeated listening)
- **Style**: Bloomberg Terminal-style notification, professional chime
- **References**: TradingView alert, Slack notification, "Confident" tone
- **When**: Any volume alert (spike, update, or hourly refresh)

**Design Principle**: One consistent sound creates a **unified audio brand** and prevents alert fatigue. Users recognize the sound instantly without needing to distinguish between types (visual alerts already show the type).

## 📋 Technical Requirements

### File Format
- **Primary**: MP3 (MPEG-1 Audio Layer 3)
- **Sample Rate**: 44.1 kHz
- **Bit Rate**: 128 kbps minimum (192 kbps preferred)
- **Channels**: Mono (stereo acceptable but mono is smaller)
- **File Size**: < 50KB per file

### Audio Quality
- **Loudness**: Normalized to -6dB peak
- **Dynamics**: Light compression for consistent volume
- **EQ**: Slight high-shelf boost for clarity on laptop speakers
- **Format**: No clipping, clean attack/release

### Browser Compatibility
- Works in Chrome, Firefox, Safari, Edge
- Mobile-friendly (iOS Safari, Android Chrome)
- Respects system autoplay policies

## 🎵 Current Status

**Status**: ⚠️ **Using Web Audio API Fallback**

The application currently uses synthesized sounds from the Web Audio API as a fallback. This is a temporary placeholder until your professional MP3 file is added.

**Next Steps**:
1. Download your chosen sound from NotificationSounds.com (MP3 format)
2. Save it as `alert.mp3` in this directory
3. Test locally (`npm run dev`)
4. Deploy to production (`git push`)

## 🧪 Testing

Once the MP3 file is added, test it using:

```
1. Go to: https://volspike.com/dashboard?debug=true
2. Sign in with any account
3. Scroll to Volume Alerts panel
4. Look for yellow "Test Mode" panel
5. Click any test button to hear the alert sound:
   - "Test Spike Sound" → alert.mp3
   - "Test 30m Update" → alert.mp3
   - "Test Hourly Update" → alert.mp3
   
Or create test alerts and click them:
   - Click any "Create Test Alert" button
   - Click the created alert card to hear sound
```

## 📚 References

- **Full Design Brief**: See `/SOUND_DESIGN_BRIEF.md` in project root
- **Implementation**: See `/volspike-nextjs-frontend/src/hooks/use-alert-sounds.ts`
- **UI Integration**: See `/volspike-nextjs-frontend/src/components/volume-alerts-panel.tsx`

## 🛠️ Fallback Behavior

If the MP3 file is not present, the system automatically falls back to Web Audio API synthesized sounds. This ensures the application continues to work, but the sounds will be less professional.

**Fallback Sounds** (type-specific for variety):
- Spike: Two-tone sine wave (800Hz → 1000Hz)
- 30m Update: Descending sine wave (600Hz → 400Hz)
- Hourly Update: Single sine wave (500Hz)

**Note**: Once `alert.mp3` is added, **all alerts will use the same professional sound** (fallback is no longer used).

## 💡 Tips for Sound Designers

### What We Want
- **Professional trading platform aesthetic** (Bloomberg Terminal, TradingView)
- **Subtle but distinct** - recognizable without being annoying
- **Not gamified** - avoid video game or playful sounds
- **Office-appropriate** - can be used in professional settings
- **Mobile-friendly** - sounds good on phone speakers

### What to Avoid
- Cheap beeps or buzzes
- Video game sounds (coins, level-ups, power-ups)
- Long or complex melodies
- Harsh or jarring tones
- Frequencies that cause listener fatigue

## 📞 Contact

Questions about sound requirements? See `SOUND_DESIGN_BRIEF.md` or contact support@volspike.com

---

*Last Updated: November 5, 2025*
*Status: Awaiting professional MP3 files*

