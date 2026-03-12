import * as fs from 'fs';
import * as path from 'path';
import { getSeasonalStatus, extractEpisodeIdentifier } from '../utils/episode';
import { PROJECT_ROOT } from '../utils/paths';

interface SelectionState {
  postedBits: string;        // hex-encoded bit vector (1 bit per image)
  imageCount: number;        // image count when bit vector was created
  recentEpisodes: string[];  // recent episode IDs for spacing
  cycleStartedAt: string;
  lastUpdated: string;
  formatVersion: number;
}

const EPISODE_SPACING = 5;
const FORMAT_VERSION = 2;

// Tracks every posted image with a bit vector (~1KB for 9000 images)
// guaranteeing full pool exhaustion before any repeats.
// Selection is random within the unposted pool — unpredictable but thorough.
class LargeScaleImageSelector {
  private statePath: string;
  private sortedImages: string[];
  private indexMap: Map<string, number>;

  constructor(private validImageFiles: string[]) {
    this.statePath = path.join(PROJECT_ROOT, '.large-scale-history.json');
    this.sortedImages = [...validImageFiles].sort();
    this.indexMap = new Map(this.sortedImages.map((img, i) => [img, i]));
    console.log(`Managing ${this.sortedImages.length} images with bit-vector tracking`);
  }

  private filterImagesBySeasonalRules(): string[] {
    const month = new Date().getMonth() + 1;

    if (month === 10) {
      const imgs = this.sortedImages.filter(img => {
        const s = getSeasonalStatus(img);
        return s.isSeasonalEpisode && s.seasonType === 'halloween';
      });
      if (imgs.length > 0) {
        console.log(`October: ${imgs.length} Halloweenie + Halloween screenshots`);
        return imgs;
      }
      console.warn('October: No Halloween screenshots found, using all');
      return this.sortedImages;
    }

    if (month === 12) {
      const imgs = this.sortedImages.filter(img => {
        const s = getSeasonalStatus(img);
        return s.isSeasonalEpisode && s.seasonType === 'christmas';
      });
      if (imgs.length > 0) {
        console.log(`December: ${imgs.length} Christmas + New Year's screenshots`);
        return imgs;
      }
      console.warn('December: No Christmas screenshots found, using all');
      return this.sortedImages;
    }

    const imgs = this.sortedImages.filter(img => !getSeasonalStatus(img).isSeasonalEpisode);
    console.log(`${imgs.length} non-seasonal screenshots available`);
    return imgs;
  }

  // --- Bit vector operations ---

  private createBitVector(size: number): Buffer {
    return Buffer.alloc(Math.ceil(size / 8), 0);
  }

  private setBit(bits: Buffer, index: number): void {
    bits[index >> 3] |= 1 << (index & 7);
  }

  private getBit(bits: Buffer, index: number): boolean {
    return (bits[index >> 3] & (1 << (index & 7))) !== 0;
  }

  private clearBit(bits: Buffer, index: number): void {
    bits[index >> 3] &= ~(1 << (index & 7));
  }

  // --- State persistence ---

  private loadState(): SelectionState {
    if (!fs.existsSync(this.statePath)) {
      return this.createFreshState();
    }

    try {
      const data = fs.readFileSync(this.statePath, 'utf8');
      const parsed: unknown = JSON.parse(data);

      if (!this.isValidState(parsed)) {
        console.log('Migrating from v1 format, resetting');
        return this.createFreshState();
      }

      if (parsed.imageCount !== this.sortedImages.length) {
        console.log(`Image count changed (${parsed.imageCount} -> ${this.sortedImages.length}), resetting`);
        return this.createFreshState();
      }

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Could not load state:', message);
      return this.createFreshState();
    }
  }

  private createFreshState(): SelectionState {
    const bits = this.createBitVector(this.sortedImages.length);
    return {
      postedBits: bits.toString('hex'),
      imageCount: this.sortedImages.length,
      recentEpisodes: [],
      cycleStartedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      formatVersion: FORMAT_VERSION,
    };
  }

