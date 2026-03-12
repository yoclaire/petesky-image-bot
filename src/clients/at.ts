import { AtpAgent } from '@atproto/api';
import * as fs from 'fs';

const REQUEST_TIMEOUT = 60e3; // 60s

async function loadImageData(imagePath: fs.PathLike) {
  const buffer = await fs.promises.readFile(imagePath);

  if (buffer.byteLength > 1024 * 1024) {
    throw new Error(
      `Image exceeds Bluesky's 1MB limit (${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB). Resize before adding to imagequeue.`
    );
  }

  return { data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) };
}

export type PostImageOptions = {
  path: fs.PathLike;
  text: string;
  altText: string;
};

async function postImage({ path, text, altText }: PostImageOptions) {
  const identifier = process.env.BSKY_IDENTIFIER;
  const password = process.env.BSKY_PASSWORD;

  if (!identifier || !password) {
    throw new Error('Missing BSKY_IDENTIFIER or BSKY_PASSWORD environment variables');
  }

  const agent = new AtpAgent({
    service: 'https://bsky.social',
    fetch: async (input, init) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        return await globalThis.fetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    },
  });

  await agent.login({ identifier, password });
  const { data } = await loadImageData(path);

  const upload = await agent.uploadBlob(data, { encoding: 'image/jpeg' });
  await agent.post({
    text,
    embed: {
      $type: 'app.bsky.embed.images',
      images: [
        {
          image: upload.data.blob,
          alt: altText,
          aspectRatio: { width: 4, height: 3 },
        },
      ],
    },
  });
}

export { postImage };
