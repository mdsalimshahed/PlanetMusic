import assert from 'node:assert/strict';
import test from 'node:test';
import { splitLatinAndOtherChunks } from '../src/Studio/hooks/translation/utils/bruteForceEngine.js';

test('keeps Latin phrases and their internal punctuation intact beside CJK text', () => {
  const chunks = splitLatinAndOtherChunks('応答して no man’s world');

  assert.deepEqual(chunks, [
    { mode: 'cjk', text: '応答して' },
    { mode: 'latin', text: 'no man’s world' }
  ]);
  assert.ok(chunks
    .filter(chunk => chunk.mode === 'cjk')
    .every(chunk => !/\p{Script=Latin}/u.test(chunk.text)));
});

test('preserves internal Latin punctuation and spacing exactly', () => {
  const phrase = "no  man's world, vol. 2";
  const chunks = splitLatinAndOtherChunks(`応答して ${phrase}`);

  assert.equal(chunks[1].mode, 'latin');
  assert.equal(chunks[1].text, phrase);
});
