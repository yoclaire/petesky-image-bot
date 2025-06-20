import { postImage } from './clients/at';
import { getNextImage } from './images';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

interface PostingHistoryEntry {
  imageName: string;
  timestamp: string;
  altText: string;
  episode?: string;
  season?: number;
  episodeNumber?: number;
  cycleInfo?: string;
}

interface PostingHistory {
  entries: PostingHistoryEntry[];
  lastUpdated: string;
}

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

// Extract episode identifier for clustering prevention
function extractEpisodeInfo(imageName: string): { season?: number; episode?: number; episodeId?: string } {
  const cleanName = imageName.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '');
  
  // Try to extract season and episode numbers
  const patterns = [
    /(?:Season?\s*)?(\d+)x(\d+)/i,
    /S(\d+)E(\d+)/i,
    /(\d+)\s*x\s*(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = cleanName.match(pattern);
    if (match) {
      const season = parseInt(match[1]);
      const episode = parseInt(match[2]);
      return {
        season,
        episode,
        episodeId: `S${season}E${episode}`
      };
    }
  }

  return {};
}

// Check for seasonal episodes and whether they should be posted now
function getSeasonalStatus(imageName: string): { isSeasonalEpisode: boolean; currentlySeasonal: boolean; seasonType?: string } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const content = imageName.toLowerCase();
  
  // Halloween episode: Halloweenie (S02E06)
  if (content.includes('halloweenie')) {
    return {
      isSeasonalEpisode: true,
      currentlySeasonal: month === 10,
      seasonType: 'halloween'
    };
  }
  
  // Christmas episodes: O' Christmas Pete and New Year's Pete
  if (content.includes('christmas_pete') || content.includes('o\'_christmas_pete') || content.includes('new_year\'s_pete') || content.includes('new_years_pete')) {
    return {
      isSeasonalEpisode: true,
      currentlySeasonal: month === 12,
      seasonType: 'christmas'
    };
  }
  
  // Not a seasonal episode
  return {
    isSeasonalEpisode: false,
    currentlySeasonal: true // Non-seasonal episodes can be posted any time
  };
}

// Load posting history
function loadPostingHistory(): PostingHistory {
  const historyPath = path.join(process.cwd(), '.bot-history.json');
  
  if (!fs.existsSync(historyPath)) {
    return {
      entries: [],
      lastUpdated: new Date().toISOString()
    };
  }
  
  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Could not load posting history, starting fresh:', error.message);
    return {
      entries: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

// Save posting history
function savePostingHistory(history: PostingHistory): void {
  const historyPath = path.join(process.cwd(), '.bot-history.json');
  history.lastUpdated = new Date().toISOString();
  
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.warn('Could not save posting history:', error.message);
  }
}

// Post with retry logic
async function postWithRetry(imageData: any, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await postImage(imageData);
      return;
    } catch (error) {
      console.log(`Posting attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to post after ${maxRetries} attempts: ${error.message}`);
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
  const filePath = path.join(process.cwd(), '.last_posted_image');
  fs.writeFileSync(filePath, imageName.trim(), 'utf8');
}

// Enhanced image selection with large-scale system (seasonal rules built-in)
async function selectImageWithLargeScale(): Promise<{ imageName: string; absolutePath: string; cycleInfo?: string }> {
  const { LAST_IMAGE_NAME: lastImageName } = process.env;
  
  // The large-scale selector handles all seasonal rules internally
  // No need for multiple attempts - it will only return seasonally appropriate images
  const nextImage = await getNextImage({ lastImageName });
  
  return nextImage;
}

// Main function
async function main() {
  try {
    const nextImage = await selectImageWithLargeScale();

    console.log(`Posting: ${nextImage.imageName}`);
    if (nextImage.cycleInfo) {
      console.log(`Large-scale status: ${nextImage.cycleInfo}`);
    }

    // Generate alt text and log it for debugging
    const altText = altTextFromImageName(nextImage.imageName);
    console.log(`Alt text: ${altText}`);

    // Post with retry logic
    await postWithRetry({
      path: nextImage.absolutePath,
      text: postTextFromImageName(nextImage.imageName),
      altText: altText,
    });

    console.log('Successfully posted to Bluesky!');
    
    // Save to posting history
    const history = loadPostingHistory();
    const episodeInfo = extractEpisodeInfo(nextImage.imageName);
    
    const entry: PostingHistoryEntry = {
      imageName: nextImage.imageName,
      timestamp: new Date().toISOString(),
      altText: altText,
      episode: episodeInfo.episodeId,
      season: episodeInfo.season,
      episodeNumber: episodeInfo.episode,
      cycleInfo: nextImage.cycleInfo
    };
    
    history.entries.push(entry);
    
    // Keep last 100 entries (increased for large-scale tracking)
    if (history.entries.length > 100) {
      history.entries = history.entries.slice(-100);
    }
    
    savePostingHistory(history);
    
    // Save the posted image name for GitHub Actions
    savePostedImageName(nextImage.imageName);
    
    // Log statistics
    console.log(`Total posts in history: ${history.entries.length}`);
    
  } catch (error) {
    console.error('Error posting to Bluesky:', error);
    process.exit(1);
  }
}

main();