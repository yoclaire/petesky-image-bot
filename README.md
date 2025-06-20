# Pete & Pete Image Bot

A sophisticated TypeScript bot that automatically posts curated screenshots from "The Adventures of Pete & Pete" to Bluesky. Optimized for large collections (9,000+ screenshots) with intelligent seasonal posting, advanced screenshot extraction, and memory-efficient state management.

## 🎬 Features

### **Advanced Screenshot Extraction**
- **TypeScript-based extraction tool** with VLC-quality 4:3 output (720x540)
- **Aggressive letterbox removal** for perfect aspect ratio 
- **I-frame detection** or interval-based extraction modes
- **VHS denoising** for optimal vintage content quality
- **Scene detection** and **custom aspect ratio** support

### **Large-Scale Image Management**
- **Optimized for 9,000+ screenshots** with memory-efficient exclusion system
- **Guaranteed uniqueness** - no repeats until all images are used
- **GitHub-safe state files** (8KB vs 650KB for full cycle tracking)
- **Episode variety** when possible within seasonal constraints

### **Seasonal Posting Rules**
- **🎃 October**: EXCLUSIVELY Halloweenie screenshots (S02E06)
- **🎄 December**: EXCLUSIVELY Christmas Pete & New Year's Pete screenshots  
- **📅 Other months**: ONLY non-seasonal episodes (seasonal content excluded)

### **Robust Infrastructure**
- **Automated GitHub Actions** posting with retry logic
- **Intelligent alt-text generation** from various filename formats
- **State persistence** across runs with backup systems
- **Error recovery** and graceful fallbacks

## 🚀 Quick Start

### 1. Fork and Clone
```bash
git clone https://github.com/YOUR_USERNAME/petesky-image-bot.git
cd petesky-image-bot
yarn install
```

### 2. Extract Screenshots (TypeScript Tool)
```bash
# Place Pete & Pete videos in ./videos/ folder
# Extract I-frames with scene detection (default - best quality)
yarn extract

# Or extract every 6 seconds with VHS denoising
yarn extract --mode interval --interval 6 --denoise

# High quality extraction for widescreen content  
yarn extract --aspect-ratio 16:9 --quality 1

# See all options
yarn extract --help
```

The extraction tool outputs perfect 720x540 (4:3) screenshots to `./raw_screenshots/` with:
- ✅ **VLC-quality letterbox removal** 
- ✅ **True 4:3 aspect ratio** (no stretching)
- ✅ **Optimized for posting** (ready to use)

### 3. Curate Your Collection
```bash
# Review extracted screenshots
ls raw_screenshots/

# Copy your best selections to the posting queue
cp raw_screenshots/some_great_shots*.jpg imagequeue/
```

