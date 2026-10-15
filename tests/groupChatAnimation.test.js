import assert from 'node:assert/strict';
import test from 'node:test';
import { finishAnimationAtCurrentStyles } from '../src/Studio/components/Workspaces/Lyrics/Views/GroupChat/utils/finishAnimation.js';

test("commits an animation's final styles before removing its effect", () => {
  const calls = [];
  finishAnimationAtCurrentStyles({
    commitStyles: () => calls.push('commit'),
    cancel: () => calls.push('cancel')
  });

  assert.deepEqual(calls, ['commit', 'cancel']);
});
