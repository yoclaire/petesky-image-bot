import { postImage, PostImageOptions } from './clients/at';
import { getNextImage } from './images';
import { composeAltText, generateVisionAltText } from './utils/alt-text';

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

// Main function
async function main() {
  try {
    const nextImage = await getNextImage();

    console.log(`Posting: ${nextImage.imageName}`);
    if (nextImage.cycleInfo) {
      console.log(`Large-scale status: ${nextImage.cycleInfo}`);
    }

    // Alt text: episode info from the filename, plus a vision description when available
    const visionDescription = await generateVisionAltText(nextImage.absolutePath);
    const altText = composeAltText(nextImage.imageName, visionDescription);
    console.log(`Alt text: ${altText}`);

    // Post with retry logic
    await postWithRetry({
      path: nextImage.absolutePath,
      text: '',
      altText: altText,
    });

    console.log('Successfully posted to Bluesky!');
  } catch (error) {
    console.error('Error posting to Bluesky:', error);
    process.exit(1);
  }
}

main();
