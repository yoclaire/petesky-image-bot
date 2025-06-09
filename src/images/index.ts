import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

type GetNextImageOptions = {
  lastImageName: string | undefined;
};

type NextImage = {
  imageName: string;
  absolutePath: string;
  loopedAround: boolean;
};

// Enhanced weighted random selection to prevent clustering
class WeightedImageSelector {
  private imageWeights: Map<string, number> = new Map();
  private historyDecayFactor = 0.75; // Stronger decay for hourly posting
  private minimumWeight = 0.05; // Lower minimum for better distribution
  private episodeSpacing = 8; // Minimum hours between same episode posts
  
  constructor(private validImageFiles: string[], private recentHistory: string[]) {
    this.initializeWeights();
    this.applyHistoryWeights();
  }
  
  private initializeWeights(): void {
    // Start all images with equal weight
    this.validImageFiles.forEach(image => {
      this.imageWeights.set(image, 1.0);
    });
  }
  
  private applyHistoryWeights(): void {
    // For hourly posting, apply stronger weight reduction
    // Recent posts get exponentially stronger penalties
    this.recentHistory.forEach((imageName, index) => {
      const recency = this.recentHistory.length - index; // More recent = higher number
      
      // Stronger exponential decay for hourly posting
      const baseDecay = Math.pow(this.historyDecayFactor, recency);
      
      // Additional penalty for same episode clustering
      const targetEpisode = extractEpisodeIdentifier(imageName);
      const sameEpisodeBonus = this.recentHistory
        .slice(index) // Only look at posts after this one
        .map(name => extractEpisodeIdentifier(name))
        .filter(episode => episode === targetEpisode).length;
      
      // Extra penalty if this episode appeared multiple times recently
      const clusteringPenalty = sameEpisodeBonus > 0 ? Math.pow(0.5, sameEpisodeBonus) : 1.0;
      
      const weightReduction = baseDecay * clusteringPenalty;
      const currentWeight = this.imageWeights.get(imageName) || 1.0;
      
      // Apply decay, but don't go below minimum
      const newWeight = Math.max(currentWeight * weightReduction, this.minimumWeight);
      this.imageWeights.set(imageName, newWeight);
    });
  }
  
  public selectWeightedRandom(): string {
    const weights = Array.from(this.imageWeights.values());
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (const [imageName, weight] of this.imageWeights.entries()) {
      random -= weight;
      if (random <= 0) {
        return imageName;
      }
    }
    
    // Fallback to last image (should rarely happen)
    return this.validImageFiles[this.validImageFiles.length - 1];
  }
  
  public getWeights(): Map<string, number> {
    return new Map(this.imageWeights);
  }
}

// Extract episode info for better distribution tracking
function extractEpisodeIdentifier(imageName: string): string {
  const cleanName = imageName.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '');
  
  // Try to extract season and episode info with various patterns
  const seasonEpisodePatterns = [
    /(?:Season?\s*)?(\d+)x(\d+)/i,           // 1x05, Season 1x05
    /S(\d+)E(\d+)/i,                         // S01E08
    /(\d+)\s*x\s*(\d+)/i                     // 3 x 12
  ];

  for (const pattern of seasonEpisodePatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      return `S${match[1]}E${match[2]}`;
    }
  }
  
  // If no episode pattern found, use the base filename as identifier
  // This helps prevent clustering of special episodes or non-standard naming
  return cleanName.split('-')[0] || cleanName;
}

// Get recent posting history with episode grouping
function getRecentPostingHistory(historySize: number = 36): string[] {
  const historyPath = path.join(process.cwd(), '.bot-history.json');
  
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(historyPath, 'utf8');
    const history = JSON.parse(data);
    
    return history.entries
      .slice(-historySize) // Get last N entries
      .map((entry: any) => entry.imageName);
  } catch (error) {
    console.warn('Could not load posting history for randomization:', error.message);
    return [];
  }
}

