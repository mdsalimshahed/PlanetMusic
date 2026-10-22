import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/translate.js';

const createRequest = (body, options = {}) => new Request('https://planetmusic.example/api/translate', {
  method: options.method || 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'https://planetmusic.example',
    ...options.headers
  },
  body: options.method === 'GET' ? undefined : JSON.stringify(body)
});

test('rejects cross-origin requests before contacting Google', async () => {
  const response = await onRequest({
    request: createRequest({ text: 'lyrics' }, { headers: { origin: 'https://other.example' } })
  });

  assert.equal(response.status, 403);
});

test('validates translation input before contacting Google', async () => {
  const response = await onRequest({
    request: createRequest({ text: 'lyrics', sl: 'https://example.com' })
  });

  assert.equal(response.status, 400);
});

test('forwards valid requests to the fixed Google Translate endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = new URL(url);
    return new Response('[[],null,"ja"]', {
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const response = await onRequest({
      request: createRequest({ text: '応答して', sl: 'ja', tl: 'en' })
    });

    assert.equal(response.status, 200);
    assert.equal(requestedUrl.hostname, 'translate.googleapis.com');
    assert.equal(requestedUrl.searchParams.get('q'), '応答して');
    assert.equal(requestedUrl.searchParams.get('sl'), 'ja');
    assert.equal(requestedUrl.searchParams.get('tl'), 'en');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
