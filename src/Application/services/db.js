/* --- src/db.js --- */
const DB_NAME = 'PlanetMusicDB';
const STORE_NAME = 'audioStore';
const DEEZER_CACHE_STORE = 'deezerAudioCache';
const DB_VERSION = 2;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(DEEZER_CACHE_STORE)) db.createObjectStore(DEEZER_CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveAudioFile = async (id, file) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getAudioFile = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteAudioFile = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getDeezerCachedAudio = async (key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEEZER_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(DEEZER_CACHE_STORE);
    const request = store.get(key);
    let blob = null;

    request.onsuccess = () => {
      const entry = request.result;
      if (entry?.blob) {
        blob = entry.blob;
        entry.lastUsed = Date.now();
        store.put(entry, key);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(blob);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      if (blob) resolve(blob);
      else reject(tx.error);
    };
  });
};

export const saveDeezerCachedAudio = async (key, blob, maxBytes) => {
  if (blob.size > maxBytes) return;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEEZER_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(DEEZER_CACHE_STORE);
    const records = [];
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        records.push({ key: cursor.primaryKey, ...cursor.value });
        cursor.continue();
        return;
      }

      const existing = records.find(record => record.key === key);
      let totalBytes = records.reduce((total, record) => total + (record.size || record.blob?.size || 0), 0);
      if (existing) totalBytes -= existing.size || existing.blob?.size || 0;

      const leastRecent = records
        .filter(record => record.key !== key)
        .sort((first, second) => (first.lastUsed || 0) - (second.lastUsed || 0));
      while (totalBytes + blob.size > maxBytes && leastRecent.length > 0) {
        const evicted = leastRecent.shift();
        store.delete(evicted.key);
        totalBytes -= evicted.size || evicted.blob?.size || 0;
      }

      store.put({ blob, size: blob.size, lastUsed: Date.now() }, key);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
};

export const clearDeezerAudioCacheStore = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEEZER_CACHE_STORE, 'readwrite');
    tx.objectStore(DEEZER_CACHE_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
};