import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBulkPronunciations
} from '../src/Studio/services/transliterator.js';
import { isLatinLikeText, isLatinLikeToken } from '../src/Studio/utils/latinScript.js';

test('recognizes accented and compatibility-form Latin text as Latin', () => {
  assert.equal(isLatinLikeToken('llamé'), true);
  assert.equal(isLatinLikeToken('𝐝𝐞𝐬𝐭𝐢𝐧𝐨'), true);
  assert.equal(isLatinLikeText('No fue el destino, fui yo que te llamé'), true);
  assert.equal(isLatinLikeText('No fuе el destino, fui yo que te llamé'), true);
});

test('tolerates an isolated Latin-lookalike glyph in a Latin word', () => {
  assert.equal(isLatinLikeToken('fuе'), true);
  assert.equal(isLatinLikeToken('сос'), false);
});

test('does not create pronunciation chunks for Latin lyrics with accents or lookalikes', async () => {
  const lines = ['No fue el destino', 'No fuе el destino, fui yo que te llamé'];
  const results = await getBulkPronunciations(
    lines.map(text => ({ text })),
    null,
    'es',
    null,
    lines.map(() => ({
      translation: 'It was not destiny',
      transliteration: null,
      srcLang: 'es'
    }))
  );

  assert.deepEqual(results.map(result => result.pronunciation), [null, null]);
});
