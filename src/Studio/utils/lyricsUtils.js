/* --- src/utils/lyricsUtils.js --- */

export const parseLyrics = (raw, defaultArtist, colorPalette) => {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim());
  const result = [];
  const globalDefaultArtists = defaultArtist ? defaultArtist.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean).map(n => n.trim()) : [];
  let currentRules = [{ marker: '', artists: globalDefaultArtists }];
  let hasExplicitHeader = false;
  let activeTags = [];
  let pendingHeader = null;

  const normalizeMarker = (m) => m.split('').sort().join('');

  lines.forEach(line => {
    let trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('<!')) return;

    const headerMatch = trimmedLine.match(/^\[(.*?)\]$/);
    if (headerMatch) {
      activeTags = [];
      hasExplicitHeader = true;
      pendingHeader = trimmedLine;
      const content = headerMatch[1];
      
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        const rawSingers = singersPart.split(/,|&|\band\b/i).map(s => s.trim()).filter(Boolean);
        let unmarkedStr = singersPart;
        const parsedTokens = [];
        const explicitArtists = [];
        const matches = [...singersPart.matchAll(/([_*~]+)([^_*~]+)([_*~]+)/g)];
        
        matches.forEach(m => {
            const startMarker = m[1];
            const endMarker = m[3];
            
            if (normalizeMarker(startMarker) === normalizeMarker(endMarker)) {
                const marker = normalizeMarker(startMarker);
                let name = m[2].trim();
                name = name.replace(/^(?:&|\band\b|\+|,)\s*/i, '').replace(/\s*(?:&|\band\b|\+|,)$/i, '').trim();
                
                parsedTokens.push({ marker, name });
                unmarkedStr = unmarkedStr.replace(m[0], ' ');
                
                if (name.toLowerCase() !== 'both' && name.toLowerCase() !== 'all') {
                    name.split(/\s*(?:&|\band\b|\+|,)\s*/i).filter(Boolean).forEach(n => explicitArtists.push(n.trim()));
                }
            }
        });

        unmarkedStr = unmarkedStr.trim();
        const unmarkedTokens = unmarkedStr.split(/\s*(?:&|\band\b|\+|,)\s*/i).filter(Boolean);
        
        if (unmarkedTokens.length > 0) {
            const validPlainTokens = unmarkedTokens.filter(token => {
                const tokenName = token.trim();
                if (tokenName.toLowerCase() === 'both' || tokenName.toLowerCase() === 'all') return true;
                const rIdx = rawSingers.findIndex(rs => rs.replace(/[_*~<>]/g, '').trim() === tokenName);
                return rIdx <= 3 || rawSingers.length <= 4;
            });
            if (validPlainTokens.length > 0) {
                parsedTokens.push({ marker: '', name: validPlainTokens.join(', ') });
            }
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
        currentRules = [{ marker: '', artists: globalDefaultArtists }];
      }
      return;
    }

    // --- LOGIC: Bubble formatting tags OUTSIDE of parentheses ---
    // This ensures that when formatting tags are placed inside parentheses (e.g. (**Oh**)),
    // the parentheses themselves inherit the formatting and are treated as a unified segment for adlib extraction.
    let previousLine = "";
    while (previousLine !== trimmedLine) {
        previousLine = trimmedLine;
        
        // 1. Bubble HTML tags outside: (<Artist>Oh</Artist>) -> <Artist>(Oh)</Artist>
        trimmedLine = trimmedLine.replace(/([(\uFF08])\s*(<[^>]+>)([\s\S]*?)(<\/[^>]+>)\s*([)\uFF09])/gi, (match, openParen, openTag, content, closeTag, closeParen) => {
            const tag1 = openTag.replace(/[<>]/g, '').trim();
            const tag2 = closeTag.replace(/[<\/>]/g, '').trim();
            if (tag1.toLowerCase() === tag2.toLowerCase()) {
                return `${openTag}${openParen}${content}${closeParen}${closeTag}`;
            }
            return match;
        });

        // 2. Bubble Markdown markers outside: (**Oh**) -> **(Oh)**
        trimmedLine = trimmedLine.replace(/([(\uFF08])\s*([_*~]+)(.*?)([_*~]+)\s*([)\uFF09])/g, (match, openParen, startMarker, content, endMarker, closeParen) => {
            if (normalizeMarker(startMarker) === normalizeMarker(endMarker)) {
                return `${startMarker}${openParen}${content}${closeParen}${endMarker}`;
            }
            return match;
        });
    }
    // ---------------------------------------------------------------

    const tagRegex = /<([^>]+)>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match;
    const initialSegments = [];

    while ((match = tagRegex.exec(trimmedLine)) !== null) {
      if (match.index > lastIndex) {
        initialSegments.push({ type: 'unparsed', text: trimmedLine.substring(lastIndex, match.index) });
      }
      initialSegments.push({ type: 'tagged', artist: match[1].trim(), text: match[2] });
      lastIndex = tagRegex.lastIndex;
    }

    if (lastIndex < trimmedLine.length) {
      initialSegments.push({ type: 'unparsed', text: trimmedLine.substring(lastIndex) });
    }

    let lineSegments = [];
    const regex = /([_*~]+)/g;
    let currentText = '';

    const applyMarkerChunk = (chunk, prevText, nextText) => {
        const prevChar = prevText.slice(-1);
        const nextChar = nextText.charAt(0);
        
        const isOpeningBoundary = !prevChar || /[\s(\[{"']/.test(prevChar);
        const isClosingBoundary = !nextChar || /[\s)\]}"']/.test(nextChar);
        const normChunk = normalizeMarker(chunk);

        if (isOpeningBoundary && !isClosingBoundary) {
            activeTags.push(normChunk);
        } else if (isClosingBoundary && !isOpeningBoundary) {
            const idx = activeTags.lastIndexOf(normChunk);
            if (idx > -1) activeTags.splice(idx, 1);
        } else {
            const idx = activeTags.lastIndexOf(normChunk);
            if (idx > -1) {
                activeTags.splice(idx, 1);
            } else {
                activeTags.push(normChunk);
            }
        }
    };

    const getActiveMarkerString = () => {
        const uniqueTags = [...new Set(activeTags)];
        return normalizeMarker(uniqueTags.join(''));
    };

    initialSegments.forEach(chunk => {
        if (chunk.type === 'tagged') {
            if (currentText) {
                lineSegments.push({ text: currentText, marker: getActiveMarkerString() });
                currentText = '';
            }
            lineSegments.push({ text: chunk.text, explicitArtists: chunk.artist, marker: getActiveMarkerString() });
        } else {
            const cleanUnparsed = chunk.text.replace(/<\/?[^>]+(>|$)/g, "");
            const parts = cleanUnparsed.split(regex);
            
            parts.forEach((part, index) => {
                if (index % 2 === 1) {
                    if (currentText) {
                        lineSegments.push({ text: currentText, marker: getActiveMarkerString() });
                        currentText = '';
                    }
                    const prevText = parts[index - 1] || '';
                    const nextText = parts[index + 1] || '';
                    applyMarkerChunk(part, prevText, nextText);
                } else if (part) {
                    currentText += part;
                }
            });
        }
    });

    if (currentText) {
        lineSegments.push({ text: currentText, marker: getActiveMarkerString() });
        currentText = '';
    }

    let rawSegments = [];
    const lineArtistsSet = new Set();
    const isOnlyPunctuationOrSpace = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u;

    lineSegments.forEach(seg => {
        let artists = [];
        if (seg.explicitArtists) {
            artists = seg.explicitArtists.split(/\s*(?:&|\band\b|\+|,)\s*/i).filter(Boolean).map(n => n.trim());
        } else {
            const rule = currentRules.find(r => r.marker === seg.marker);
            if (rule) {
                artists = rule.artists;
            } else if (seg.marker === '') {
                artists = currentRules.find(r => r.marker === '')?.artists || globalDefaultArtists;
            } else {
                artists = [];
            }
        }

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
            rawSegments.push({
                text: cleanSegText,
                color: segColor,
                isGradient: segIsGradient,
                gradient: segGradient,
                artists: artists
            });
        }
    });

    // --- ADLIB FORCED REORDERING (The Absolute Source of Truth) ---
    const mainSegments = [];
    const adlibSegments = [];

    rawSegments.forEach(seg => {
      const parts = seg.text.split(/([(\uFF08][^)\uFF09]+[)\uFF09])/g);

      parts.forEach(part => {
        if (!part) return;
        const isAdlib = /^[(\uFF08][^)\uFF09]+[)\uFF09]$/.test(part);
        const subSeg = { ...seg, text: part };
        if (isAdlib) {
          adlibSegments.push(subSeg);
        } else {
          mainSegments.push(subSeg);
        }
      });
    });

    // Smart space collapsing across segment boundaries to prevent double spaces 
    let sanitizedMainSegments = [];
    let lastEndedWithSpace = false;

    for (let i = 0; i < mainSegments.length; i++) {
        let t = mainSegments[i].text;
        
        if (sanitizedMainSegments.length === 0) {
            t = t.trimStart();
        } else if (lastEndedWithSpace && t.startsWith(' ')) {
            t = t.trimStart();
        }
        
        // Clean spaces before punctuation
        if (sanitizedMainSegments.length > 0 && /^[.,!?;:\])}]/.test(t)) {
            sanitizedMainSegments[sanitizedMainSegments.length - 1].text = sanitizedMainSegments[sanitizedMainSegments.length - 1].text.trimEnd();
        }

        lastEndedWithSpace = t.endsWith(' ') || t.endsWith('\u00A0');
        if (t.length > 0) {
            sanitizedMainSegments.push({ ...mainSegments[i], text: t });
        }
    }

    let sanitizedAdlibSegments = adlibSegments.map((seg, idx) => {
      let text = seg.text.trim();
      if (idx < adlibSegments.length - 1) {
        text = text + ' ';
      }
      return { ...seg, text };
    });

    // Ensure a single clean space connects the main text and the reordered ad-libs
    if (sanitizedMainSegments.length > 0 && sanitizedAdlibSegments.length > 0) {
      const lastMainIdx = sanitizedMainSegments.length - 1;
      sanitizedMainSegments[lastMainIdx].text = sanitizedMainSegments[lastMainIdx].text.trimEnd() + ' ';
    }

    const finalSegments = [...sanitizedMainSegments, ...sanitizedAdlibSegments].filter(s => s.text.length > 0);

    const finalArtistsArray = Array.from(lineArtistsSet);
    const lineSinger = finalArtistsArray.length > 0 ? finalArtistsArray.join(', ') : '';
    
    let finalColor = '#ffffff';
    let lineIsGradient = false;
    let lineGradientStyle = '';

    if (finalArtistsArray.length > 1) {
      lineIsGradient = true;
      const c1 = colorPalette[finalArtistsArray[0]] || '#ffffff';
      const c2 = colorPalette[finalArtistsArray[1]] || '#ffffff';
      lineGradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
    } else if (finalArtistsArray.length === 1) {
      finalColor = colorPalette[finalArtistsArray[0]] || '#ffffff';
    }

    result.push({
        text: finalSegments.map(s => s.text).join(''),
        segments: finalSegments,
        singer: lineSinger,
        color: finalColor,
        isGradient: lineIsGradient,
        gradient: lineGradientStyle,
        sectionHeader: pendingHeader
      });

      pendingHeader = null;
  });

  return result;
};

