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

// --- GENIUS AUTO-MERGE SYNC ENGINE ---
export const mergeSyncWithGenius = (lrcSyncData, rawGeniusLyrics, defaultArtist, colorPalette) => {
  if (!rawGeniusLyrics || !rawGeniusLyrics.includes('[')) return lrcSyncData;

  const geniusParsed = parseLyrics(rawGeniusLyrics, defaultArtist, colorPalette);
  if (geniusParsed.length === 0) return lrcSyncData;

  let currentGeniusIdx = 0;
  
  return lrcSyncData.map(lrcLine => {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLrc = normalize(lrcLine.text);
    
    if (!cleanLrc) return lrcLine; // Skip empty instrumental lines

    let bestMatchIdx = currentGeniusIdx;
    let found = false;

    // Scan ahead up to 15 lines to find a matching lyric line 
    for (let i = currentGeniusIdx; i < Math.min(currentGeniusIdx + 15, geniusParsed.length); i++) {
      const cleanGenius = normalize(geniusParsed[i].text);
      if (cleanGenius && (cleanLrc.includes(cleanGenius) || cleanGenius.includes(cleanLrc) || cleanLrc === cleanGenius)) {
        bestMatchIdx = i;
        found = true;
        break;
      }
    }

    if (found) {
      currentGeniusIdx = bestMatchIdx + 1; // Move pointer forward so we don't match the same line twice
    } else {
      // If we didn't find a match, just assume the singer of the current active block
      bestMatchIdx = Math.min(currentGeniusIdx, geniusParsed.length - 1);
    }

    const assignedSinger = geniusParsed[bestMatchIdx].singer;
    const assignedColor = geniusParsed[bestMatchIdx].color;
    const assignedIsGradient = geniusParsed[bestMatchIdx].isGradient;
    const assignedGradient = geniusParsed[bestMatchIdx].gradient;

    return {
      ...lrcLine,
      singer: assignedSinger,
      color: assignedColor,
      isGradient: assignedIsGradient,
      gradient: assignedGradient
    };
  });
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
    const junkParams = [
      'si', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
      'fbclid', 'igshid', '_nc_ht', '_nc_cat', 'oh', 'oe', 'usqp', 'ved',
      'w', 'h', 'width', 'height', 'size', 'resize', 'crop', 'quality', 'fit', 'format', 'auto', 'blur', 'dpr', 's'
    ];
    junkParams.forEach(param => url.searchParams.delete(param));
    
    let finalUrl = url.toString();
    if (finalUrl.includes('upload.wikimedia.org') && finalUrl.includes('/thumb/')) {
      finalUrl = finalUrl.replace(/\/thumb\//, '/');
      finalUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/'));
    }

    return finalUrl;
  } catch (e) {
    return urlStr;
  }
};

export const parseTrackName = (trackName) => {
  if (!trackName) return { mainTitle: '', extras: [], featuredArtists: [] };
  
  const extras = [];
  const featuredArtists = [];
  
  let mainTitle = trackName.replace(/[\(\[]([^()\[\]]+)[\)\]]/g, (match, content) => {
    const lowerContent = content.toLowerCase().trim();
    
    if (
      lowerContent.includes('soundtrack') || 
      lowerContent.includes('motion picture') || 
      lowerContent.startsWith('from ') ||
      lowerContent === 'ost' ||
      lowerContent.includes('original score')
    ) {
      return ''; 
    }
    
    const featMatch = content.match(/^(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
    if (featMatch) {
      featuredArtists.push(featMatch[1].trim());
      return ''; 
    }
    
    extras.push(content.trim());
    return ''; 
  });
  
  mainTitle = mainTitle.replace(/\s+/g, ' ').trim();
  
  return { mainTitle, extras, featuredArtists };
};

// --- DATABASE INTEGRATIONS ---

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

export const parseLRC = (lrcString, defaultArtist, colorPalette) => {
  const lines = lrcString.split('\n');
  const syncData = [];
  let plainTextLyrics = "";

  lines.forEach(line => {
    const timeMatch = line.match(/\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseFloat(timeMatch[2]);
      const rawText = timeMatch[3];
      
      const text = rawText.replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '').trim();
      if (!text) return;

      const startTime = (minutes * 60) + seconds;
      plainTextLyrics += text + "\n";
      
      let wordSync = null;
      const wordRegex = /<(\d{2}):(\d{2}\.\d{2,3})>([^<]*)/g;
      let wMatch;
      const words = [];
      
      if (/<(\d{2}):(\d{2}\.\d{2,3})>/.test(rawText)) {
        while ((wMatch = wordRegex.exec(rawText)) !== null) {
          const wMin = parseInt(wMatch[1], 10);
          const wSec = parseFloat(wMatch[2]);
          const wText = wMatch[3]; 
          
          if (wText) {
            words.push({
              start: (wMin * 60) + wSec,
              text: wText
            });
          }
        }
        if (words.length > 0) wordSync = words;
      }

      syncData.push({
        start: startTime,
        end: null, 
        text: text,
        singer: defaultArtist, 
        color: colorPalette[defaultArtist] || '#ffffff',
        isGradient: false,
        gradient: '',
        pronunciation: null,
        wordSync: wordSync
      });
    }
  });

  for (let i = 0; i < syncData.length; i++) {
    if (i < syncData.length - 1) {
      syncData[i].end = syncData[i + 1].start;
    } else {
      syncData[i].end = syncData[i].start + 5; 
    }
    
    if (syncData[i].wordSync) {
        const ws = syncData[i].wordSync;
        for (let j = 0; j < ws.length - 1; j++) ws[j].end = ws[j+1].start;
        ws[ws.length - 1].end = syncData[i].end;
    }
  }

  return { syncData, plainTextLyrics: plainTextLyrics.trim() };
};