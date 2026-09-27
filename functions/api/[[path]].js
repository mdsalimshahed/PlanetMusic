const BACKEND_ORIGIN = 'https://ytdownloader-jnt0.onrender.com';
const GATEWAY_HEADER = 'X-Backend-Gateway-Token';

const jsonError = (status, error) => new Response(JSON.stringify({ error }), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const resolveRoute = (pathname, method, searchParams) => {
  const apiPath = pathname.slice('/api/'.length);

  if (apiPath === 'search-deezer') {
    if (method !== 'GET') return { error: jsonError(405, 'Method not allowed.'), allow: 'GET' };
    if (!searchParams.has('q')) return { error: jsonError(400, 'Missing search query.') };
    return { upstreamPath: '/search-deezer' };
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

  return { error: jsonError(404, 'Unknown API route.') };
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
    return jsonError(503, 'Deezer service configuration is unavailable.');
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
    return jsonError(502, 'The Deezer service could not be reached. Please retry.');
  }
}
