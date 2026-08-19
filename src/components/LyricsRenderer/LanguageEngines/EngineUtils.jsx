/* --- src/components/LyricsRenderer/LanguageEngines/EngineUtils.jsx --- */
import React from 'react';
import { getGraphemes, normalizeTrans } from '../textUtils.js';

// --- COLOR INTERPOLATION HELPERS ---
export const hexToRgb = (hex) => {
  let h = String(hex).replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const int = parseInt(h, 16);
  if (isNaN(int)) return [(255), (255), (255)];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

export const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

export const interpolateColor = (colors, ratio) => {
  if (!colors || colors.length === 0) return '#ffffff';
  if (colors.length === 1) return colors[0];
  const maxIdx = colors.length - 1;
  const scaledRatio = ratio * maxIdx;
  const leftIdx = Math.floor(scaledRatio);
  const rightIdx = Math.min(Math.ceil(scaledRatio), maxIdx);
  if (leftIdx === rightIdx) return colors[leftIdx];
  const fraction = scaledRatio - leftIdx;
  const c1 = hexToRgb(colors[leftIdx]);
  const c2 = hexToRgb(colors[rightIdx]);
  const r = c1[0] + (c2[0] - c1[0]) * fraction;
  const g = c1[1] + (c2[1] - c1[1]) * fraction;
  const b = c1[2] + (c2[2] - c1[2]) * fraction;
  return rgbToHex(r, g, b);
};

export const basePronStyle = {
  fontSize: 'var(--dyn-translit-font-size, 0.55em)',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'center',
  marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  WebkitTextFillColor: 'var(--dyn-translit-color, #ffffff)',
  color: 'var(--dyn-translit-color, #ffffff)',
  opacity: 'var(--dyn-translit-opacity, 0.8)',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
  fontFamily: 'var(--font-family)'
};

export const getDisplayTranslation = (originalText, translation) => {
  const normalizeForMatch = (str) => String(str || '').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '').trim();
  const cleanMainText = normalizeForMatch(originalText);
  const cleanTransText = normalizeForMatch(translation);
  return (cleanMainText && cleanMainText === cleanTransText) ? '' : (translation || '');
};

// Character rendering strictly checks for script types
export const renderColoredChar = (c, globalIdx, isFocused) => {
  const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(c.char);
  const isArabicChar = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(c.char);
  const isBengaliChar = /[\u0980-\u09FF]/.test(c.char);
  const selectedFont = isArabicChar ? 'var(--arabic-font-family)' : (isBengaliChar ? 'var(--bengali-font-family)' : 'var(--font-family)');

  let style = { 
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    fontFamily: selectedFont
  };

  if (isPunct && c.char.trim() !== '') {
    style = {
      ...style,
      color: '#fbbf24',
      WebkitTextFillColor: '#fbbf24',
      textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
    };
  } else {
    const activeColor = c.computedColor || '#ffffff';
    style.color = activeColor;
    style.WebkitTextFillColor = activeColor;
    style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.45)';
  }

  return <span key={globalIdx} style={style}>{c.char}</span>;
};

