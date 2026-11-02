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
    for (const call of calls.slice(0, 2)) {
      assert.equal(
        call.options.headers['X-Backend-Gateway-Token'],
        'test-gateway-token'
      );
    }
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

test('proxies automatic YouTube searches through the authenticated backend route', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;

  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.pathname === '/healthz') return Response.json({ status: 'ok' });
    upstreamRequest = { url, options };
    return Response.json({ url: 'https://www.youtube.com/watch?v=abcdefghijk' });
  };

  try {
    const response = await onRequest({
      request: new Request('https://planetmusic.example/api/search-youtube?q=Song%20Artist'),
      env: { BACKEND_GATEWAY_TOKEN: 'test-gateway-token' }
    });

    assert.equal(response.status, 200);
    assert.equal(upstreamRequest.url.pathname, '/search-youtube');
    assert.equal(upstreamRequest.url.searchParams.get('q'), 'Song Artist');
    assert.equal(
      upstreamRequest.options.headers.get('X-Backend-Gateway-Token'),
      'test-gateway-token'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('backend-health wakes Render without forwarding an application request', async () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  let healthRequest;
  Date.now = () => originalDateNow() + 10_000;

  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.pathname, '/healthz');
    healthRequest = { url, options };
    return Response.json({ status: 'ok' });
  };

  try {
    const response = await onRequest({
      request: new Request('https://planetmusic.example/api/backend-health'),
      env: { BACKEND_GATEWAY_TOKEN: 'test-gateway-token' }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(
      healthRequest.options.headers['X-Backend-Gateway-Token'],
      'test-gateway-token'
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalDateNow;
  }
});