// Check for episode clustering with stricter rules for hourly posting
function hasEpisodeClustering(imageName: string, recentHistory: string[], maxClusterSize: number = 1, windowSize: number = 12): boolean {
  if (recentHistory.length === 0) {
    return false;
  }
  
  const targetEpisode = extractEpisodeIdentifier(imageName);
  
  // For hourly posting, be much stricter about episode spacing
  const recentWindow = recentHistory.slice(-windowSize); // Last 12 hours
  
  // Count how many images from the same episode in recent window
  const sameEpisodeCount = recentWindow
    .map(name => extractEpisodeIdentifier(name))
    .filter(episode => episode === targetEpisode)
    .length;
  
  // Check if this episode appeared in the last few posts (stricter)
  const veryRecentWindow = recentHistory.slice(-6); // Last 6 hours
  const hasVeryRecentEpisode = veryRecentWindow
    .some(name => extractEpisodeIdentifier(name) === targetEpisode);
  
  return sameEpisodeCount >= maxClusterSize || hasVeryRecentEpisode;
}

async function getNextImage(options?: GetNextImageOptions): Promise<NextImage> {
  const { lastImageName } = options || {};
  const readdir = util.promisify(fs.readdir);
  const imagesDir = path.resolve(process.cwd(), 'imagequeue');
  const imageFiles = await readdir(imagesDir);
  const imageRegex = /\.(jpg|jpeg|png|gif|bmp)$/i;
  const validImageFiles = imageFiles.filter((filename) => imageRegex.test(filename));

  if (validImageFiles.length === 0) {
    throw new Error('No image files found in the imagequeue directory.');
  }

  // If only one image, return it
  if (validImageFiles.length === 1) {
    const imageName = validImageFiles[0];
    const absolutePath = path.join(imagesDir, imageName);
    return { imageName, absolutePath, loopedAround: false };
  }

  // Get recent posting history for hourly posting (larger window)
  const recentHistory = getRecentPostingHistory(36); // Last 36 hours
  console.log(`Recent history loaded: ${recentHistory.length} entries (${(recentHistory.length / 24).toFixed(1)} days)`);

  // Use weighted selection to reduce clustering
  const selector = new WeightedImageSelector(validImageFiles, recentHistory);
  
  let selectedImage: string;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    selectedImage = selector.selectWeightedRandom();
    attempts++;
    
    // Check multiple anti-clustering conditions
    const isLastImage = selectedImage === lastImageName;
    const hasEpisodeCluster = hasEpisodeClustering(selectedImage, recentHistory);
    
    // If image passes all checks, use it
    if (!isLastImage && !hasEpisodeCluster) {
      break;
    }
    
    console.log(`Attempt ${attempts}: Skipping ${selectedImage} (lastImage: ${isLastImage}, clustering: ${hasEpisodeCluster})`);
    
    // If we've tried many times, start relaxing constraints
    if (attempts >= 75) {
      // First relaxation: only avoid same episode in last 3 hours
      const veryRecentHistory = recentHistory.slice(-3);
      const hasVeryRecentCluster = veryRecentHistory
        .some(name => extractEpisodeIdentifier(name) === extractEpisodeIdentifier(selectedImage));
      
      if (!isLastImage && !hasVeryRecentCluster) {
        console.log(`Using relaxed clustering rules after ${attempts} attempts`);
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      console.warn(`Could not find suitable image after ${maxAttempts} attempts, using emergency fallback`);
      // Emergency fallback: pick anything except the last few images
      const recentImages = new Set(recentHistory.slice(-3));
      const availableImages = validImageFiles.filter(img => !recentImages.has(img));
      
      if (availableImages.length > 0) {
        selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
      } else {
        // Absolute last resort
        selectedImage = validImageFiles[Math.floor(Math.random() * validImageFiles.length)];
      }
      break;
    }
    
  } while (attempts < maxAttempts);

  const absolutePath = path.join(imagesDir, selectedImage);

  // Log selection info for debugging
  const weights = selector.getWeights();
  const selectedWeight = weights.get(selectedImage) || 0;
  console.log(`Selected: ${selectedImage} (weight: ${selectedWeight.toFixed(3)}, attempts: ${attempts})`);
  
  // Log some weight distribution for debugging
  const sortedWeights = Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log('Top 5 weights:', sortedWeights.map(([name, weight]) => `${name}: ${weight.toFixed(3)}`).join(', '));

  return {
    imageName: selectedImage,
    absolutePath,
    loopedAround: false,
  };
}

export { getNextImage };
