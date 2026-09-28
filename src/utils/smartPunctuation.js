const isWordCharacter = (character) => Boolean(character && /[\p{L}\p{N}]/u.test(character));
const isOpeningBoundary = (character) => !character || /[\s([{\u2014\u2013-]/u.test(character);

export const toSmartPunctuation = (value) => {
  const characters = Array.from(String(value ?? ''));

  return characters.map((character, index) => {
    if (character !== "'" && character !== '"') return character;

    const previous = characters[index - 1] || '';
    const next = characters[index + 1] || '';

    if (character === "'") {
      if (isWordCharacter(previous) && isWordCharacter(next)) return '\u2019';
      if ((!previous || /\s/u.test(previous)) && /\d/u.test(next)) return '\u2019';
      return isOpeningBoundary(previous) ? '\u2018' : '\u2019';
    }

    return isOpeningBoundary(previous) ? '\u201c' : '\u201d';
  }).join('');
};

export const normalizeStructuredPunctuation = (value) => {
  if (typeof value !== 'string') return value;

  const trimmedValue = value.trim();
  if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
    try {
      const normalizeValue = (item) => {
        if (typeof item === 'string') return toSmartPunctuation(item);
        if (Array.isArray(item)) return item.map(normalizeValue);
        if (item && typeof item === 'object') {
          return Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, normalizeValue(nested)]));
        }
        return item;
      };

      return JSON.stringify(normalizeValue(JSON.parse(value)));
    } catch {
      return toSmartPunctuation(value);
    }
  }

  return toSmartPunctuation(value);
};

const normalizeLyricRecord = (record) => {
  if (!record || typeof record !== 'object') return record;

  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (key === 'pronunciation') return [key, normalizeStructuredPunctuation(value)];
    if (key === 'segments' && Array.isArray(value)) {
      return [key, value.map(segment => normalizeLyricRecord(segment))];
    }
    if (key === 'adlibs' && Array.isArray(value)) {
      return [key, value.map(adlib => normalizeLyricRecord(adlib))];
    }
    if (typeof value === 'string') return [key, toSmartPunctuation(value)];
    return [key, value];
  }));
};

export const normalizeSongLyrics = (song) => {
  if (!song || typeof song !== 'object') return song;

  return {
    ...song,
    lyrics: typeof song.lyrics === 'string' ? toSmartPunctuation(song.lyrics) : song.lyrics,
    syncData: Array.isArray(song.syncData) ? song.syncData.map(normalizeLyricRecord) : song.syncData,
    autoSyncData: Array.isArray(song.autoSyncData) ? song.autoSyncData.map(normalizeLyricRecord) : song.autoSyncData
  };
};