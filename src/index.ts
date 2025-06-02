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
  // Clean up the filename by removing file extension and replacing separators
  const cleanName = imageName
    .replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '') // Remove file extension
    .replace(/[_\-]+/g, ' ') // Replace underscores and dashes with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  // Try to extract season and episode info with various patterns
  const seasonEpisodePatterns = [
    /(?:Season?\s*)?(\d+)x(\d+)/i,           // 1x05, Season 1x05
    /S(\d+)E(\d+)/i,                         // S01E08
    /Season\s*(\d+)\s*Episode\s*(\d+)/i,     // Season 1 Episode 5
    /(\d+)\s*x\s*(\d+)/i                     // 3 x 12
  ];

  let season: string | null = null;
  let episode: string | null = null;
  
  for (const pattern of seasonEpisodePatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      season = match[1];
      episode = match[2];
      break;
    }
  }

  // Try to extract episode title
  let episodeTitle: string | null = null;
  
  if (season && episode) {
    // Look for title after the season/episode info
    const titlePatterns = [
      new RegExp(`(?:Season?\\s*)?${season}\\s*x\\s*${episode}\\s*[\\-_]?\\s*(.+?)(?:\\s*\\-?\\s*\\d+)?$`, 'i'),
      new RegExp(`S${season.padStart(2, '0')}E${episode.padStart(2, '0')}\\s*[\\-_]?\\s*(.+?)(?:\\s*\\-?\\s*\\d+)?$`, 'i'),
      new RegExp(`${season}\\s*x\\s*${episode}\\s*[\\-_]?\\s*(.+?)(?:\\s*\\-?\\s*\\d+)?$`, 'i')
    ];

    for (const pattern of titlePatterns) {
      const match = cleanName.match(pattern);
      if (match && match[1]) {
        episodeTitle = match[1].trim();
        break;
      }
    }
  } else {
    // If no season/episode found, try to extract title from common patterns
    const generalTitlePatterns = [
      /The Adventures of Pete\s*&?\s*Pete\s*[\\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$/i,
      /Pete\s*&?\s*Pete\s*[\\-_]?\s*(.+?)(?:\s*\-?\s*\d+)?$/i,
      /^(.+?)(?:\s*\-?\s*\d+)?$/  // Fallback: everything except trailing numbers
    ];

    for (const pattern of generalTitlePatterns) {
      const match = cleanName.match(pattern);
      if (match && match[1] && match[1].trim().length > 0) {
        episodeTitle = match[1].trim();
        break;
      }
    }
  }

  // Clean up episode title if found
  if (episodeTitle) {
    episodeTitle = episodeTitle
      .replace(/^[\\-_\s]+|[\\-_\s]+$/g, '') // Remove leading/trailing separators
      .replace(/[_]+/g, ' ') // Replace underscores with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    // Fix common formatting issues
    episodeTitle = episodeTitle
      .replace(/\b([a-z])\s+([smldt])\b/gi, "$1'$2") // Fix missing apostrophes
      .replace(/\bpete\b/gi, 'Pete') // Capitalize Pete
      .replace(/\band\b/gi, 'and') // Normalize 'and'
      .replace(/\bthe\b/gi, 'the'); // Normalize 'the'

    // Capitalize first letter of each word for title case
    episodeTitle = episodeTitle.replace(/\b\w+/g, (word) => {
      // Don't capitalize small words unless they're the first word
      const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'up'];
      const isFirstWord = episodeTitle!.indexOf(word) === 0;
      
      if (!isFirstWord && smallWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  // Build the alt text
  let altText = 'The Adventures of Pete & Pete';
  
  if (season && episode) {
    // Don't include season/episode info for Season 0 (specials/shorts)
    if (parseInt(season) === 0) {
      // For Season 0, just use the title if available
      if (episodeTitle && episodeTitle.length > 0) {
        altText += ` - ${episodeTitle}`;
      }
    } else {
      // Normal season/episode format
      altText += ` - Season ${parseInt(season)}, Episode ${parseInt(episode)}`;
      
      if (episodeTitle && episodeTitle.length > 0) {
        altText += `: ${episodeTitle}`;
      }
    }
  } else if (episodeTitle && episodeTitle.length > 0 && 
             !episodeTitle.toLowerCase().includes('pete') && 
             episodeTitle.length > 3) {
    // Only add title if it's meaningful and doesn't already contain "pete"
    altText += ` - ${episodeTitle}`;
  }
  
  return altText;
}

// Main function - shouldn't need to edit this
async function main() {
  try {
    const { LAST_IMAGE_NAME: lastImageName } = process.env;
    const nextImage = await getNextImage({ lastImageName });

    console.log(`Posting: ${nextImage.imageName}`);

    // Generate alt text and log it for debugging
    const altText = altTextFromImageName(nextImage.imageName);
    console.log(`Alt text: ${altText}`);

    await postImage({
      path: nextImage.absolutePath,
      text: postTextFromImageName(nextImage.imageName),
      altText: altText,
    });

    console.log('Successfully posted to Bluesky!');
    
    // Output filename for GitHub Actions to capture
    console.log(nextImage.imageName);
    
  } catch (error) {
    console.error('Error posting to Bluesky:', error);
    process.exit(1);
  }
}

main();