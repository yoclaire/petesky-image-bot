# bsky-image-bot

A TypeScript bot that automatically posts curated screenshots from "The Adventures of Pete & Pete" to Bluesky on a scheduled basis. Features intelligent episode clustering prevention, seasonal content awareness, and robust error handling.

## Features

- **Automated posting** to Bluesky using GitHub Actions
- **Smart image selection** that avoids posting screenshots from the same episode consecutively
- **Seasonal content awareness** - prioritizes Halloween episodes in October, Christmas content in December, etc.
- **Robust alt-text generation** that handles various filename formats and extracts episode information
- **Retry logic** with exponential backoff for network reliability
- **Posting history tracking** for analytics and improved selection logic
- **No captions** - focuses purely on visual nostalgia

## How It Works

1. **Image Extraction**: Use `extract_screenshots.sh` to extract I-frames from Pete & Pete video files
2. **Manual Curation**: Select the best screenshots and move them to the `/imagequeue/` folder
3. **Automated Posting**: GitHub Actions runs on a schedule to randomly select and post images
4. **Smart Selection**: The bot avoids episode clustering and reserves seasonal episodes for appropriate months
5. **State Management**: Uses file-based state tracking to prevent immediate repeats

## Setup Instructions

### 1. Fork and Clone
```bash
git clone https://github.com/YOUR_USERNAME/bsky-image-bot.git
cd bsky-image-bot
```

### 2. Prepare Your Images
1. Place Pete & Pete video files in `/videos/` directory
2. Run the extraction script: `./extract_screenshots.sh`
3. Review extracted screenshots in `/raw_screenshots/`
4. Copy your best selections to `/imagequeue/`

### 3. Configure Bluesky Credentials
1. Generate an [app password](https://bsky.app/settings/app-passwords) for your Bluesky account
2. In your GitHub repository, go to Settings → Secrets and Variables → Actions
3. Add these Repository Secrets:
   - `BSKY_IDENTIFIER`: Your Bluesky handle (e.g., `yourname.bsky.social`)
   - `BSKY_PASSWORD`: Your app password

### 4. Set Up GitHub Token
1. Create a [fine-grained GitHub personal token](https://github.com/settings/tokens?type=beta)
2. Give it read/write access to repository variables for your repo
3. Add it as a secret named `REPO_ACCESS_TOKEN`

### 5. Test and Enable
1. Run the action manually from GitHub UI: Actions → "bsky-image-bot Post Next Image" → "Run workflow"
2. If successful, the bot will start posting on the scheduled times (4PM-11PM and midnight-4AM UTC)

## Supported Filename Formats

The bot intelligently parses various filename formats for alt-text generation:

- `S01E08_-_Hard_Day's_Pete-0236.jpg` → "The Adventures of Pete & Pete - Season 1, Episode 8: Hard Day's Pete"
- `The_Adventures_of_Pete_&_Pete_-_3x12_-_Das_Bus-0273.jpg` → "The Adventures of Pete & Pete - Season 3, Episode 12: Das Bus"  
- `The_Adventures_of_Pete___Pete_-_0x23_-_Artie__The_Strongest_Man..._In_The_World_-0005.jpg` → "The Adventures of Pete & Pete - Artie, the Strongest Man... in the World"
- `pete_and_pete_2x07_halloweenie-0089.jpg` → "The Adventures of Pete & Pete - Season 2, Episode 7: Halloweenie"

### Special Handling
- **Season 0 episodes** (specials/shorts) don't include season/episode numbers in alt-text
- **Episode titles** are automatically cleaned up and properly capitalized
- **Frame numbers** are stripped from alt-text but preserved in tracking

## Smart Features

### Episode Clustering Prevention
The bot tracks recent posts and avoids posting multiple screenshots from the same episode consecutively. If 2 of the last 3 posts were from the same episode, it will skip other images from that episode.

### Seasonal Episode Management
- **October**: Only posts screenshots from "Halloweenie" (S02E06)
- **December**: Only posts screenshots from "O' Christmas Pete" and "New Year's Pete" episodes
- **Rest of year**: Seasonal episodes are completely avoided to preserve their special nature

### Retry Logic
Network failures are handled with exponential backoff (5s, 10s, 20s delays) to ensure reliable posting.

## Local Development

### Install Dependencies
```bash
yarn install
```

### Test Alt-Text Generation
```bash
npx ts-node test-alt-text.ts
```

### Test Image Selection (without posting)
```bash
# Set environment variables
export BSKY_IDENTIFIER="your-handle"
export BSKY_PASSWORD="your-app-password"
export LAST_IMAGE_NAME=""

# Run locally (will actually post - be careful!)
yarn start
```

## File Structure

```
├── imagequeue/              # Curated screenshots (your content)
├── videos/                  # Source video files (gitignored)
├── raw_screenshots/         # Extracted frames (gitignored)
├── src/
│   ├── index.ts            # Main bot logic
│   ├── images/index.ts     # Image selection logic
│   └── clients/at.ts       # Bluesky API client
├── .github/workflows/      # GitHub Actions automation
├── .bot-history.json       # Posting history (gitignored)
├── .last_posted_image      # State file (gitignored)
└── extract_screenshots.sh  # Video processing script
```

## Posting History

The bot maintains a JSON history file (`.bot-history.json`) that tracks:
- Posted images and timestamps
- Episode information for clustering prevention
- Alt-text for each post
- Analytics data for future enhancements

History is limited to the last 50 posts to prevent file bloat.

## Troubleshooting

### Common Issues

**"No image files found"**
- Ensure `/imagequeue/` contains `.jpg`, `.png`, or `.gif` files
- Check that filenames don't contain invalid characters

**"Authentication failed"**
- Verify `BSKY_IDENTIFIER` and `BSKY_PASSWORD` secrets are set correctly
- Ensure you're using an app password, not your account password

**"Episode clustering detected"**
- This is normal behavior - the bot is avoiding posting too many screenshots from the same episode
- Add more variety to your `/imagequeue/` folder

**Workflow fails to update state**
- Check that `REPO_ACCESS_TOKEN` has proper permissions
- Verify the token has read/write access to repository variables

### Debug Mode
Set environment variables for verbose logging:
```bash
export DEBUG=1
yarn start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes locally
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*"Hey Sandy" 🎵 - Enjoy the nostalgia!*