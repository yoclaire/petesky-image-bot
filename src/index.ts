import { postImage, PostImageOptions } from './clients/at';
import { getNextImage } from './images';
import * as fs from 'fs';
import { generateVisionAltText } from './utils/alt-text';
import { PROJECT_ROOT } from './utils/paths';

// Extract episode info from filename for alt text
function altTextFromImageName(imageName: string): string {
  const base = imageName.replace(/-\d+\.jpg$/i, '');
  const toSpaces = (s: string) => s.replace(/_/g, ' ');

  // Shorts: The_Adventures_of_Pete_&_Pete_-_0x01_-_Title
  const shortMatch = base.match(/^The_Adventures_of_Pete_&_Pete_-_0x\d+_-_(.+)$/);
  if (shortMatch) return `The Adventures of Pete & Pete - ${toSpaces(shortMatch[1])}`;

  // Episodes: S01E08_-_Title
  const epMatch = base.match(/^S(\d+)E(\d+)_-_(.+)$/);
  if (epMatch) {
    const [, s, e, title] = epMatch;
    const prettyTitle = toSpaces(title);
    if (parseInt(s) === 0) return `The Adventures of Pete & Pete - ${prettyTitle}`;
    return `The Adventures of Pete & Pete - Season ${parseInt(s)}, Episode ${parseInt(e)}: ${prettyTitle}`;
  }

  return 'The Adventures of Pete & Pete';
}

// Post with retry logic
async function postWithRetry(imageData: PostImageOptions, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await postImage(imageData);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Posting attempt ${attempt} failed:`, message);

      if (attempt === maxRetries) {
        throw new Error(`Failed to post after ${maxRetries} attempts: ${message}`);
      }

      // Exponential backoff: 5s, 10s, 20s
      const delay = 5000 * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Write the posted image name to a file for GitHub Actions to read
function savePostedImageName(imageName: string): void {
  const filePath = `${PROJECT_ROOT}/.last_posted_image`;
  fs.writeFileSync(filePath, imageName.trim(), 'utf8');
}

// Main function
async function main() {
  try {
    const nextImage = await getNextImage();

    console.log(`Posting: ${nextImage.imageName}`);
    if (nextImage.cycleInfo) {
      console.log(`Large-scale status: ${nextImage.cycleInfo}`);
    }

    // Generate alt text: try vision API first, fall back to filename-based
    const filenameAltText = altTextFromImageName(nextImage.imageName);
    const altText = await generateVisionAltText(nextImage.absolutePath, filenameAltText);
    console.log(`Alt text: ${altText}`);

    // Post with retry logic
    await postWithRetry({
      path: nextImage.absolutePath,
      text: '',
      altText: altText,
    });

    console.log('Successfully posted to Bluesky!');

    // Save the posted image name for GitHub Actions
    savePostedImageName(nextImage.imageName);

  } catch (error) {
    console.error('Error posting to Bluesky:', error);
    process.exit(1);
  }
}

main();
