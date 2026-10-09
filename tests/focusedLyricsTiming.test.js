import assert from 'node:assert/strict';
import test from 'node:test';
import { getFocusedLyricsAnimationTiming } from '../src/Studio/components/Workspaces/Lyrics/focusedLyricsTiming.js';

test('keeps percentage-based timings below the legacy caps', () => {
  assert.deepEqual(getFocusedLyricsAnimationTiming(1, 4), {
    enterDuration: 0.18,
    enterStagger: 0.04,
    exitDuration: 0.15,
    exitLayerDuration: 0.1
  });
});

test('caps entry, stagger, and exit timings for long lines', () => {
  assert.deepEqual(getFocusedLyricsAnimationTiming(10, 4), {
    enterDuration: 0.36,
    enterStagger: 0.055,
    exitDuration: 0.25,
    exitLayerDuration: 0.155
  });
});

test('caps single-word entry duration and retains the exit-layer minimum', () => {
  assert.deepEqual(getFocusedLyricsAnimationTiming(10, 1), {
    enterDuration: 0.36,
    enterStagger: 0,
    exitDuration: 0.25,
    exitLayerDuration: 0.155
  });

  assert.equal(getFocusedLyricsAnimationTiming(0.2, 2).exitLayerDuration, 0.1);
});

test('applies minimum entry and exit timings to short lines without negative staggers', () => {
  assert.deepEqual(getFocusedLyricsAnimationTiming(0.5, 4), {
    enterDuration: 0.18,
    enterStagger: 0,
    exitDuration: 0.15,
    exitLayerDuration: 0.1
  });
});

test('returns zero animation timings when line duration is invalid', () => {
  assert.deepEqual(getFocusedLyricsAnimationTiming(0, 2), {
    enterDuration: 0,
    enterStagger: 0,
    exitDuration: 0,
    exitLayerDuration: 0
  });
});
