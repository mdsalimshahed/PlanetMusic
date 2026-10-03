const VAULT_FORMAT = 'planetmusic-vault';
const VAULT_VERSION = 1;
const RESERVED_KEYS = new Set(['_0', '_a', '_c', '_d', '_g', '_i', '_p', '_r']);
const DEFAULTS = [
  ['isGradient', false, 1],
  ['gradient', '', 2],
  ['isSplit', false, 4]
];

const addArtist = (artists, value) => {
  if (typeof value === 'string' && value.length > 0) artists.add(value);
};

const visitRecords = (records, callback) => {
  if (!Array.isArray(records)) return;
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    callback(record);
    visitRecords(record.segments, callback);
    visitRecords(record.adlibs, callback);
  }
};

const collectArtists = (song) => {
  const customColors = song.artistColors && typeof song.artistColors === 'object' ? song.artistColors : {};
  const artists = new Set(Object.keys(customColors));
  for (const records of [song.syncData, song.autoSyncData]) {
    visitRecords(records, (record) => {
      addArtist(artists, record.singer);
      if (Array.isArray(record.artists)) record.artists.forEach((artist) => addArtist(artists, artist));
    });
  }
  return [...artists];
};

const getSingleArtist = (record, artistIds) => {
  if (Array.isArray(record.artists) && record.artists.length === 1) {
    return artistIds.get(record.artists[0]);
  }
  if (typeof record.singer === 'string' && artistIds.has(record.singer)) {
    return artistIds.get(record.singer);
  }
  if (Array.isArray(record.segments) && record.segments.length === 1) {
    const [segment] = record.segments;
    if (Array.isArray(segment?.artists) && segment.artists.length === 1) {
      return artistIds.get(segment.artists[0]);
    }
  }
  return undefined;
};

const buildPalette = (song, artistIds) => {
  const explicit = song.artistColors && typeof song.artistColors === 'object' ? song.artistColors : {};
  const candidates = new Map();
  const conflicts = new Set();

  const consider = (record, artistName) => {
    if (typeof artistName !== 'string' || typeof record.color !== 'string') return;
    if (Object.hasOwn(explicit, artistName)) return;
    const previous = candidates.get(artistName);
    if (previous !== undefined && previous !== record.color) conflicts.add(artistName);
    else candidates.set(artistName, record.color);
  };

  for (const records of [song.syncData, song.autoSyncData]) {
    visitRecords(records, (record) => {
      if (Array.isArray(record.artists) && record.artists.length === 1) {
        consider(record, record.artists[0]);
      } else if (typeof record.singer === 'string' && artistIds.has(record.singer)) {
        consider(record, record.singer);
      }
    });
  }

  return artistIds.names.map((artist) => {
    if (typeof explicit[artist] === 'string') return explicit[artist];
    return conflicts.has(artist) ? null : (candidates.get(artist) ?? null);
  });
};

const collectDictionaries = (song, artistNames, palette) => {
  const artistIds = new Map(artistNames.map((artist, index) => [artist, index]));
  artistIds.names = artistNames;
  const colors = new Set();
  const gradients = new Set();

  const collect = (record) => {
    if (typeof record.color === 'string') {
      const artist = getSingleArtist(record, artistIds);
      if (artist === undefined || palette[artist] !== record.color) colors.add(record.color);
    }
    if (typeof record.gradient === 'string' && record.gradient.length > 0) gradients.add(record.gradient);
  };

  for (const records of [song.syncData, song.autoSyncData]) visitRecords(records, collect);
  return {
    artistIds,
    colors: [...colors],
    colorIds: new Map([...colors].map((color, index) => [color, index])),
    gradients: [...gradients],
    gradientIds: new Map([...gradients].map((gradient, index) => [gradient, index]))
  };
};

const isRedundantSegment = (record) => {
  const segments = record.segments;
  if (!Array.isArray(segments) || segments.length !== 1) return false;
  const segment = segments[0];
  return Object.keys(segment).length === 5 &&
    segment.text === record.text &&
    segment.color === record.color &&
    segment.isGradient === record.isGradient &&
    segment.gradient === record.gradient &&
    Array.isArray(segment.artists) &&
    segment.artists.length === 1 &&
    segment.artists[0] === record.singer;
};

