/* --- src/utils/searchEngine.js --- */

// Properly normalizes text: removes parentheticals (e.g. "(feat. X)"), 
// strips punctuation, and standardizes casing for flawless matching.
export const norm = (str) => {
  if (!str) return '';
  return str
    .replace(/[\(\[].*?[\)\]]/g, '')
    .replace(/[^\w\s]/g, '') 
    .toLowerCase()
    .trim();
};

export const filterAndSortByTitleMatch = (results, query) => {
  if (!results || results.length === 0) return [];
  if (!query || !query.trim()) return results;
  
  const cleanQuery = query.toLowerCase().trim();
  const queryWords = cleanQuery.split(/\s+/).filter(Boolean);

  const strictFiltered = results.filter(song => {
    const title = (song.trackName || '').toLowerCase();
    const artist = (song.artistName || '').toLowerCase();
    const album = (song.collectionName || '').toLowerCase();
    
    // Combine all searchable metadata into one payload
    const fullText = `${title} ${artist} ${album}`;
    const cleanFullText = norm(fullText);
    
    // REQUIREMENT 1: Every single word typed MUST exist somewhere in the song's metadata
    const matchesAllWords = queryWords.every(word => 
      fullText.includes(word) || cleanFullText.includes(norm(word))
    );

    // REQUIREMENT 2: Strict Title Relevance. At least one word MUST be in the song title.
    const hasTitleMatch = queryWords.some(word => 
      title.includes(word) || norm(title).includes(norm(word))
    );

    return matchesAllWords && hasTitleMatch;
  });

  const getScore = (song) => {
    const rawTitle = (song.trackName || '').toLowerCase().trim();
    const rawArtist = (song.artistName || '').toLowerCase().trim();
    const titleClean = norm(song.trackName);
    const artistClean = norm(song.artistName);
    
    let score = 0;

    // 1. Exact Match for the whole query (User typed exact title)
    if (titleClean === cleanQuery || rawTitle === cleanQuery) score += 3000;

    // 2. Query contains the exact clean title (e.g. query is "gnat eminem", title is "gnat")
    if (titleClean && cleanQuery.includes(titleClean)) {
       score += 1500;
       // Massive bonus if the query contains BOTH the exact title AND the exact artist
       if (artistClean && cleanQuery.includes(artistClean)) score += 1500;
    }
    
    // 3. Query contains the exact clean artist (e.g. query is "gnat eminem", artist is "eminem")
    if (artistClean && cleanQuery.includes(artistClean)) score += 800;

    // 4. Starts with matches
    if (rawTitle.startsWith(cleanQuery) || titleClean.startsWith(cleanQuery)) score += 300;

    // 5. Individual Token matches
    queryWords.forEach(word => {
      // Title scoring
      if (titleClean === word) score += 150; 
      else if (titleClean.includes(word)) score += 50; 
      else if (rawTitle.includes(word)) score += 10; // Found in parens/brackets (low weight)
      
      // Artist scoring
      if (artistClean === word) score += 150; 
      else if (artistClean.includes(word)) score += 50;
      else if (rawArtist.includes(word)) score += 10;
    });

    // 6. Universal Penalties for spam/karaoke/covers
    const spamKeywords = [
        'karaoke', 'cover', 'tribute', 'made popular by', 
        'originally performed by', 'instrumental', 'vocal version', 
        'backing business', '8-bit', 'emulation', 'in the style of'
    ];
    
    spamKeywords.forEach(spam => {
      if (rawTitle.includes(spam) || rawArtist.includes(spam)) {
        // Only apply the penalty if the user didn't explicitly ask for this spam word
        if (!cleanQuery.includes(spam)) {
          score -= 3000;
        }
      }
    });

    return score;
  };

  return [...strictFiltered].sort((a, b) => getScore(b) - getScore(a));
};