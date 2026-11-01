import assert from 'node:assert/strict';
import test from 'node:test';
import { finishAnimationAtCurrentStyles } from '../src/Studio/components/Workspaces/Lyrics/Views/GroupChat/utils/finishAnimation.js';
import { getHistoryGlideStart } from '../src/Studio/components/Workspaces/Lyrics/Views/GroupChat/utils/historyGlide.js';

test("commits an animation's final styles before removing its effect", () => {
  const calls = [];
  finishAnimationAtCurrentStyles({
    commitStyles: () => calls.push('commit'),
    cancel: () => calls.push('cancel')
  });

  assert.deepEqual(calls, ['commit', 'cancel']);
});

test('rebases an interrupted history glide from its current position', () => {
  const start = getHistoryGlideStart({
    previousTop: 120,
    previousTransform: 20,
    currentTop: 60,
    currentTransform: 10,
    scale: 1
  });

  assert.equal(start, 60);
});

test('accounts for the layout scale when rebasing a history glide', () => {
  const start = getHistoryGlideStart({
    previousTop: 240,
    previousTransform: 20,
    currentTop: 120,
    currentTransform: 10,
    scale: 2
  });

  assert.equal(start, 60);
});