const packPronunciation = (value) => {
  if (typeof value !== 'string' || value[0] !== '{') return value;
  try {
    const parsed = JSON.parse(value);
    if (JSON.stringify(parsed) !== value) return value;
    const order = Object.keys(parsed).join(',');
    if (order !== 'full,chunks' && order !== 'chunks,full') return value;
    if (typeof parsed.full !== 'string' || !Array.isArray(parsed.chunks)) return value;
    if (!parsed.chunks.every((chunk) => Object.keys(chunk).join(',') === 'type,text,trans')) return value;
    return {
      $pmPron: order === 'full,chunks' ? 0 : 1,
      f: parsed.full,
      c: parsed.chunks.map((chunk) => [
        chunk.type === 'en' ? 0 : chunk.type === 'foreign' ? 1 : chunk.type,
        chunk.text,
        chunk.trans
      ])
    };
  } catch {
    return value;
  }
};

const unpackPronunciation = (value) => {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, '$pmPron')) return value;
  const chunks = value.c.map(([type, text, trans]) => ({
    type: type === 0 ? 'en' : type === 1 ? 'foreign' : type,
    text,
    trans
  }));
  return JSON.stringify(value.$pmPron === 0 ? { full: value.f, chunks } : { chunks, full: value.f });
};

const packNode = (record, context) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  if (Object.keys(record).some((key) => RESERVED_KEYS.has(key))) return [0, record];

  const packed = { ...record };
  if (isRedundantSegment(record)) {
    delete packed.segments;
    packed._r = 1;
  } else if (Array.isArray(record.segments)) {
    packed.segments = record.segments.map((segment) => packNode(segment, context));
  }
  if (Array.isArray(record.adlibs)) packed.adlibs = record.adlibs.map((adlib) => packNode(adlib, context));

  let defaultMask = 0;
  for (const [key, value, bit] of DEFAULTS) {
    if (Object.hasOwn(record, key) && record[key] === value) {
      delete packed[key];
      defaultMask |= bit;
    }
  }
  if (defaultMask) packed._d = defaultMask;

  if (typeof record.singer === 'string' && context.artistIds.has(record.singer)) {
    delete packed.singer;
    packed._i = context.artistIds.get(record.singer);
  }
  if (Array.isArray(record.artists) && record.artists.every((artist) => context.artistIds.has(artist))) {
    delete packed.artists;
    packed._a = record.artists.map((artist) => context.artistIds.get(artist));
  }
  if (typeof record.color === 'string') {
    const artist = getSingleArtist(record, context.artistIds);
    if (artist !== undefined && context.palette[artist] === record.color) {
      delete packed.color;
      packed._c = -(artist + 1);
    } else if (context.colorIds.has(record.color)) {
      delete packed.color;
      packed._c = context.colorIds.get(record.color);
    }
  }
  if (typeof record.gradient === 'string' && context.gradientIds.has(record.gradient)) {
    delete packed.gradient;
    packed._g = context.gradientIds.get(record.gradient);
  }
  if (Object.hasOwn(record, 'pronunciation')) packed.pronunciation = packPronunciation(record.pronunciation);
  return packed;
};

const unpackNode = (record, context) => {
  if (Array.isArray(record) && record.length === 2 && record[0] === 0) return record[1];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;

  const unpacked = { ...record };
  const defaultMask = unpacked._d || 0;
  delete unpacked._d;
  for (const [key, value, bit] of DEFAULTS) {
    if (defaultMask & bit) unpacked[key] = value;
  }

  if (Object.hasOwn(unpacked, '_i')) {
    unpacked.singer = context.artists[unpacked._i];
    delete unpacked._i;
  }
  if (Object.hasOwn(unpacked, '_a')) {
    unpacked.artists = unpacked._a.map((id) => context.artists[id]);
    delete unpacked._a;
  }
  if (Object.hasOwn(unpacked, '_c')) {
    const colorRef = unpacked._c;
    unpacked.color = colorRef < 0 ? context.palette[-colorRef - 1] : context.colors[colorRef];
    delete unpacked._c;
  }
  if (Object.hasOwn(unpacked, '_g')) {
    unpacked.gradient = context.gradients[unpacked._g];
    delete unpacked._g;
  }
  if (Object.hasOwn(unpacked, 'pronunciation')) {
    unpacked.pronunciation = unpackPronunciation(unpacked.pronunciation);
  }
  if (Array.isArray(unpacked.segments)) {
    unpacked.segments = unpacked.segments.map((segment) => unpackNode(segment, context));
  }
  if (Array.isArray(unpacked.adlibs)) {
    unpacked.adlibs = unpacked.adlibs.map((adlib) => unpackNode(adlib, context));
  }
  if (unpacked._r) {
    delete unpacked._r;
    unpacked.segments = [{
      text: unpacked.text,
      color: unpacked.color,
      isGradient: unpacked.isGradient,
      gradient: unpacked.gradient,
      artists: [unpacked.singer]
    }];
  }
  return unpacked;
};

