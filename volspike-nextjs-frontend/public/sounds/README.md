# VolSpike Alert Sounds

This directory contains professional alert sound files for the VolSpike trading dashboard.

## 📁 Required Files

Place the following MP3 files in this directory:

```
public/sounds/
├── spike-alert.mp3       # New volume spike (urgent, attention-grabbing)
├── half-update.mp3       # 30-minute update (softer, informative)
└── full-update.mp3       # Hourly update (gentle, subtle)
```

## 🔊 Sound Specifications

### 1. `spike-alert.mp3` (Volume Spike Alert)
- **Purpose**: Notifies user of new significant volume spike (most important alert)
- **Character**: Urgent, attention-grabbing, confident
- **Duration**: 250-400ms
- **Pitch**: Mid-high (600-1200Hz)
- **Volume**: 100% (loudest of three)
- **Style**: Bloomberg Terminal-style chime, professional notification sound
- **References**: TradingView price alert, Slack notification
- **When**: First detection of 3x+ volume increase

### 2. `half-update.mp3` (30-Minute Update)
- **Purpose**: Updates existing alert at 30-minute mark
- **Character**: Softer, informative, less intrusive
- **Duration**: 150-250ms
- **Pitch**: Mid (400-800Hz)
- **Volume**: 70% of spike volume
- **Style**: Gentle pop or soft woodblock tap
- **References**: macOS "Pop" sound, Notion notification
- **When**: Mid-hour check-in for already-alerted assets

### 3. `full-update.mp3` (Hourly Update)
- **Purpose**: Routine hourly refresh (least urgent)
- **Character**: Subtle, gentle, background-appropriate
- **Duration**: 100-200ms
- **Pitch**: Low-mid (300-600Hz)
- **Volume**: 50% of spike volume
- **Style**: Soft bell ping, gentle reminder
- **References**: iOS "Tink", calendar reminder tone
- **When**: Top-of-hour update for tracked assets

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

The application currently uses synthesized sounds from the Web Audio API as a fallback. These are temporary placeholders until professional MP3 files are added.

**Next Steps**:
1. Consult with audio expert using `SOUND_DESIGN_BRIEF.md`
2. Receive 3 professional MP3 files
3. Add files to this directory
4. Test in debug mode (`?debug=true`)
5. Deploy to production

## 🧪 Testing

Once MP3 files are added, test them using:

```
1. Go to: https://volspike.com/dashboard?debug=true
2. Sign in with any account
3. Scroll to Volume Alerts panel
4. Look for yellow "Test Mode" panel
5. Click test buttons:
   - "Test Spike Sound" → spike-alert.mp3
   - "Test 30m Update" → half-update.mp3
   - "Test Hourly Update" → full-update.mp3
```

## 📚 References

- **Full Design Brief**: See `/SOUND_DESIGN_BRIEF.md` in project root
- **Implementation**: See `/volspike-nextjs-frontend/src/hooks/use-alert-sounds.ts`
- **UI Integration**: See `/volspike-nextjs-frontend/src/components/volume-alerts-panel.tsx`

## 🛠️ Fallback Behavior

If MP3 files are not present, the system automatically falls back to Web Audio API synthesized sounds. This ensures the application continues to work, but the sounds will be less professional.

**Fallback Sounds**:
- Spike: Two-tone sine wave (800Hz → 1000Hz)
- Half Update: Descending sine wave (600Hz → 400Hz)
- Full Update: Single sine wave (500Hz)

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

