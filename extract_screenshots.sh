#!/bin/bash

# Pete & Pete Screenshot Extraction Script - Robust Version
# Extracts I-frames (scene changes) from all video files

echo "🎬 Starting Pete & Pete screenshot extraction..."

# Create directories if they don't exist
mkdir -p raw_screenshots
mkdir -p imagequeue

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Initialize counters
processed=0
total_screenshots=0

echo -e "${BLUE}🔍 Scanning for video files...${NC}"

# Process each video file with robust handling
for video_file in videos/*; do
    # Skip if not a regular file
    if [[ ! -f "$video_file" ]]; then
        continue
    fi
    
    # Get the extension and check if it's a video file
    extension="${video_file##*.}"
    # Convert to lowercase using tr for compatibility
    extension_lower=$(echo "$extension" | tr '[:upper:]' '[:lower:]')
    case "$extension_lower" in
        mp4|mkv|avi|mov|m4v)
            # This is a video file, process it
            ;;
        *)
            # Skip non-video files
            continue
            ;;
    esac
    
    # Get filename without path
    filename=$(basename "$video_file")
    name_only="${filename%.*}"
    
    # Create a safe filename for output (more permissive cleaning)
    clean_name=$(echo "$name_only" | sed 's/[\/\\:*?"<>|]/_/g' | sed 's/  */_/g')
    
    echo -e "${YELLOW}🎥 Processing: $filename${NC}"
    echo -e "${BLUE}   Clean name: $clean_name${NC}"
    
    # Test if file is readable by ffmpeg first
    echo -e "${BLUE}   🔍 Testing file...${NC}"
    if ! ffprobe -v quiet -select_streams v:0 -show_entries stream=codec_name "$video_file" >/dev/null 2>&1; then
        echo -e "${RED}❌ File appears corrupted or unreadable${NC}"
        processed=$((processed + 1))
        echo ""
        continue
    fi
    
    echo -e "${BLUE}   ✅ File readable, extracting frames...${NC}"
    
    # Extract I-frames with scene detection (no blur filter for compatibility)
    if ffmpeg -i "$video_file" \
        -vf "select='eq(pict_type,PICT_TYPE_I)*gt(scene,0.1)'" \
        -vsync vfr \
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
            echo -e "${RED}❌ No screenshots extracted (no I-frames found)${NC}"
        fi
    else
        echo -e "${RED}❌ FFmpeg failed to process this file${NC}"
        echo -e "${BLUE}   💡 Try converting this file to MP4 first${NC}"
    fi
    
    processed=$((processed + 1))
    echo ""
done

# Final count
total_screenshots=$(find raw_screenshots/ -name "*.jpg" 2>/dev/null | wc -l)

# Final summary
echo -e "${GREEN}🎉 Extraction complete!${NC}"
echo -e "${BLUE}📊 Summary:${NC}"
echo "  • Videos processed: $processed"
echo "  • Total screenshots: $total_screenshots"
echo ""

if [ "$total_screenshots" -gt 0 ]; then
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Review screenshots in 'raw_screenshots/' folder"
    echo "2. Copy your best shots to 'imagequeue/' folder"
    echo "3. Use Gigapixel AI to upscale your favorites"
    echo ""
    echo -e "${BLUE}💡 Pro tip: Look for:${NC}"
    echo "  • Character close-ups and expressions"
    echo "  • Memorable scenes and moments"
    echo "  • Good lighting and composition"
    echo "  • Avoid blurry or dark frames"
    echo ""
    echo -e "${GREEN}🤖 Ready for Gigapixel upscaling!${NC}"
else
    echo -e "${RED}❌ No screenshots were extracted.${NC}"
    echo -e "${BLUE}💡 Troubleshooting:${NC}"
    echo "  • Check if video files are corrupted"
    echo "  • Try converting to MP4 format first"
    echo "  • Ensure files aren't DRM protected"
fi
