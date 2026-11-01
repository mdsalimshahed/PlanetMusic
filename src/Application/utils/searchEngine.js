/* --- src/utils/searchEngine.js --- */

// Properly normalizes text: removes parentheticals (e.g. "(feat. X)"), 
// strips punctuation, and standardizes casing for flawless matching.
export const norm = (str) => {
  if (!str) return '';
  return str
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '') 
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

export const mergeOnlineSearchResults = (itunesItems = [], deezerItems = []) => {
  const seenITunesIds = new Set();
  const itunesResults = itunesItems.reduce((results, song) => {
    if (song.trackId != null && seenITunesIds.has(String(song.trackId))) return results;
    if (song.trackId != null) seenITunesIds.add(String(song.trackId));
    results.push({ ...song, sourceNames: ['iTunes'] });
    return results;
  }, []);

  const deezerResults = [];
  const seenDeezerIds = new Set();
  deezerItems.forEach(song => {
    if (song.id == null || seenDeezerIds.has(String(song.id))) return;
    seenDeezerIds.add(String(song.id));
    deezerResults.push({
      trackId: `dz_${song.id}`,
      trackName: song.title || '',
      artistName: song.artist || '',
      collectionName: song.album || '',
      artworkUrl100: song.cover || '',
      trackTimeMillis: (song.duration || 0) * 1000,
      previewUrl: '',
      sourceNames: ['Deezer'],
      customLinks: song.link ? { deezer: song.link } : {}
    });
  });

  const matchedDeezerIds = new Set();
  const combinedResults = itunesResults.map(song => {
    const title = norm(song.trackName);
    const artist = norm(song.artistName);
    if (!title || !artist) return song;

    const deezerMatch = deezerResults.find(deezerSong => (
      !matchedDeezerIds.has(deezerSong.trackId) &&
      norm(deezerSong.trackName) === title &&
      norm(deezerSong.artistName) === artist
    ));
    if (!deezerMatch) return song;

    matchedDeezerIds.add(deezerMatch.trackId);
    return {
      ...song,
      sourceNames: ['iTunes', 'Deezer'],
      customLinks: { ...song.customLinks, ...deezerMatch.customLinks }
    };
  });

  deezerResults.forEach(song => {
    if (!matchedDeezerIds.has(song.trackId)) combinedResults.push(song);
  });

  return combinedResults;
};

export const filterAndSortByTitleMatch = (results, query) => {
  if (!results || results.length === 0) return [];
  if (!query || !query.trim()) return results;
  
  const cleanQuery = norm(query);
  const queryWords = cleanQuery.split(/\s+/).filter(Boolean);

  const strictFiltered = results.filter(song => {
    const cleanTitle = norm(song.trackName);
    const cleanFullText = norm(`${song.trackName || ''} ${song.artistName || ''} ${song.collectionName || ''}`);
    
    // REQUIREMENT 1: Every single word typed MUST exist somewhere in the song's metadata
    const matchesAllWords = queryWords.every(word => cleanFullText.includes(word));

    // REQUIREMENT 2: Strict Title Relevance. At least one word MUST be in the song title.
    const hasTitleMatch = queryWords.some(word => cleanTitle.includes(word));

    return matchesAllWords && hasTitleMatch;
  });

  const getScore = (song) => {
    const rawTitle = (song.trackName || '').toLowerCase().trim();
    const rawArtist = (song.artistName || '').toLowerCase().trim();
    const titleClean = norm(song.trackName);
    const artistClean = norm(song.artistName);
    
    let score = 0;

    // 1. Exact Match for the whole query (User typed exact title)
    if (titleClean === cleanQuery) score += 3000;

    // 2. Query contains the exact clean title (e.g. query is "gnat eminem", title is "gnat")
    if (titleClean && cleanQuery.includes(titleClean)) {
       score += 1500;
       // Massive bonus if the query contains BOTH the exact title AND the exact artist
       if (artistClean && cleanQuery.includes(artistClean)) score += 1500;
    }
    
    // 3. Query contains the exact clean artist (e.g. query is "gnat eminem", artist is "eminem")
    if (artistClean && cleanQuery.includes(artistClean)) score += 800;

    // 4. Starts with matches
    if (titleClean.startsWith(cleanQuery)) score += 300;

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