export const renderFormattedTranslation = (text, isFocused = false) => {
  if (!text) return null;
  const parts = text.split(/([\p{P}\p{S}\s]+)/u);
  return parts.map((part, pIdx) => {
    if (!part) return null;
    const isPunct = /^[\p{P}\p{S}\s]+$/u.test(part);
    const isArabicPart = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(part);
    const isBengaliPart = /[\u0980-\u09FF]/.test(part);
    const font = isArabicPart ? 'var(--arabic-font-family)' : (isBengaliPart ? 'var(--bengali-font-family)' : 'var(--font-family)');

    if (isPunct && part.trim() !== '') {
      return (
        <span key={pIdx} style={{ color: '#fbbf24', textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)', WebkitTextFillColor: '#fbbf24', fontFamily: font }}>
          {part}
        </span>
      );
    }
    return <span key={pIdx} style={{ fontFamily: font }}>{part}</span>;
  });
};

export const groupWords = (elements, charData, isFocused, hasSpacingText = false) => {
  const words = [];
  let currentWord = [];
  let hyphenCount = 0;

  const flushWord = (keySuffix) => {
    if (currentWord.length > 0) {
      const shouldWrap = hyphenCount > 3;
      words.push(
        <span
          key={`w-${keySuffix}`}
          style={
            shouldWrap
              ? {
                  whiteSpace: 'normal',
                  display: 'inline',
                  wordBreak: 'normal',
                  overflowWrap: 'normal'
                }
              : {
                  whiteSpace: 'pre-line', 
                  wordBreak: 'normal', 
                  overflowWrap: 'normal',
                  display: 'inline'
                }
          }
        >
          {currentWord}
        </span>
      );
      currentWord = [];
      hyphenCount = 0;
    }
  };

  for (let i = 0; i < elements.length; i++) {
    if (!elements[i]) {
      flushWord(i);
      words.push(elements[i]);
      continue;
    }
    const char = charData[i] ? charData[i].char : '';
    const isSpace = /\s/.test(char);
    const shouldBreak = hasSpacingText ? isSpace : isSpace;

    if (shouldBreak) {
      flushWord(i);
      words.push(elements[i]); 
    } else {
      if (char === '-') {
        hyphenCount++;
      }
      currentWord.push(elements[i]);
    }
  }

  flushWord('end');
  return words;
};

export const extractCharsAndSegments = (lineObj, savedNode) => {
  const activeSpacingText = savedNode?.spacingText || lineObj?.spacingText || '';
  const useSpacingText = Boolean(activeSpacingText && activeSpacingText.trim());
  const activeDisplayText = useSpacingText ? activeSpacingText : (lineObj.text || '');

  let chars = [];
  let gIdx = 0;
  let originalCpIdx = 0;

  const segments = lineObj.segments || [{ text: lineObj.text }];

  if (useSpacingText) {
    const spacedGraphemes = getGraphemes(activeDisplayText);
    const origGraphemes = getGraphemes(lineObj.text || '');
    
    let origPointer = 0;
    let segmentPointer = 0;
    let charPointerInSegment = 0;
    let currentCpStart = 0;

    spacedGraphemes.forEach(char => {
      let currentSeg = segments[segmentPointer] || segments[segments.length - 1] || {};
      let isOrigChar = false;

      if (origPointer < origGraphemes.length && char === origGraphemes[origPointer]) {
        isOrigChar = true;
      } else if (/\s/.test(char) && origPointer < origGraphemes.length && !/\s/.test(origGraphemes[origPointer])) {
        isOrigChar = false;
      } else {
        isOrigChar = !/\s/.test(char);
      }

      const cpLen = Array.from(char).length;
      chars.push({
          char,
          seg: currentSeg,
          globalIndex: gIdx++,
          cpStart: currentCpStart,
          cpEnd: currentCpStart + cpLen
        });

      if (isOrigChar) {
        const origLen = Array.from(origGraphemes[origPointer] || char).length;
        currentCpStart += origLen;
        origPointer++;
        
        charPointerInSegment += getGraphemes(char).length;
        if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text || '').length) {
          segmentPointer++;
          charPointerInSegment = 0;
        }
      }
    });
  } else {
    segments.forEach(seg => {
      const segChars = getGraphemes(seg.text || '');
      segChars.forEach(char => {
        const cpLen = Array.from(char).length;
        chars.push({
            char,
            seg,
            globalIndex: gIdx++,
            cpStart: originalCpIdx,
            cpEnd: originalCpIdx + cpLen
          });
        originalCpIdx += cpLen;
      });
    });
  }

  // Force hasSpacingText = true if spaces exist in chars
  const hasSpacesInText = chars.some(c => /\s/.test(c.char));

  return { chars, hasSpacingText: useSpacingText || hasSpacesInText };
};

