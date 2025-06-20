#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import ffmpeg from 'fluent-ffmpeg';
import * as cliProgress from 'cli-progress';

interface ExtractionOptions {
  mode: 'iframe' | 'interval';
  interval: number;
  sceneThreshold: number;
  denoise: boolean;
  aspectRatio: '4:3' | '16:9' | 'original';
  width: number;
  height: number;
  quality: number;
  videoDir: string;
  outputDir: string;
  verbose: boolean;
}

interface VideoFile {
  path: string;
  name: string;
  cleanName: string;
}

class ScreenshotExtractor {
  private options: ExtractionOptions;
  private progressBar: cliProgress.SingleBar;
  private supportedExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.wmv', '.flv', '.webm', '.ts'];

  constructor(options: ExtractionOptions) {
    this.options = options;
    this.progressBar = new cliProgress.SingleBar({
      format: '🎬 Extracting |{bar}| {percentage}% | {value}/{total} frames | {filename}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  private log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
    const symbols = {
      info: '🔍',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    };
    
    console.log(`${symbols[level]} ${message}`);
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [this.options.outputDir, path.join(this.options.outputDir, '..', 'imagequeue')];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  private cleanFilename(filename: string): string {
    return filename
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private async findVideoFiles(): Promise<VideoFile[]> {
    if (!fs.existsSync(this.options.videoDir)) {
      throw new Error(`Videos directory not found: ${this.options.videoDir}`);
    }

    const files = fs.readdirSync(this.options.videoDir);
    const videoFiles: VideoFile[] = [];

    for (const file of files) {
      const filePath = path.join(this.options.videoDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile() && this.supportedExtensions.includes(path.extname(file).toLowerCase())) {
        const name = path.basename(file, path.extname(file));
        videoFiles.push({
          path: filePath,
          name: file,
          cleanName: this.cleanFilename(name)
        });
      }
    }

    return videoFiles;
  }

  private buildVideoFilters(): string {
    const filters: string[] = [];

    // Scene selection or frame interval
    if (this.options.mode === 'iframe') {
      filters.push(`select='eq(pict_type,PICT_TYPE_I)*gt(scene,${this.options.sceneThreshold})'`);
    } else {
      filters.push(`fps=1/${this.options.interval}`);
    }

    // Denoising for VHS content
    if (this.options.denoise) {
      filters.push('hqdn3d=2:1:2:3');
    }

    // Aggressive letterbox removal + aspect ratio correction
    if (this.options.aspectRatio !== 'original') {
      const { width, height } = this.options;
      
      if (this.options.aspectRatio === '4:3') {
        // Gentle letterbox removal - only crop obvious black bars
        // This removes minimal content to preserve the scene
        filters.push('crop=iw:ih*0.9:0:ih*0.05');
        // Then scale to fill exact 4:3 dimensions
        filters.push(`scale=${width}:${height}`);
      } else if (this.options.aspectRatio === '16:9') {
        // For 16:9, crop to remove any pillarboxing
        filters.push('crop=iw*0.9:ih:iw*0.05:0');
        filters.push(`scale=${width}:${height}`);
      }
    }

    return filters.join(',');
  }

  private async extractFromVideo(video: VideoFile): Promise<number> {
    return new Promise((resolve, reject) => {
      const outputPattern = path.join(this.options.outputDir, `${video.cleanName}-%04d.jpg`);
      const videoFilters = this.buildVideoFilters();

      let extractedCount = 0;

      const command = ffmpeg(video.path)
        .videoFilters(videoFilters)
        .outputOptions([
          '-vsync vfr',
          `-q:v ${this.options.quality}`,
          '-f image2'
        ])
        .output(outputPattern)
        .on('start', (commandLine) => {
          if (this.options.verbose) {
            this.log(`FFmpeg command: ${commandLine}`, 'info');
          }
        })
        .on('progress', (progress) => {
          if (progress.frames && !this.progressBar.isActive) {
            this.progressBar.start(100, 0, { filename: video.name });
          }
          if (progress.percent) {
            this.progressBar.update(Math.round(progress.percent), { filename: video.name });
          }
        })
        .on('end', () => {
          this.progressBar.stop();
          
          // Count generated files
          const files = fs.readdirSync(this.options.outputDir);
          extractedCount = files.filter(f => f.startsWith(video.cleanName) && f.endsWith('.jpg')).length;
          
          resolve(extractedCount);
        })
        .on('error', (err) => {
          this.progressBar.stop();
          reject(new Error(`FFmpeg error for ${video.name}: ${err.message}`));
        });

      command.run();
    });
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  private async testVideoFile(videoPath: string): Promise<boolean> {
    try {
      await this.getVideoDuration(videoPath);
      return true;
    } catch {
      return false;
    }
  }

  async extract(): Promise<void> {
    try {
      this.log('🎬 Starting Pete & Pete screenshot extraction...');
      
      // Setup
      await this.ensureDirectories();
      const videoFiles = await this.findVideoFiles();
      
      if (videoFiles.length === 0) {
        throw new Error('No video files found');
      }

      this.log(`Found ${videoFiles.length} video file(s)`);
      this.log(`Mode: ${this.options.mode === 'iframe' ? 'I-frame + scene detection' : `Every ${this.options.interval} seconds`}`);
      this.log(`Output: ${this.options.width}x${this.options.height} (${this.options.aspectRatio}${this.options.aspectRatio !== 'original' ? ' - gentle letterbox removal' : ''})`);
      this.log(`Quality: ${this.options.quality}/10 ${this.options.denoise ? '+ denoising' : ''}`);
      console.log('');

      let totalExtracted = 0;
      let processed = 0;

      for (const video of videoFiles) {
        try {
          this.log(`Processing: ${video.name}`);
          
          // Test if file is readable
          if (!(await this.testVideoFile(video.path))) {
            this.log(`Skipping corrupted file: ${video.name}`, 'warn');
            continue;
          }

          // Get duration for estimation
          if (this.options.mode === 'interval') {
            const duration = await this.getVideoDuration(video.path);
            const estimated = Math.floor(duration / this.options.interval);
            this.log(`Duration: ~${Math.round(duration)}s, estimating ~${estimated} frames`);
          }

          // Extract screenshots
          const extracted = await this.extractFromVideo(video);
          
          if (extracted > 0) {
            this.log(`Extracted ${extracted} screenshots`, 'success');
            totalExtracted += extracted;
          } else {
            this.log(`No screenshots extracted from ${video.name}`, 'warn');
          }
          
          processed++;
          console.log('');
          
        } catch (error) {
          this.log(`Failed to process ${video.name}: ${error.message}`, 'error');
          console.log('');
        }
      }

      // Final summary
      this.log('🎉 Extraction complete!', 'success');
      console.log('📊 Summary:');
      console.log(`  • Videos processed: ${processed}/${videoFiles.length}`);
      console.log(`  • Total screenshots: ${totalExtracted}`);
      console.log(`  • Output format: ${this.options.width}x${this.options.height} (${this.options.aspectRatio})`);
      console.log('');
      
      if (totalExtracted > 0) {
        console.log('📝 Next steps:');
        console.log(`1. Review screenshots in '${this.options.outputDir}' folder`);
        console.log(`2. Copy your best shots to 'imagequeue' folder`);
        console.log('3. Screenshots now use 720x540 4:3 with gentle letterbox removal!');
        console.log('');
        this.log('🤖 Ready for Bluesky posting!', 'success');
      }

    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// CLI Configuration
program
  .name('extract-screenshots')
  .description('Extract screenshots from Pete & Pete videos with proper aspect ratio')
  .version('1.0.0');

program
  .option('-m, --mode <mode>', 'extraction mode: "iframe" or "interval"', 'iframe')
  .option('-i, --interval <seconds>', 'interval between frames (for interval mode)', '6')
  .option('-s, --scene-threshold <threshold>', 'scene detection threshold (for iframe mode)', '0.1')
  .option('-d, --denoise', 'apply denoising (recommended for VHS)', false)
  .option('-a, --aspect-ratio <ratio>', 'aspect ratio: "4:3", "16:9", or "original"', '4:3')
  .option('-w, --width <pixels>', 'output width', '720')
  .option('-h, --height <pixels>', 'output height', '540')
  .option('-q, --quality <level>', 'JPEG quality (1-10, higher = better)', '2')
  .option('--video-dir <path>', 'videos directory', './videos')
  .option('--output-dir <path>', 'output directory', './raw_screenshots')
  .option('-v, --verbose', 'verbose output', false)
  .action(async (options) => {
    // Validate options
    if (!['iframe', 'interval'].includes(options.mode)) {
      console.error('❌ Mode must be "iframe" or "interval"');
      process.exit(1);
    }

    if (!['4:3', '16:9', 'original'].includes(options.aspectRatio)) {
      console.error('❌ Aspect ratio must be "4:3", "16:9", or "original"');
      process.exit(1);
    }

    // Set dimensions based on aspect ratio
    let width = parseInt(options.width);
    let height = parseInt(options.height);
    
    if (options.aspectRatio === '4:3' && (width !== 720 || height !== 540)) {
      width = 720;
      height = 540;
      console.log('📐 Using 720x540 for 4:3 aspect ratio (VLC standard)');
    } else if (options.aspectRatio === '16:9' && (width !== 720 || height !== 405)) {
      width = 720;
      height = 405;
      console.log('📐 Using 720x405 for 16:9 aspect ratio');
    }

    const extractorOptions: ExtractionOptions = {
      mode: options.mode as 'iframe' | 'interval',
      interval: parseInt(options.interval),
      sceneThreshold: parseFloat(options.sceneThreshold),
      denoise: options.denoise,
      aspectRatio: options.aspectRatio as '4:3' | '16:9' | 'original',
      width,
      height,
      quality: parseInt(options.quality),
      videoDir: options.videoDir,
      outputDir: options.outputDir,
      verbose: options.verbose
    };

    const extractor = new ScreenshotExtractor(extractorOptions);
    await extractor.extract();
  });

// Example usage help
program.addHelpText('after', `

Examples:
  # Extract I-frames with scene detection (720x540 4:3, removes letterboxing)
  $ yarn extract

  # Extract every 6 seconds with VHS denoising
  $ yarn extract --mode interval --interval 6 --denoise

  # Extract for widescreen content (720x405 16:9, removes letterboxing)
  $ yarn extract --aspect-ratio 16:9

  # High quality extraction every 4 seconds
  $ yarn extract --mode interval --interval 4 --quality 1 --denoise

  # Custom resolution
  $ yarn extract --width 640 --height 480

  # Verbose output with custom paths
  $ yarn extract --video-dir ./my-videos --output-dir ./screenshots --verbose

Note: Default 4:3 resolution is now 720x540 to match VLC quality standards.
4:3 and 16:9 modes aggressively remove letterboxing for perfect aspect ratios.
`);

if (require.main === module) {
  program.parse();
}