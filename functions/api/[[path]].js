const BACKEND_ORIGIN = 'https://ytdownloader-jnt0.onrender.com';
const GATEWAY_HEADER = 'X-Backend-Gateway-Token';
const BACKEND_READY_CACHE_MS = 5000;
const BACKEND_READY_TIMEOUT_MS = 85000;
const BACKEND_RETRY_DELAY_MS = 1500;
let backendReadyUntil = 0;

const jsonError = (status, error) => new Response(JSON.stringify({ error }), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const resolveRoute = (pathname, method, searchParams) => {
  const apiPath = pathname.slice('/api/'.length);

  if (apiPath === 'backend-health') {
    if (method !== 'GET') return { error: jsonError(405, 'Method not allowed.'), allow: 'GET' };
    return { healthCheck: true };
  }

  if (apiPath === 'search-deezer') {
    if (method !== 'GET') return { error: jsonError(405, 'Method not allowed.'), allow: 'GET' };
    if (!searchParams.has('q')) return { error: jsonError(400, 'Missing search query.') };
    return { upstreamPath: '/search-deezer' };
  }

  if (apiPath === 'search-youtube') {
    if (method !== 'GET') return { error: jsonError(405, 'Method not allowed.'), allow: 'GET' };
    if (!searchParams.has('q')) return { error: jsonError(400, 'Missing search query.') };
    return { upstreamPath: '/search-youtube' };
  }

  if (/^track-info-deezer\/\d+$/.test(apiPath)) {
    if (method !== 'GET') return { error: jsonError(405, 'Method not allowed.'), allow: 'GET' };
    return { upstreamPath: `/${apiPath}` };
  }

  if (/^deezer-progress\/[A-Za-z0-9_-]+$/.test(apiPath)) {
    if (method !== 'GET') return { error: jsonError(405, 'Method not allowed.'), allow: 'GET' };
    return { upstreamPath: `/${apiPath}`, isEventStream: true };
  }

  if (apiPath === 'download-deezer') {
    if (method !== 'POST') return { error: jsonError(405, 'Method not allowed.'), allow: 'POST' };
    return { upstreamPath: '/download-deezer', isMultipart: true };
  }

  if (
    apiPath === 'translate'
    || apiPath === 'translate/batch'
    || apiPath === 'translate/stream'
  ) {
    if (method !== 'POST') return { error: jsonError(405, 'Method not allowed.'), allow: 'POST' };
    return { upstreamPath: `/api/${apiPath}`, isJson: true };
  }

  return { error: jsonError(404, 'Unknown API route.') };
};

const waitForBackend = async (signal, gatewayToken) => {
  if (Date.now() < backendReadyUntil) return true;

  const healthUrl = new URL('/healthz', BACKEND_ORIGIN);
  const deadline = Date.now() + BACKEND_READY_TIMEOUT_MS;
  const healthSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(BACKEND_READY_TIMEOUT_MS)
  ]);

  while (Date.now() < deadline && !healthSignal.aborted) {
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          [GATEWAY_HEADER]: gatewayToken
        },
        cache: 'no-store',
        signal: healthSignal
      });

      if (response.ok) {
        const health = await response.json().catch(() => null);
        if (health?.status === 'ok') {
          backendReadyUntil = Date.now() + BACKEND_READY_CACHE_MS;
          return true;
        }
      } else if (![502, 503, 504, 520, 521, 522, 523, 524].includes(response.status)) {
        await response.body?.cancel();
        return false;
      }
      await response.body?.cancel();
    } catch {
      if (signal.aborted || healthSignal.aborted) return false;
    }

    await new Promise(resolve => setTimeout(resolve, BACKEND_RETRY_DELAY_MS));
  }

  return false;
};

export async function onRequest({ request, env }) {
  const incomingUrl = new URL(request.url);
  if (!incomingUrl.pathname.startsWith('/api/')) return jsonError(404, 'Unknown API route.');

  const route = resolveRoute(incomingUrl.pathname, request.method, incomingUrl.searchParams);
  if (route.error) {
    if (route.allow) route.error.headers.set('allow', route.allow);
    return route.error;
  }

  const gatewayToken = env.BACKEND_GATEWAY_TOKEN;
  if (typeof gatewayToken !== 'string' || gatewayToken.length === 0) {
    return jsonError(503, 'Backend service configuration is unavailable.');
  }

  if (!await waitForBackend(request.signal, gatewayToken)) {
    return new Response(JSON.stringify({
      error: request.signal.aborted
        ? 'The request was cancelled while the backend was starting.'
        : 'The backend did not become ready in time. Please retry shortly.'
    }), {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '3'
      }
    });
  }

  if (route.healthCheck) {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }

  const headers = new Headers();
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  if (route.isMultipart) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
      return jsonError(415, 'This endpoint requires multipart form data.');
    }
    headers.set('content-type', contentType);
  }

  if (route.isJson) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return jsonError(415, 'This endpoint requires JSON.');
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 220000) {
      return jsonError(413, 'Translation request is too large.');
    }
    headers.set('content-type', contentType);
  }

  headers.set(GATEWAY_HEADER, gatewayToken);
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('X-PlanetMusic-Client-IP', clientIp);

  if (route.isEventStream) headers.set('accept', 'text/event-stream');

  const upstreamUrl = new URL(route.upstreamPath, BACKEND_ORIGIN);
  upstreamUrl.search = incomingUrl.search;

  try {
    return await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? request.body : undefined,
      redirect: 'manual',
      cache: 'no-store',
      signal: request.signal
    });
  } catch {
    return jsonError(502, 'The backend service could not be reached. Please retry.');
  }
}
