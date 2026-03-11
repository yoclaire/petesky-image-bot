import { BskyAgent, stringifyLex, jsonToLex } from '@atproto/api';
import * as fs from 'fs';

const GET_TIMEOUT = 15e3; // 15s
const POST_TIMEOUT = 60e3; // 60s

async function loadImageData(imagePath: fs.PathLike) {
  const buffer = await fs.promises.readFile(imagePath);

  if (buffer.byteLength > 1024 * 1024) {
    throw new Error(
      `Image exceeds Bluesky's 1MB limit (${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB). Resize before adding to imagequeue.`
    );
  }

  return { data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) };
}

interface FetchHandlerResponse {
  status: number;
  headers: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

async function fetchHandler(
  reqUri: string,
  reqMethod: string,
  reqHeaders: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reqBody: any,
): Promise<FetchHandlerResponse> {
  const reqMimeType = reqHeaders['Content-Type'] || reqHeaders['content-type'];
  if (reqMimeType && reqMimeType.startsWith('application/json')) {
    reqBody = stringifyLex(reqBody);
  }

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), reqMethod === 'post' ? POST_TIMEOUT : GET_TIMEOUT);

  try {
    const res = await fetch(reqUri, {
      method: reqMethod,
      headers: reqHeaders,
      body: reqBody,
      signal: controller.signal,
    });

    const resStatus = res.status;
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((value: string, key: string) => {
      resHeaders[key] = value;
    });
    const resMimeType = resHeaders['Content-Type'] || resHeaders['content-type'];
    let resBody;
    if (resMimeType) {
      if (resMimeType.startsWith('application/json')) {
        resBody = jsonToLex(await res.json());
      } else if (resMimeType.startsWith('text/')) {
        resBody = await res.text();
      } else {
        resBody = await res.blob();
      }
    }

    return {
      status: resStatus,
      headers: resHeaders,
      body: resBody,
    };
  } finally {
    clearTimeout(to);
  }
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

  const agent = new BskyAgent({ service: 'https://bsky.social' });
  BskyAgent.configure({
    fetch: fetchHandler,
  });
  await agent.login({ identifier, password });
  const { data } = await loadImageData(path);

  const testUpload = await agent.uploadBlob(data, { encoding: 'image/jpg' });
  await agent.post({
    text: text,
    embed: {
      images: [
        {
          image: testUpload.data.blob,
          alt: altText,
          aspectRatio: {
            width: 4,
            height: 3,
          },
        },
      ],
      $type: 'app.bsky.embed.images',
    },
  });
}

export { postImage };
