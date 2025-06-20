# Screenshot Extraction Setup

After creating the new TypeScript extractor, you can clean up the old bash scripts:

```bash
# Remove old scripts (optional)
rm extract_screenshots.sh extract_screenshots2.sh extract_screenshots_fixed.sh extract_screenshots2_fixed.sh

# Install new dependencies
yarn install
```

## Usage Examples

```bash
# Default: Extract I-frames with scene detection + 4:3 aspect ratio correction
yarn extract

# VHS-friendly: Every 6 seconds with denoising
yarn extract --mode interval --interval 6 --denoise

# High quality: Every 4 seconds, best quality
yarn extract --mode interval --interval 4 --quality 1 --denoise

# Widescreen content
yarn extract --aspect-ratio 16:9

# Custom paths and verbose output
yarn extract --video-dir ./my-videos --output-dir ./screenshots --verbose

# See all options
yarn extract --help
```

## Why This Solution is Better

1. **Single Script**: One tool handles both I-frame and interval extraction
2. **Type Safety**: TypeScript with proper error handling
3. **Better UX**: Progress bars, colored output, clear error messages
4. **Configurable**: Command-line options for all parameters
5. **Integrated**: Uses your existing project structure and dependencies
6. **Aspect Ratio Fixed**: Automatically handles 4:3 correction
7. **Smart Defaults**: Optimized settings for Pete & Pete content

## The Key Fix

The aspect ratio issue is solved with this ffmpeg filter chain:
```
scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2
```

This ensures all screenshots are exactly 640x480 (4:3) and will display properly on Bluesky without letterboxing!
