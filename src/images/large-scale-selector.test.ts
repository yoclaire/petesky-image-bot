import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LargeScaleImageSelector } from './large-scale-selector';

const JULY = 7;

function tmpStateDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'selector-test-'));
}

// Non-seasonal image names: `episodes` episodes with `perEpisode` screenshots each
function pool(episodes: number, perEpisode: number, season = 1): string[] {
  const images: string[] = [];
  for (let e = 1; e <= episodes; e++) {
    for (let i = 1; i <= perEpisode; i++) {
      const ep = `S${String(season).padStart(2, '0')}E${String(e).padStart(2, '0')}`;
      images.push(`${ep}_-_Episode_Title-${String(i).padStart(4, '0')}.jpg`);
    }
  }
  return images;
}

// Select `count` images, constructing a fresh selector each time
// (mirrors production: one selector instance per bot run)
function drain(stateDir: string, images: string[], count: number, month = JULY): string[] {
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const selector = new LargeScaleImageSelector(images, { stateDir, month });
    picked.push(selector.selectNextImage().imageName);
  }
  return picked;
}

test('posts every image exactly once before any repeat', () => {
  const dir = tmpStateDir();
  const images = pool(4, 3); // 12 images

  const firstCycle = drain(dir, images, 12);
  assert.deepStrictEqual(new Set(firstCycle), new Set(images));

  const secondCycle = drain(dir, images, 12);
  assert.deepStrictEqual(new Set(secondCycle), new Set(images));
});

test('consecutive selections come from different episodes', () => {
  const dir = tmpStateDir();
  const images = pool(6, 10);

  const picked = drain(dir, images, 10);
  for (let i = 1; i < picked.length; i++) {
    const prev = picked[i - 1].slice(0, 6);
    const curr = picked[i].slice(0, 6);
    assert.notStrictEqual(curr, prev, `picks ${i - 1} and ${i} share episode ${curr}`);
  }
});

test('October restricts selection to Halloween images', () => {
  const dir = tmpStateDir();
  const halloween = [1, 2, 3, 4, 5].map(i => `S02E06_-_Halloweenie-${String(i).padStart(4, '0')}.jpg`);
  const images = [...pool(4, 5), ...halloween];

  const picked = drain(dir, images, 5, 10);
  assert.deepStrictEqual(new Set(picked), new Set(halloween));
});

test('December restricts selection to Christmas images', () => {
  const dir = tmpStateDir();
  const christmas = [
    ...[1, 2, 3, 4].map(i => `S03E11_-_O'_Christmas_Pete-${String(i).padStart(4, '0')}.jpg`),
    ...[1, 2, 3].map(i => `S00E05_-_New_Year's_Pete-${String(i).padStart(4, '0')}.jpg`),
  ];
  const images = [...pool(4, 5), ...christmas];

  const picked = drain(dir, images, 7, 12);
  assert.deepStrictEqual(new Set(picked), new Set(christmas));
});

test('other months exclude seasonal images', () => {
  const dir = tmpStateDir();
  const nonSeasonal = pool(3, 2); // 6 images
  const seasonal = [
    'S02E06_-_Halloweenie-0001.jpg',
    "S03E11_-_O'_Christmas_Pete-0001.jpg",
  ];
  const images = [...nonSeasonal, ...seasonal];

  const picked = drain(dir, images, 6);
  assert.deepStrictEqual(new Set(picked), new Set(nonSeasonal));
});

test('adding images preserves already-posted marks', () => {
  const dir = tmpStateDir();
  const base = pool(5, 2); // 10 images
  const posted = new Set(drain(dir, base, 4));

  const expanded = [...base, ...pool(5, 1, 2)]; // 5 new images from other episodes
  const rest = drain(dir, expanded, 11);

  assert.strictEqual(new Set(rest).size, 11, 'remaining picks should not repeat');
  for (const img of rest) {
    assert.ok(!posted.has(img), `${img} was already posted before the pool grew`);
  }
  assert.deepStrictEqual(
    new Set([...posted, ...rest]),
    new Set(expanded),
    'posted + remaining should cover the expanded pool exactly'
  );
});

test('removing images preserves already-posted marks for survivors', () => {
  const dir = tmpStateDir();
  const base = pool(5, 2); // 10 images
  const posted = new Set(drain(dir, base, 4));

  const removedPosted = [...posted][0];
  const removedUnposted = base.find(img => !posted.has(img))!;
  const shrunk = base.filter(img => img !== removedPosted && img !== removedUnposted);

  const expectedRemaining = shrunk.filter(img => !posted.has(img)); // 5 images
  const rest = drain(dir, shrunk, expectedRemaining.length);

  assert.deepStrictEqual(new Set(rest), new Set(expectedRemaining));
});

test('state from before the manifest existed is adopted, not reset', () => {
  const dir = tmpStateDir();
  const images = pool(5, 2); // 10 images
  const posted = new Set(drain(dir, images, 4));

  // Simulate a state file written before manifest tracking existed
  fs.rmSync(path.join(dir, '.image-manifest.json'));

  const rest = drain(dir, images, 6);
  assert.deepStrictEqual(
    new Set([...posted, ...rest]),
    new Set(images),
    'pre-manifest bits keyed to the same pool should be kept'
  );
});

test('pre-manifest state with a changed pool resets cleanly', () => {
  const dir = tmpStateDir();
  const base = pool(5, 2); // 10 images
  drain(dir, base, 3);

  fs.rmSync(path.join(dir, '.image-manifest.json'));

  // Without a manifest there is nothing to remap against — expect a full reset
  const expanded = [...base, ...pool(2, 1, 2)]; // 12 images
  const picked = drain(dir, expanded, 12);
  assert.deepStrictEqual(new Set(picked), new Set(expanded));
});

test('falls back to the full pool when every image is seasonal', () => {
  const dir = tmpStateDir();
  const images = [
    'S02E06_-_Halloweenie-0001.jpg',
    "S03E11_-_O'_Christmas_Pete-0001.jpg",
  ];

  const picked = drain(dir, images, 2);
  assert.deepStrictEqual(new Set(picked), new Set(images));
});

test('corrupted state file resets without crashing', () => {
  const dir = tmpStateDir();
  const images = pool(4, 3); // 12 images
  drain(dir, images, 2);

  fs.writeFileSync(path.join(dir, '.large-scale-history.json'), 'not json{', 'utf8');

  const picked = drain(dir, images, 12);
  assert.deepStrictEqual(new Set(picked), new Set(images));
});
