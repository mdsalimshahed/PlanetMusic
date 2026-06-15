/* --- src/utils/songHelpers.js --- */

// Helper to convert HSL to HEX for the native HTML Color Picker
const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const getDistinctArtistColors = (rawLyrics, defaultArtist, featuredArtists = []) => {
  const artistColors = {};
  const discoveredNames = new Set();
  
  // FIXED: Split the default track artist string to identify individuals (e.g. "Artist A & Artist B")
  if (defaultArtist) {
    defaultArtist.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean).forEach(n => discoveredNames.add(n.trim()));
  }
  
  // Extract featured artists from the track title
  if (featuredArtists && featuredArtists.length > 0) {
    featuredArtists.forEach(f => {
      f.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean).forEach(n => discoveredNames.add(n.trim()));
    });
  }

  // Extract tagged artists from the lyrics headers
  if (rawLyrics) {
    const headerLines = rawLyrics.split('\n').filter(l => l.startsWith('[') && l.endsWith(']'));
    headerLines.forEach(line => {
      const content = line.slice(1, -1);
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        const nakedNames = singersPart.replace(/<\/?[^>]+(>|$)/g, "").replace(/_/g, "");
        const splitNames = nakedNames.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean);
        splitNames.forEach(name => discoveredNames.add(name.trim()));
      }
    });
  }

  const artistArray = Array.from(discoveredNames);
  artistArray.forEach((artist, index) => {
    const hue = (index * (360 / artistArray.length) + 45) % 360;
    artistColors[artist] = hslToHex(hue, 90, 75);
  });

  return artistColors;
};

export const parseLyrics = (raw, defaultArtist, colorPalette) => {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim());
  const result = [];
  
  let currentDefaultSinger = defaultArtist;
  let currentUnderscoreSinger = null;
  let tagMap = {};
  let activeHtmlTag = null; 

  lines.forEach(line => {
    if (!line) return; 
    
    const headerMatch = line.match(/^\[(.*?)\]$/);
    if (headerMatch) {
      const content = headerMatch[1];
      tagMap = {}; 
      activeHtmlTag = null; 
      currentUnderscoreSinger = null;
      
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        
        // Detect underscore singer (e.g. "_& Eminem_")
        const underscoreMatch = singersPart.match(/_([^_]+)_/);
        if (underscoreMatch) {
            currentUnderscoreSinger = underscoreMatch[1].replace(/&/g, '').replace(/\band\b/gi, '').replace(/,/g, '').trim();
        }

        const cleanSingersPart = singersPart.replace(/_([^_]+)_/g, '$1').replace(/&/g, ',').replace(/\band\b/gi, ',');
        const singerEntries = cleanSingersPart.split(',').map(s => s.trim()).filter(Boolean);
        
        if (singerEntries.length > 0) {
           currentDefaultSinger = singerEntries[0].replace(/<\/?[^>]+(>|$)/g, "").trim() || "";
        } else {
           currentDefaultSinger = "";
        }

        if (!currentUnderscoreSinger && singerEntries.length > 1) {
           currentUnderscoreSinger = singerEntries[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
        }

        singerEntries.forEach((entry, idx) => {
           const tagRegex = /^((?:<[a-zA-Z0-9]+>)*)(.*?)((?:<\/[a-zA-Z0-9]+>)*)$/;
           const match = entry.match(tagRegex);
           if (match) {
             const openingTags = match[1]; 
             const name = match[2].replace(/<\/?[^>]+(>|$)/g, "").trim(); 
             if (openingTags) {
               tagMap[openingTags] = name;
             }
           }
        });
      } else {
        currentDefaultSinger = ""; 
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

    let cleanText = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
    if (!cleanText) return;

    if (cleanText.includes('_')) {
        if (currentUnderscoreSinger) {
            const isFullyUnderscore = cleanText.startsWith('_') && cleanText.endsWith('_');
            if (isFullyUnderscore) {
                lineSinger = currentUnderscoreSinger;
            } else {
                lineSinger = `${currentDefaultSinger}, ${currentUnderscoreSinger}`;
            }
        }
        cleanText = cleanText.replace(/_/g, "");
    }

    let finalColor = '#ffffff';
    let isGradient = false;
    let gradientStyle = '';

    const subArtists = lineSinger.split(/\s*(?:,|&|\band\b)\s*/i).map(n => n.trim()).filter(Boolean);

    if (subArtists.length > 1) {
      isGradient = true;
      const c1 = colorPalette[subArtists[0]] || '#ffffff';
      const c2 = colorPalette[subArtists[1]] || '#ffffff';
      gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
    } else {
      finalColor = colorPalette[lineSinger] || '#ffffff';
    }

    result.push({ text: cleanText, singer: lineSinger, color: finalColor, isGradient, gradient: gradientStyle });
  });
  return result;
};

export const mergeSyncWithGenius = (lrcSyncData, rawLyrics, defaultArtist, colorPalette) => {
  if (!rawLyrics) return lrcSyncData;

  const parsedLines = parseLyrics(rawLyrics, defaultArtist, colorPalette);
  if (parsedLines.length === 0) return lrcSyncData;

  let currentLrcIdx = 0;

  const mergedData = parsedLines.map((geniusLine) => {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanGenius = normalize(geniusLine.text);

    if (!cleanGenius) {
      return { ...geniusLine, start: null, end: null, wordSync: null, pronunciation: null };
    }

    let bestMatchIdx = -1;
    let highestScore = 0;

    for (let i = currentLrcIdx; i < Math.min(currentLrcIdx + 15, lrcSyncData.length); i++) {
      const cleanLrc = normalize(lrcSyncData[i].text);
      if (!cleanLrc) continue;

      let score = 0;
      if (cleanGenius === cleanLrc) {
        score = 100;
      } else if (cleanGenius.includes(cleanLrc) || cleanLrc.includes(cleanGenius)) {
        score = 60 + (Math.min(cleanGenius.length, cleanLrc.length) / Math.max(cleanGenius.length, cleanLrc.length)) * 40;
      }

      if (score > highestScore && score > 50) {
        highestScore = score;
        bestMatchIdx = i;
      }
    }

    let start = null;
    let end = null;
    let wordSync = null;

    if (bestMatchIdx !== -1) {
      start = lrcSyncData[bestMatchIdx].start;
      end = lrcSyncData[bestMatchIdx].end;
      if (highestScore > 90) {
        wordSync = lrcSyncData[bestMatchIdx].wordSync;
      }
      currentLrcIdx = bestMatchIdx + 1; 
    }

    return {
      ...geniusLine,
      start,
      end,
      wordSync,
      pronunciation: null
    };
  });

  for (let i = 0; i < mergedData.length; i++) {
    if (mergedData[i].start === null && mergedData[i].text.trim() !== '') {
      let prevTime = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (mergedData[j].end !== null) { prevTime = mergedData[j].end; break; }
        if (mergedData[j].start !== null) { prevTime = mergedData[j].start + 2; break; }
      }
      
      let nextTime = null;
      for (let j = i + 1; j < mergedData.length; j++) {
        if (mergedData[j].start !== null) { nextTime = mergedData[j].start; break; }
      }

      mergedData[i].start = prevTime;
      mergedData[i].end = nextTime ? Math.min(prevTime + 3, nextTime) : prevTime + 3;
    }
  }

  for (let i = 0; i < mergedData.length - 1; i++) {
    if (mergedData[i].end !== null && mergedData[i+1].start !== null && mergedData[i].end > mergedData[i+1].start) {
      mergedData[i].end = mergedData[i+1].start;
    }
  }

  return mergedData;
};

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