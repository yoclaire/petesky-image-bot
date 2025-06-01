#!/bin/bash

# Pete & Pete Screenshot Extraction Script
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

# Count video files
video_count=$(find videos/ -type f \( -iname "*.mp4" -o -iname "*.mkv" -o -iname "*.avi" -o -iname "*.mov" -o -iname "*.m4v" \) | wc -l)

if [ $video_count -eq 0 ]; then
    echo -e "${RED}❌ No video files found in videos/ directory!${NC}"
    echo "Supported formats: mp4, mkv, avi, mov, m4v"
    exit 1
fi

echo -e "${BLUE}📁 Found $video_count video files${NC}"
echo ""

# Initialize counters
processed=0
total_screenshots=0

# Initialize counters outside the loop
processed=0
total_screenshots=0

# Process each video file
find videos/ -type f \( -iname "*.mp4" -o -iname "*.mkv" -o -iname "*.avi" -o -iname "*.mov" -o -iname "*.m4v" \) -print0 | while IFS= read -r -d '' video_file; do
    # Get filename without extension and path
    filename=$(basename "$video_file")
    name_only="${filename%.*}"
    
    # Clean filename for use in output (remove special characters)
    clean_name=$(echo "$name_only" | sed 's/[^a-zA-Z0-9._-]/_/g')
    
    echo -e "${YELLOW}🎥 Processing: $filename${NC}"
    echo -e "${BLUE}   Full path: $video_file${NC}"
    
    # Extract I-frames (keyframes) - these capture scene changes and major movements
    ffmpeg -i "$video_file" \
        -vf "select='eq(pict_type,PICT_TYPE_I)'" \
        -vsync vfr \
        -q:v 2 \
        -f image2 \
        "raw_screenshots/${clean_name}-%04d.jpg" \
        -y \
        -loglevel error \
        -hide_banner
    
    # Check if ffmpeg succeeded
    if [ $? -eq 0 ]; then
        # Count screenshots generated for this file
        file_screenshots=$(find raw_screenshots/ -name "${clean_name}-*.jpg" 2>/dev/null | wc -l)
        
        if [ $file_screenshots -gt 0 ]; then
            echo -e "${GREEN}✅ Extracted $file_screenshots screenshots${NC}"
            total_screenshots=$((total_screenshots + file_screenshots))
        else
            echo -e "${RED}❌ No screenshots extracted (ffmpeg succeeded but no files found)${NC}"
        fi
    else
        echo -e "${RED}❌ FFmpeg failed to process this file${NC}"
    fi
    
    processed=$((processed + 1))
    echo ""
done

# Re-count total screenshots after the loop (since variables in pipes create subshells)
total_screenshots=$(find raw_screenshots/ -name "*.jpg" 2>/dev/null | wc -l)

# Final summary
echo -e "${GREEN}🎉 Extraction complete!${NC}"
echo -e "${BLUE}📊 Summary:${NC}"
echo "  • Videos processed: $processed"
echo "  • Total screenshots: $total_screenshots"
echo ""

if [ $total_screenshots -gt 0 ]; then
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Review screenshots in 'raw_screenshots/' folder"
    echo "2. Copy your best shots to 'imagequeue/' folder"
    echo "3. Aim for 100-500 good screenshots for variety"
    echo ""
    echo -e "${BLUE}💡 Pro tip: Look for:${NC}"
    echo "  • Character close-ups and expressions"
    echo "  • Memorable scenes and moments"
    echo "  • Good lighting and composition"
    echo "  • Avoid blurry or dark frames"
    echo ""
    echo -e "${GREEN}🤖 Once you've curated your shots, your bot will be ready to post!${NC}"
else
    echo -e "${RED}❌ No screenshots were extracted. Check your video files and try again.${NC}"
fi
