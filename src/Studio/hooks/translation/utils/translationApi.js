/* --- src/hooks/translation/utils/translationApi.js --- */
import { getBulkPronunciations } from '../../../services/transliterator.js';

export const formatAdlibPronunciation = (adlibText, displayPron) => {
  if (!displayPron) return null;
  return JSON.stringify({
    full: displayPron,
    chunks: [{ type: 'foreign', text: adlibText, trans: displayPron }]
  });
};

export const normalizeForComparison = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '')
    .trim();

export const fetchGoogleWithLang = async (text, sl = 'auto') => {
  if (!text || text === '') return { translation: '', transliteration: null, srcLang: 'auto' };
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

export const fetchSingleLine = async (line) => {
  const hasSpacing = Boolean(line.spacingText && line.spacingText.trim());
  
  let textToTranslate = hasSpacing ? line.spacingText : line.displayText;
  if (!hasSpacing && !line._meta?.isAdlib && line.isSplit && line.adlibs) {
    line.adlibs.forEach(a => {
      textToTranslate = textToTranslate.replace(a.text, '');
    });
  }

  textToTranslate = textToTranslate.replace(/\s+/g, ' ').trim();
  if (!textToTranslate) return null;
  
  try {
    const sourceLang = line.lang || 'auto';
    const rawData = await fetchGoogleWithLang(textToTranslate, sourceLang);
    
    const resArr = await getBulkPronunciations([{ text: textToTranslate, hasSpacing }], null, rawData.srcLang || sourceLang);
    const res = resArr?.[0] || {};
    
    const finalSrcLang = rawData.srcLang && rawData.srcLang !== 'auto' 
       ? rawData.srcLang 
       : (res.srcLang || sourceLang);
        
    return {
      ...res,
      translation: rawData.translation || res.translation || '',
      srcLang: finalSrcLang
    };
  } catch (e) {
    console.error("Single line fetch error:", e);
    return null;
  }
};