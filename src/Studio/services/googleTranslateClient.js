import { createRequestScheduler } from '../hooks/translation/utils/requestScheduler.js';

const scheduleGoogleBatch = createRequestScheduler(0, 3);
const googleResponseCache = new Map();
const MAX_CACHED_GOOGLE_RESPONSES = 500;
const MAX_TRANSLATION_BATCH_ITEMS = 10;
const TRANSLATION_BATCH_DELAY_MS = 12;
let rateLimitCooldownMs = 60000;
let pendingGoogleRequests = [];
let googleBatchTimer = null;
let nextGoogleRequestId = 0;

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

const flushGoogleRequests = () => {
  if (googleBatchTimer !== null) {
    clearTimeout(googleBatchTimer);
    googleBatchTimer = null;
  }

  while (pendingGoogleRequests.length) {
    const batch = pendingGoogleRequests.splice(0, MAX_TRANSLATION_BATCH_ITEMS);
    scheduleGoogleBatch(async () => {
      const response = await fetch('/api/translate/batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: batch.map(({ id, text, sl, tl, proxySession }) => ({
          id: String(id),
          text,
          sl,
          tl,
          ...(proxySession ? { proxy_session: proxySession } : {})
        }))
      })
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
          const cooldown = Math.min(retryAfter || rateLimitCooldownMs, 300000);
          scheduleGoogleBatch.pause(cooldown);
          rateLimitCooldownMs = Math.min(rateLimitCooldownMs * 2, 300000);
        }
        throw new Error(`Translation service HTTP ${response.status}`);
      }

      const payload = await response.json();
      const resultById = new Map(
        (Array.isArray(payload.results) ? payload.results : [])
          .map(result => [result.id, result])
      );
      batch.forEach(item => {
        const result = resultById.get(String(item.id));
        if (!result) {
          item.reject(new Error('Translation service omitted a batch result.'));
        } else if (!result.ok) {
          if (result.status === 429) {
            const retryAfter = parseRetryAfter(result.retry_after);
            const cooldown = Math.min(retryAfter || rateLimitCooldownMs, 300000);
            scheduleGoogleBatch.pause(cooldown);
            rateLimitCooldownMs = Math.min(rateLimitCooldownMs * 2, 300000);
          }
          item.reject(new Error(
            result.status === 429
              ? 'Translation service HTTP 429'
              : `Translation service HTTP ${result.status || 503}`
          ));
        } else {
          rateLimitCooldownMs = 60000;
          item.resolve(parseGoogleResponse(result));
        }
      });
    }).catch(error => {
      batch.forEach(item => item.reject(error));
    });
  }
};

const queueGoogleRequest = (text, sl, tl, proxySession) => new Promise((resolve, reject) => {
  pendingGoogleRequests.push({
    id: ++nextGoogleRequestId,
    text,
    sl,
    tl,
    proxySession,
    resolve,
    reject
  });

  if (pendingGoogleRequests.length >= MAX_TRANSLATION_BATCH_ITEMS) {
    flushGoogleRequests();
  } else if (googleBatchTimer === null) {
    googleBatchTimer = setTimeout(flushGoogleRequests, TRANSLATION_BATCH_DELAY_MS);
  }
});

export const fetchGoogleTranslate = async (
  text,
  sl = 'auto',
  tl = 'en',
  proxySession = null
) => {
  if (!text) return { translation: '', transliteration: null, srcLang: 'auto' };

  const cacheKey = `${sl}\u0000${tl}\u0000${proxySession || ''}\u0000${text}`;
  const cachedResponse = googleResponseCache.get(cacheKey);
  if (cachedResponse) {
    googleResponseCache.delete(cacheKey);
    googleResponseCache.set(cacheKey, cachedResponse);
    return cachedResponse;
  }

  const responsePromise = queueGoogleRequest(text, sl, tl, proxySession)
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
