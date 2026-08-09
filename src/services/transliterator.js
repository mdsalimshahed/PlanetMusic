/* --- src/services/transliterator.js --- */
import { numberToEnglishWords } from '../utils/numberToWords';

// Clear legacy memory caches from localStorage
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
    let srcLang = data?.[2] || 'auto'; // Extracted directly from Google's response
    
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

const fetchNumberTranslation = async (engWord, tl) => {
  if (tl === 'auto' || tl === 'en') return engWord;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&dt=rm&q=${encodeURIComponent(engWord)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    let translation = '';
    let transliteration = '';
    
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
    return transliteration ? transliteration.trim() : translation.trim();
  } catch (e) {
    return engWord;
  }
};

export const quickTransliterate = async (text, sl = 'auto') => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return { translation: '', transliteration: null, srcLang: 'auto' };
  return await getGoogleData(clean, sl);
};

// Treats any line containing spaces between words as a spaced script
const isSpacedScript = (text) => {
  if (!text) return true;
  if (/\S\s+\S/.test(text.trim())) return true;
  return !/[\u4e00-\u9fa5\u3040-\u30ff]/.test(text || '');
};

const isRomanChar = (char) => {
  if (/[\u0900-\u109F\u200C\u200D]/.test(char)) return false; 
  return /^[\p{Script=Latin}\p{M}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);
};

export const getBulkPronunciations = async (linesArray, onProgress, targetLang = 'auto') => {
  let completed = 0;
  const promises = linesArray.map(async (lineText) => {
    const updateProgress = () => {
      completed++;
      if (onProgress) onProgress(completed, linesArray.length);
    };

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
    const chunks = [];
    
    if (isSpacedScript(cleanLine)) {
      const transWords = fullTrans
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim());
        
      const tokens = cleanLine.split(/(\s+)/);
      let wordIndex = 0;
      
      for (const token of tokens) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          chunks.push({ type: 'en', text: token, trans: '' });
        } else {
          const isEnToken = Array.from(token).every(c => isRomanChar(c));
          let currentTrans = transWords[wordIndex] || '';
          
          if (/^[\p{P}\p{S}]+$/u.test(token.trim())) {
            chunks.push({ type: 'en', text: token, trans: '' });
            continue;
          }
          
          if (/^[\d,]+$/.test(token)) {
            const cleanNum = token.replace(/,/g, '');
            const engWord = numberToEnglishWords(cleanNum);
            let translatedNum = token;
            if (engWord) {
                translatedNum = await fetchNumberTranslation(engWord, targetLang);
            }
            chunks.push({ type: 'foreign', text: token, trans: translatedNum });
            
            if (transWords[wordIndex] === token) wordIndex++;
          } else if (isEnToken) {
            chunks.push({ type: 'en', text: token, trans: '' });
            
            const cleanToken = token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim().toLowerCase();
            const cleanTransWord = (transWords[wordIndex] || '').toLowerCase();
            
            if (cleanTransWord === cleanToken && cleanToken !== '') {
              wordIndex++;
            }
          } else {
            chunks.push({ type: 'foreign', text: token, trans: currentTrans || token });
            wordIndex++;
          }
        }
      }
    } else {
      let currentType = null;
      let currentText = '';
      
      for (const char of cleanLine) {
        const type = isRomanChar(char) ? 'en' : 'foreign';
        if (currentType === null) {
          currentType = type;
          currentText = char;
        } else if (currentType === type) {
          currentText += char;
        } else {
          chunks.push({ type: currentType, text: currentText });
          currentType = type;
          currentText = char;
        }
      }
      if (currentText) {
        chunks.push({ type: currentType, text: currentText });
      }
      
      for (let j = 0; j < chunks.length; j++) {
        if (chunks[j].type === 'foreign' && chunks[j].text.trim()) {
          const textKey = chunks[j].text.trim();
          
          if (/^[\d,]+$/.test(textKey)) {
            const cleanNum = textKey.replace(/,/g, '');
            const engWord = numberToEnglishWords(cleanNum);
            let translatedNum = textKey;
            if (engWord) {
                translatedNum = await fetchNumberTranslation(engWord, targetLang);
            }
            chunks[j].trans = translatedNum;
          } else {
            const chunkData = await quickTransliterate(textKey, targetLang);
            let cleanChunkTrans = chunkData.transliteration || chunks[j].text;
            cleanChunkTrans = cleanChunkTrans.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim();
            chunks[j].trans = cleanChunkTrans;
          }
        } else {
          chunks[j].trans = '';
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