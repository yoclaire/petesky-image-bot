#!/bin/bash

# VHS-Friendly Pete & Pete Screenshot Extraction Script
# Optimized for Elgato VHS captures with analog artifacts

echo "📼 Starting VHS-friendly Pete & Pete screenshot extraction..."

# Create directories if they don't exist
mkdir -p raw_screenshots
mkdir -p imagequeue

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Aggressive configuration for VHS captures - more is better for curation!
INTERVAL_SECONDS=6         # Extract every 6 seconds 
                          # This gives you ~250 shots per 25-minute episode
                          # Want more? Try 4-5 seconds. Want fewer? Try 8-10 seconds.

echo -e "${BLUE}📋 VHS Extraction settings:${NC}"
echo "  • Interval: Every ${INTERVAL_SECONDS} seconds"
echo "  • Quality: Optimized for analog captures"
echo "  • No scene detection (VHS artifacts interfere)"
echo "  • No intro/outro detection (capture timing varies)"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}❌ FFmpeg not found! Please install it first:${NC}"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/"
    exit 1
fi

# Check if videos directory exists
if [ ! -d "videos" ]; then
    echo -e "${RED}❌ 'videos' directory not found!${NC}"
    echo "Please create a 'videos' folder and put your Pete & Pete episodes in it."
    exit 1
fi

# Function to clean filename for VHS captures
clean_filename() {
    echo "$1" | sed 's/[\/\\:*?"<>|]/_/g' | sed 's/  */_/g' | sed 's/__*/_/g'
}

# Initialize counters
processed=0
total_screenshots=0

echo -e "${BLUE}🔍 Scanning for video files...${NC}"

# Process each video file
for video_file in videos/*; do
    # Skip if not a regular file
    if [[ ! -f "$video_file" ]]; then
        continue
    fi
    
    # Get the extension and check if it's a video file
    extension="${video_file##*.}"
    extension_lower=$(echo "$extension" | tr '[:upper:]' '[:lower:]')
    case "$extension_lower" in
        mp4|mkv|avi|mov|m4v|wmv|flv|webm|ts)
            # This is a video file, process it
            ;;
        *)
            # Skip non-video files
            continue
            ;;
    esac
    
    # Get filename without path and extension
    filename=$(basename "$video_file")
    name_only="${filename%.*}"
    clean_name=$(clean_filename "$name_only")
    
    echo -e "${YELLOW}📼 Processing: $filename${NC}"
    echo -e "${BLUE}   Clean name: $clean_name${NC}"
    
    # Test if file is readable by ffmpeg
    echo -e "${BLUE}   🔍 Testing file...${NC}"
    if ! ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name "$video_file" >/dev/null 2>&1; then
        echo -e "${RED}❌ File appears corrupted or unreadable${NC}"
        processed=$((processed + 1))
        echo ""
        continue
    fi
    
    # Get basic duration (don't rely on precise metadata from VHS captures)
    duration=$(ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$video_file" 2>/dev/null | cut -d. -f1)
    
    if [ -z "$duration" ] || [ "$duration" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Could not determine duration, proceeding anyway...${NC}"
        estimated_frames="unknown"
    else
        estimated_frames=$((duration / INTERVAL_SECONDS))
        echo -e "${BLUE}   ⏱️  Duration: ~${duration}s, extracting ~${estimated_frames} frames${NC}"
    fi
    
    # Simple time-based extraction - works best with VHS captures
    # Using slightly higher quality (q:v 2) and adding mild denoising for VHS
    echo -e "${BLUE}   📸 Extracting screenshots every ${INTERVAL_SECONDS} seconds...${NC}"
    
    if ffmpeg -i "$video_file" \
        -vf "fps=1/${INTERVAL_SECONDS},hqdn3d=2:1:2:3" \
        -q:v 2 \
        -f image2 \
        "raw_screenshots/${clean_name}-%04d.jpg" \
        -y \
        -loglevel error \
        -hide_banner; then
        
        # Count screenshots generated for this file
        file_screenshots=$(find raw_screenshots/ -name "${clean_name}-*.jpg" 2>/dev/null | wc -l)
        
        if [ "$file_screenshots" -gt 0 ]; then
            echo -e "${GREEN}✅ Extracted $file_screenshots screenshots${NC}"
            total_screenshots=$((total_screenshots + file_screenshots))
        else
            echo -e "${RED}❌ No screenshots extracted${NC}"
        fi
    else
        echo -e "${RED}❌ FFmpeg failed to process this file${NC}"
        echo -e "${BLUE}   💡 VHS captures can be tricky - file might need conversion${NC}"
    fi
    
    processed=$((processed + 1))
    echo ""
done

# Final summary
echo -e "${GREEN}🎉 VHS extraction complete!${NC}"
echo -e "${BLUE}📊 Summary:${NC}"
echo "  • Videos processed: $processed"
echo "  • Total screenshots: $total_screenshots"
echo ""

if [ "$total_screenshots" -gt 0 ]; then
    echo -e "${YELLOW}📝 Next steps for VHS captures:${NC}"
    echo "1. Review screenshots in 'raw_screenshots/' folder"
    echo "2. With ~250+ shots per episode, be selective!"
    echo "3. Look for frames with good focus (VHS can be soft)"
    echo "4. Avoid frames with tracking lines or analog artifacts"
    echo "5. Copy your favorites to 'imagequeue/' folder"
    echo "6. Consider Gigapixel AI for upscaling the best ones"
    echo ""
    echo -e "${BLUE}💡 Curation tips with aggressive extraction:${NC}"
    echo "  • You'll have tons of options - be picky!"
    echo "  • Look for character expressions and memorable moments"
    echo "  • Frames with good contrast usually work best"
    echo "  • Character close-ups often survive VHS artifacts better"
    echo "  • Don't worry about perfect quality - VHS charm is part of it!"
    echo ""
    echo -e "${GREEN}🤖 Ready for Pete & Pete magic!${NC}"
else
    echo -e "${RED}❌ No screenshots were extracted.${NC}"
    echo -e "${BLUE}💡 VHS troubleshooting:${NC}"
    echo "  • VHS captures can have unusual formats"
    echo "  • Try converting to MP4 first: ffmpeg -i input.mov -c:v libx264 output.mp4"
    echo "  • Check if the file plays normally in VLC"
fi