const diffRecords = (base, target) => {
  const changes = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
  for (const key of keys) {
    if (JSON.stringify(base[key]) === JSON.stringify(target[key])) continue;
    if (Object.hasOwn(target, key)) changes.push([key, 1, target[key]]);
    else changes.push([key, 0]);
  }
  return changes;
};

const applyDiff = (base, changes) => {
  const result = { ...base };
  for (const [key, operation, value] of changes) {
    if (operation === 0) delete result[key];
    else result[key] = value;
  }
  return result;
};

const packSong = (song) => {
  const artists = collectArtists(song);
  const artistIds = new Map(artists.map((artist, index) => [artist, index]));
  artistIds.names = artists;
  const palette = buildPalette(song, artistIds);
  const dictionaries = collectDictionaries(song, artists, palette);
  const context = { ...dictionaries, artists, palette };
  const metadata = { ...song };
  if (Array.isArray(song.syncData)) delete metadata.syncData;
  if (Array.isArray(song.autoSyncData)) delete metadata.autoSyncData;

  const packed = { m: metadata, a: artists, p: palette, c: dictionaries.colors, g: dictionaries.gradients };
  const sync = Array.isArray(song.syncData) ? song.syncData.map((line) => packNode(line, context)) : null;
  const auto = Array.isArray(song.autoSyncData) ? song.autoSyncData.map((line) => packNode(line, context)) : null;

  if (sync) packed.s = sync;
  const canDiff = auto && sync && auto.length === sync.length && sync.length > 0 &&
    sync.every((line) => line && typeof line === 'object' && !Array.isArray(line)) &&
    auto.every((line) => line && typeof line === 'object' && !Array.isArray(line));
  if (canDiff) {
    const diffs = auto.map((line, index) => diffRecords(sync[index], line));
    packed.u = { d: 1, l: diffs.map((changes) => changes.length ? changes : 0) };
  } else if (auto) {
    packed.u = auto;
  }
  return packed;
};

const unpackSong = (packed) => {
  const context = {
    artists: packed.a || [],
    palette: packed.p || [],
    colors: packed.c || [],
    gradients: packed.g || []
  };
  const song = { ...packed.m };
  const sync = Array.isArray(packed.s) ? packed.s.map((line) => unpackNode(line, context)) : null;
  if (sync) song.syncData = sync;
  if (packed.u?.d === 1) {
    song.autoSyncData = packed.u.l.map((changes, index) =>
      changes ? unpackNode(applyDiff(packed.s[index], changes), context) : unpackNode(packed.s[index], context)
    );
  } else if (Array.isArray(packed.u)) {
    song.autoSyncData = packed.u.map((line) => unpackNode(line, context));
  }
  return song;
};

export const isPackedVault = (data) =>
  Boolean(data && !Array.isArray(data) && data.format === VAULT_FORMAT && data.version === VAULT_VERSION);

export const unpackVault = (data) => {
  if (Array.isArray(data)) return { library: data, settings: undefined };
  if (!data || !Array.isArray(data.library)) return { library: [], settings: data?.settings };
  if (data.format === VAULT_FORMAT && data.version !== VAULT_VERSION) {
    throw new Error(`Unsupported PlanetMusic vault version: ${data.version}`);
  }
  return {
    library: isPackedVault(data) ? data.library.map(unpackSong) : data.library,
    settings: data.settings
  };
};

export const getVaultArtistData = (data) => {
  let songs;
  if (Array.isArray(data)) {
    songs = data;
  } else if (data && Array.isArray(data.library)) {
    if (data.format === VAULT_FORMAT && data.version !== VAULT_VERSION) {
      throw new Error(`Unsupported PlanetMusic vault version: ${data.version}`);
    }
    songs = isPackedVault(data) ? data.library.map((song) => song?.m) : data.library;
  } else {
    return [];
  }

  return songs.map((song) => ({
    artistImages: song?.artistImages,
    artistColors: song?.artistColors
  }));
};

export const sanitizeVaultSettings = (settings) => {
  const sanitized = { ...settings };
  delete sanitized.spotifyConfig;
  delete sanitized.spotifyClientId;
  delete sanitized.spotifyClientSecret;
  delete sanitized.youtubeApiKey;
  return sanitized;
};

export const packVault = ({ library, settings }) => {
  const packed = { format: VAULT_FORMAT, version: VAULT_VERSION, library: library.map(packSong) };
  if (settings !== undefined) packed.settings = settings;
  return packed;
};