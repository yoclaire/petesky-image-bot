import { test } from 'node:test';
import assert from 'node:assert';
import { altTextFromImageName, composeAltText } from './alt-text';

test('describes a regular episode with season and episode number', () => {
  assert.strictEqual(
    altTextFromImageName("S01E08_-_Hard_Day's_Pete-0157.jpg"),
    "The Adventures of Pete & Pete - Season 1, Episode 8: Hard Day's Pete"
  );
});

test('describes a season-zero special without episode numbering', () => {
  assert.strictEqual(
    altTextFromImageName("S00E05_-_New_Year's_Pete-0001.jpg"),
    "The Adventures of Pete & Pete - New Year's Pete"
  );
});

test('describes a short by title', () => {
  assert.strictEqual(
    altTextFromImageName('The_Adventures_of_Pete_&_Pete_-_0x18_-_The_Dot-0042.jpg'),
    'The Adventures of Pete & Pete - The Dot'
  );
});

test('falls back to the show name for unrecognized filenames', () => {
  assert.strictEqual(altTextFromImageName('random-thing.jpg'), 'The Adventures of Pete & Pete');
});

test('appends the vision description to the episode info', () => {
  assert.strictEqual(
    composeAltText('S01E02_-_Day_of_The_Dot-0189.jpg', 'Little Pete grins at the camera.'),
    'The Adventures of Pete & Pete - Season 1, Episode 2: Day of The Dot — Little Pete grins at the camera.'
  );
});

test('uses episode info alone when no vision description is available', () => {
  assert.strictEqual(
    composeAltText('S01E02_-_Day_of_The_Dot-0189.jpg', null),
    'The Adventures of Pete & Pete - Season 1, Episode 2: Day of The Dot'
  );
});
