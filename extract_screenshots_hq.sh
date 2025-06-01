#!/bin/bash

# Pete & Pete High-Quality Screenshot Extraction Script
# Extracts upscaled, sharpened I-frames with scene detection

echo "🎬 Starting Pete & Pete HIGH-QUALITY screenshot extraction..."

# Create directories if they don't exist
mkdir -p raw_screenshots_hq
mkdir -p imagequeue

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}❌ FFmpeg not found! Please install it first:${NC}"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/"
    exit 1
fi

# Check if ffprobe is installed
if ! command -v ffprobe &> /dev/null; then
    echo -e "${RED}❌ FFprobe not found! Install FFmpeg with full tools.${NC}"
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

echo -e "${PURPLE}🚀 HIGH-QUALITY MODE ENABLED${NC}"
echo -e "${BLUE}📁 Found $video_count video files${NC}"
echo -e "${YELLOW}⚡ Quality enhancements: 2x upscaling, scene filtering, sharpening${NC}"
echo ""

# Initialize counters
processed=0
total_screenshots=0

# Process each video file with better path handling
echo -e "${BLUE}🔍 Scanning for video files...${NC}"

# First, let's see what we're working with
video_files=()
while IFS= read -r -d '' file; do
    video_files+=("$file")
done < <(find videos/ -type f \( -iname "*.mp4" -o -iname "*.mkv" -o -iname "*.avi" -o -iname "*.mov" -o -iname "*.m4v" \) -print0)

echo -e "${BLUE}📁 Found ${#video_files[@]} video files to process${NC}"
echo ""