  private isValidState(data: unknown): data is SelectionState {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.postedBits === 'string' &&
      typeof obj.imageCount === 'number' &&
      Array.isArray(obj.recentEpisodes) &&
      obj.formatVersion === FORMAT_VERSION
    );
  }

  private saveState(state: SelectionState): void {
    state.lastUpdated = new Date().toISOString();
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(state), 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to save state:', message);
    }
  }

  // --- Selection ---

  public selectNextImage(): { imageName: string; cycleInfo: string } {
    const state = this.loadState();
    const seasonalPool = this.filterImagesBySeasonalRules();
    let bits = Buffer.from(state.postedBits, 'hex');

    // Ensure bit vector is correctly sized
    const expectedSize = Math.ceil(this.sortedImages.length / 8);
    if (bits.length !== expectedSize) {
      bits = this.createBitVector(this.sortedImages.length);
      state.postedBits = bits.toString('hex');
    }

    // Collect unposted images in the seasonal pool
    let unposted: number[] = [];
    for (const img of seasonalPool) {
      const idx = this.indexMap.get(img)!;
      if (!this.getBit(bits, idx)) {
        unposted.push(idx);
      }
    }

    // Pool exhausted — clear bits for this seasonal pool only
    if (unposted.length === 0) {
      console.log(`All ${seasonalPool.length} seasonal images posted — new cycle`);

      for (const img of seasonalPool) {
        this.clearBit(bits, this.indexMap.get(img)!);
      }
      state.postedBits = bits.toString('hex');
      state.cycleStartedAt = new Date().toISOString();
      state.recentEpisodes = [];

      unposted = seasonalPool.map(img => this.indexMap.get(img)!);
    }

    // Episode spacing: prefer images not from recently posted episodes
    const recentEps = new Set(state.recentEpisodes.slice(-EPISODE_SPACING));
    const spaced = unposted.filter(idx => {
      const ep = extractEpisodeIdentifier(this.sortedImages[idx]);
      return !recentEps.has(ep);
    });

    const candidates = spaced.length > 0 ? spaced : unposted;
    const selectedIdx = candidates[Math.floor(Math.random() * candidates.length)];
    const selectedImage = this.sortedImages[selectedIdx];

    // Update state
    this.setBit(bits, selectedIdx);
    state.postedBits = bits.toString('hex');

    const episode = extractEpisodeIdentifier(selectedImage);
    state.recentEpisodes.push(episode);
    if (state.recentEpisodes.length > EPISODE_SPACING * 2) {
      state.recentEpisodes = state.recentEpisodes.slice(-EPISODE_SPACING * 2);
    }

    this.saveState(state);

    // Stats: count set bits in seasonal pool
    let posted = 0;
    for (const img of seasonalPool) {
      if (this.getBit(bits, this.indexMap.get(img)!)) {
        posted++;
      }
    }
    const total = seasonalPool.length;
    const remaining = total - posted;
    const pct = (posted / total * 100).toFixed(1);
    const cycleInfo = `Post ${posted}/${total} (${pct}%) — ${remaining} remaining`;

    return { imageName: selectedImage, cycleInfo };
  }

  public getStatus(): string {
    try {
      const state = this.loadState();
      const seasonalPool = this.filterImagesBySeasonalRules();
      const bits = Buffer.from(state.postedBits, 'hex');

      let posted = 0;
      for (const img of seasonalPool) {
        const idx = this.indexMap.get(img);
        if (idx !== undefined && this.getBit(bits, idx)) {
          posted++;
        }
      }

      const total = seasonalPool.length;
      const remaining = total - posted;
      const month = new Date().getMonth() + 1;
      let tag = '';
      if (month === 10) tag = ' (Halloween)';
      else if (month === 12) tag = ' (Christmas)';

      return `${posted}/${total} posted (${remaining} remaining)${tag}`;
    } catch {
      return 'Error reading status';
    }
  }
}

export { LargeScaleImageSelector };
