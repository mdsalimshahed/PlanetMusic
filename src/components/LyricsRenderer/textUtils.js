/* --- src/components/LyricsRenderer/textUtils.js --- */
export const isCJ = (char) => /[\u4e00-\u9fa5\u3040-\u30ff]/.test(char);
export const isPunctuationChar = (char) => /^[\p{P}\p{S}\s]+$/u.test(char);

export const getGraphemes = (str) => {
  if (!str) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  return str.match(/[\u0900-\u097F][\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]*|./gu) || Array.from(str);
};

export const normalizeTrans = (str, keepParens = false) => {
  if (!str) return '';
  let res = str;
  if (!keepParens) {
    res = res.replace(/[()\[\]{}]/g, ''); // PRESERVES SPACES
  }
  const leadingPunctRegex = keepParens ? /^[^\p{L}\p{N}\p{M}\s()]+/gu : /^[\p{P}\p{S}]+/gu;
  const trailingPunctRegex = keepParens ? /[^\p{L}\p{N}\p{M}\s()]+$/gu : /[\p{P}\p{S}]+$/gu;
  return res
    .replace(/[\u02BE\u02BF\u02C0\u02C1]/g, "'")
    .replace(leadingPunctRegex, '')
    .replace(trailingPunctRegex, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const cleanTranslationText = (text) => {
  if (!text) return '';
  return String(text).replace(/\.+$/, '').trim();
};

export const isRTLLanguage = (text) => /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);

export const parsePronunciation = (pronString) => {
  let parsedChunks = null;
  let fullTrans = null;
  if (typeof pronString === 'string') {
    const cleanPron = pronString.trim();
    if (cleanPron.startsWith('{')) {
      try {
        const parsed = JSON.parse(cleanPron);
        parsedChunks = parsed.chunks;
        fullTrans = parsed.full;
      } catch (e) {}
    } else if (cleanPron.startsWith('[')) {
      try {
        parsedChunks = JSON.parse(cleanPron);
      } catch (e) {}
    }
  }
  return { parsedChunks, fullTrans };
};