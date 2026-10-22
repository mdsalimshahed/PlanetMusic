/* --- src/hooks/translation/utils/translationApi.js --- */
import { getBulkPronunciations } from '../../../services/transliterator.js';
import { fetchGoogleTranslate } from '../../../services/googleTranslateClient.js';

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

export const fetchGoogleWithLang = async (
  text,
  sl = 'auto',
  proxySession = null
) => {
  if (!text || text === '') return { translation: '', transliteration: null, srcLang: 'auto' };
  try {
    return await fetchGoogleTranslate(text, sl, 'en', proxySession);
  } catch (error) {
    console.warn('Google Translate API error:', error);
    throw error;
  }
};

export const fetchSingleLine = async (line, proxySession = null) => {
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
    const rawData = await fetchGoogleWithLang(
      textToTranslate,
      sourceLang,
      proxySession
    );
    
    const resArr = await getBulkPronunciations(
      [{ text: textToTranslate, hasSpacing }],
      null,
      rawData.srcLang || sourceLang,
      proxySession,
      [rawData]
    );
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