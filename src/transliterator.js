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
  const cleanText = stripHtmlAndBrackets(text);
  if (!cleanText || cleanText === '') return null;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=rm&q=${encodeURIComponent(cleanText)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data[0] && data[0][0]) {
      const romanized = data[0][0][2] || data[0][0][3];
      return romanized ? romanized.trim() : null;
    }
    return null;
  } catch (error) {
    console.warn("Google Translate API skipped a line:", error);
    return null;
  }
};

export const getBulkPronunciations = async (linesArray, onProgress) => {
  const results = [];
  
  for (let i = 0; i < linesArray.length; i++) {
    if (linesArray[i] === null) {
      results.push(null);
    } else {
      const cleanLine = stripHtmlAndBrackets(linesArray[i]);
      
      // Skip if line is completely empty or purely English/Punctuation
      const isEnglish = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~‘’“”\–\—]+$/.test(cleanLine);
      
      if (!cleanLine || isEnglish) {
        results.push(null);
      } else {
        const p = await getGooglePronunciation(cleanLine);
        results.push(p);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (onProgress) onProgress(i + 1, linesArray.length);
  }
  
  return results;
};