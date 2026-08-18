/* --- src/components/LyricsRenderer/LanguageEngines/EngineUtils.jsx --- */
import React from 'react';
import { getGraphemes, normalizeTrans } from '../textUtils';

export const basePronStyle = {
  fontSize: 'var(--dyn-translit-font-size, 0.55em)',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'center',
  marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  WebkitTextFillColor: 'currentcolor',
  backgroundImage: 'none',
  color: 'rgba(255,255,255,0.7)',
  textShadow: 'none'
};

export const getDisplayTranslation = (originalText, translation) => {
  const normalizeForMatch = (str) => String(str || '').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '').trim();
  const cleanMainText = normalizeForMatch(originalText);
  const cleanTransText = normalizeForMatch(translation);
  return (cleanMainText && cleanMainText === cleanTransText) ? '' : (translation || '');
};

export const getSegmentStyle = (seg, masterPalette, isFocused) => {
  let targetArtists = seg?.artists;
  let isGrad = false;
  let gradStyle = '';

  if (targetArtists && targetArtists.length > 1) {
    isGrad = true;
    const gradientColors = targetArtists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
    gradStyle = `linear-gradient(90deg, ${gradientColors})`;
  } else if (seg?.isGradient && seg?.gradient) {
    isGrad = true;
    gradStyle = seg.gradient;
  }

  if (isGrad) {
    return {
      backgroundImage: gradStyle,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      WebkitBoxDecorationBreak: 'clone',
      display: 'inline',
      filter: isFocused
         ? `drop-shadow(0 0 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`
         : `drop-shadow(0 4px 12px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(255,255,255,0.4))`
    };
  }
  return {};
};

export const renderColoredChar = (c, globalIdx, masterPalette, isFocused) => {
  const isPunct = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(c.char);
  let style = { transition: 'opacity 0.3s ease, transform 0.3s ease' };
  
  if (isPunct && c.char.trim() !== '') {
    style = {
      ...style,
      color: '#fbbf24',
      WebkitTextFillColor: '#fbbf24',
      textShadow: isFocused ? '0 0 12px rgba(0,0,0,0.95), 0 0 15px rgba(251, 191, 36, 0.6)' : '0 4px 12px rgba(0,0,0,0.95), 0 0 15px rgba(251, 191, 36, 0.6)',
      backgroundImage: 'none',
      filter: 'none'
    };
  } else {
    let targetArtists = c.seg?.artists;
    let isGrad = (targetArtists && targetArtists.length > 1) || c.seg?.isGradient;
    
    if (!isGrad) {
      let activeColor = '#ffffff';
      if (targetArtists && targetArtists.length === 1) {
        activeColor = masterPalette[targetArtists[0]] || '#ffffff';
      } else if (c.seg?.color) {
        activeColor = c.seg.color;
      }
      style.color = activeColor;
      style.WebkitTextFillColor = activeColor;
      style.textShadow = isFocused ? `0 0 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80` : `0 4px 12px rgba(0,0,0,0.95), 0 0 20px ${activeColor}80`;
    }
  }

  return <span key={globalIdx} style={style}>{c.char}</span>;
};

export const renderFormattedTranslation = (text, isFocused = false) => {
  if (!text) return null;
  const parts = text.split(/([\p{P}\p{S}\s]+)/u);
  return parts.map((part, pIdx) => {
    if (!part) return null;
    const isPunct = /^[\p{P}\p{S}\s]+$/u.test(part);
    if (isPunct && part.trim() !== '') {
      const shadow = isFocused 
           ? '0 0 12px rgba(0, 0, 0, 0.95), 0 0 15px rgba(251, 191, 36, 0.6)' 
         : '0 4px 12px rgba(0, 0, 0, 0.95), 0 0 15px rgba(251, 191, 36, 0.6)';
      return (
        <span key={pIdx} style={{ color: '#fbbf24', textShadow: shadow, WebkitTextFillColor: '#fbbf24', backgroundImage: 'none' }}>
          {part}
        </span>
      );
    }
    return <span key={pIdx}>{part}</span>;
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
                  display: 'inline-block',
                  maxWidth: '100%',
                  wordBreak: 'normal',
                  overflowWrap: 'normal'
                }
              : {
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'normal', 
                  overflowWrap: 'normal'
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

  return { chars, hasSpacingText: useSpacingText };
};

export const buildChunkElements = (alignedChunks, masterPalette, isFocused, hasSpacingText, isRTL, isHybridLine, isAdlib = false) => {
    const chunkElements = alignedChunks.map((chunk, chunkIdx) => {
        const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex, masterPalette, isFocused));
        if (renderedText.every(c => c === null)) return null;
        
        const groupedText = groupWords(renderedText, chunk.chars, isFocused, hasSpacingText);
        let chunkJSX;

        if (isRTL) {
            chunkJSX = (
                <span key={chunkIdx} style={{ 
                whiteSpace: 'pre-wrap', 
                verticalAlign: 'middle', 
                maxWidth: '100%',
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
                  cleanTrans = cleanTrans.replace(/[()\[\]{}（）]/g, '').trim();
                }

                chunkJSX = (
                <span
                    key={chunkIdx}
                    style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    verticalAlign: 'baseline',
                    margin: hasSpacingText ? '0' : '0 2px',
                    maxWidth: '100%'
                    }}
                >
                    <span style={{ display: 'inline-block', whiteSpace: 'pre-wrap', maxWidth: '100%' }}>{groupedText}</span>
                    {cleanTrans ? (
                    <span className="pronunciation-text" style={basePronStyle} dir="ltr">
                        {renderFormattedTranslation(cleanTrans, isFocused)}
                    </span>
                    ) : null}
                </span>
                );
            } else {
                chunkJSX = (
                <span key={chunkIdx} style={{ 
                    whiteSpace: 'pre-wrap', 
                    verticalAlign: 'baseline', 
                    display: 'inline', 
                    maxWidth: '100%',
                    position: 'relative',
                    top: isHybridLine ? 'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)' : 'auto'
                }}>
                    {groupedText}
                </span>
                );
            }
        }
        
        return { seg: chunk.chars[0]?.seg, jsx: chunkJSX };
    }).filter(item => item !== null);

    const segmentGroups = [];
    let currentGroup = null;

    chunkElements.forEach(item => {
        if (!currentGroup || currentGroup.seg !== item.seg) {
            if (currentGroup) segmentGroups.push(currentGroup);
            currentGroup = { seg: item.seg, elements: [item.jsx] };
        } else {
            currentGroup.elements.push(item.jsx);
        }
    });
    if (currentGroup) segmentGroups.push(currentGroup);

    return segmentGroups.map((group, idx) => {
        const parentStyle = getSegmentStyle(group.seg, masterPalette, isFocused);
        return <span key={`seg-${idx}`} style={parentStyle}>{group.elements}</span>;
    });
};