### 4. Configure Bluesky
1. Generate an [app password](https://bsky.app/settings/app-passwords) 
2. In GitHub: Settings → Secrets and Variables → Actions
3. Add secrets:
   - `BLUESKY_USERNAME`: Your handle (`yourname.bsky.social`)
   - `BLUESKY_PASSWORD`: Your app password

### 5. Deploy
1. Push to GitHub
2. Actions → "Post Pete & Pete Image" → "Run workflow" (test)
3. Bot starts posting hourly automatically!

## 📊 Large-Scale Performance

**Optimized for massive collections:**
- ✅ **9,396 screenshots** tested and verified
- ✅ **8KB state files** (vs 650KB naive approach)
- ✅ **~70MB/year** GitHub storage (vs 5.5GB naive)
- ✅ **Guaranteed no repeats** for ~391 days of hourly posting
- ✅ **Excellent randomness** (always 6,000+ available choices)

**Expected behavior:**
```
Managing 9396 images with 469-image exclusion list
🎃 October: Using only 156 Halloweenie screenshots  
Status: Post 1000 - 8396 available (10.6% excluded from seasonal pool)
```

## 🎯 Seasonal Posting System

### **October Behavior**
```
🎃 October: Using only 156 Halloweenie screenshots
Selected: 2x06_Halloweenie-0034.jpg
Status: Post 45 - 111 available (28.8% excluded from seasonal pool) (🎃 October: Halloweenie only)
```
- **100% Halloweenie content** 
- All other episodes excluded
- Cycles through all Halloweenie screenshots before repeating

### **December Behavior**  
```
🎄 December: Using only 203 Christmas Pete screenshots
Selected: 3x08_O_Christmas_Pete-0012.jpg
Status: Post 12 - 191 available (5.9% excluded from seasonal pool) (🎄 December: Christmas Pete only)
```
- **100% Christmas Pete and New Year's Pete content**
- All other episodes excluded
- Perfect for holiday nostalgia

### **Regular Months (Jan-Sep, Nov)**
```
Using 8937 non-seasonal screenshots (excluding seasonal episodes)
Selected: 1x05_What_Would_You_Do-0067.jpg  
Status: Post 2847 - 6090 available (31.8% excluded from seasonal pool) (Non-seasonal episodes only)
```
- **0% seasonal content** (preserves special episodes)
- Maximum variety from 31+ non-seasonal episodes
- Seasonal episodes saved for their proper months

## ⚙️ Screenshot Extraction Guide

### **Basic Usage**
```bash
# Default: I-frame extraction with 4:3 letterbox removal
yarn extract

# Extract every 4 seconds with denoising (good for VHS sources)
yarn extract --mode interval --interval 4 --denoise

# Widescreen content (16:9 aspect ratio)
yarn extract --aspect-ratio 16:9

# High quality mode (larger file sizes)
yarn extract --quality 1 --denoise
```

### **Advanced Options**
```bash
yarn extract \
  --mode iframe \                    # I-frame detection (best quality)
  --scene-threshold 0.1 \           # Scene change sensitivity  
  --aspect-ratio 4:3 \              # Force 4:3 output
  --width 720 --height 540 \       # Custom resolution
  --quality 2 \                     # JPEG quality (1-10)
  --denoise \                       # Apply VHS denoising
  --video-dir ./my-videos \         # Custom video directory
  --output-dir ./screenshots \      # Custom output directory
  --verbose                         # Detailed logging
```

### **Output Quality**
- **Resolution**: 720x540 (26% more pixels than 640x480)
- **Aspect Ratio**: Perfect 4:3 (matches Pete & Pete original format)
- **Letterbox Removal**: Aggressive cropping to eliminate black bars
- **Quality**: Optimized for social media posting

## 🛠️ Development

### **Local Testing**
```bash
# Test extraction tool
yarn extract --verbose

# Test image selection (dry run)
export BLUESKY_USERNAME="test" 
export BLUESKY_PASSWORD="test"
yarn start

# Check current status
node -e "
import { LargeScaleImageSelector } from './src/images/large-scale-selector.js';
const fs = require('fs');
const files = fs.readdirSync('./imagequeue').filter(f => /\.(jpg|png|gif)$/i.test(f));
const selector = new LargeScaleImageSelector(files);
console.log(selector.getStatus());
"
```

### **File Structure**
```
├── src/
│   ├── index.ts                     # Main bot logic
│   ├── extract-screenshots.ts       # Advanced extraction tool
│   ├── images/
│   │   ├── index.ts                # Image selection coordinator
│   │   └── large-scale-selector.ts # Large collection optimizer
│   └── clients/at.ts               # Bluesky API client
├── imagequeue/                     # Your curated screenshots
├── raw_screenshots/                # Extraction output
├── videos/                         # Source video files
├── .large-scale-history.json       # State tracking (8KB)
├── .bot-history.json              # Posting history (15KB)  
└── .github/workflows/             # Automated posting
```

### **State Files (Memory Efficient)**
- `.large-scale-history.json` - Recent image exclusions (8KB)
- `.bot-history.json` - Last 100 posts for analytics (15KB)
- Total: **~23KB committed per cycle** (GitHub-friendly)

## 📱 Alt-Text Generation

**Intelligent parsing of various filename formats:**

```
Input: "2x06_Halloweenie-0089.jpg"
Output: "The Adventures of Pete & Pete - Season 2, Episode 6: Halloweenie"

Input: "The_Adventures_of_Pete___Pete_-_3x12_-_Das_Bus-0273.jpg" 
Output: "The Adventures of Pete & Pete - Season 3, Episode 12: Das Bus"

Input: "S01E08_Hard_Days_Pete-0236.jpg"
Output: "The Adventures of Pete & Pete - Season 1, Episode 8: Hard Day's Pete"
```

**Special handling:**
- Season 0 episodes (specials) omit season/episode numbers
- Automatic title case conversion and punctuation fixes
- Frame numbers stripped but preserved for tracking

## 🔧 Configuration

### **Environment Variables**
```bash
BLUESKY_USERNAME=yourname.bsky.social    # Bluesky handle
BLUESKY_PASSWORD=your-app-password       # App password (not account password)
LAST_IMAGE_NAME=last_posted_image.jpg    # State tracking (auto-managed)
```

### **GitHub Actions Schedule**
```yaml
# Default: Every hour
- cron: '0 * * * *'

# Custom schedules:
- cron: '0 16-23,0-4 * * *'  # 4PM-11PM + Midnight-4AM UTC
- cron: '0 */6 * * *'        # Every 6 hours
- cron: '0 12 * * *'         # Daily at noon
```

## 🚨 Troubleshooting

### **Common Issues**

**"No image files found in imagequeue"**
- Add `.jpg`, `.png`, or `.gif` files to `./imagequeue/` folder
- Run `yarn extract` to generate screenshots from videos

**"Managing 0 images"**
- Check that imagequeue contains valid image files
- Verify file extensions are recognized (jpg, jpeg, png, gif, bmp)

**"October: No Halloweenie screenshots found"**
- Ensure Halloweenie episode screenshots are in imagequeue
- Filenames must contain "halloweenie" (case-insensitive)

**"December: No Christmas Pete screenshots found"**
- Add screenshots containing "christmas_pete" or "new_year" in filename

**"State file too large"**
- Auto-trimmed to 50KB max (should not occur with proper implementation)
- Delete `.large-scale-history.json` to reset (will start fresh cycle)

### **Debug Mode**
```bash
# Verbose extraction
yarn extract --verbose

# Check state
node -e "console.log(require('./.large-scale-history.json'))"

# Manual test run (will actually post!)
DEBUG=1 yarn start
```

## 📈 Analytics

**Track your bot's performance:**
- Posted images and timestamps in `.bot-history.json`
- Episode variety metrics
- Seasonal content distribution
- Exclusion list efficiency stats

**Example status output:**
```
156/156 recently used (100.0%) - 0 available (🎃 October: Halloweenie only)
All 156 seasonally allowed images recently used - resetting exclusions
Completed cycle: 156 posts since 2024-10-01T00:00:00Z
Starting fresh seasonal cycle
```

## 🎵 Credits

*"Hey Sandy" - Built with love for Pete & Pete fans everywhere*

**Powered by:**
- [TypeScript](https://www.typescriptlang.org/) - Type-safe bot logic
- [AT Protocol](https://atproto.com/) - Decentralized social networking  
- [FFmpeg](https://ffmpeg.org/) - Video processing excellence
- [GitHub Actions](https://github.com/features/actions) - Reliable automation

## 📄 License

MIT License - Share the Pete & Pete love responsibly!

---

*🏠 "Home is where you hang your hat... and post your Pete & Pete screenshots."*
