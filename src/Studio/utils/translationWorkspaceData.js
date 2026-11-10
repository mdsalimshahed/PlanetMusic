import { parseLyrics } from './lyricsUtils.js';
import { isLatinLikeText } from './latinScript.js';

const getDisplayPronunciation = pronunciation => {
  if (typeof pronunciation !== 'string') return pronunciation || '';
  if (!pronunciation.startsWith('{') && !pronunciation.startsWith('[')) {
    return pronunciation;
  }

  try {
    const parsed = JSON.parse(pronunciation);
    if (parsed.full) return parsed.full;
    const chunks = Array.isArray(parsed) ? parsed : parsed.chunks;
    return chunks?.map(chunk => chunk.trans || chunk.text).join('') || pronunciation;
  } catch {
    return pronunciation;
  }
};

const latinLookalikeMap = new Map(
  Object.entries({
    а: 'a', в: 'b', с: 'c', е: 'e', ё: 'e', н: 'h', і: 'i', ј: 'j',
    к: 'k', м: 'm', о: 'o', р: 'p', т: 't', у: 'y', х: 'x',
    α: 'a', β: 'b', ε: 'e', η: 'h', ι: 'i', κ: 'k', μ: 'm',
    ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'y', χ: 'x'
  })
);

const normalizeImportedLyric = text => {
  let normalized = '';
  let previousWasLatin = false;
  const foldedText = String(text || '')
    .normalize('NFKD')
    .replace(/[’‘ʼ`]/g, "'")
    .replace(/[‐‑‒–—―]/g, '-')
    .toLowerCase();

  for (const char of foldedText) {
    if (/\p{M}/u.test(char) && previousWasLatin) continue;

    const mappedChar = latinLookalikeMap.get(char) || char;
    normalized += mappedChar;
    if (!/\p{M}/u.test(mappedChar)) {
      previousWasLatin = /\p{Script=Latin}/u.test(mappedChar);
    }
  }

  return normalized
    .replace(/[\p{P}\p{S}]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
};

export const findNextTranslationImportTarget = (
  workspaceData,
  originalText,
  startIndex = 0,
  nextOriginalText = ''
) => {
  const normalizedOriginal = normalizeImportedLyric(originalText);
  if (!normalizedOriginal) return -1;

  const normalizedNextOriginal = normalizeImportedLyric(nextOriginalText);
  const matchingIndexes = workspaceData.flatMap((row, index) => (
    index >= startIndex && normalizeImportedLyric(row.displayText) === normalizedOriginal
      ? [index]
      : []
  ));

  for (const index of matchingIndexes) {
    const row = workspaceData[index];
    if (row._meta?.isAdlib) return index;

    const nextEntryIsAdlib = normalizedNextOriginal && workspaceData.some(candidate => (
      candidate._meta?.isAdlib
      && candidate._meta.lineIndex === row._meta?.lineIndex
      && normalizeImportedLyric(candidate.displayText) === normalizedNextOriginal
    ));

    if (nextEntryIsAdlib) return index;

    const fullLineAdlibIndex = workspaceData.findIndex(candidate => (
      candidate._meta?.isAdlib
      && candidate._meta.lineIndex === row._meta?.lineIndex
      && normalizeImportedLyric(candidate.displayText) === normalizedOriginal
    ));

    if (fullLineAdlibIndex !== -1) return fullLineAdlibIndex;
    return index;
  }

  return -1;
};

export const buildTranslationWorkspaceData = (
  selectedSong,
  customData,
  masterPalette,
  parsedLyricsColorMap
) => {
  let sourceData = selectedSong?.syncData || selectedSong?.autoSyncData;
  if ((!Array.isArray(sourceData) || sourceData.length === 0) && customData?.lyrics) {
    sourceData = parseLyrics(
      customData.lyrics,
      selectedSong?.artistName,
      masterPalette
    ).map(line => ({
      ...line,
      start: null,
      end: null,
      translation: '',
      pronunciation: null,
      lang: 'auto',
      spacingText: ''
    }));
  }

  return (Array.isArray(sourceData) ? sourceData : []).flatMap((line, index) => {
    if (!line || typeof line !== 'object') {
      return [{
        text: '',
        segments: [],
        start: null,
        end: null,
        translation: '',
        pronunciation: '',
        lang: 'auto',
        spacingText: '',
        displayText: '',
        displayPron: '',
        rowId: `main-${index}`,
        _meta: { isAdlib: false, lineIndex: index }
      }];
    }

    const parsedLine = parsedLyricsColorMap?.[index];
    const hasMainText = Boolean(line.text?.trim());
    const hasLatinText = isLatinLikeText(line.text);
    const pronunciation = hasLatinText ? '' : (line.pronunciation || '');
    const isEnglish = line.lang === 'en';
    const lineSegments = (Array.isArray(parsedLine?.segments)
      ? parsedLine.segments
      : Array.isArray(line.segments) ? line.segments : [])
      .filter(segment => segment && typeof segment === 'object');
    const mainRow = {
      ...line,
      rowId: `main-${index}`,
      segments: lineSegments,
      displayText: line.text || '',
      translation: !hasMainText || isEnglish ? '' : (line.translation || ''),
      pronunciation: isEnglish ? '' : pronunciation,
      displayPron: isEnglish || hasLatinText ? '' : getDisplayPronunciation(pronunciation),
      lang: line.lang || 'auto',
      spacingText: line.spacingText || '',
      _meta: { isAdlib: false, lineIndex: index }
    };
    const adlibRows = line.isSplit && Array.isArray(line.adlibs)
      ? line.adlibs.map((adlib, adlibIndex) => {
        if (!adlib || typeof adlib !== 'object') {
          return {
            text: '',
            segments: [],
            displayText: '',
            translation: '',
            pronunciation: '',
            displayPron: '',
            lang: 'auto',
            spacingText: '',
            rowId: `adlib-${index}-${adlibIndex}`,
            _meta: { isAdlib: true, lineIndex: index, adlibIndex }
          };
        }

        const hasLatinAdlib = isLatinLikeText(adlib.text);
        const adlibPronunciation = hasLatinAdlib ? '' : (adlib.pronunciation || '');
        const isAdlibEnglish = adlib.lang === 'en';
        return {
          ...adlib,
          rowId: `adlib-${index}-${adlibIndex}`,
          segments: Array.isArray(adlib.segments)
            ? adlib.segments.filter(segment => segment && typeof segment === 'object')
            : [],
          displayText: adlib.text,
          translation: isAdlibEnglish ? '' : (adlib.translation || ''),
          pronunciation: isAdlibEnglish ? '' : adlibPronunciation,
          displayPron: isAdlibEnglish || hasLatinAdlib
            ? ''
            : getDisplayPronunciation(adlibPronunciation),
          lang: adlib.lang || 'auto',
          spacingText: adlib.spacingText || '',
          _meta: { isAdlib: true, lineIndex: index, adlibIndex }
        };
      })
      : [];

    return [mainRow, ...adlibRows];
  });
};
