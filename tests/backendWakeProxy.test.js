import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/api/[[path]].js';

test('waits for the backend health endpoint before forwarding API requests', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let healthAttempts = 0;

  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });

    if (url.pathname === '/healthz') {
      healthAttempts++;
      if (healthAttempts === 1) {
        return new Response('starting', { status: 503 });
      }
      return Response.json({ status: 'ok' });
    }

    return Response.json({ results: [] });
  };

  try {
    const response = await onRequest({
      request: new Request('https://planetmusic.example/api/search-deezer?q=test'),
      env: { BACKEND_GATEWAY_TOKEN: 'test-gateway-token' }
    });

    assert.equal(response.status, 200);
    assert.equal(healthAttempts, 2);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].url.pathname, '/search-deezer');
    assert.equal(calls[2].url.searchParams.get('q'), 'test');
    assert.equal(
      calls[2].options.headers.get('X-Backend-Gateway-Token'),
      'test-gateway-token'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
