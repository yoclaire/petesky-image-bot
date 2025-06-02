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

async function getNextImage(options?: GetNextImageOptions): Promise<NextImage> {
  const { lastImageName } = options || {};
  const readdir = util.promisify(fs.readdir);
  const imagesDir = path.resolve(__dirname, '../../imagequeue');
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
    return {
      imageName,
      absolutePath,
      loopedAround: false,
    };
  }

  let selectedImage: string;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loop

  do {
    // Randomly select an image
    const randomIndex = Math.floor(Math.random() * validImageFiles.length);
    selectedImage = validImageFiles[randomIndex];
    attempts++;
    
    // If no last image or selected image is different from last, we're good
    if (!lastImageName || selectedImage !== lastImageName) {
      break;
    }
    
    // If we've tried many times and only have 2 images, accept the repeat
    if (attempts >= maxAttempts && validImageFiles.length === 2) {
      break;
    }
    
  } while (attempts < maxAttempts);

  const absolutePath = path.join(imagesDir, selectedImage);

  console.log(`Randomly selected: ${selectedImage} (${validImageFiles.indexOf(selectedImage) + 1}/${validImageFiles.length})`);

  return {
    imageName: selectedImage,
    absolutePath,
    loopedAround: false, // Not applicable for random selection
  };
}

export { getNextImage };
