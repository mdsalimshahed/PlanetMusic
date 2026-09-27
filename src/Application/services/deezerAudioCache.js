import {
  clearDeezerAudioCacheStore,
  getDeezerCachedAudio,
  saveDeezerCachedAudio
} from './db.js';
import { fetchDeezerApi } from './deezerBackend.js';

const MEBIBYTE = 1024 * 1024;
const deviceMemoryGb = typeof navigator !== 'undefined' ? Number(navigator.deviceMemory) || 4 : 4;
const MAX_CACHE_BYTES = Math.min(256 * MEBIBYTE, Math.max(32 * MEBIBYTE, deviceMemoryGb * 32 * MEBIBYTE));
const audioBlobs = new Map();
const pendingDownloads = new Map();
const pendingCacheWrites = new Set();
let cachedBytes = 0;
let cacheGeneration = 0;
let cacheClearing = false;

const makeAbortError = () => {
  const error = new Error('Deezer audio request was cancelled.');
  error.name = 'AbortError';
  return error;
};

const touchEntry = (key, entry) => {
  audioBlobs.delete(key);
  audioBlobs.set(key, entry);
};

const cacheBlob = (key, blob) => {
  if (blob.size > MAX_CACHE_BYTES) return;

  const existing = audioBlobs.get(key);
  if (existing) cachedBytes -= existing.blob.size;
  audioBlobs.delete(key);
  audioBlobs.set(key, { blob });
  cachedBytes += blob.size;

  while (cachedBytes > MAX_CACHE_BYTES) {
    const oldestKey = audioBlobs.keys().next().value;
    const oldestEntry = audioBlobs.get(oldestKey);
    audioBlobs.delete(oldestKey);
    cachedBytes -= oldestEntry.blob.size;
  }
};

export const getCachedDeezerAudioBlob = async (deezerUrl) => {
  if (cacheClearing || !deezerUrl) return null;

  const cacheKey = `${deezerUrl}|quality=1`;
  const cachedEntry = audioBlobs.get(cacheKey);
  if (cachedEntry) {
    touchEntry(cacheKey, cachedEntry);
    return cachedEntry.blob;
  }

  try {
    const blob = await getDeezerCachedAudio(cacheKey);
    if (!blob || cacheClearing) return null;
    cacheBlob(cacheKey, blob);
    return blob;
  } catch {
    return null;
  }
};

const downloadDeezerAudio = async (deezerUrl, arlToken, signal) => {
  const formData = new FormData();
  formData.append('session_id', `stream_${Date.now()}`);
  formData.append('url', deezerUrl);
  formData.append('arl_token', arlToken || '');
  formData.append('quality', '1');
  formData.append('action', 'stream');
  formData.append('obfuscate', 'true');
  formData.append('local_dir', '');

  const response = await fetchDeezerApi('/download-deezer', {
    method: 'POST',
    body: formData,
    signal
  });
  if (!response.ok) throw new Error('Deezer stream failed');
  if (response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Deezer stream is unavailable. Please check the ARL and try again.');
  }

  const data = new Uint8Array(await response.arrayBuffer());
  if (response.headers.get('X-Audio-Obfuscated') === 'true') {
    const obfuscationKey = 0x5A;
    const limit = Math.min(data.length, 2048);
    for (let index = 0; index < limit; index++) data[index] ^= obfuscationKey;
  }

  return new Blob([data], { type: 'audio/mpeg' });
};

const waitForDownload = (task, signal) => {
  if (signal?.aborted) return Promise.reject(makeAbortError());

  task.waiters++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      task.waiters--;
      if (task.waiters === 0 && !task.finished) task.controller.abort();
      callback(value);
    };
    const onAbort = () => finish(reject, makeAbortError());

    signal?.addEventListener('abort', onAbort, { once: true });
    task.promise.then(
      blob => finish(resolve, blob),
      error => finish(reject, error)
    );
  });
};

export const getDeezerAudioBlob = (deezerUrl, arlToken, signal) => {
  if (cacheClearing) return Promise.reject(makeAbortError());
  if (signal?.aborted) return Promise.reject(makeAbortError());

  const cacheKey = `${deezerUrl}|quality=1`;
  const cachedEntry = audioBlobs.get(cacheKey);
  if (cachedEntry) {
    touchEntry(cacheKey, cachedEntry);
    return Promise.resolve(cachedEntry.blob);
  }

  let task = pendingDownloads.get(cacheKey);
  if (!task || task.controller.signal.aborted) {
    const taskGeneration = cacheGeneration;
    task = {
      controller: new AbortController(),
      waiters: 0,
      finished: false,
      promise: null
    };
    task.promise = (async () => {
      let blob = null;
      try {
        blob = await getDeezerCachedAudio(cacheKey);
      } catch {
        // Continue with a fresh request if browser storage is unavailable.
      }
      if (task.controller.signal.aborted) throw makeAbortError();

      if (blob) {
        if (taskGeneration === cacheGeneration) cacheBlob(cacheKey, blob);
        return blob;
      }

      blob = await downloadDeezerAudio(deezerUrl, arlToken, task.controller.signal);
      if (taskGeneration === cacheGeneration) {
        cacheBlob(cacheKey, blob);
        const cacheWrite = saveDeezerCachedAudio(cacheKey, blob, MAX_CACHE_BYTES).catch(() => {});
        pendingCacheWrites.add(cacheWrite);
        cacheWrite.finally(() => pendingCacheWrites.delete(cacheWrite));
      }
      return blob;
    })()
      .finally(() => {
        task.finished = true;
        if (pendingDownloads.get(cacheKey) === task) pendingDownloads.delete(cacheKey);
      });
    pendingDownloads.set(cacheKey, task);
  }

  return waitForDownload(task, signal);
};

export const clearDeezerAudioCache = async () => {
  cacheClearing = true;
  cacheGeneration++;
  audioBlobs.clear();
  cachedBytes = 0;
  pendingDownloads.forEach(task => task.controller.abort());
  pendingDownloads.clear();
  try {
    await Promise.allSettled([...pendingCacheWrites]);
    await clearDeezerAudioCacheStore();
  } catch {
    // Cache clearing still completes for this page even if storage is unavailable.
  } finally {
    cacheClearing = false;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', event => {
    if (!event.ctrlKey || event.key !== 'F5') return;
    event.preventDefault();
    clearDeezerAudioCache().finally(() => window.location.reload());
  }, true);
}