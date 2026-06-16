/* --- src/utils/lyricsUtils.js --- */

export const parseLyrics = (raw, defaultArtist, colorPalette) => {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim());
  const result = [];
  
  const globalDefaultArtists = defaultArtist ? defaultArtist.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean).map(n => n.trim()) : [];
  let currentRules = [{ marker: '', artists: globalDefaultArtists }];
  let activeMarkerState = ''; 

  lines.forEach(line => {
    const cleanHtmlLine = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
    if (!cleanHtmlLine || cleanHtmlLine.startsWith('<!')) return; 

    const headerMatch = cleanHtmlLine.match(/^\[(.*?)\]$/);
    if (headerMatch) {
      const content = headerMatch[1];
      activeMarkerState = ''; 
      
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        let unmarkedStr = singersPart;
        const parsedTokens = [];
        const explicitArtists = [];

        const matches = [...singersPart.matchAll(/([_*~]+)(.+?)\1/g)];
        
        matches.forEach(m => {
            const marker = m[1];
            let name = m[2].trim();
            name = name.replace(/^(?:&|\band\b|\+|,)\s*/i, '').replace(/\s*(?:&|\band\b|\+|,)$/i, '').trim();
            
            parsedTokens.push({ marker, name });
            unmarkedStr = unmarkedStr.replace(m[0], ' '); 
            
            if (name.toLowerCase() !== 'both' && name.toLowerCase() !== 'all') {
                name.split(/\s*(?:&|\band\b|\+|,)\s*/i).filter(Boolean).forEach(n => explicitArtists.push(n.trim()));
            }
        });

        unmarkedStr = unmarkedStr.trim();
        const unmarkedTokens = unmarkedStr.split(/\s*(?:&|\band\b|\+|,)\s*/i).filter(Boolean);
        
        if (unmarkedTokens.length > 0) {
            parsedTokens.push({ marker: '', name: unmarkedTokens.join(', ') });
            unmarkedTokens.forEach(n => {
                if (n.toLowerCase() !== 'both' && n.toLowerCase() !== 'all') {
                    explicitArtists.push(n.trim());
                }
            });
        }

        const allMentioned = [...explicitArtists, ...unmarkedTokens].map(n => n.trim()).filter(n => n.toLowerCase() !== 'both' && n.toLowerCase() !== 'all');
        const contextArtists = allMentioned.length > 0 ? [...new Set(allMentioned)] : globalDefaultArtists;

        currentRules = parsedTokens.map(pt => {
            const lowerName = pt.name.toLowerCase();
            let ruleArtists = [];
            if (lowerName === 'both' || lowerName === 'all') ruleArtists = contextArtists;
            else ruleArtists = pt.name.split(/\s*(?:&|\band\b|\+|,)\s*/i).filter(Boolean).map(n => n.trim());
            return { marker: pt.marker, artists: ruleArtists };
        });

        currentRules.sort((a, b) => b.marker.length - a.marker.length);
      } else {
        // Unassigned headers like [Intro] with no explicit singer specified get empty artists 
        // to render as default white text without generating a watermark.
        currentRules = [{ marker: '', artists: [] }];
      }
      return; 
    }

    let lineSegments = [];
    const activeMarkers = currentRules.filter(r => r.marker !== '').map(r => r.marker);

    if (activeMarkers.length > 0) {
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexParts = activeMarkers.map(m => escapeRegExp(m));
        
        const regex = new RegExp(`(${regexParts.join('|')})`, 'g');
        const parts = cleanHtmlLine.split(regex);
        
        let currentText = '';

        parts.forEach(part => {
            if (activeMarkers.includes(part)) {
                if (activeMarkerState === part) {
                    if (currentText) lineSegments.push({ text: currentText, marker: activeMarkerState });
                    currentText = '';
                    activeMarkerState = ''; 
                } 
                else if (activeMarkerState === '') {
                    if (currentText) lineSegments.push({ text: currentText, marker: '' });
                    currentText = '';
                    activeMarkerState = part; 
                } 
                else {
                    currentText += part;
                }
            } else if (part) {
                currentText += part;
            }
        });

        if (currentText) {
            lineSegments.push({ text: currentText, marker: activeMarkerState });
        }
    } else {
        lineSegments.push({ text: cleanHtmlLine, marker: activeMarkerState });
    }

    const finalSegments = [];
    const lineArtistsSet = new Set();
    const punctRegex = /([.,!?;:"'()\[\]{}\-—–¿¡«»“”‘’]+)/;
    const isOnlyPunctuationOrSpace = /^[\s.,!?;:"'()\[\]{}\-—–~¿¡«»“”‘’]*$/;

    lineSegments.forEach(seg => {
        let artists = [];
        const rule = currentRules.find(r => r.marker === seg.marker);
        
        if (rule) artists = rule.artists;
        else artists = currentRules.find(r => r.marker === '')?.artists || globalDefaultArtists;

        if (!isOnlyPunctuationOrSpace.test(seg.text)) {
            artists.forEach(a => lineArtistsSet.add(a));
        }

        let segColor = '#ffffff';
        let segIsGradient = false;
        let segGradient = '';

        if (artists.length > 1) {
            segIsGradient = true;
            const c1 = colorPalette[artists[0]] || '#ffffff';
            const c2 = colorPalette[artists[1]] || '#ffffff';
            segGradient = `linear-gradient(90deg, ${c1}, ${c2})`;
        } else if (artists.length === 1) {
            segColor = colorPalette[artists[0]] || '#ffffff';
        }

        const cleanSegText = seg.text.replace(/[_*~]+/g, '');

        if (cleanSegText.length > 0) {
            const subParts = cleanSegText.split(punctRegex);
            subParts.forEach(part => {
                if (!part) return;
                if (punctRegex.test(part)) finalSegments.push({ text: part, color: '#fbbf24', isGradient: false, gradient: '' });
                else finalSegments.push({ text: part, color: segColor, isGradient: segIsGradient, gradient: segGradient });
            });
        }
    });

    if (lineArtistsSet.size === 0 && currentRules.length > 0) {
        const defaultRule = currentRules.find(r => r.marker === '');
        if (defaultRule) defaultRule.artists.forEach(a => lineArtistsSet.add(a));
    }

    const finalArtistsArray = Array.from(lineArtistsSet);
    const lineSinger = finalArtistsArray.join(', ');
    const displayText = finalSegments.map(s => s.text).join('');

    let finalColor = '#ffffff';
    let lineIsGradient = false;
    let lineGradientStyle = '';

    if (finalArtistsArray.length > 1) {
      lineIsGradient = true;
      lineGradientStyle = `linear-gradient(90deg, ${colorPalette[finalArtistsArray[0]] || '#ffffff'}, ${colorPalette[finalArtistsArray[1]] || '#ffffff'})`;
    } else if (finalArtistsArray.length === 1) {
      finalColor = colorPalette[finalArtistsArray[0]] || '#ffffff';
    }

    result.push({ 
      text: displayText,
      segments: finalSegments,
      singer: lineSinger, 
      color: finalColor, 
      isGradient: lineIsGradient, 
      gradient: lineGradientStyle 
    });
  });
  return result;
};

export const mergeSyncWithGenius = (lrcSyncData, rawLyrics, defaultArtist, colorPalette) => {
  if (!rawLyrics) return lrcSyncData;

  const parsedLines = parseLyrics(rawLyrics, defaultArtist, colorPalette);
  if (parsedLines.length === 0) return lrcSyncData;

  let currentLrcIdx = 0;

  const mergedData = parsedLines.map((geniusLine) => {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
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
    let pronunciation = null;

    if (bestMatchIdx !== -1) {
      start = lrcSyncData[bestMatchIdx].start;
      end = lrcSyncData[bestMatchIdx].end;
      if (highestScore > 90) {
        wordSync = lrcSyncData[bestMatchIdx].wordSync;
      }
      
      // Preserve existing pronunciation ONLY if the raw text matches exactly!
      if (geniusLine.text === lrcSyncData[bestMatchIdx].text) {
        pronunciation = lrcSyncData[bestMatchIdx].pronunciation;
      }

      currentLrcIdx = bestMatchIdx + 1; 
    }

    return {
      ...geniusLine,
      start,
      end,
      wordSync,
      pronunciation
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
      mergedData[i].end = nextTime ? Math.min(prevTime + 5, nextTime) : prevTime + 5;
    }
  }

  for (let i = 0; i < mergedData.length - 1; i++) {
    if (mergedData[i].end !== null && mergedData[i+1].start !== null && mergedData[i].end > mergedData[i+1].start) {
      mergedData[i].end = mergedData[i+1].start;
    }
  }

  for (let i = 0; i < mergedData.length; i++) {
    if (mergedData[i].start !== null && mergedData[i].end !== null) {
      if (mergedData[i].end - mergedData[i].start > 7) {
        mergedData[i].end = mergedData[i].start + 7;
      }
    }
  }

  return mergedData;
};

export const parseLRC = (lrcString, defaultArtist, colorPalette) => {
  const lines = lrcString.split('\n');
  const syncData = [];
  let plainTextLyrics = "";
  const punctRegex = /([.,!?;:"'()\[\]{}\-—–¿¡«»“”‘’]+)/;
  const defColor = colorPalette[defaultArtist] || '#ffffff';

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
            words.push({ start: (wMin * 60) + wSec, text: wText });
          }
        }
        if (words.length > 0) wordSync = words;
      }

      const segments = [];
      const subParts = text.split(punctRegex);
      subParts.forEach(part => {
          if (!part) return;
          if (punctRegex.test(part)) segments.push({ text: part, color: '#fbbf24', isGradient: false, gradient: '' });
          else segments.push({ text: part, color: defColor, isGradient: false, gradient: '' });
      });

      syncData.push({
        start: startTime,
        end: null, 
        text: text,
        segments: segments,
        singer: defaultArtist, 
        color: defColor,
        isGradient: false,
        gradient: '',
        pronunciation: null,
        wordSync: wordSync
      });
    }
  });

  for (let i = 0; i < syncData.length; i++) {
    const currentStart = syncData[i].start;
    const nextStart = (i < syncData.length - 1) ? syncData[i + 1].start : currentStart + 7;
    
    if (nextStart - currentStart > 7) {
        syncData[i].end = currentStart + 7;
    } else {
        syncData[i].end = nextStart;
    }
    
    if (syncData[i].wordSync) {
        const ws = syncData[i].wordSync;
        for (let j = 0; j < ws.length - 1; j++) ws[j].end = ws[j+1].start;
        ws[ws.length - 1].end = Math.min(ws[ws.length - 1].start + 1.5, syncData[i].end);
    }
  }

  return { syncData, plainTextLyrics: plainTextLyrics.trim() };
};