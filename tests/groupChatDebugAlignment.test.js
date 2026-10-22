import assert from 'node:assert/strict';
import test from 'node:test';
import { alignTranslationBoxToRowOutline } from '../src/Application/components/GroupChatDebug/translationAlignment.js';

test('centers a translation box directly above its matching red row outline', () => {
  const translation = {
    top: 100,
    left: 40,
    width: 80,
    height: 20
  };

  const rowOutline = {
    top: 150,
    left: 20,
    width: 120,
    height: 18
  };

  const aligned = alignTranslationBoxToRowOutline(translation, rowOutline);

  assert.equal(aligned.top, 130);
  assert.equal(aligned.left, 40);
  assert.equal(aligned.width, 80);
  assert.equal(aligned.height, 20);
});
