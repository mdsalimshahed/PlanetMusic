import assert from 'node:assert/strict';
import test from 'node:test';
import { splitAutoSpacingBlocks } from '../src/Studio/hooks/translation/utils/autoSpacingText.js';

test('preserves ordered CJK and non-CJK blocks, including curly apostrophes', () => {
  const blocks = splitAutoSpacingBlocks('応答して no man’s world');

  assert.deepEqual(blocks, [
    { mode: 'cjk', text: '応答して' },
    { mode: 'latin', text: ' no man’s world' }
  ]);
});

test('keeps CJK runs wherever they appear in a sentence', () => {
  assert.deepEqual(splitAutoSpacingBlocks('no man’s world 応答して again'), [
    { mode: 'latin', text: 'no man’s world ' },
    { mode: 'cjk', text: '応答して' },
    { mode: 'latin', text: ' again' }
  ]);
});

test('keeps punctuation and spacing in non-CJK runs unchanged', () => {
  assert.deepEqual(splitAutoSpacingBlocks('歌詞 (NASA) こんにちは！'), [
    { mode: 'cjk', text: '歌詞' },
    { mode: 'latin', text: ' (NASA) ' },
    { mode: 'cjk', text: 'こんにちは' },
    { mode: 'latin', text: '！' }
  ]);
});