export const buildChunkElements = (alignedChunks, masterPalette, isFocused, hasSpacingText, isRTL, isHybridLine, isAdlib = false) => {
    // 1. Flatten characters to compute contiguous groups for accurate math color interpolation
    const flatChars = [];
    alignedChunks.forEach(chunk => {
        chunk.chars.forEach(c => flatChars.push(c));
    });

    const getSegId = (c) => {
        if (c.seg?.artists) return c.seg.artists.join('-');
        if (c.seg?.gradient) return c.seg.gradient;
        if (c.seg?.color) return c.seg.color;
        return 'default';
    };

    const contigGroups = [];
    let currentGroupId = null;

    flatChars.forEach((c) => {
        const id = getSegId(c);
        if (id !== currentGroupId) {
            contigGroups.push({ id, chars: [] });
            currentGroupId = id;
        }
        contigGroups[contigGroups.length - 1].chars.push(c);
    });

    // 2. Pre-compute and assign the exact hex color for every character based on position
    contigGroups.forEach(group => {
        const firstChar = group.chars[0];
        const seg = firstChar.seg;
        const targetArtists = seg?.artists;
        
        let isGrad = false;
        let colors = ['#ffffff'];

        if (targetArtists && targetArtists.length > 1) {
            isGrad = true;
            colors = targetArtists.map(a => masterPalette[a] || '#ffffff');
        } else if (seg?.isGradient && seg?.gradient) {
            isGrad = true;
            // Parse CSS gradient hex colors if provided
            const hexRegex = /#([a-f\d]{3,6})/gi;
            const matches = [...seg.gradient.matchAll(hexRegex)];
            if (matches.length > 0) {
                colors = matches.map(m => m[0]);
            }
        } else if (targetArtists && targetArtists.length === 1) {
            colors = [masterPalette[targetArtists[0]] || '#ffffff'];
        } else if (seg?.color) {
            colors = [seg.color];
        }

        group.chars.forEach((c, i) => {
            if (isGrad) {
                const ratio = group.chars.length > 1 ? i / (group.chars.length - 1) : 0.5;
                c.computedColor = interpolateColor(colors, ratio);
            } else {
                c.computedColor = colors[0];
            }
        });
    });

    // 3. Render chunks completely free of CSS background masks
    const chunkElements = alignedChunks.map((chunk, chunkIdx) => {
        const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex, isFocused));
        if (renderedText.every(c => c === null)) return null;

        const groupedText = groupWords(renderedText, chunk.chars, isFocused, hasSpacingText);

        if (isRTL) {
            return (
                <span key={chunkIdx} className="lyric-text-span" style={{
                    whiteSpace: 'pre-line',
                    display: 'inline',
                    position: 'relative',
                    top: isHybridLine ? 'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)' : 'auto'
                }}>
                  {groupedText}
                </span>
            );
        } else {
            if (chunk.type !== 'en' && chunk.trans && chunk.trans.trim()) {
                let cleanTrans = normalizeTrans(chunk.trans, !isAdlib);
                if (isAdlib) {
                    cleanTrans = cleanTrans.replace(/[()\[\]{}]/g, '').trim();
                }
                return (
                  <span
                    key={`chunk-${chunkIdx}`}
                    className="inline-cjk-chunk"
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      verticalAlign: 'top',
                      margin: hasSpacingText ? '0' : '0 2px'
                    }}
                  >
                    <span
                        className="lyric-text-span"
                       style={{
                         display: 'inline',
                         whiteSpace: 'pre-line'
                       }}
                    >
                      {groupedText}
                    </span>
                    {cleanTrans ? (
                      <span
                          className="pronunciation-text"
                         style={basePronStyle}
                         dir="ltr"
                      >
                        {renderFormattedTranslation(cleanTrans, isFocused)}
                      </span>
                    ) : null}
                  </span>
                );
            } else {
                return (
                  <span
                      key={`chunk-${chunkIdx}`}
                     className="lyric-text-span"
                     style={{
                       whiteSpace: 'pre-line',
                       display: 'inline',
                       position: 'relative',
                       top: isHybridLine ? 'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)' : 'auto'
                  }}>
                      {groupedText}
                  </span>
                );
            }
        }
    }).filter(item => item !== null);

    return (
      <span className="main-lyrics-flow-wrapper" style={{ display: 'inline', whiteSpace: 'pre-line' }}>
        {chunkElements}
      </span>
    );
};