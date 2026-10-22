import assert from 'node:assert/strict';
import test from 'node:test';
import { getBulkPronunciations } from '../src/Studio/services/transliterator.js';

test('runs independent pronunciation token lookups concurrently on one line affinity', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    return new Response(JSON.stringify({
      results: body.items.map(item => ({
        id: item.id,
        ok: true,
        status: 200,
        translation: item.text,
        transliteration: item.text.includes(' ')
          ? 'konnichiwa sekai'
          : item.text === 'こんにちは'
            ? 'konnichiwa'
            : 'sekai',
        srcLang: 'ja'
      }))
    }), {
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const [result] = await getBulkPronunciations(
      [{ text: 'こんにちは 世界' }],
      null,
      'ja',
      'auto-spacing:run:line-1'
    );

    assert.ok(result.pronunciation);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.items.length, 1);
    assert.equal(requests[1].body.items.length, 2);
    assert.ok(requests.flatMap(item => item.body.items).every(
      item => item.proxy_session === 'auto-spacing:run:line-1'
    ));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
