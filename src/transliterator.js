/* --- src/transliterator.js --- */

export const chunkText = (text) => {
  // A robust regex that isolates blocks of English letters, numbers, punctuation, and whitespace
  const regex = /([A-Za-zÀ-ÖØ-öø-ÿ0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~‘’“”\–\—]+)/;
  const parts = text.split(regex).filter(p => p !== '');
  
  return parts.map(part => {
    const isEnglish = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~‘’“”\–\—]+$/.test(part);
    return { text: part, isEnglish: isEnglish };
  });
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

export const getBulkPronunciations = async (linesArray) => {
  const results = [];
  
  for (let i = 0; i < linesArray.length; i++) {
    const cleanLine = stripHtmlAndBrackets(linesArray[i]);
    
    if (!cleanLine) {
      results.push(null);
      continue;
    }

    const chunks = chunkText(cleanLine);
    const pronChunks = [];
    
    for (const chunk of chunks) {
      if (chunk.isEnglish || !chunk.text.trim()) {
        // Skip the API completely, preserve English seamlessly
        pronChunks.push({ text: chunk.text, pron: null });
      } else {
        // Only translate the isolated foreign characters
        const p = await getGooglePronunciation(chunk.text);
        pronChunks.push({ text: chunk.text, pron: p });
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    if (pronChunks.every(c => c.pron === null)) {
      results.push(null);
    } else {
      results.push(pronChunks);
    }
  }
  
  return results;
};