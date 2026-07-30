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

// Detect Brahmic / Indic scripts ONLY
export const isIndicScript = (text) => {
  return /[\u0900-\u0DFF\u0E80-\u0EFF]/.test(text || '');
};

export const getBulkPronunciations = async (linesArray, onProgress) => {
  const results = [];
  
  const isRomanChar = (char) => {
    if (/[\u0900-\u109F\u200C\u200D]/.test(char)) return false; 
    return /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);
  };

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
    const fullTrans = fullData.transliteration || '';
    const chunks = [];

    // --- INDIC-ONLY WORD MAPPING PATH ---
    if (isIndicScript(cleanLine)) {
      const transWords = fullTrans.split(/\s+/).filter(Boolean);
      let transWordIdx = 0;

      const tokens = cleanLine.split(/(\s+)/);

      for (const token of tokens) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          chunks.push({ type: 'en', text: token, trans: '' });
        } else {
          const isEnToken = Array.from(token).every(c => isRomanChar(c));
          if (isEnToken) {
            chunks.push({ type: 'en', text: token, trans: '' });
          } else {
            const pairedTrans = transWords[transWordIdx] || '';
            chunks.push({ type: 'foreign', text: token, trans: pairedTrans });
            transWordIdx++;
          }
        }
      }
    } else {
      // --- ORIGINAL CHARACTER/CHUNK PATH FOR KOREAN, JAPANESE, CHINESE, RTL, LATIN ---
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

      // Fetch individual sub-chunk transliterations so Korean words do NOT repeat full line text!
      for (let j = 0; j < chunks.length; j++) {
        if (chunks[j].type === 'foreign' && chunks[j].text.trim()) {
          const textKey = chunks[j].text.trim();
          const chunkData = await quickTransliterate(textKey);
          chunks[j].trans = chunkData.transliteration || chunks[j].text;
        } else {
          chunks[j].trans = ''; 
        }
      }
    }

    let hasForeign = chunks.some(c => c.type === 'foreign' && c.text.trim());

    if (hasForeign) {
      results.push({
        translation: fullData.translation,
        pronunciation: JSON.stringify({ full: fullTrans, chunks: chunks })
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