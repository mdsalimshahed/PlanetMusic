/* --- src/services/transliterator.js --- */
import { numberToEnglishWords } from '../../Application/utils/numberToWords.js';

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

const getGoogleData = async (text, sl = 'auto') => {
  if (!text || text === '') return { translation: '', transliteration: null, srcLang: 'auto' };
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    let translation = '';
    let transliteration = '';
    let srcLang = data?.[2] || 'auto';

    if (data && data[0]) {
      for (let i = 0; i < data[0].length; i++) {
        if (data[0][i][0] && data[0][i][1]) {
          translation += data[0][i][0];
        }
      }
      const last = data[0][data[0].length - 1];
      if (last && (last[2] || last[3]) && !last[1]) {
        transliteration = last[2] || last[3] || '';
      } else if (data[0].length > 1) {
        const possibleRom = data[0].find(item => item[2] || item[3]);
        if (possibleRom) transliteration = possibleRom[2] || possibleRom[3];
      }
    }
    return {
      translation: translation.trim(),
      transliteration: transliteration ? transliteration.trim() : null,
      srcLang
    };
  } catch (error) {
    console.warn("Google Translate API error:", error);
    return { translation: '', transliteration: null, srcLang: sl || 'auto' };
  }
};

export const quickTransliterate = async (text, sl = 'auto') => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return { translation: '', transliteration: null, srcLang: 'auto' };
  return await getGoogleData(clean, sl);
};

const isRomanChar = (char) => {
  if (/[\u0900-\u109F\u200C\u200D]/.test(char)) return false; 
  return /^[\p{Script=Latin}\p{M}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);
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
    const fullTrans = fullData.transliteration || '';
    
    // Split by organic space boundaries (matching `const blocks = textInput.split(/\s+/)`)
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

        if (isEnToken) {
          // English token: Strictly mute pronunciation!
          chunks.push({ type: 'en', text: token, trans: '' });
        } else {
          // CJK token: Fetch pronunciation specifically for this block
          const chunkData = await quickTransliterate(token, targetLang);
          const chunkTrans = chunkData.transliteration || '';
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