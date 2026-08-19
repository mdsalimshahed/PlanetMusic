/* --- src/utils/apiUtils.js --- */

export const fetchSingerImage = async (band, singer, trackName, albumName) => {
  if (!singer || singer.includes('&') || singer.includes(',')) return null;

  const cleanSinger = singer.replace(/\s*\(feat\..*?\)/i, '').trim();
  const cleanBand = band ? band.replace(/\s*\(feat\..*?\)/i, '').trim() : '';
  const isMainArtist = cleanSinger.toLowerCase() === cleanBand.toLowerCase();

  try {
    if (isMainArtist) {
      // MAIN ARTIST LOGIC: Strict article text verification
      const cleanTrack = trackName ? trackName.replace(/[\(\[].*?[\)\]]/g, '').trim().toLowerCase() : '';
      const cleanAlbum = albumName ? albumName.replace(/[\(\[].*?[\)\]]/g, '').trim().toLowerCase() : '';

      // Search Wikipedia using ONLY the artist's name
      const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(cleanSinger)}&gsrlimit=10&prop=pageimages|extracts|pageterms&explaintext=1&exchars=5000&pithumbsize=500`);
      const wikiData = await wikiRes.json();
      
      if (wikiData?.query?.pages) {
        const pages = Object.values(wikiData.query.pages).sort((a, b) => a.index - b.index);
        const musicKeywords = ['singer', 'musician', 'band', 'rapper', 'dj', 'songwriter', 'composer', 'group', 'pop', 'vocalist', 'artist'];
        
        // Pass 1: Strict match - check if the song name or album name is explicitly mentioned in the article text
        for (const page of pages) {
          const title = page.title.toLowerCase();
          if (title.includes('disambiguation') || title.includes('list of')) continue;

          const extract = (page.extract || '').toLowerCase();
          
          // Ensure track/album names are substantial enough to avoid false positives on generic words like "intro"
          const mentionsTrack = cleanTrack && cleanTrack.length > 2 && extract.includes(cleanTrack);
          const mentionsAlbum = cleanAlbum && cleanAlbum.length > 2 && extract.includes(cleanAlbum);

          if ((mentionsTrack || mentionsAlbum) && page.thumbnail?.source && !page.thumbnail.source.toLowerCase().endsWith('.svg')) {
            return page.thumbnail.source;
          }
        }

        // Pass 2: Fallback - if no article mentions the specific song/album, find the first relevant musician page
        for (const page of pages) {
          const title = page.title.toLowerCase();
          if (title.includes('disambiguation') || title.includes('list of')) continue;
          
          const desc = page.terms?.description?.[0]?.toLowerCase() || '';
          const isMusician = musicKeywords.some(keyword => desc.includes(keyword) || title.includes(`(${keyword})`));

          if (isMusician && page.thumbnail?.source && !page.thumbnail.source.toLowerCase().endsWith('.svg')) {
            return page.thumbnail.source;
          }
        }
      }
    } else {
      // INDIVIDUAL ARTIST LOGIC: Reverted back to the highly successful context query
      const wikiSearchQuery = `${cleanSinger} ${cleanBand} musician`.trim().replace(/\s+/g, ' ');
      
      const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(wikiSearchQuery)}&gsrlimit=5&prop=pageimages|pageterms&pithumbsize=500`);
      const wikiData = await wikiRes.json();
      
      if (wikiData?.query?.pages) {
        const pages = Object.values(wikiData.query.pages).sort((a, b) => a.index - b.index);
        const musicKeywords = ['singer', 'musician', 'band', 'rapper', 'dj', 'songwriter', 'composer', 'group', 'pop', 'vocalist', 'artist'];
        
        for (const page of pages) {
          const desc = page.terms?.description?.[0]?.toLowerCase() || '';
          const title = page.title.toLowerCase();
          
          // Strictly reject disambiguation pages
          if (title.includes('disambiguation') || title.includes('list of')) continue;

          // Ensure the Wikipedia result is explicitly tagged as a musician or artist
          const isMusician = musicKeywords.some(keyword => desc.includes(keyword) || title.includes(`(${keyword})`));
          if (isMusician && page.thumbnail?.source && !page.thumbnail.source.toLowerCase().endsWith('.svg')) {
            return page.thumbnail.source;
          }
        }
      }
    }
  } catch (e) {
    console.error("Wikipedia Fetch Error:", e);
  }

  return null;
};

export const fetchYouLyrics = async (trackName, artistName, durationMs) => {
  const track = encodeURIComponent(trackName);
  const artist = encodeURIComponent(artistName);

  try {
    const res = await fetch(`https://api.youlyrics.com/get?artist=${artist}&track=${track}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.warn("YouLyrics Fetch Error:", error);
    return null;
  }
};

export const fetchLRCLIB = async (trackName, artistName, durationMs) => {
  const durationSec = Math.round(durationMs / 1000);
  const track = encodeURIComponent(trackName);
  const artist = encodeURIComponent(artistName);

  try {
    let res = await fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${track}&duration=${durationSec}`);
    if (!res.ok) {
      res = await fetch(`https://lrclib.net/api/search?q=${artist} ${track}`);
      const searchData = await res.json();
      if (searchData && searchData.length > 0) return searchData[0];
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("LRCLIB Fetch Error:", error);
    return null;
  }
};