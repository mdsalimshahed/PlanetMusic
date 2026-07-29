/* --- src/transliterator.js --- */

const getInitialCache = () => {
  localStorage.removeItem('globalTranslationCache');
  
  try {
    const stored = localStorage.getItem('pm_translation_memory_v1');
    if (stored) return new Map(JSON.parse(stored));
  } catch (e) {
    console.error("Failed to parse translation cache", e);
  }
  return new Map();
};

const translationCache = getInitialCache();

const saveTranslationCache = () => {
  try {
    localStorage.setItem('pm_translation_memory_v1', JSON.stringify(Array.from(translationCache.entries())));
  } catch (e) {
    console.warn("Translation cache size limit reached", e);
  }
};

const stripHtmlAndBrackets = (text) => {
  if (!text) return '';
  return text
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[<>]/g, "")
    .trim();
};

export const forceSaveToCache = (text, translation, pronunciationString) => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return;
  
  let rawTranslit = pronunciationString;
  
  if (typeof pronunciationString === 'string') {
      if (pronunciationString.startsWith('{')) {
          try {
              rawTranslit = JSON.parse(pronunciationString).full;
          } catch(e) {}
      } else if (pronunciationString.startsWith('[')) {
          try {
              const parsed = JSON.parse(pronunciationString);
              rawTranslit = parsed.map(c => c.trans || c.text).join('');
          } catch(e) {}
      }
  }

  translationCache.set(clean, { 
     translation: translation || '', 
     transliteration: rawTranslit || null 
  });
  
  saveTranslationCache();
};

const getGoogleData = async (text) => {
  if (!text || text === '') return { translation: '', transliteration: null };
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
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
    return { 
      translation: translation.trim(), 
      transliteration: transliteration ? transliteration.trim() : null 
    };
  } catch (error) {
    console.warn("Google Translate API error:", error);
    return { translation: '', transliteration: null };
  }
};

export const quickTransliterate = async (text, forceRefetch = false, saveToCache = true) => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return { translation: '', transliteration: null };
  
  if (!forceRefetch && translationCache.has(clean)) {
      const cached = translationCache.get(clean);
      if (cached && typeof cached === 'object' && 'translation' in cached) {
          return cached;
      }
  }
  
  const res = await getGoogleData(clean);
  
  if (saveToCache) {
      translationCache.set(clean, res);
      saveTranslationCache();
  }
  
  return res;
};

export const getBulkPronunciations = async (linesArray, onProgress, forceRefetch = false, saveToCache = true) => {
  const results = [];
  const isRomanChar = (char) => /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);

  for (let i = 0; i < linesArray.length; i++) {
    
    const updateProgress = async () => {
      if (onProgress) {
        onProgress(i + 1, linesArray.length);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    };

    if (!linesArray[i]) {
      results.push(null);
      await updateProgress();
      continue;
    }

    const cleanLine = stripHtmlAndBrackets(linesArray[i]);
    if (!cleanLine) {
      results.push(null);
      await updateProgress();
      continue;
    }

    if (forceRefetch) {
       await new Promise(resolve => setTimeout(resolve, 250));
    }

    const fullData = await quickTransliterate(cleanLine, forceRefetch, saveToCache);

    const chunks = [];
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

    let hasForeign = false;
    for (let j = 0; j < chunks.length; j++) {
      if (chunks[j].type === 'foreign' && chunks[j].text.trim()) {
        hasForeign = true;
        const textKey = chunks[j].text.trim();
        const chunkData = await quickTransliterate(textKey, false, saveToCache);
        chunks[j].trans = chunkData.transliteration || chunks[j].text;
      } else {
        // CRITICAL FIX: Leaves English chunks entirely blank so nothing displays beneath them
        chunks[j].trans = ''; 
      }
    }

    if (hasForeign) {
      results.push({
        translation: fullData.translation,
        pronunciation: JSON.stringify({ full: fullData.transliteration, chunks: chunks })
      });
    } else {
      results.push({
        translation: fullData.translation !== cleanLine ? fullData.translation : '', 
        pronunciation: null
      });
    }
    
    await updateProgress();
  }
  
  return results;
};