/* --- src/transliterator.js --- */

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

export const quickTransliterate = async (text) => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return { translation: '', transliteration: null };
  return await getGoogleData(clean);
};

// Check for Brahmic / Indic scripts (Bengali, Devanagari, Tamil, Telugu, Malayalam, Kannada, Gujarati, Gurmukhi, Sinhala)
export const isIndicScript = (text) => {
  return /[\u0900-\u0DFF\u0E80-\u0EFF]/.test(text || '');
};

export const getBulkPronunciations = async (linesArray, onProgress) => {
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

    const fullData = await quickTransliterate(cleanLine);

    // CRITICAL FIX: If line contains Indic or complex scripts, preserve the whole string to avoid breaking diacritics
    if (isIndicScript(cleanLine)) {
      results.push({
        translation: fullData.translation,
        pronunciation: JSON.stringify({
          full: fullData.transliteration,
          isIndic: true,
          chunks: [{ type: 'foreign', text: cleanLine, trans: fullData.transliteration }]
        })
      });
      await updateProgress();
      continue;
    }

    // Word/Chunk-level grouping for Latin + Asian mixed scripts (Chinese, Japanese, etc.)
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
        const chunkData = await quickTransliterate(textKey);
        chunks[j].trans = chunkData.transliteration || chunks[j].text;
      } else {
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