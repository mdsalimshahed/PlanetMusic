import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPlatformLinkErrors,
  validatePlatformLink
} from '../src/Application/utils/platformLinkValidation.js';

test('accepts a full Deezer track URL with a locale path', () => {
  assert.equal(
    validatePlatformLink('deezer', 'https://www.deezer.com/en/track/854914442'),
    ''
  );
});

test('rejects short shares and non-track Deezer URLs', () => {
  assert.match(
    validatePlatformLink('deezer', 'https://deezer.page.link/aB1cD2eF3gH'),
    /full Deezer track link/
  );
  assert.match(
    validatePlatformLink('deezer', 'https://www.deezer.com/en/album/123456'),
    /full Deezer track link/
  );
  assert.match(
    validatePlatformLink('deezer', 'http://www.deezer.com/en/track/854914442'),
    /https:\/\//
  );
});

test('accepts Spotify track and album links but rejects search URLs', () => {
  assert.equal(
    validatePlatformLink('spotify', 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'),
    ''
  );
  assert.equal(
    validatePlatformLink('spotify', 'https://open.spotify.com/intl-us/album/4iV5W9uYEdYUVa79Axb7Rh'),
    ''
  );
  assert.match(
    validatePlatformLink('spotify', 'https://open.spotify.com/search/song'),
    /track or album link/
  );
});

test('accepts supported YouTube video URLs and rejects unrelated or invalid links', () => {
  assert.equal(validatePlatformLink('yt', 'https://youtu.be/abcdefghijk'), '');
  assert.equal(validatePlatformLink('yt', 'https://music.youtube.com/watch?v=abcdefghijk'), '');
  assert.match(validatePlatformLink('yt', 'https://example.com/watch?v=abcdefghijk'), /YouTube/);
  assert.match(validatePlatformLink('yt', 'https://youtube.com/watch?v=short'), /valid YouTube/);
});

test('allows empty fields but returns field-specific errors for invalid entries', () => {
  assert.deepEqual(getPlatformLinkErrors({ spotify: '', deezer: '', yt: '' }), {
    spotify: '',
    deezer: '',
    yt: ''
  });
  assert.deepEqual(getPlatformLinkErrors({ deezer: 'not a link' }), {
    spotify: '',
    deezer: 'Enter a valid link beginning with https://.',
    yt: ''
  });
});
