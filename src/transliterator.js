/* --- src/transliterator.js --- */

const isBasicLatin = (text) => /^[\u0000-\u024F\u1E00-\u1EFF\s\d!@#$%^&*()_+\-=\[\] {};':"\\|,.<>\/?]+$/.test(text);

// HARDCODED UNBREAKABLE SANITIZER: Eradicates every trace of HTML tags and brackets instantly
const stripHtmlAndBrackets = (text) => {
  if (!text) return '';
  return text
    .replace(/<\/?[^>]+(>|$)/g, "") // Strips all <i>, <b>, </i>, <br> tags
    .replace(/\[.*?\]/g, "")        // Strips any Genius section block metadata completely
    .replace(/[<>]/g, "")           // Aggressive fallback to kill any stray opening/closing angle brackets
    .trim();
};

const getGooglePronunciation = async (text) => {
  const cleanText = stripHtmlAndBrackets(text);
  
  if (!cleanText || cleanText === '') return null;
  if (isBasicLatin(cleanText)) return null;

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

export const getBulkPronunciations = async (linesArray) => {
  const results = [];
  
  for (let i = 0; i < linesArray.length; i++) {
    const pronunciation = await getGooglePronunciation(linesArray[i]);
    results.push(pronunciation);
    
    // 50ms safety buffer
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return results;
};