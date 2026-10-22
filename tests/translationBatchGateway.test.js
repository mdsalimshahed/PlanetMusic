import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

test('forwards streamed translation batches through the authenticated backend gateway', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  let forwardedHeaders;
  let forwardedBody;
  globalThis.fetch = async (url, options) => {
    requestedUrl = new URL(url);
    forwardedHeaders = options.headers;
    forwardedBody = await new Response(options.body).text();
    return new Response('', {
      headers: { 'content-type': 'application/x-ndjson' }
    });
  };

  try {
    const body = JSON.stringify({ items: [{ id: 'line-1', text: 'lyrics' }] });
    const response = await onRequest({
      request: new Request(
        'https://planetmusic.example/api/translate/stream',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body
        }
      ),
      env: { BACKEND_GATEWAY_TOKEN: 'gateway-test-token' }
    });

    assert.equal(response.status, 200);
    assert.equal(requestedUrl.pathname, '/api/translate/stream');
    assert.equal(
      forwardedHeaders.get('X-Backend-Gateway-Token'),
      'gateway-test-token'
    );
    assert.equal(forwardedBody, body);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('allows the backend response stream to pass through without buffering', async () => {
  const originalFetch = globalThis.fetch;
  let responseController;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      responseController = controller;
    }
  }), { headers: { 'content-type': 'application/x-ndjson' } });

  try {
    const response = await onRequest({
      request: new Request(
        'https://planetmusic.example/api/translate/stream',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: [{ id: 'line-1', text: 'lyrics' }] })
        }
      ),
      env: { BACKEND_GATEWAY_TOKEN: 'gateway-test-token' }
    });
    const reader = response.body.getReader();
    responseController.enqueue(new TextEncoder().encode('{"id":"line-1"}\n'));

    const chunk = await reader.read();
    assert.equal(new TextDecoder().decode(chunk.value), '{"id":"line-1"}\n');
    responseController.close();
    await reader.read();
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
