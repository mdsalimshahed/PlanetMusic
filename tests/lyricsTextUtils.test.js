import assert from 'node:assert/strict';
import test from 'node:test';
import { isCJ } from '../src/components/LyricsRenderer/textUtils.js';

test('detects Chinese, Japanese, and Korean characters for pronunciation alignment', () => {
  assert.equal(isCJ('漢'), true);
  assert.equal(isCJ('あ'), true);
  assert.equal(isCJ('한'), true);
  assert.equal(isCJ('ᄒ'), true);
  assert.equal(isCJ('a'), false);
});
