/* --- src/Application/services/vaultCodec.js ---
 * Lossless compact codec for PlanetMusic songs.
 *   packSong(song)   -> smaller plain object (safe to JSON.stringify / compress / store)
 *   unpackSong(pack) -> exactly the original song object
 * Nothing here changes how the app works: unpack once when a song is opened.
 *
 * What it removes (all re-derivable):
 *  1. `segments` arrays that only repeat the line's own text/color/singer
 *  2. default values (isGradient:false, gradient:"", isSplit:false) stored on every line
 *  3. pronunciation stored as a JSON *string inside JSON* (double-escaped, repeated key names)
 *  4. autoSyncData when it mostly equals syncData (stored as a per-line diff)
 */
const DEF = { isGradient: false, gradient: '', isSplit: false };
const DKEYS = Object.keys(DEF);

const lineSegRedundant = (n) => {
  const s = n.segments;
  return Array.isArray(s) && s.length === 1 && Object.keys(s[0]).length === 5 &&
    s[0].text === n.text && s[0].color === n.color && s[0].isGradient === n.isGradient &&
    s[0].gradient === n.gradient && Array.isArray(s[0].artists) &&
    s[0].artists.length === 1 && s[0].artists[0] === n.singer;
};
const adlibSegRedundant = (a) => {
  const s = a.segments;
  return Array.isArray(s) && s.length === 1 && Object.keys(s[0]).length === 5 &&
    s[0].text === a.text && s[0].isGradient === false && s[0].gradient === '' &&
    Array.isArray(s[0].artists) && s[0].artists.length === 1 && s[0].artists[0] === a.singer &&
    typeof s[0].color === 'string';
};

const packPron = (p) => {
  if (typeof p !== 'string' || p[0] !== '{') return p;
  try {
    const o = JSON.parse(p);
    if (JSON.stringify(o) !== p) return p;
    const order = Object.keys(o).join();
    if (order !== 'full,chunks' && order !== 'chunks,full') return p;
    if (typeof o.full !== 'string' || !Array.isArray(o.chunks)) return p;
    if (!o.chunks.every(c => Object.keys(c).join() === 'type,text,trans')) return p;
    return { $p: order === 'full,chunks' ? 0 : 1, f: o.full,
      c: o.chunks.map(c => [c.type === 'en' ? 0 : c.type === 'foreign' ? 1 : c.type, c.text, c.trans]) };
  } catch { return p; }
};
const unpackPron = (p) => {
  if (!p || typeof p !== 'object' || p.$p === undefined) return p;
  const chunks = p.c.map(([t, text, trans]) => ({ type: t === 0 ? 'en' : t === 1 ? 'foreign' : t, text, trans }));
  return JSON.stringify(p.$p === 0 ? { full: p.f, chunks } : { chunks, full: p.f });
};

const packAdlib = (a) => {
  const o = { ...a };
  if (adlibSegRedundant(a)) { o._sc = a.segments[0].color; delete o.segments; }
  if ('pronunciation' in a) o.pronunciation = packPron(a.pronunciation);
  return o;
};
const unpackAdlib = (a) => {
  const o = { ...a };
  if ('pronunciation' in a) o.pronunciation = unpackPron(a.pronunciation);
  if ('_sc' in o) {
    o.segments = [{ text: o.text, color: o._sc, isGradient: false, gradient: '', artists: [o.singer] }];
    delete o._sc;
  }
  return o;
};

const packLine = (n) => {
  const o = { ...n };
  if (lineSegRedundant(n)) { delete o.segments; o._s = 1; }   // derived on unpack
  const absent = DKEYS.filter(k => !(k in n));            // remember keys that were truly missing
  for (const k of DKEYS) if (n[k] === DEF[k]) delete o[k];
  if (absent.length) o._n = absent;
  if ('pronunciation' in n) o.pronunciation = packPron(n.pronunciation);
  if (Array.isArray(n.adlibs)) o.adlibs = n.adlibs.map(packAdlib);
  return o;
};
const unpackLine = (n) => {
  const o = { ...n };
  const absent = n._n || [];
  for (const k of DKEYS) if (!(k in o) && !absent.includes(k)) o[k] = DEF[k];
  delete o._n;
  if ('pronunciation' in n) o.pronunciation = unpackPron(n.pronunciation);
  if (Array.isArray(n.adlibs)) o.adlibs = n.adlibs.map(unpackAdlib);
  if (o._s) {
    delete o._s;
    o.segments = [{ text: o.text, color: o.color, isGradient: o.isGradient, gradient: o.gradient, artists: [o.singer] }];
  }
  return o;
};

