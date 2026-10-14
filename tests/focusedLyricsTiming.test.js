import assert from 'node:assert/strict';
import test from 'node:test';
import { getFocusedLyricsAnimationTiming } from '../src/Studio/components/Workspaces/Lyrics/focusedLyricsTiming.js';

test('uses the same entry and exit animation durations for every line', () => {
  const expected = {
    enterDuration: 0.36,
    enterStagger: 0.055,
    exitDuration: 0.25,
    exitLayerDuration: 0.155
  };

  assert.deepEqual(getFocusedLyricsAnimationTiming(), expected);
});
