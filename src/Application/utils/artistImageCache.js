const ARTIST_IMAGE_CACHE_LIMIT = 48;
const artistImageCache = new Map();

export const preloadArtistImage = (url, priority = 'low') => {
  if (typeof url !== 'string' || !url.trim()) return Promise.resolve(false);

  const normalizedUrl = url.trim();
  const cached = artistImageCache.get(normalizedUrl);
  if (cached) {
    artistImageCache.delete(normalizedUrl);
    artistImageCache.set(normalizedUrl, cached);
    if (priority === 'high' && !cached.image.complete) {
      cached.image.fetchPriority = 'high';
    }
    return cached.promise;
  }

  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = priority;
  image.src = normalizedUrl;

  const entry = { image, promise: null };
  entry.promise = image.decode().then(
    () => true,
    () => {
      if (artistImageCache.get(normalizedUrl) === entry) {
        artistImageCache.delete(normalizedUrl);
      }
      return false;
    }
  );
  artistImageCache.set(normalizedUrl, entry);

  if (artistImageCache.size > ARTIST_IMAGE_CACHE_LIMIT) {
    const oldestUrl = artistImageCache.keys().next().value;
    artistImageCache.delete(oldestUrl);
  }

  return entry.promise;
};
