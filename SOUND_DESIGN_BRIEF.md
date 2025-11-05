# 🎵 VolSpike Alert Sound Design Brief

## Project Overview

**Product**: VolSpike - Professional cryptocurrency trading dashboard  
**Feature**: Real-time volume spike alert notifications  
**Goal**: Create distinctive, professional alert sounds that enhance the trading experience  

---

## 🎯 What We Need

**Three unique notification sounds** for different alert types in a crypto trading dashboard.

---

## 🔔 Sound 1: Volume Spike Alert (PRIMARY)

### Context:
This plays when a **new volume spike** is detected (current hourly volume is 3x+ previous hour). This is the **most important** alert - something significant is happening in the market.

### Requirements:
- **Duration**: 250-400ms
- **Character**: Confident, urgent, professional, attention-grabbing
- **Pitch Range**: Mid-high (600-1200Hz)
- **Feel**: "Something important just happened - check now!"
- **Volume**: Loudest of the three (but not jarring)

### Reference Sounds:
- Bloomberg Terminal notification chime
- TradingView price alert
- Short marimba hit with warm resonance
- Professional desk bell "ding"

### What to Avoid:
- ❌ Cheap electronic beeps
- ❌ Harsh or piercing tones
- ❌ Gamified sounds (coins, level-up, etc.)
- ❌ Too long or musical (this is data, not entertainment)

---

## 🔄 Sound 2: 30-Minute Update (SECONDARY)

### Context:
This plays when an **already-alerted asset** gets a 30-minute update. It's informative but less urgent than the initial spike.

### Requirements:
- **Duration**: 150-250ms
- **Character**: Informative, softer, professional
- **Pitch Range**: Mid (400-800Hz)
- **Feel**: "Here's an update on something you're watching"
- **Volume**: 70% of spike alert volume

### Reference Sounds:
- Gentle woodblock tap
- Soft notification "pop"
- Muted chime
- Subtle click or tick

### What to Avoid:
- ❌ Too similar to spike alert (must be distinguishable)
- ❌ Annoying (users might hear this frequently)
- ❌ Too loud or attention-demanding

---

## ⏰ Sound 3: Hourly Update (TERTIARY)

### Context:
This plays for **hourly updates** on tracked assets. It's the most subtle - just a gentle reminder that data refreshed.

### Requirements:
- **Duration**: 100-200ms
- **Character**: Subtle, gentle, background-appropriate
- **Pitch Range**: Low-mid (300-600Hz)
- **Feel**: "FYI, hourly refresh happened"
- **Volume**: 50% of spike alert volume

### Reference Sounds:
- Soft bell tone (single ping)
- Gentle tick
- Muted notification beep
- Calm reminder tone

### What to Avoid:
- ❌ Too loud (should blend into background)
- ❌ Distracting (users focus on trading)
- ❌ Similar to other two alerts

---

## 📊 Comparative Table

| Alert Type | Urgency | Duration | Pitch | Volume | Character |
|------------|---------|----------|-------|--------|-----------|
| **Spike** | HIGH | 250-400ms | 600-1200Hz | 100% | Exciting, confident |
| **30m Update** | MEDIUM | 150-250ms | 400-800Hz | 70% | Informative, softer |
| **Hourly Update** | LOW | 100-200ms | 300-600Hz | 50% | Subtle, gentle |

---

## 🎨 Design Philosophy

### The Trading Floor Aesthetic:
- **Professional**: Like Bloomberg, Reuters, TradingView
- **Non-intrusive**: Can be heard 100+ times without annoyance
- **Distinctive**: Each sound immediately recognizable
- **Premium**: Reflects a $9-49/month product value

### Sound Personality:
- **Sharp but warm** (not cold or robotic)
- **Confident but not aggressive** (data, not alarm)
- **Unique but familiar** (trading platform, not generic notification)
- **Subtle but noticeable** (background-friendly, not intrusive)

---

## 📁 Technical Specifications

### File Format:
- **Primary**: MP3 (best browser compatibility)
- **Alternative**: WebM (smaller file size, modern browsers)
- **Fallback**: OGG (for older browsers - optional)

### Audio Quality:
- **Sample Rate**: 44.1kHz (CD quality)
- **Bit Rate**: 128kbps minimum (192kbps preferred for quality)
- **Channels**: Mono (sufficient for UI sounds, smaller file size)
- **File Size**: < 50KB each (for fast loading)

### Loudness:
- **Peak**: -6dB to -3dB (leaves headroom, prevents clipping)
- **Normalization**: All three sounds should be normalized relative to each other
- **Dynamic Range**: Consistent across all three files

---

