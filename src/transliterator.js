/* --- src/transliterator.js --- */

// Initialize memory from local storage to keep past translations completely permanent
const getInitialCache = () => {
  try {
    const stored = localStorage.getItem('globalTranslationCache');
    if (stored) return new Map(JSON.parse(stored));
  } catch (e) {
    console.error("Failed to parse translation cache", e);
  }
  return new Map();
};

const translationCache = getInitialCache();

// Helper to save cache back to local storage
const saveTranslationCache = () => {
  try {
    localStorage.setItem('globalTranslationCache', JSON.stringify(Array.from(translationCache.entries())));
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

const getGooglePronunciation = async (text) => {
  if (!text || text === '') return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data[0] && data[0][0]) {
      const romanized = data[0][0][2] || data[0][0][3];
      return romanized ? romanized.trim() : null;
    }
    return null;
  } catch (error) {
    console.warn("Google Translate API skipped a chunk:", error);
    return null;
  }
};

export const quickTransliterate = async (text) => {
  const clean = stripHtmlAndBrackets(text);
  if (!clean) return null;
  if (translationCache.has(clean)) return translationCache.get(clean);
  
  const res = await getGooglePronunciation(clean);
  translationCache.set(clean, res);
  saveTranslationCache();
  return res;
};

export const getBulkPronunciations = async (linesArray, onProgress) => {
  const results = [];
  const isRomanChar = (char) => /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);

  for (let i = 0; i < linesArray.length; i++) {
    
    // CRITICAL FIX: We create a helper function that yields the main thread for 15ms.
    // This allows React to physically paint the DOM and animate the progress bar, 
    // ensuring the UI doesn't freeze when pulling instantly from the local cache.
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
        let trans = translationCache.get(textKey);
                 
        if (!trans) {
          trans = await getGooglePronunciation(textKey);
          translationCache.set(textKey, trans);
          saveTranslationCache();
        }
        chunks[j].trans = trans || null;
      }
    }

    if (hasForeign) {
      results.push(JSON.stringify(chunks));
    } else {
      results.push(null);
    }
    
    await updateProgress();
  }
  
  return results;
};