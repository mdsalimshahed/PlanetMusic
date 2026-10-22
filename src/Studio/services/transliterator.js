/* --- src/services/transliterator.js --- */
import { numberToEnglishWords } from '../../Application/utils/numberToWords.js';
import { fetchGoogleTranslate } from './googleTranslateClient.js';

try {
  localStorage.removeItem('globalTranslationCache');
  localStorage.removeItem('pm_translation_memory_v1');
} catch (e) {}

const stripHtmlAndBrackets = (text) => {
  if (!text) return '';
  return text
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[<>]/g, "")
    .trim();
};

const getGoogleData = async (
  text,
  sl = 'auto',
  tl = 'en',
  proxySession = null
) => {
  if (!text || text === '') return { translation: '', transliteration: null, srcLang: 'auto' };

  try {
    return await fetchGoogleTranslate(text, sl, tl, proxySession);
  } catch (error) {
    console.warn("Google Translate API error:", error);
    return { translation: '', transliteration: null, srcLang: sl || 'auto' };
  }
};

export const quickTransliterate = async (
  text,
  sl = 'auto',
  tl = 'en',
  proxySession = null
) => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return { translation: '', transliteration: null, srcLang: 'auto' };
  return await getGoogleData(clean, sl, tl, proxySession);
};

const isRomanChar = (char) => {
  if (/[\u0900-\u109F\u200C\u200D]/.test(char)) return false; 
  return /^[\p{Script=Latin}\p{M}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);
};

// Helper: Converts digits to English words, then translates to the target language of the line
const translateNumberToTargetLang = async (
  numStr,
  targetLang,
  proxySession = null
) => {
    const enWords = numberToEnglishWords(numStr);
    if (!targetLang || targetLang === 'auto' || targetLang === 'en') return enWords;
    
    const res = await getGoogleData(enWords, 'en', targetLang, proxySession);
    
    // For phonetic fields, prioritize the transliteration (e.g. Romaji/Pinyin) if the language provides one
    if (res.transliteration) return res.transliteration.toLowerCase();
    
    return res.translation ? res.translation.toLowerCase() : enWords;
};

const translateNumberMatches = async (text, targetLang, proxySession) => {
  const matches = [...new Set(text.match(/\d+/g) || [])];
  const translations = await Promise.all(
    matches.map(match => translateNumberToTargetLang(
      match, targetLang, proxySession
    ))
  );
  return matches.reduce(
    (result, match, index) => result.replace(
      new RegExp(`\\b${match}\\b`, 'g'),
      translations[index]
    ),
    text
  );
};

export const getBulkPronunciations = async (
  linesArray,
  onProgress,
  targetLang = 'auto',
  proxySession = null,
  initialResponses = []
) => {
  let completed = 0;

  const promises = linesArray.map(async (item, itemIndex) => {
    const updateProgress = () => {
      completed++;
      if (onProgress) onProgress(completed, linesArray.length);
    };

    const lineText = typeof item === 'object' ? item.text : item;
    if (!lineText) {
      updateProgress();
      return null;
    }
    
    const cleanLine = stripHtmlAndBrackets(lineText);
    if (!cleanLine) {
      updateProgress();
      return null;
    }
    
    const fullData = initialResponses[itemIndex] || await quickTransliterate(
      cleanLine, targetLang, 'en', proxySession
    );
    const finalLang = fullData.srcLang !== 'auto' ? fullData.srcLang : targetLang;
    let fullTrans = fullData.transliteration || '';
    
    if (fullTrans) {
      fullTrans = await translateNumberMatches(
        fullTrans, finalLang, proxySession
      );
    }
    
    const tokens = cleanLine.split(/(\s+)/);
    const chunks = (await Promise.all(tokens.map(async token => {
      if (!token) return null;
      if (/^\s+$/.test(token)) {
        return { type: 'en', text: token, trans: '' };
      }

      const isEnToken = Array.from(token).every(c => isRomanChar(c));
      if (/^[\p{P}\p{S}]+$/u.test(token.trim())) {
        return { type: 'en', text: token, trans: '' };
      }

      const nakedToken = token.replace(/[\p{P}\p{S}]/gu, '').trim();
      if (/^\d+$/.test(nakedToken)) {
        const translatedNum = await translateNumberToTargetLang(
          nakedToken, finalLang, proxySession
        );
        return {
          type: 'foreign',
          text: token,
          trans: token.replace(nakedToken, translatedNum)
        };
      }

      if (isEnToken) return { type: 'en', text: token, trans: '' };

      const chunkData = token === cleanLine
        ? fullData
        : await quickTransliterate(token, targetLang, 'en', proxySession);
      const chunkTrans = await translateNumberMatches(
        chunkData.transliteration || '',
        finalLang,
        proxySession
      );
      return { type: 'foreign', text: token, trans: chunkTrans };
    }))).filter(Boolean);

    updateProgress();
    
    const hasForeign = chunks.some(c => c.type === 'foreign' && c.text.trim());
    if (hasForeign) {
      return {
        translation: fullData.translation,
        pronunciation: JSON.stringify({ full: fullTrans, chunks: chunks }),
        srcLang: fullData.srcLang || 'auto'
      };
    } else {
      return {
        translation: fullData.translation !== cleanLine ? fullData.translation : '', 
        pronunciation: null,
        srcLang: fullData.srcLang || 'auto'
      };
    }
  });

  return await Promise.all(promises);
};