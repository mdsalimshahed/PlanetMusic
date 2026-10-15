import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePlayerSource } from '../src/Studio/components/Player/resolvePlayerSource.js';

const track = {
  trackId: 42,
  customLinks: {
    deezer: 'https://www.deezer.com/track/123',
    hasLocal: true,
    yt: 'https://www.youtube.com/watch?v=abcdefghijk'
  },
  previewUrl: 'https://example.com/preview.mp3'
};

test('preserves source priority and extracts the linked YouTube ID', () => {
  assert.deepEqual(
    resolvePlayerSource(track, [], false, ''),
    {
      trackId: 42,
      dzUrl: 'https://www.deezer.com/track/123',
      extractedYtId: 'abcdefghijk',
      hasArl: false,
      intendedSource: 'deezer'
    }
  );
});

test('honors a usable forced source and falls back when that source has failed', () => {
  assert.equal(
    resolvePlayerSource({ ...track, forceSource: 'youtube' }, [], false, '').intendedSource,
    'youtube'
  );
  assert.equal(
    resolvePlayerSource({ ...track, forceSource: 'youtube' }, ['youtube'], false, '').intendedSource,
    'deezer'
  );
});

test('only selects an iTunes preview outside the sync workspace', () => {
  const previewTrack = { trackId: 43, previewUrl: track.previewUrl };

  assert.equal(resolvePlayerSource(previewTrack, [], false, '').intendedSource, 'preview');
  assert.equal(resolvePlayerSource(previewTrack, [], true, '').intendedSource, null);
});

test('requires a configured Deezer credential before treating it as available', () => {
  assert.equal(resolvePlayerSource(track, [], false, '  ').hasArl, false);
  assert.equal(resolvePlayerSource(track, [], false, 'test-arl').hasArl, true);
});
