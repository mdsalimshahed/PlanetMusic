import { parseLyrics } from './lyricsUtils.js';

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
    const pronunciation = line.pronunciation || '';
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
      translation: isEnglish ? '' : (line.translation || ''),
      pronunciation: isEnglish ? '' : pronunciation,
      displayPron: isEnglish ? '' : getDisplayPronunciation(pronunciation),
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

        const adlibPronunciation = adlib.pronunciation || '';
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
          displayPron: isAdlibEnglish ? '' : getDisplayPronunciation(adlibPronunciation),
          lang: adlib.lang || 'auto',
          spacingText: adlib.spacingText || '',
          _meta: { isAdlib: true, lineIndex: index, adlibIndex }
        };
      })
      : [];

    return [mainRow, ...adlibRows];
  });
};
