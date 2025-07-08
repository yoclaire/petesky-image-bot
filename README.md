# Pete & Pete Screenshot Bot

Automatically posts screenshots from "The Adventures of Pete & Pete" to Bluesky every 30 minutes with smart duplicate prevention and seasonal posting.

## What it does

Posts a different Pete & Pete screenshot to Bluesky every 30 minutes. Features include:
- No repeated images for about 4 weeks 
- Seasonal episode filtering (Halloween in October, Christmas in December)
- Automatic alt-text generation for accessibility
- Handles large collections efficiently

Runs on GitHub Actions with no manual intervention required.

## How selection works

The bot tracks recently posted images and excludes them from selection. With 8,973 images:
- Regular months: ~8,600 images available (excludes seasonal episodes)
- October: ~150 Halloween images only
- December: ~200 Christmas images only

Avoids posting multiple screenshots from the same episode consecutively.

## Seasonal posting

**October**: Only Halloweenie episode (S02E06) screenshots.

**December**: Only O' Christmas Pete (S03E11) and New Year's Pete (S00E05) screenshots.

**Other months**: All episodes except seasonal ones.

## Screenshot extraction

Extract screenshots from video files:

```bash
yarn extract
```

Place video files in the `videos/` folder. The tool extracts 4:3 screenshots to `raw_screenshots/`. Copy the best ones to `imagequeue/`.

Options:
```bash
yarn extract --help                    # See all options
yarn extract --interval 6 --denoise    # Every 6 seconds with noise reduction
yarn extract --quality 1               # Highest quality
```

## File structure

```
imagequeue/           # Curated screenshots (8,973 currently)
videos/              # Source video files for extraction
src/                 # Bot code
├── index.ts         # Main posting logic
├── extract-screenshots.ts  # Screenshot extraction tool
└── images/          # Image selection logic
.github/workflows/   # GitHub Actions automation
```

## Security

Uses GitHub's built-in authentication with automatic credential management. No personal access tokens required. State is stored in the git repository.

## Local testing

```bash
export BSKY_IDENTIFIER="your.handle.bsky.social"
export BSKY_PASSWORD="your-app-password"
yarn start
```

Note: This will post to Bluesky.

## Technical details

Uses a memory-efficient exclusion system that tracks the last ~1,300 images (15% of collection). Prevents repeats for 4 weeks while keeping state files small.

State files:
- `.large-scale-history.json` - Recent image hashes for duplicate prevention (~8KB)
- `.bot-history.json` - Last 100 posts for analytics (~15KB)

Both files are committed to the repository after each post.

## Troubleshooting

**"No image files found"**: Add .jpg files to the `imagequeue/` folder.

**"No Halloweenie screenshots found" (October)**: Ensure screenshots have "halloweenie" in the filename.

**"No Christmas Pete screenshots found" (December)**: Add screenshots with "christmas_pete" or "new_year" in the filename.

**Permission errors**: Verify you're using the current workflow file.

## Alt-text generation

Automatically generates accessibility descriptions from filenames:

`S01E08_Hard_Days_Pete-0236.jpg` → `"The Adventures of Pete & Pete - Season 1, Episode 8: Hard Day's Pete"`

Handles various filename formats and applies proper text formatting.

## Requirements

- Node.js 20+
- Yarn
- Bluesky account with app password
- GitHub repository with Actions enabled

## Credits

Built with TypeScript, GitHub Actions, and the AT Protocol. Screenshot extraction uses FFmpeg.

## License

MIT
