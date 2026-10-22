import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGoogleTranslate } from '../src/Studio/services/googleTranslateClient.js';

test('batches pending translation lookups without pinning them to one proxy', async () => {
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
      Array.from({ length: 62 }, (_, index) => fetchGoogleTranslate(
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
      [12, 50]
    );
    assert.ok(requests.flatMap(item => item.body.items)
      .every(item => !Object.hasOwn(item, 'proxy_session')));
    assert.equal(results[57].translation, 'translated line 57');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('splits large requests below the gateway body limit', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ body, byteLength: new TextEncoder().encode(options.body).length });
    return new Response(JSON.stringify({
      results: body.items.map(item => ({
        id: item.id,
        ok: true,
        status: 200,
        translation: 'done',
        srcLang: item.sl
      }))
    }), { headers: { 'content-type': 'application/json' } });
  };

  try {
    await Promise.all(Array.from({ length: 45 }, (_, index) => (
      fetchGoogleTranslate(`${index}${'x'.repeat(4998)}`, 'ja', 'en')
    )));

    assert.ok(requests.length > 1);
    assert.ok(requests.every(request => request.byteLength <= 200_000));
    assert.ok(requests.every(request => request.body.items.length <= 50));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('flushes requests on the next microtask without a batching timer', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (_url, options) => {
    requested.push(JSON.parse(options.body));
    return new Response(JSON.stringify({
      results: JSON.parse(options.body).items.map(item => ({
        id: item.id,
        ok: true,
        status: 200,
        translation: item.text,
        srcLang: item.sl
      }))
    }), { headers: { 'content-type': 'application/json' } });
  };

  try {
    const promise = fetchGoogleTranslate('immediate', 'ja', 'en');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(requested.length, 1);
    await promise;
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

test('does not add a fallback cooldown when a 429 has no Retry-After header', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async (_url, options) => {
    requestCount++;
    const [{ id }] = JSON.parse(options.body).items;
    const isLimited = requestCount === 1;
    return new Response(JSON.stringify({
      results: [{
        id,
        ok: !isLimited,
        status: isLimited ? 429 : 200,
        error: isLimited ? 'Rate limited' : undefined,
        translation: 'translated',
        srcLang: 'ja'
      }]
    }), { headers: { 'content-type': 'application/json' } });
  };

  try {
    await assert.rejects(
      fetchGoogleTranslate('limited request', 'ja', 'en'),
      /HTTP 429/
    );
    const nextResult = await fetchGoogleTranslate('next request', 'ja', 'en');
    assert.equal(nextResult.translation, 'translated');
    assert.equal(requestCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
