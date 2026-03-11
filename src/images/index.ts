import * as fs from 'fs';
import * as path from 'path';
import { LargeScaleImageSelector } from './large-scale-selector';
import { PROJECT_ROOT } from '../utils/paths';

type NextImage = {
  imageName: string;
  absolutePath: string;
  loopedAround: boolean;
  cycleInfo?: string;
};

async function getNextImage(): Promise<NextImage> {
  const imagesDir = path.resolve(PROJECT_ROOT, 'imagequeue');
  const imageFiles = await fs.promises.readdir(imagesDir);
  const imageRegex = /\.(jpg|jpeg|png|gif|bmp)$/i;
  const validImageFiles = imageFiles.filter((filename) => imageRegex.test(filename));

  if (validImageFiles.length === 0) {
    throw new Error('No image files found in the imagequeue directory.');
  }

  console.log(`Found ${validImageFiles.length} valid images in imagequeue`);

  // For large collections (>1000 images), use exclusion-based approach
  if (validImageFiles.length > 1000) {
    console.log('Using large-scale selector for optimal memory usage');

    const selector = new LargeScaleImageSelector(validImageFiles);
    const selection = selector.selectNextImage();

    console.log(`Selected: ${selection.imageName}`);
    console.log(`Status: ${selector.getStatus()}`);

    const absolutePath = path.join(imagesDir, selection.imageName);

    return {
      imageName: selection.imageName,
      absolutePath,
      loopedAround: false,
      cycleInfo: selection.cycleInfo,
    };
  }

  // For smaller collections (<1000 images), fall back to simple random
  console.log('Using simple random selection for small collection');
  const selectedImage = validImageFiles[Math.floor(Math.random() * validImageFiles.length)];
  const absolutePath = path.join(imagesDir, selectedImage);

  return {
    imageName: selectedImage,
    absolutePath,
    loopedAround: false,
    cycleInfo: `Random selection from ${validImageFiles.length} images`,
  };
}

export { getNextImage };
