import { postImage } from './clients/at';
import { getNextImage } from './images';
import * as dotenv from 'dotenv';
dotenv.config();

// No text - just pure Pete & Pete imagery
function postTextFromImageName(imageName: string): string {
  return ""; // Empty string = no caption, no text, no hashtags
}

// Extract episode info from filename for alt text
function altTextFromImageName(imageName: string): string {
  // Try to extract episode info like "1x05" and episode title
  const episodeMatch = imageName.match(/(\d+)x(\d+)/);
  
  if (episodeMatch) {
    const season = episodeMatch[1];
    const episode = episodeMatch[2];
    
    // Try to extract episode title after the episode number
    // Look for patterns like "1x05 - Tool and Die" or "1x05_Tool_and_Die"
    const titleMatch = imageName.match(/\d+x\d+[\s\-_]+([^\.]+)/);
    
    if (titleMatch) {
      // Clean up the title - replace underscores/multiple spaces with single spaces
      const title = titleMatch[1]
        .replace(/[_\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return `The Adventures of Pete & Pete - Season ${season}, Episode ${episode}: ${title}`;
    } else {
      return `The Adventures of Pete & Pete - Season ${season}, Episode ${episode}`;
    }
  }
  
  // Fallback if no episode info found
  return 'The Adventures of Pete & Pete';
}

// Main function - shouldn't need to edit this
async function main() {
  try {
    const { LAST_IMAGE_NAME: lastImageName } = process.env;
    const nextImage = await getNextImage({ lastImageName });

    console.log(`📸 Posting: ${nextImage.imageName}`);

    await postImage({
      path: nextImage.absolutePath,
      text: postTextFromImageName(nextImage.imageName),
      altText: altTextFromImageName(nextImage.imageName),
    });

    console.log('✅ Successfully posted to Bluesky!');
    
    // Output filename for GitHub Actions to capture
    console.log(nextImage.imageName);
    
  } catch (error) {
    console.error('❌ Error posting to Bluesky:', error);
    process.exit(1);
  }
}

main();