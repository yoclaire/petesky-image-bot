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

interface SelectorOptions {
  stateDir?: string;
  month?: number; // 1-12, defaults to the current month
}

// Tracks every posted image with a bit vector (~1KB for 9000 images)
// guaranteeing full pool exhaustion before any repeats. Bits are keyed to
// the sorted filename list persisted in .image-manifest.json — when images
// are added or removed, posted marks are remapped by filename, not reset.
// Selection is random within the unposted pool — unpredictable but thorough.
class LargeScaleImageSelector {
  private statePath: string;
  private manifestPath: string;
  private sortedImages: string[];
  private indexMap: Map<string, number>;
  private month: number;

  constructor(validImageFiles: string[], options: SelectorOptions = {}) {
    const stateDir = options.stateDir ?? PROJECT_ROOT;
    this.statePath = path.join(stateDir, '.large-scale-history.json');
    this.manifestPath = path.join(stateDir, '.image-manifest.json');
    this.sortedImages = [...validImageFiles].sort();
    this.indexMap = new Map(this.sortedImages.map((img, i) => [img, i]));
    this.month = options.month ?? new Date().getMonth() + 1;
    console.log(`Managing ${this.sortedImages.length} images with bit-vector tracking`);
  }

  private filterImagesBySeasonalRules(): string[] {
    const month = this.month;

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
    if (imgs.length > 0) {
      console.log(`${imgs.length} non-seasonal screenshots available`);
      return imgs;
    }
    console.warn('No non-seasonal screenshots found, using all');
    return this.sortedImages;
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

  private loadState(): SelectionState | null {
    if (!fs.existsSync(this.statePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.statePath, 'utf8');
      const parsed: unknown = JSON.parse(data);

      if (!this.isValidState(parsed)) {
        console.log('Unrecognized state format, resetting');
        return null;
      }

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Could not load state:', message);
      return null;
    }
  }

  private loadManifest(): string[] | null {
    if (!fs.existsSync(this.manifestPath)) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
      console.warn('Unrecognized manifest format, ignoring');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Could not load manifest:', message);
      return null;
    }
  }

  private sameList(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  // Returns state and bits keyed to the current sorted image list, remapping
  // posted marks by filename when the pool has changed since the last run.
  private reconcileState(): { state: SelectionState; bits: Buffer; manifestChanged: boolean } {
    const state = this.loadState();

    if (state) {
      const manifestFromFile = this.loadManifest();
      // States written before manifest tracking were keyed to the sorted
      // directory listing of their time — adoptable if the count still matches
      const manifest = manifestFromFile
        ?? (state.imageCount === this.sortedImages.length ? this.sortedImages : null);

      if (manifest && state.imageCount === manifest.length) {
        const oldBits = Buffer.from(state.postedBits, 'hex');

        if (oldBits.length === Math.ceil(manifest.length / 8)) {
          if (this.sameList(manifest, this.sortedImages)) {
            return { state, bits: oldBits, manifestChanged: manifestFromFile === null };
          }

          // Pool changed — carry each posted mark over to the image's new index
          const bits = this.createBitVector(this.sortedImages.length);
          let preserved = 0;
          manifest.forEach((img, oldIdx) => {
            const newIdx = this.indexMap.get(img);
            if (newIdx !== undefined && this.getBit(oldBits, oldIdx)) {
              this.setBit(bits, newIdx);
              preserved++;
            }
          });
          console.log(`Pool changed (${manifest.length} -> ${this.sortedImages.length} images), preserved ${preserved} posted marks`);

          state.postedBits = bits.toString('hex');
          state.imageCount = this.sortedImages.length;
          return { state, bits, manifestChanged: true };
        }
      }

      console.log('State does not match image pool, resetting');
    }

    const fresh = this.createFreshState();
    return { state: fresh, bits: Buffer.from(fresh.postedBits, 'hex'), manifestChanged: true };
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

  private saveState(state: SelectionState, manifestChanged: boolean): void {
    state.lastUpdated = new Date().toISOString();
    try {
      if (manifestChanged) {
        fs.writeFileSync(this.manifestPath, JSON.stringify(this.sortedImages, null, 1), 'utf8');
      }
      fs.writeFileSync(this.statePath, JSON.stringify(state), 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to save state:', message);
    }
  }

  // --- Selection ---

  public selectNextImage(): { imageName: string; cycleInfo: string } {
    const { state, bits, manifestChanged } = this.reconcileState();
    const seasonalPool = this.filterImagesBySeasonalRules();

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

    this.saveState(state, manifestChanged);

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
}

export { LargeScaleImageSelector };