// autoSyncData as a diff against syncData (same length only); otherwise stored normally
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const diffAuto = (sync, auto) => auto.map((b, i) => {
  const a = sync[i], d = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!sameJSON(a[k], b[k])) d[k] = (k in b) ? b[k] : { $del: 1 };
  }
  return Object.keys(d).length ? d : 0;
});
const applyAuto = (sync, lines) => lines.map((d, i) => {
  const r = structuredClone(sync[i]);
  if (d) for (const [k, v] of Object.entries(d)) { if (v && v.$del === 1) delete r[k]; else r[k] = v; }
  return r;
});

export const packSong = (s) => {
  const o = { ...s };
  const canDiff = Array.isArray(s.syncData) && Array.isArray(s.autoSyncData) &&
    s.syncData.length === s.autoSyncData.length && s.syncData.length > 0;
  if (Array.isArray(s.syncData)) o.syncData = s.syncData.map(packLine);
  if (canDiff) o.autoSyncData = { $diff: 1, lines: diffAuto(s.syncData, s.autoSyncData).map(d => d ? packDiff(d) : 0) };
  else if (Array.isArray(s.autoSyncData)) o.autoSyncData = s.autoSyncData.map(packLine);
  return o;
};
export const unpackSong = (s) => {
  const o = { ...s };
  let sync = null;
  if (Array.isArray(s.syncData)) { sync = s.syncData.map(unpackLine); o.syncData = sync; }
  const a = s.autoSyncData;
  if (a && a.$diff === 1) o.autoSyncData = applyAuto(sync, a.lines.map(d => d ? unpackDiff(d) : 0));
  else if (Array.isArray(a)) o.autoSyncData = a.map(unpackLine);
  return o;
};
// diff entries are raw (unpacked) values, so they need no extra packing
const packDiff = (d) => d;
const unpackDiff = (d) => d;

// Optional, LOSSY but inaudible: round timestamps to milliseconds (saves ~3% more)
export const roundTimes = (song) => {
  const r = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
  const fix = (n) => { const o = { ...n }; if ('start' in o) o.start = r(o.start); if ('end' in o) o.end = r(o.end); if (o.adlibs) o.adlibs = o.adlibs.map(fix); return o; };
  const o = { ...song };
  if (Array.isArray(o.syncData)) o.syncData = o.syncData.map(fix);
  if (Array.isArray(o.autoSyncData)) o.autoSyncData = o.autoSyncData.map(fix);
  return o;
};

/* ------------------------------------------------------------------
 * Whole-file helpers (backup / export / import / sample vault)
 * ------------------------------------------------------------------
 * New file format:  { format: 'planetmusic-vault', version: 2, library: [packed songs], settings }
 * Old formats (still accepted forever): { library, settings }  or a bare array of songs.
 */
export const VAULT_FORMAT = 'planetmusic-vault';
export const VAULT_VERSION = 2;

export const isPackedVault = (data) =>
  !!data && !Array.isArray(data) && data.format === VAULT_FORMAT && data.version === VAULT_VERSION;

// Returns { library, settings } in the ORIGINAL song shape, whatever format came in.
export const unpackVault = (data) => {
  if (Array.isArray(data)) return { library: data, settings: undefined };
  if (!data || !Array.isArray(data.library)) return { library: [], settings: data?.settings };
  const library = isPackedVault(data) ? data.library.map(unpackSong) : data.library;
  return { library, settings: data.settings };
};

// Takes ORIGINAL-shape songs, returns the compact file object (stringify WITHOUT indentation).
export const packVault = ({ library, settings }) => {
  const out = { format: VAULT_FORMAT, version: VAULT_VERSION, library: library.map(packSong) };
  if (settings !== undefined) out.settings = settings;
  return out;
};