## 🎧 Testing & Iteration

### What Good Sounds Should Feel Like:
1. **Spike Alert**: "Oh! Something's happening - let me check"
2. **30m Update**: "Okay, update noted"
3. **Hourly Update**: "Mm-hmm, refresh completed"

### Red Flags (Send Back for Revision):
- ❌ Sounds like a system error
- ❌ Sounds like a video game
- ❌ Sounds annoying after 3rd play
- ❌ Sounds can't tell apart
- ❌ Sounds too long (>500ms)

---

## 💰 Budget Guidance

### Quality Levels:

**Budget Option** ($0-20):
- Use royalty-free sound libraries (Zapsplat, Notification Sounds)
- Edit/customize existing sounds
- May need attribution

**Professional Option** ($50-200):
- Custom sound design from Fiverr/Upwork
- Original, unique to VolSpike
- Full rights, no attribution

**Premium Option** ($500+):
- Professional audio studio
- Multiple iterations
- Audio branding package
- Complete sonic identity

**Recommendation**: Start with professional option ($50-200) for custom, high-quality sounds that match your brand.

---

## 🔗 Resources for Sound Designer

### Inspiration Examples:
- **TradingView**: Alert sound when price target hit
- **Bloomberg Terminal**: Message notification
- **Slack**: Message received (but more professional)
- **macOS**: "Glass" notification sound (elegant)
- **iOS**: "Note" notification (clean, pleasant)

### Where to Find Designers:
1. **Fiverr**: Search "notification sound design" or "UI sound effects"
2. **Upwork**: Post job "Trading Platform Alert Sounds"
3. **Soundstripe/Artlist**: Royalty-free libraries (subscription)

### Keywords for Search:
- "Professional notification sounds"
- "Trading platform alerts"
- "Financial app UI sounds"
- "Minimal notification chimes"
- "Corporate alert sounds"

---

## 📋 Deliverables Expected

### From Sound Designer:
1. **Three audio files**:
   - `spike-alert.mp3` (new volume spike)
   - `half-update.mp3` (30-minute update)
   - `full-update.mp3` (hourly update)

2. **Alternative formats** (optional):
   - `.webm` versions (for file size optimization)
   - `.ogg` versions (for older browser compatibility)

3. **Documentation**:
   - Usage rights confirmation
   - Attribution requirements (if any)
   - Source files (WAV/AIFF at 44.1kHz) for future edits

### File Naming Convention:
```
spike-alert.mp3       // Primary spike notification
half-update.mp3       // 30-minute update
full-update.mp3       // Hourly update
```

---

## 🎯 Implementation Plan (After Receiving Files)

### Step 1: Receive Files
You provide the 3 sound files from the designer

### Step 2: I'll Implement
```typescript
// Replace Web Audio API with file playback
const audio = new Audio('/sounds/spike-alert.mp3')
audio.volume = userVolumeSetting
audio.play()
```

### Step 3: Test
Use the debug mode test buttons to preview

### Step 4: Deploy
Push to production when you approve

---

## 📞 Questions for Sound Expert

**Share this with your sound designer:**

1. **Can you create 3 distinct notification sounds** for a cryptocurrency trading dashboard?
2. **Specifications**: 
   - MP3 format, < 50KB each
   - 100-400ms duration
   - Professional, trading-floor appropriate
   - NOT generic beeps or chimes
3. **Deliverables**: 3 MP3 files + usage rights
4. **Timeline**: When can you deliver?
5. **Cost**: What's your rate?
6. **Revisions**: How many rounds of feedback included?

---

## 🎨 Creative Direction Summary

**In One Sentence:**  
We need three sophisticated, Bloomberg-Terminal-like notification sounds that traders will hear hundreds of times without getting annoyed - each distinctly recognizable by urgency level.

**Mood Board:**
- Financial news networks (Bloomberg, CNBC)
- Professional trading platforms (TradingView, Interactive Brokers)
- High-end productivity apps (Notion, Linear)
- macOS/iOS system sounds (polished, refined)

**NOT Like:**
- Video game sounds
- Cheap app notifications
- System error beeps
- Quirky or playful tones

---

## ✅ Success Criteria

**The sounds are successful if:**
1. ✅ Can immediately tell which type of alert without looking
2. ✅ Don't get annoying after hearing 50+ times
3. ✅ Sound professional on $2000 speakers and $20 earbuds
4. ✅ Colleagues hear them and think "professional" not "cheap"
5. ✅ Would fit in a Bloomberg Terminal interface
6. ✅ Make users feel like they're using premium software

---

**Share this document with your sound expert and they'll know exactly what to create!** 🎵

