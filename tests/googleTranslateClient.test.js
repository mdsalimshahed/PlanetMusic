import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGoogleTranslate } from '../src/Studio/services/googleTranslateClient.js';

test('batches pending translation lookups and preserves proxy affinity fields', async () => {
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
        translation: `translated ${item.text}`,
        transliteration: null,
        srcLang: item.sl
      }))
    }), {
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => fetchGoogleTranslate(
        `line ${index}`,
        'ja',
        'en',
        `auto-spacing:run:${index}`
      ))
    );

    assert.equal(requests.length, 2);
    assert.ok(requests.every(item => item.url === '/api/translate/batch'));
    assert.deepEqual(
      requests.map(item => item.body.items.length).sort((left, right) => left - right),
      [2, 10]
    );
    assert.equal(
      requests.flatMap(item => item.body.items)
        .filter(item => item.proxy_session === 'auto-spacing:run:7').length,
      1
    );
    assert.equal(results[7].translation, 'translated line 7');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not retry slow backend failures in the browser', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async (_url, options) => {
    requestCount++;
    const [{ id }] = JSON.parse(options.body).items;
    return new Response(JSON.stringify({
      results: [{
        id,
        ok: false,
        status: 503,
        error: 'Translation service is temporarily unavailable.'
      }]
    }), {
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    await assert.rejects(
      fetchGoogleTranslate('proxy failure fixture', 'ja', 'en', 'line:failure'),
      /HTTP 503/
    );
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
