import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface LargeScaleHistory {
  recentlyUsed: string[]; // Last N image hashes
  totalImagesEver: number;
  postsThisCycle: number;
  cycleStartedAt: string;
  lastUpdated: string;
  formatVersion: number;
}

// Efficient selector for large screenshot collections (9000+ images)
// Uses exclusion list instead of full cycle tracking to minimize memory usage
class LargeScaleImageSelector {
  private historyPath: string;
  private recentExclusionSize: number;
  private maxFileSize = 50 * 1024; // 50KB limit
  
  constructor(private validImageFiles: string[]) {
    this.historyPath = path.join(process.cwd(), '.large-scale-history.json');
    
    // Scale exclusion size based on collection size
    // For 8,973 images, exclude last ~1,346 (15% - good for hourly bot variety)
    this.recentExclusionSize = Math.min(
      Math.floor(validImageFiles.length * 0.15), // 15% of collection
      2000 // Cap at 2000 for memory efficiency
    );
    
    console.log(`Managing ${validImageFiles.length} images with ${this.recentExclusionSize}-image exclusion list`);
  }
  
  private getSeasonalStatus(imageName: string): { isSeasonalEpisode: boolean; currentlySeasonal: boolean; seasonType?: string } {
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
  
  private filterImagesBySeasonalRules(): string[] {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    
    if (month === 10) {
      // October: ONLY Halloweenie screenshots
      const halloweenieImages = this.validImageFiles.filter(image => {
        const seasonalStatus = this.getSeasonalStatus(image);
        return seasonalStatus.isSeasonalEpisode && seasonalStatus.seasonType === 'halloween';
      });
      
      if (halloweenieImages.length > 0) {
        console.log(`🎃 October: Using only ${halloweenieImages.length} Halloweenie screenshots`);
        return halloweenieImages;
      } else {
        console.warn('October: No Halloweenie screenshots found, falling back to all images');
        return this.validImageFiles;
      }
    }
    
    if (month === 12) {
      // December: ONLY Christmas Pete and New Year's Pete screenshots
      const christmasImages = this.validImageFiles.filter(image => {
        const seasonalStatus = this.getSeasonalStatus(image);
        return seasonalStatus.isSeasonalEpisode && seasonalStatus.seasonType === 'christmas';
      });
      
      if (christmasImages.length > 0) {
        console.log(`🎄 December: Using only ${christmasImages.length} Christmas Pete screenshots`);
        return christmasImages;
      } else {
        console.warn('December: No Christmas Pete screenshots found, falling back to all images');
        return this.validImageFiles;
      }
    }
    
    // All other months: ONLY non-seasonal episodes
    const nonSeasonalImages = this.validImageFiles.filter(image => {
      const seasonalStatus = this.getSeasonalStatus(image);
      return !seasonalStatus.isSeasonalEpisode;
    });
    
    console.log(`Using ${nonSeasonalImages.length} non-seasonal screenshots (excluding seasonal episodes)`);
    return nonSeasonalImages;
  }
  
  private hashFilename(filename: string): string {
    // Create short hash to save space (8 chars = 16M combinations)
    return crypto.createHash('sha256').update(filename).digest('hex').slice(0, 8);
  }
  
  private loadHistory(): LargeScaleHistory {
    if (!fs.existsSync(this.historyPath)) {
      return this.createFreshHistory();
    }
    
    try {
      const data = fs.readFileSync(this.historyPath, 'utf8');
      
      if (data.length > this.maxFileSize) {
        console.warn(`History file too large (${data.length} bytes), resetting`);
        return this.createFreshHistory();
      }
      
      const parsed = JSON.parse(data);
      
      if (this.isValidHistory(parsed)) {
        return parsed;
      } else {
        console.warn('Invalid history structure, resetting');
        return this.createFreshHistory();
      }
    } catch (error) {
      console.warn('Could not load history:', error.message);
      return this.createFreshHistory();
    }
  }
  
  private createFreshHistory(): LargeScaleHistory {
    return {
      recentlyUsed: [],
      totalImagesEver: this.validImageFiles.length,
      postsThisCycle: 0,
      cycleStartedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      formatVersion: 1
    };
  }
  
  private isValidHistory(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.recentlyUsed) &&
      typeof data.totalImagesEver === 'number' &&
      typeof data.postsThisCycle === 'number'
    );
  }
  
  private saveHistory(history: LargeScaleHistory): void {
    history.lastUpdated = new Date().toISOString();
    
    try {
      // Trim exclusion list if it's getting too large
      if (history.recentlyUsed.length > this.recentExclusionSize) {
        history.recentlyUsed = history.recentlyUsed.slice(-this.recentExclusionSize);
      }
      
      const jsonData = JSON.stringify(history, null, 2);
      
      if (jsonData.length > this.maxFileSize) {
        // Emergency trim - keep only most recent exclusions
        const emergencySize = Math.floor(this.recentExclusionSize * 0.7);
        history.recentlyUsed = history.recentlyUsed.slice(-emergencySize);
        console.warn(`Trimmed exclusion list to ${emergencySize} items`);
      }
      
      fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save history:', error.message);
      // Continue without saving - graceful degradation
    }
  }
  
  private extractEpisodeIdentifier(imageName: string): string {
    const cleanName = imageName.replace(/\.(jpg|jpeg|png|gif|bmp)$/i, '');
    
    const patterns = [
      /(?:Season?\s*)?(\d+)x(\d+)/i,
      /S(\d+)E(\d+)/i,
      /(\d+)\s*x\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = cleanName.match(pattern);
      if (match) {
        return `S${match[1]}E${match[2]}`;
      }
    }
    
    return cleanName.split('-')[0] || cleanName;
  }
  
  private getRecentPostingHistory(historySize: number = 8): string[] {
    const historyPath = path.join(process.cwd(), '.bot-history.json');
    
    if (!fs.existsSync(historyPath)) {
      return [];
    }
    
    try {
      const data = fs.readFileSync(historyPath, 'utf8');
      const history = JSON.parse(data);
      
      return history.entries
        .slice(-historySize)
        .map((entry: any) => entry.imageName);
    } catch (error) {
      return [];
    }
  }
  
  public selectNextImage(): { imageName: string; cycleInfo: string } {
    let history = this.loadHistory();
    
    // Check if image collection size changed significantly
    if (Math.abs(history.totalImagesEver - this.validImageFiles.length) > 50) {
      console.log(`Image collection changed significantly (${history.totalImagesEver} → ${this.validImageFiles.length}), resetting`);
      history = this.createFreshHistory();
    }
    
    // Apply seasonal filtering FIRST - this determines what images we can even consider
    const seasonallyAllowedImages = this.filterImagesBySeasonalRules();
    
    // Create exclusion set for fast lookup
    const excludedHashes = new Set(history.recentlyUsed);
    const recentPosts = this.getRecentPostingHistory();
    const recentEpisodes = recentPosts.map(name => this.extractEpisodeIdentifier(name));
    
    // Find available images from the seasonally allowed set (not recently used)
    const availableImages = seasonallyAllowedImages.filter(image => {
      const hash = this.hashFilename(image);
      return !excludedHashes.has(hash);
    });
    
    let selectedImage: string;
    
    if (availableImages.length === 0) {
      // All seasonally allowed images recently used - reset exclusion list for this seasonal set
      console.log(`All ${seasonallyAllowedImages.length} seasonally allowed images recently used - resetting exclusions`);
      console.log(`Completed cycle: ${history.postsThisCycle} posts since ${history.cycleStartedAt}`);
      
      history.recentlyUsed = [];
      history.postsThisCycle = 0;
      history.cycleStartedAt = new Date().toISOString();
      
      // Select from seasonally allowed collection
      selectedImage = seasonallyAllowedImages[Math.floor(Math.random() * seasonallyAllowedImages.length)];
    } else {
      // Try to avoid episode clustering within available seasonal images
      const episodeFilteredImages = availableImages.filter(image => {
        const episode = this.extractEpisodeIdentifier(image);
        return !recentEpisodes.slice(-3).includes(episode); // Avoid last 3 episodes
      });
      
      if (episodeFilteredImages.length > 0) {
        selectedImage = episodeFilteredImages[Math.floor(Math.random() * episodeFilteredImages.length)];
      } else {
        // No episode variety possible, use any available seasonal image
        selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
        console.log('Episode clustering unavoidable with available seasonal images');
      }
    }
    
    // Update history
    const selectedHash = this.hashFilename(selectedImage);
    history.recentlyUsed.push(selectedHash);
    history.postsThisCycle++;
    
    // Save updated history
    this.saveHistory(history);
    
    // Calculate statistics based on seasonal pool
    const exclusionRate = (history.recentlyUsed.length / seasonallyAllowedImages.length * 100).toFixed(1);
    const availableCount = seasonallyAllowedImages.length - history.recentlyUsed.length;
    
    const cycleInfo = `Post ${history.postsThisCycle} - ${availableCount} available (${exclusionRate}% excluded from seasonal pool)`;
    
    console.log(`Selected: ${selectedImage}`);
    console.log(`Status: ${cycleInfo}`);
    
    return {
      imageName: selectedImage,
      cycleInfo
    };
  }
  
  public getStatus(): string {
    try {
      const history = this.loadHistory();
      const seasonallyAllowedImages = this.filterImagesBySeasonalRules();
      const excludedCount = history.recentlyUsed.length;
      const availableCount = seasonallyAllowedImages.length - excludedCount;
      const exclusionRate = (excludedCount / seasonallyAllowedImages.length * 100).toFixed(1);
      
      const now = new Date();
      const month = now.getMonth() + 1;
      let seasonalInfo = '';
      
      if (month === 10) {
        seasonalInfo = ' (🎃 October: Halloweenie only)';
      } else if (month === 12) {
        seasonalInfo = ' (🎄 December: Christmas Pete only)';
      } else {
        seasonalInfo = ' (Non-seasonal episodes only)';
      }
      
      return `${excludedCount}/${seasonallyAllowedImages.length} recently used (${exclusionRate}%) - ${availableCount} available${seasonalInfo}`;
    } catch (error) {
      return 'Error reading status';
    }
  }
}

export { LargeScaleImageSelector };