export const mergeSyncWithGenius = (lrcSyncData, rawLyrics, defaultArtist, colorPalette) => {
  if (!rawLyrics) return lrcSyncData;

  const parsedLines = parseLyrics(rawLyrics, defaultArtist, colorPalette);
  if (parsedLines.length === 0) return lrcSyncData;

  const normalize = (str) => {
    if (!str) return '';
    return str
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]/gu, '');
  };

  const m = parsedLines.length;
  const n = lrcSyncData.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    const cleanNew = normalize(parsedLines[i - 1].text);
    for (let j = 1; j <= n; j++) {
      const cleanOld = normalize(lrcSyncData[j - 1].text);
      if (cleanNew === cleanOld && cleanNew !== '') {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const alignment = [];

  while (i > 0 && j > 0) {
    const cleanNew = normalize(parsedLines[i - 1].text);
    const cleanOld = normalize(lrcSyncData[j - 1].text);
    
    if (cleanNew === cleanOld && cleanNew !== '') {
      alignment.push({ newIndex: i - 1, oldIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  alignment.reverse();

  const matchMap = {};
  alignment.forEach(match => {
    matchMap[match.newIndex] = match.oldIndex;
  });

  const mergedData = parsedLines.map((newLine, idx) => {
    const oldIdx = matchMap[idx];
    
    if (oldIdx !== undefined) {
      const matchedNode = lrcSyncData[oldIdx];
      
      let isSplit = false;
      let newAdlibs = undefined;
      
      if (matchedNode.isSplit && matchedNode.adlibs) {
        if (newLine.text === matchedNode.text) {
          isSplit = matchedNode.isSplit;
          newAdlibs = matchedNode.adlibs;
        }
      }

      return {
        ...newLine,
        start: matchedNode.start !== undefined ? matchedNode.start : null,
        end: matchedNode.end !== undefined ? matchedNode.end : null,
        wordSync: matchedNode.wordSync || null,
        pronunciation: matchedNode.pronunciation !== undefined ? matchedNode.pronunciation : null,
        translation: matchedNode.translation !== undefined ? matchedNode.translation : '',
        spacingText: matchedNode.spacingText || '',
        lang: matchedNode.lang || 'auto',
        isSplit: isSplit,
        adlibs: newAdlibs
      };
    } else {
      return {
        ...newLine,
        start: null,
        end: null,
        wordSync: null,
        pronunciation: null,
        translation: '',
        spacingText: '',
        lang: 'auto',
        isSplit: false,
        adlibs: undefined
      };
    }
  });

  return mergedData;
};

export const parseLRC = (lrcString, defaultArtist, colorPalette) => {
  const lines = lrcString.split('\n');
  const syncData = [];
  let plainTextLyrics = "";
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

      const segments = [{ text: text, color: defColor, isGradient: false, gradient: '', artists: [defaultArtist] }];

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