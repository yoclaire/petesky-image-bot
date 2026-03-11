# Pete & Pete Screenshot Bot

Automatically posts screenshots from "The Adventures of Pete & Pete" to Bluesky with smart duplicate prevention and seasonal posting.

## Features

- No repeated images across posting cycles
- Seasonal episode filtering (Halloween in October, Christmas in December)
- Automatic alt-text generation for accessibility
- Runs on GitHub Actions with no manual intervention

## Setup

Requires a Bluesky account with an [app password](https://bsky.app/settings/app-passwords).

Add these as repository secrets in GitHub Actions:
- `BSKY_IDENTIFIER` — your Bluesky handle
- `BSKY_PASSWORD` — your app password

Add `.jpg` images to the `imagequeue/` folder and push.

## Screenshot extraction

Extract screenshots from video files placed in `videos/`:

```bash
yarn extract          # Default settings
yarn extract --help   # See all options
```

## Requirements

- Node.js 20+
- Yarn
- GitHub repository with Actions enabled

## License

MIT
