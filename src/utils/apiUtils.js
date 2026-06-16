/* --- src/utils/apiUtils.js --- */

export const fetchSingerImage = async (band, singer) => {
  if (!singer || singer === band || singer.includes('&') || singer.includes(',')) return null;
  
  try {
    const adbRes = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(singer)}`);
    const adbData = await adbRes.json();
    if (adbData?.artists && adbData.artists[0].strArtistThumb) {
      return adbData.artists[0].strArtistThumb;
    }
  } catch (e) {}

  try {
    const deezerRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(singer)}`);
    const deezerData = await deezerRes.json();
    if (deezerData?.data?.length > 0) {
      const topMatch = deezerData.data.find(a => a.name.toLowerCase() === singer.toLowerCase()) || deezerData.data[0];
      if (topMatch.name.toLowerCase().includes(singer.toLowerCase())) {
         if (topMatch.picture_xl) return topMatch.picture_xl;
      }
    }
  } catch (e) {}

  try {
    const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(singer)}&gsrlimit=5&prop=pageimages|pageterms&pithumbsize=1000`);
    const wikiData = await wikiRes.json();
    
    if (wikiData?.query?.pages) {
      const pages = Object.values(wikiData.query.pages).sort((a, b) => a.index - b.index);
      const musicKeywords = ['singer', 'musician', 'band', 'rapper', 'dj', 'songwriter', 'composer', 'group', 'pop', 'vocalist', 'artist'];
      
      for (const page of pages) {
        const desc = page.terms?.description?.[0]?.toLowerCase() || '';
        const title = page.title.toLowerCase();
        if (title.includes('disambiguation') || title.includes('list of')) continue;

        const isMusician = musicKeywords.some(keyword => desc.includes(keyword) || title.includes(`(${keyword})`));
        if (isMusician && page.thumbnail?.source && !page.thumbnail.source.toLowerCase().endsWith('.svg')) {
          return page.thumbnail.source;
        }
      }
    }
  } catch (e) {}
  
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