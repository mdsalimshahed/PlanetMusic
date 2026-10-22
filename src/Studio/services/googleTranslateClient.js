import { createRequestScheduler } from '../hooks/translation/utils/requestScheduler.js';

const scheduleGoogleRequest = createRequestScheduler(550, 10);
const googleResponseCache = new Map();
const MAX_CACHED_GOOGLE_RESPONSES = 500;
let rateLimitCooldownMs = 60000;

const parseRetryAfter = (value) => {
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? 0 : Math.max(0, retryAt - Date.now());
};

const parseGoogleResponse = (data) => {
  if (data && !Array.isArray(data) && typeof data === 'object') {
    return {
      translation: typeof data.translation === 'string' ? data.translation.trim() : '',
      transliteration: typeof data.transliteration === 'string'
        ? data.transliteration.trim() || null
        : typeof data.pronunciation === 'string'
          ? data.pronunciation.trim() || null
          : null,
      srcLang: typeof data.srcLang === 'string' ? data.srcLang : 'auto'
    };
  }

  let translation = '';
  let transliteration = '';
  const srcLang = data?.[2] || 'auto';

  if (data && data[0]) {
    for (const item of data[0]) {
      if (item[0] && item[1]) translation += item[0];
    }

    const last = data[0][data[0].length - 1];
    if (last && (last[2] || last[3]) && !last[1]) {
      transliteration = last[2] || last[3] || '';
    } else if (data[0].length > 1) {
      const possibleRom = data[0].find(item => item[2] || item[3]);
      if (possibleRom) transliteration = possibleRom[2] || possibleRom[3];
    }
  }

  return {
    translation: translation.trim(),
    transliteration: transliteration ? transliteration.trim() : null,
    srcLang
  };
};

const fetchGoogleResponse = async (text, sl, tl) => {
  let serverErrorRetryDelay = 1000;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, sl, tl })
    });

    if (response.ok) {
      rateLimitCooldownMs = 60000;
      return response.json();
    }

    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      const cooldown = Math.min(retryAfter || rateLimitCooldownMs, 300000);
      scheduleGoogleRequest.pause(cooldown);
      rateLimitCooldownMs = Math.min(rateLimitCooldownMs * 2, 300000);
      throw new Error('Translation service HTTP 429');
    }

    if (response.status !== 503 || attempt === 2) {
      throw new Error(`Translation service HTTP ${response.status}`);
    }

    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    await new Promise(resolve => setTimeout(resolve, Math.min(retryAfter || serverErrorRetryDelay, 30000)));
    serverErrorRetryDelay *= 2;
  }

  throw new Error('Translation service retries exhausted');
};

export const fetchGoogleTranslate = async (text, sl = 'auto', tl = 'en') => {
  if (!text) return { translation: '', transliteration: null, srcLang: 'auto' };

  const cacheKey = `${sl}\u0000${tl}\u0000${text}`;
  const cachedResponse = googleResponseCache.get(cacheKey);
  if (cachedResponse) {
    googleResponseCache.delete(cacheKey);
    googleResponseCache.set(cacheKey, cachedResponse);
    return cachedResponse;
  }

  const responsePromise = scheduleGoogleRequest(() => fetchGoogleResponse(text, sl, tl))
    .then(parseGoogleResponse)
    .catch(error => {
      googleResponseCache.delete(cacheKey);
      throw error;
    });

  googleResponseCache.set(cacheKey, responsePromise);
  if (googleResponseCache.size > MAX_CACHED_GOOGLE_RESPONSES) {
    googleResponseCache.delete(googleResponseCache.keys().next().value);
  }

  return responsePromise;
};
