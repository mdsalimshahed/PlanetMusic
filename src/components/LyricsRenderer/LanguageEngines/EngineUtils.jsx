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
  WebkitTextFillColor: 'var(--dyn-translit-color, #ffffff)',
  color: 'var(--dyn-translit-color, #ffffff)',
  opacity: 'var(--dyn-translit-opacity, 0.8)',
  backgroundImage: 'none',
  WebkitBackgroundClip: 'border-box',
  textShadow: 'none',
  fontFamily: 'var(--font-family)'
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

export const renderColoredChar = (c, globalIdx, masterPalette, isFocused, isMaskLayer = false) => {
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
    
    if (isGrad || isMaskLayer) {
      style.WebkitTextFillColor = 'transparent';
      style.color = 'transparent';
    } else {
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
    let lineGradientStyle = null;
    alignedChunks.forEach(chunk => {
      const seg = chunk.chars[0]?.seg;
      if (seg) {
        const style = getSegmentStyle(seg, masterPalette, isFocused);
        if (style.backgroundImage) {
          lineGradientStyle = style;
        }
      }
    });

    // --- HELPER TO RENDER A SPECIFIC LAYER (Mask vs Pronunciation Overlay) ---
    const renderLayerTree = (hidePronunciation = false, hideMainText = false) => {
      return alignedChunks.map((chunk, chunkIdx) => {
          const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex, masterPalette, isFocused, Boolean(lineGradientStyle)));
          if (renderedText.every(c => c === null)) return null;
          
          const groupedText = groupWords(renderedText, chunk.chars, isFocused, hasSpacingText);
          const seg = chunk.chars[0]?.seg;
          const segStyle = lineGradientStyle ? {} : getSegmentStyle(seg, masterPalette, isFocused);

          if (isRTL) {
              return (
                  <span key={chunkIdx} className="lyric-text-span" style={{ 
                    ...segStyle,
                    whiteSpace: 'pre-wrap', 
                    verticalAlign: 'middle', 
                    maxWidth: '100%',
                    position: 'relative',
                    top: isHybridLine ? 'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)' : 'auto',
                    visibility: hideMainText ? 'hidden' : 'visible'
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

                  return (
                    <span
                      key={`chunk-${chunkIdx}`}
                      className="inline-cjk-chunk"
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        verticalAlign: 'top',
                        margin: hasSpacingText ? '0' : '0 2px',
                        maxWidth: '100%'
                      }}
                    >
                      <span 
                        className="lyric-text-span" 
                        style={{ 
                          ...segStyle,
                          display: 'inline-block', 
                          whiteSpace: 'pre-wrap', 
                          maxWidth: '100%',
                          visibility: hideMainText ? 'hidden' : 'visible'
                        }}
                      >
                        {groupedText}
                      </span>
                      {cleanTrans ? (
                        <span 
                          className="pronunciation-text" 
                          style={{
                            ...basePronStyle,
                            visibility: hidePronunciation ? 'hidden' : 'visible'
                          }} 
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
                        ...segStyle,
                        whiteSpace: 'pre-wrap', 
                        verticalAlign: 'baseline', 
                        display: 'inline-block', 
                        maxWidth: '100%',
                        position: 'relative',
                        top: isHybridLine ? 'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)' : 'auto',
                        visibility: hideMainText ? 'hidden' : 'visible'
                    }}>
                        {groupedText}
                    </span>
                  );
              }
          }
      }).filter(item => item !== null);
    };

    // --- NON-GRADIENT SINGLE LAYER RENDER ---
    if (!lineGradientStyle) {
      return (
        <span className="main-lyrics-flow-wrapper" style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'flex-start', width: '100%' }}>
          {renderLayerTree(false, false)}
        </span>
      );
    }

    // --- DUAL-LAYER ARCHITECTURE FOR GRADIENT MASKED LINES ---
    // Layer 1: Gets the continuous gradient mask across the whole span, but hides pronunciation.
    // Layer 2: Stacked identically on top, hides the main text and renders ONLY the un-clipped pronunciation text.
    return (
      <span className="dual-layer-gradient-container" style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        {/* LAYER 1: Gradient Mask Layer */}
        <span className="segment-mask-span" style={{ ...lineGradientStyle, display: 'inline-flex', flexWrap: 'wrap', alignItems: 'flex-start', width: '100%' }}>
          {renderLayerTree(true, false)}
        </span>

        {/* LAYER 2: Clean Pronunciation Overlay */}
        <span 
          className="full-pronunciation-row" 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            display: 'inline-flex', 
            flexWrap: 'wrap', 
            alignItems: 'flex-start', 
            pointerEvents: 'none',
            zIndex: 2
          }}
        >
          {renderLayerTree(false, true)}
        </span>
      </span>
    );
};