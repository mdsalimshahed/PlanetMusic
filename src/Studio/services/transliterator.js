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

const getGoogleData = async (text, sl = 'auto', tl = 'en') => {
  if (!text || text === '') return { translation: '', transliteration: null, srcLang: 'auto' };

  try {
    return await fetchGoogleTranslate(text, sl, tl);
  } catch (error) {
    console.warn("Google Translate API error:", error);
    return { translation: '', transliteration: null, srcLang: sl || 'auto' };
  }
};

export const quickTransliterate = async (text, sl = 'auto', tl = 'en') => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return { translation: '', transliteration: null, srcLang: 'auto' };
  return await getGoogleData(clean, sl, tl);
};

const isRomanChar = (char) => {
  if (/[\u0900-\u109F\u200C\u200D]/.test(char)) return false; 
  return /^[\p{Script=Latin}\p{M}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);
};

// Helper: Converts digits to English words, then translates to the target language of the line
const translateNumberToTargetLang = async (numStr, targetLang) => {
    const enWords = numberToEnglishWords(numStr);
    if (!targetLang || targetLang === 'auto' || targetLang === 'en') return enWords;
    
    const res = await getGoogleData(enWords, 'en', targetLang);
    
    // For phonetic fields, prioritize the transliteration (e.g. Romaji/Pinyin) if the language provides one
    if (res.transliteration) return res.transliteration.toLowerCase();
    
    return res.translation ? res.translation.toLowerCase() : enWords;
};

export const getBulkPronunciations = async (linesArray, onProgress, targetLang = 'auto') => {
  let completed = 0;

  const promises = linesArray.map(async (item) => {
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
    
    const fullData = await quickTransliterate(cleanLine, targetLang);
    const finalLang = fullData.srcLang !== 'auto' ? fullData.srcLang : targetLang;
    let fullTrans = fullData.transliteration || '';
    
    // Process full sentence transliteration payload (if it exists)
    if (fullTrans) {
        const matches = fullTrans.match(/\d+/g) || [];
        for (const match of new Set(matches)) {
            const translatedNum = await translateNumberToTargetLang(match, finalLang);
            fullTrans = fullTrans.replace(new RegExp(`\\b${match}\\b`, 'g'), translatedNum);
        }
    }
    
    // Split by organic space boundaries
    const tokens = cleanLine.split(/(\s+)/);
    const chunks = [];

    for (const token of tokens) {
      if (!token) continue;
      
      if (/^\s+$/.test(token)) {
        chunks.push({ type: 'en', text: token, trans: '' });
      } else {
        const isEnToken = Array.from(token).every(c => isRomanChar(c));
        
        if (/^[\p{P}\p{S}]+$/u.test(token.trim())) {
          chunks.push({ type: 'en', text: token, trans: '' });
          continue;
        }

        // HACK: Intercept tokens that are purely numbers (ignoring punctuation like commas/parentheses)
        const nakedToken = token.replace(/[\p{P}\p{S}]/gu, '').trim();
        if (/^\d+$/.test(nakedToken)) {
            const translatedNum = await translateNumberToTargetLang(nakedToken, finalLang);
            const translatedToken = token.replace(nakedToken, translatedNum);
            chunks.push({ type: 'foreign', text: token, trans: translatedToken });
            continue;
        }

        if (isEnToken) {
          chunks.push({ type: 'en', text: token, trans: '' });
        } else {
          const chunkData = await quickTransliterate(token, targetLang);
          let chunkTrans = chunkData.transliteration || '';
          
          if (chunkTrans) {
              const matches = chunkTrans.match(/\d+/g) || [];
              for (const match of new Set(matches)) {
                  const translatedNum = await translateNumberToTargetLang(match, finalLang);
                  chunkTrans = chunkTrans.replace(new RegExp(`\\b${match}\\b`, 'g'), translatedNum);
              }
          }
          
          chunks.push({ type: 'foreign', text: token, trans: chunkTrans });
        }
      }
    }

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