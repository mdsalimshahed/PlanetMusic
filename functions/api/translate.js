const MAX_TRANSLATION_LENGTH = 5000;
const LANGUAGE_CODE_PATTERN = /^(auto|[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/;

const jsonResponse = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

export async function onRequest({ request }) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Cross-origin requests are not allowed.' }, 403);
  }

  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: 'This endpoint requires JSON.' }, 415);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_TRANSLATION_LENGTH * 4) {
    return jsonResponse({ error: 'Translation text is too long.' }, 413);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request.' }, 400);
  }

  const { text, sl = 'auto', tl = 'en' } = input || {};
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TRANSLATION_LENGTH) {
    return jsonResponse({ error: 'Translation text must contain 1 to 5000 characters.' }, 400);
  }
  if (typeof sl !== 'string' || !LANGUAGE_CODE_PATTERN.test(sl)
    || typeof tl !== 'string' || !LANGUAGE_CODE_PATTERN.test(tl)) {
    return jsonResponse({ error: 'Invalid translation language.' }, 400);
  }

  const googleUrl = new URL('https://translate.googleapis.com/translate_a/single');
  googleUrl.searchParams.set('client', 'gtx');
  googleUrl.searchParams.set('sl', sl);
  googleUrl.searchParams.set('tl', tl);
  googleUrl.searchParams.append('dt', 't');
  googleUrl.searchParams.append('dt', 'rm');
  googleUrl.searchParams.set('q', text);

  try {
    const upstream = await fetch(googleUrl, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: request.signal
    });
    const headers = new Headers({
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    const retryAfter = upstream.headers.get('Retry-After');
    if (retryAfter) headers.set('Retry-After', retryAfter);

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return jsonResponse({ error: 'Translation service is temporarily unavailable.' }, 502);
  }
}