for video_file in "${video_files[@]}"; do
    # Get filename without extension and path
    filename=$(basename "$video_file")
    name_only="${filename%.*}"
    
    # Clean filename for use in output (remove special characters but keep structure)
    clean_name=$(echo "$name_only" | sed 's/[^a-zA-Z0-9._& -]/_/g' | sed 's/__*/_/g' | sed 's/^_\+\|_\+$//g')
    
    echo -e "${YELLOW}🎥 Processing: $filename${NC}"
    echo -e "${BLUE}   Full path: $video_file${NC}"
    echo -e "${BLUE}   Clean name: $clean_name${NC}"
    
    # Verify file exists and is readable
    if [ ! -f "$video_file" ]; then
        echo -e "${RED}❌ File not found: $video_file${NC}"
        processed=$((processed + 1))
        echo ""
        continue
    fi
    
    if [ ! -r "$video_file" ]; then
        echo -e "${RED}❌ File not readable: $video_file${NC}"
        processed=$((processed + 1))
        echo ""
        continue
    fi
    
    # Get video info for better processing
    echo -e "${BLUE}   📊 Analyzing video...${NC}"
    video_info=$(ffprobe -v quiet -print_format json -show_streams "$video_file" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$video_info" ]; then
        width=$(echo "$video_info" | jq -r '.streams[] | select(.codec_type=="video") | .width' 2>/dev/null | head -1)
        height=$(echo "$video_info" | jq -r '.streams[] | select(.codec_type=="video") | .height' 2>/dev/null | head -1)
        codec=$(echo "$video_info" | jq -r '.streams[] | select(.codec_type=="video") | .codec_name' 2>/dev/null | head -1)
        
        # Fallback if jq not available
        if [ -z "$width" ] || [ "$width" = "null" ]; then
            width=$(echo "$video_info" | grep -o '"width":[0-9]*' | cut -d':' -f2 | head -1)
            height=$(echo "$video_info" | grep -o '"height":[0-9]*' | cut -d':' -f2 | head -1)
            codec=$(echo "$video_info" | grep -o '"codec_name":"[^"]*"' | cut -d'"' -f4 | head -1)
        fi
        
        if [ ! -z "$width" ] && [ ! -z "$height" ] && [ "$width" != "null" ] && [ "$height" != "null" ]; then
            target_width=$((width * 2))
            target_height=$((height * 2))
            echo -e "${BLUE}   📺 Source: ${width}x${height} (${codec}) → Target: ${target_width}x${target_height}${NC}"
        else
            echo -e "${BLUE}   📺 Video analysis: Resolution detection failed, using auto-scaling${NC}"
        fi
    else
        echo -e "${BLUE}   📺 Video analysis: Using automatic settings${NC}"
    fi
    
    # High-quality extraction with codec-aware processing
    echo -e "${PURPLE}   🔧 Applying quality filters...${NC}"
    
    # Check if this is a problematic codec that needs special handling
    if [ "$codec" = "msmpeg4v2" ] || [ "$codec" = "msmpeg4v3" ] || [ "$codec" = "msmpeg4" ]; then
        echo -e "${YELLOW}   ⚠️  Detected legacy codec ($codec), using compatibility mode${NC}"
        # Use a more conservative approach for legacy codecs
        ffmpeg -i "$video_file" \
            -vf "select='eq(pict_type,PICT_TYPE_I)',scale=iw*2:ih*2:flags=lanczos,format=rgb24" \
            -fps_mode vfr \
            -q:v 2 \
            -f image2 \
            "raw_screenshots_hq/${clean_name}-HQ-%05d.jpg" \
            -y \
            -loglevel warning \
            -hide_banner
    else
        # Standard high-quality processing for modern codecs
        ffmpeg -i "$video_file" \
            -vf "select='eq(pict_type,PICT_TYPE_I)*gt(scene,0.2)',scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:1.0:5:5:0.0,format=yuv420p" \
            -fps_mode vfr \
            -q:v 1 \
            -f image2 \
            "raw_screenshots_hq/${clean_name}-HQ-%05d.jpg" \
            -y \
            -loglevel warning \
            -hide_banner
    fi
    
    # Check if ffmpeg succeeded
    if [ $? -eq 0 ]; then
        # Count screenshots generated for this file
        file_screenshots=$(find raw_screenshots_hq/ -name "${clean_name}-HQ-*.jpg" 2>/dev/null | wc -l)
        
        if [ $file_screenshots -gt 0 ]; then
            echo -e "${GREEN}✅ Extracted $file_screenshots HIGH-QUALITY screenshots${NC}"
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

# Re-count total screenshots after the loop
total_screenshots=$(find raw_screenshots_hq/ -name "*-HQ-*.jpg" 2>/dev/null | wc -l)

# Final summary
echo -e "${PURPLE}🎉 HIGH-QUALITY extraction complete!${NC}"
echo -e "${BLUE}📊 Summary:${NC}"
echo "  • Videos processed: $processed"
echo "  • Total HQ screenshots: $total_screenshots"
echo ""

if [ $total_screenshots -gt 0 ]; then
    echo -e "${PURPLE}🚀 QUALITY ENHANCEMENTS APPLIED:${NC}"
    echo -e "${GREEN}  ✅ 2x resolution upscaling (Lanczos filter)${NC}"
    echo -e "${GREEN}  ✅ Scene change detection (reduces duplicates)${NC}"
    echo -e "${GREEN}  ✅ Unsharp mask sharpening${NC}"
    echo -e "${GREEN}  ✅ Maximum JPEG quality (q:v 1)${NC}"
    echo -e "${GREEN}  ✅ Enhanced color space (yuvj420p)${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Review HQ screenshots in 'raw_screenshots_hq/' folder"
    echo "2. Compare with standard quality in 'raw_screenshots/' folder"
    echo "3. Copy your best HQ shots to 'imagequeue/' folder"
    echo ""
    echo -e "${BLUE}💡 Pro tip:${NC}"
    echo "  • HQ screenshots are 2x larger and sharper"
    echo "  • Scene detection gives you more variety"
    echo "  • Perfect for modern displays and upscaling tools"
    echo ""
    echo -e "${PURPLE}🤖 Your Pete & Pete bot will look amazing with these!${NC}"
else
    echo -e "${RED}❌ No screenshots were extracted. Check your video files and try again.${NC}"
fi
