/* --- src/utils/songHelpers.js --- */

export const getDistinctArtistColors = (rawLyrics, defaultArtist) => {
  const artistColors = {};
  if (!rawLyrics) {
    artistColors[defaultArtist] = `hsl(0, 85%, 70%)`;
    return artistColors;
  }

  const headerLines = rawLyrics.split('\n').filter(l => l.startsWith('[') && l.endsWith(']'));
  const discoveredNames = new Set([defaultArtist]);

  headerLines.forEach(line => {
    const content = line.slice(1, -1);
    if (content.includes(':')) {
      const singersPart = content.split(':').slice(1).join(':').trim();
      const nakedNames = singersPart.replace(/<\/?[^>]+(>|$)/g, "");
      const splitNames = nakedNames.split(/,|\s&\s|\sand\s/).map(n => n.trim()).filter(Boolean);
      splitNames.forEach(name => discoveredNames.add(name));
    }
  });

  const artistArray = Array.from(discoveredNames);
  artistArray.forEach((artist, index) => {
    const hue = (index * (360 / artistArray.length) + 45) % 360;
    artistColors[artist] = `hsl(${hue}, 90%, 75%)`;
  });

  return artistColors;
};

export const parseLyrics = (raw, defaultArtist, colorPalette) => {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim());
  const result = [];
  
  let currentDefaultSinger = defaultArtist;
  let tagMap = {};
  let activeHtmlTag = null; 

  lines.forEach(line => {
    if (!line) return; 
    
    const headerMatch = line.match(/^\[(.*?)\]$/);
    if (headerMatch) {
      const content = headerMatch[1];
      tagMap = {}; 
      activeHtmlTag = null; 
      
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        const singerEntries = singersPart.split(',').map(s => s.trim());
        
        singerEntries.forEach((entry, idx) => {
           const tagRegex = /^((?:<[a-zA-Z0-9]+>)*)(.*?)((?:<\/[a-zA-Z0-9]+>)*)$/;
           const match = entry.match(tagRegex);
           if (match) {
             const openingTags = match[1]; 
             const name = match[2].replace(/<\/?[^>]+(>|$)/g, "").trim(); 
             
             if (openingTags) {
               tagMap[openingTags] = name;
             } else if (idx === 0) {
               currentDefaultSinger = name || defaultArtist;
             }
           }
        });
      } else {
        currentDefaultSinger = defaultArtist; 
      }
      return; 
    }

    let lineSinger = currentDefaultSinger;
    if (activeHtmlTag && tagMap[activeHtmlTag]) {
      lineSinger = tagMap[activeHtmlTag];
    }

    const openTagMatch = line.match(/((?:<[a-zA-Z0-9]+>)+)/);
    if (openTagMatch) {
      const tags = openTagMatch[1];
      if (tagMap[tags]) {
        lineSinger = tagMap[tags]; 
        activeHtmlTag = tags; 
      }
    }

    if (activeHtmlTag && line.includes('</')) {
      activeHtmlTag = null; 
    }

    const cleanText = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
    if (!cleanText) return;

    let finalColor = '#ffffff';
    let isGradient = false;
    let gradientStyle = '';

    const subArtists = lineSinger.split(/,|\s&\s|\sand\s/).map(n => n.trim()).filter(Boolean);

    if (subArtists.length > 1) {
      isGradient = true;
      const c1 = colorPalette[subArtists[0]] || 'hsl(0, 100%, 100%)';
      const c2 = colorPalette[subArtists[1]] || 'hsl(180, 100%, 100%)';
      gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
    } else {
      finalColor = colorPalette[lineSinger] || colorPalette[defaultArtist] || '#ffffff';
    }

    result.push({ text: cleanText, singer: lineSinger, color: finalColor, isGradient, gradient: gradientStyle });
  });
  return result;
};

export const fetchSingerImage = async (band, singer) => {
  if (!singer || singer === band || singer.includes('&') || singer.includes(',')) return null;
  try {
    const deezerRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(singer)}`);
    const deezerData = await deezerRes.json();
    if (deezerData?.data?.length > 0 && deezerData.data[0].picture_xl) return deezerData.data[0].picture_xl;
  } catch (e) {}

  try {
    const adbRes = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(singer)}`);
    const adbData = await adbRes.json();
    if (adbData?.artists && adbData.artists[0].strArtistThumb) return adbData.artists[0].strArtistThumb;
  } catch (e) {}
  
  return null;
};

export const formatTime = (millis) => {
  if (!millis) return "N/A";
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export const formatPreciseTime = (sec) => {
  if (isNaN(sec) || sec === null) return "--:--.---";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms.toString().padStart(3, '0')}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const cleanUrl = (urlStr) => {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    const trackers = ['host', 'deferredFl', 'universal_link', 'si', 'context', 'nd', 'ls', 'app', 'at', 'ct', 'l', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'feature', 'fbclid', 'igshid'];
    trackers.forEach(param => url.searchParams.delete(param));
    return url.toString();
  } catch (e) {
    return urlStr;
  }
};

export const cleanImageUrl = (urlStr) => {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    
    // Aggressively strip out sizing, cropping, resizing, quality, and tracking metadata from image CDNs
    const junkParams = [
      'si', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
      'fbclid', 'igshid', '_nc_ht', '_nc_cat', 'oh', 'oe', 'usqp', 'ved',
      'w', 'h', 'width', 'height', 'size', 'resize', 'crop', 'quality', 'fit', 'format', 'auto', 'blur', 'dpr', 's'
    ];
    junkParams.forEach(param => url.searchParams.delete(param));
    
    let finalUrl = url.toString();
    
    // Automatically bypass Wikipedia/Wikimedia thumbnail compressions and extract the master file
    if (finalUrl.includes('upload.wikimedia.org') && finalUrl.includes('/thumb/')) {
      finalUrl = finalUrl.replace(/\/thumb\//, '/');
      finalUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/'));
    }

    return finalUrl;
  } catch (e) {
    return urlStr;
  }
};