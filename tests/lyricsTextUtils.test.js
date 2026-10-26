import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasInlinePronunciation,
  isCJ
} from '../src/components/LyricsRenderer/textUtils.js';

test('detects Chinese, Japanese, and Korean characters for pronunciation alignment', () => {
  assert.equal(isCJ('漢'), true);
  assert.equal(isCJ('あ'), true);
  assert.equal(isCJ('한'), true);
  assert.equal(isCJ('ᄒ'), true);
  assert.equal(isCJ('a'), false);
});

test('detects structured adlib pronunciations rendered inside lyric chunks', () => {
  assert.equal(hasInlinePronunciation(JSON.stringify({
    full: 'konnichiwa',
    chunks: [{ type: 'foreign', text: 'こんにちは', trans: 'konnichiwa' }]
  }), 'ja', 'こんにちは'), true);
  assert.equal(hasInlinePronunciation(JSON.stringify({
    full: 'hello',
    chunks: [{ type: 'en', text: 'hello', trans: '' }]
  }), 'ja', 'こんにちは'), false);
  assert.equal(hasInlinePronunciation(JSON.stringify({
    full: 'hello',
    chunks: [{ type: 'foreign', text: 'hello', trans: 'hello' }]
  }), 'ja', 'こんにちは'), false);
  assert.equal(hasInlinePronunciation('(Do~uba)', 'ja', '（ドゥバ）'), true);
  assert.equal(hasInlinePronunciation('(Do~uba)', 'en', '（ドゥバ）'), false);
  assert.equal(hasInlinePronunciation('konnichiwa', 'auto', 'こんにちは'), true);
  assert.equal(hasInlinePronunciation('konnichiwa', 'en', 'hello'), false);
});
