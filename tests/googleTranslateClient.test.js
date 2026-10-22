import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGoogleTranslate } from '../src/Studio/services/googleTranslateClient.js';

const DIRECT_TRANSLATE_URL = 'https://translate.googleapis.com/';

const failDirectRequest = (url) => {
  if (String(url).startsWith(DIRECT_TRANSLATE_URL)) {
    throw new TypeError('Failed to fetch');
  }
};

test('uses the direct Google Translate API before any backend request', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(url);
    return new Response(JSON.stringify([
      [['Hello', 'こんにちは', null, null], ['', '', 'konnichiwa', null]],
      null,
      'ja'
    ]));
  };

  try {
    const result = await fetchGoogleTranslate('こんにちは', 'ja', 'en');

    assert.equal(requestedUrl.origin, 'https://translate.googleapis.com');
    assert.equal(requestedUrl.pathname, '/translate_a/single');
    assert.equal(requestedUrl.searchParams.get('client'), 'gtx');
    assert.equal(requestedUrl.searchParams.get('sl'), 'ja');
    assert.equal(requestedUrl.searchParams.get('tl'), 'en');
    assert.deepEqual(requestedUrl.searchParams.getAll('dt'), ['t', 'rm']);
    assert.equal(requestedUrl.searchParams.get('q'), 'こんにちは');
    assert.deepEqual(result, {
      translation: 'Hello',
      transliteration: 'konnichiwa',
      srcLang: 'ja'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('batches pending translation lookups without pinning them to one proxy', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    return new Response(body.items.map(item => JSON.stringify({
        id: item.id,
        ok: true,
        status: 200,
        translation: `translated ${item.text}`,
        transliteration: null,
        srcLang: item.sl
      })).join('\n') + '\n', {
      headers: { 'content-type': 'application/x-ndjson' }
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
    assert.ok(requests.every(item => item.url === '/api/translate/stream'));
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

test('runs up to thirty translation batches concurrently', async () => {
  const originalFetch = globalThis.fetch;
  const pendingResponses = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    const body = JSON.parse(options.body);
    requests.push(body);
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    return new Promise(resolve => {
      pendingResponses.push(() => {
        activeRequests--;
        resolve(new Response(body.items.map(item => JSON.stringify({
            id: item.id,
            ok: true,
            status: 200,
            translation: `translated ${item.text}`,
            srcLang: item.sl
          })).join('\n') + '\n', {
          headers: { 'content-type': 'application/x-ndjson' }
        }));
      });
    });
  };

  const waitForRequestCount = async (count) => {
    for (let attempt = 0; attempt < 100 && requests.length < count; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    assert.equal(requests.length, count);
  };

  try {
    const translations = Promise.all(
      Array.from({ length: 1501 }, (_, index) => (
        fetchGoogleTranslate(`parallel line ${index}`, 'ja', 'en')
      ))
    );

    await waitForRequestCount(30);
    assert.equal(activeRequests, 30);
    assert.equal(maxActiveRequests, 30);
    pendingResponses.splice(0).forEach(resolve => resolve());

    await waitForRequestCount(31);
    pendingResponses.splice(0).forEach(resolve => resolve());
    const results = await translations;

    assert.equal(results.length, 1501);
    assert.equal(maxActiveRequests, 30);
  } finally {
    pendingResponses.splice(0).forEach(resolve => resolve());
    globalThis.fetch = originalFetch;
  }
});

test('resolves a translation as soon as its streamed result arrives', async () => {
  const originalFetch = globalThis.fetch;
  let streamController;
  let itemIds;
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    itemIds = JSON.parse(options.body).items.map(item => item.id);
    return new Response(new ReadableStream({
      start(controller) {
        streamController = controller;
      }
    }), { headers: { 'content-type': 'application/x-ndjson' } });
  };

  try {
    const first = fetchGoogleTranslate('first line', 'ja', 'en');
    const second = fetchGoogleTranslate('second line', 'ja', 'en');
    await new Promise(resolve => setTimeout(resolve, 0));
    streamController.enqueue(new TextEncoder().encode(
      `${JSON.stringify({
        id: itemIds[0],
        ok: true,
        status: 200,
        translation: 'first result',
        srcLang: 'ja'
      })}\n`
    ));

    assert.equal((await first).translation, 'first result');
    let secondResolved = false;
    second.then(() => { secondResolved = true; });
    await Promise.resolve();
    assert.equal(secondResolved, false);

    streamController.enqueue(new TextEncoder().encode(
      `${JSON.stringify({
        id: itemIds[1],
        ok: true,
        status: 200,
        translation: 'second result',
        srcLang: 'ja'
      })}\n`
    ));
    streamController.close();
    assert.equal((await second).translation, 'second result');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('splits large requests below the gateway body limit', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    const body = JSON.parse(options.body);
    requests.push({ body, byteLength: new TextEncoder().encode(options.body).length });
    return new Response(body.items.map(item => JSON.stringify({
        id: item.id,
        ok: true,
        status: 200,
        translation: 'done',
        srcLang: item.sl
      })).join('\n') + '\n', {
      headers: { 'content-type': 'application/x-ndjson' }
    });
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
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    requested.push(JSON.parse(options.body));
    return new Response(JSON.parse(options.body).items.map(item => JSON.stringify({
        id: item.id,
        ok: true,
        status: 200,
        translation: item.text,
        srcLang: item.sl
      })).join('\n') + '\n', {
      headers: { 'content-type': 'application/x-ndjson' }
    });
  };

  try {
    const promise = fetchGoogleTranslate('immediate', 'ja', 'en');
    for (let attempt = 0; attempt < 20 && requested.length === 0; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    assert.equal(requested.length, 1);
    await promise;
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not retry slow backend failures in the browser', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    requestCount++;
    const [{ id }] = JSON.parse(options.body).items;
    return new Response(JSON.stringify({
        id,
        ok: false,
        status: 503,
        error: 'Translation service is temporarily unavailable.'
      }) + '\n', {
      headers: { 'content-type': 'application/x-ndjson' }
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
  globalThis.fetch = async (url, options) => {
    failDirectRequest(url);
    requestCount++;
    const [{ id }] = JSON.parse(options.body).items;
    const isLimited = requestCount === 1;
    return new Response(JSON.stringify({
        id,
        ok: !isLimited,
        status: isLimited ? 429 : 200,
        error: isLimited ? 'Rate limited' : undefined,
        translation: 'translated',
        srcLang: 'ja'
      }) + '\n', { headers: { 'content-type': 'application/x-ndjson' } });
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
