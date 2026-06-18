/* --- src/transliterator.js --- */

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

export const getBulkPronunciations = async (linesArray, onProgress) => {
  const results = [];
  
  // Regex defines English/Roman letters, numbers, punctuation, spaces, and symbols.
  const isRomanChar = (char) => /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{Z}\p{S}\p{C}]+$/u.test(char);
  
  for (let i = 0; i < linesArray.length; i++) {
    if (!linesArray[i]) {
      results.push(null);
      if (onProgress) onProgress(i + 1, linesArray.length);
      continue;
    }

    const cleanLine = stripHtmlAndBrackets(linesArray[i]);
    if (!cleanLine) {
      results.push(null);
      if (onProgress) onProgress(i + 1, linesArray.length);
      continue;
    }

    // 1. Split line into logical chunks
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

    // 2. Transliterate ONLY the foreign chunks
    for (let j = 0; j < chunks.length; j++) {
      if (chunks[j].type === 'foreign' && chunks[j].text.trim()) {
        hasForeign = true;
        const trans = await getGooglePronunciation(chunks[j].text.trim());
        chunks[j].trans = trans || null;
        // Small delay to prevent API rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // 3. Save as a structured JSON string to map perfectly in the UI
    if (hasForeign) {
      results.push(JSON.stringify(chunks));
    } else {
      results.push(null); // It's a purely English line, skip transliteration entirely
    }

    if (onProgress) onProgress(i + 1, linesArray.length);
  }
  
  return results;
};