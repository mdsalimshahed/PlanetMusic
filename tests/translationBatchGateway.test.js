import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

test('forwards translation batches through the authenticated backend gateway', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  let forwardedHeaders;
  let forwardedBody;
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url);
    forwardedHeaders = options.headers;
    forwardedBody = await new Response(options.body).text();
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const body = JSON.stringify({ items: [{ id: 'line-1', text: 'lyrics' }] });
    const response = await onRequest({
      request: new Request(
        'https://planetmusic.example/api/translate/batch',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body
        }
      ),
      env: { BACKEND_GATEWAY_TOKEN: 'gateway-test-token' }
    });

    assert.equal(response.status, 200);
    assert.equal(requestedUrl.pathname, '/api/translate/batch');
    assert.equal(
      forwardedHeaders.get('X-Backend-Gateway-Token'),
      'gateway-test-token'
    );
    assert.equal(forwardedBody, body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects oversized translation batch bodies at the edge', async () => {
  const response = await onRequest({
    request: new Request(
      'https://planetmusic.example/api/translate/batch',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '220001'
        },
        body: '{}'
      }
    ),
    env: { BACKEND_GATEWAY_TOKEN: 'gateway-test-token' }
  });

  assert.equal(response.status, 413);
});
