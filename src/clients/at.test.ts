import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadImageData } from './at';

function tmpFile(bytes: number): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'at-test-')), 'image.jpg');
  fs.writeFileSync(file, Buffer.alloc(bytes));
  return file;
}

test('accepts images within the Bluesky blob limit', async () => {
  const { data } = await loadImageData(tmpFile(999_999));
  assert.strictEqual(data.byteLength, 999_999);
});

test('rejects images over the 1,000,000-byte Bluesky blob limit', async () => {
  // The lexicon limit is 1,000,000 bytes, not 1 MiB — this size passes a
  // 1 MiB check locally but gets rejected by the server
  await assert.rejects(() => loadImageData(tmpFile(1_010_000)), /limit/);
});
