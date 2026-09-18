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

export const renderFormattedTranslation = (text, isFocused = false, state = { index: 0 }, isAdlib = false) => {
  if (!text) return null;
  const parts = text.split(/(\s+)/u);
  const renderedParts = parts.map((part, pIdx) => {
    if (!part) return null;
    const isArabicPart = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(part);
    const isBengaliPart = /[\u0980-\u09FF]/.test(part);
    const font = isArabicPart ? 'var(--arabic-font-family)' : (isBengaliPart ? 'var(--bengali-font-family)' : 'var(--font-family)');

    const isSpaceOnly = /^\s+$/.test(part);
    
    if (isSpaceOnly) {
      return { type: 'space', node: <span key={pIdx} style={{ whiteSpace: 'pre' }}>{part}</span> };
    }

    const tokenParts = part.split(/([\p{P}\p{S}]+)/u).filter(Boolean);
    const currentIdx = state.index;
    state.index++;
    const punctuationCount = tokenParts.filter(tokenPart => {
      const isPunctuation = /^[\p{P}\p{S}]+$/u.test(tokenPart);
      const isParenthesis = isAdlib && /^[()[\]{}]+$/u.test(tokenPart);
      return isPunctuation && !isParenthesis;
    }).length;
    state.index += isFocused ? punctuationCount : 0;
    return { type: 'token', node: (
      <span key={pIdx} className={isFocused ? 'trans-word-group' : 'trans-word'} style={{ fontFamily: font, display: isFocused ? 'inline-block' : 'inline-block', whiteSpace: 'nowrap' }}>
        {tokenParts.map((tokenPart, tokenIdx) => {
          const isPunct = /^[\p{P}\p{S}]+$/u.test(tokenPart);
          const isParenthesis = isAdlib && /^[()[\]{}]+$/u.test(tokenPart);
          const tokenIndex = isPunct
            ? isParenthesis
              ? currentIdx
              : currentIdx + tokenParts.slice(0, tokenIdx).filter(value => /^[\p{P}\p{S}]+$/u.test(value) && !(isAdlib && /^[()[\]{}]+$/u.test(value))).length + 1
            : currentIdx;
          return isPunct
            ? <span key={tokenIdx} className={isFocused ? 'trans-punctuation' : undefined} style={{ color: '#fbbf24', textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)', WebkitTextFillColor: '#fbbf24', ...(isFocused ? { '--word-index': tokenIndex, display: 'inline-block' } : {}) }}>{tokenPart}</span>
            : isFocused
              ? <span key={tokenIdx} className="trans-word" style={{ fontFamily: font, '--word-index': tokenIndex, display: 'inline-block', whiteSpace: 'pre-wrap' }}>{tokenPart}</span>
              : tokenPart;
        })}
      </span>
    ) };
  });

  const groupedParts = [];
  renderedParts.forEach((part) => {
    if (!part) return;
    if (part.type === 'token') {
      groupedParts.push({ type: 'token-group', nodes: [part.node] });
    } else {
      groupedParts.push(part);
    }
  });

  return groupedParts.map((part, pIdx) => {
    if (part.type === 'space') return part.node;
    if (part.nodes.length === 1) return part.nodes[0];
    return <span key={`trans-group-${pIdx}`} className="trans-word-group">{part.nodes}</span>;
  });
};

export const groupWords = (elements, charData, isFocused, hasSpacingText = false, state = { index: 0 }, isAdlib = false) => {
  if (isFocused) {
    const words = [];
    let currentToken = [];
    let currentText = [];

    const flushText = (keySuffix) => {
      if (currentText.length === 0) return;
      const index = state.index++;
      currentToken.push(
        <span key={`focused-word-${keySuffix}`} className="lyric-word" style={{ whiteSpace: 'pre-wrap', display: 'inline-block', '--word-index': index }}>
          {currentText}
        </span>
      );
      currentText = [];
    };

    const flushToken = (keySuffix) => {
      flushText(`${keySuffix}-text`);
      if (currentToken.length > 0) {
        words.push(currentToken.length === 1 ? currentToken[0] : (
          <span key={`focused-group-${keySuffix}`} className="lyric-word-group">
            {currentToken}
          </span>
        ));
      }
      currentToken = [];
    };

    for (let i = 0; i < elements.length; i++) {
      if (!elements[i]) {
        flushToken(i);
        words.push(elements[i]);
        continue;
      }
      const char = charData[i] ? charData[i].char : '';
      if (/\s/.test(char)) {
        flushToken(i);
        words.push(elements[i]);
      } else if (/^[\p{P}\p{S}]+$/u.test(char)) {
        const hadTextBeforePunctuation = currentText.length > 0;
        flushText(`${i}-before-punctuation`);
        const isParenthesis = isAdlib && /^[()[\]{}]+$/u.test(char);
        const index = isParenthesis
          ? Math.max(0, state.index - (hadTextBeforePunctuation ? 1 : 0))
          : state.index++;
        currentToken.push(
          <span key={`focused-punctuation-${i}`} className="lyric-punctuation" style={{ color: '#fbbf24', WebkitTextFillColor: '#fbbf24', textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)', display: 'inline-block', '--word-index': index }}>
            {elements[i]}
          </span>
        );
      } else {
        currentText.push(elements[i]);
      }
    }

    flushToken('end');
    return words;
  }

  const words = [];
  let currentWord = [];
  let currentWordIndex = null;
  let hyphenCount = 0;

  const isPunctuation = (char) => /^[\p{P}\p{S}]+$/u.test(char);

  const flushWord = (keySuffix) => {
    if (currentWord.length > 0) {
      const shouldWrap = hyphenCount > 3;
      words.push(
        <span
          key={`w-${keySuffix}`}
          className="lyric-word"
          style={
            shouldWrap
              ? {
                  whiteSpace: 'normal',
                  display: 'inline-block',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  '--word-index': currentWordIndex
                }
              : {
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'normal', 
                  overflowWrap: 'normal',
                  display: 'inline-block',
                  '--word-index': currentWordIndex
                }
          }
        >
          {currentWord}
        </span>
      );
      currentWord = [];
      currentWordIndex = null;
      hyphenCount = 0;
    }
  };

  const addToCurrentWord = (element) => {
    if (currentWordIndex === null) currentWordIndex = state.index++;
    currentWord.push(element);
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
    } else if (isPunctuation(char)) {
      flushWord(i);

      let previousIndex = words.length - 1;
      const space = words[previousIndex] && !words[previousIndex].props?.className?.includes('lyric-word') ? words[previousIndex] : null;
      if (space) previousIndex--;

      const previousWord = words[previousIndex];
      currentWord = [elements[i]];
      currentWordIndex = state.index++;
      flushWord(i);
      const punctuationWord = words.pop();

      if (previousWord && punctuationWord) {
        if (space) words.splice(previousIndex + 1, 1);
        words[previousIndex] = (
          <span key={`wg-${i}`} className="lyric-word-group">
            {previousWord}
            {space}
            {punctuationWord}
          </span>
        );
      } else if (punctuationWord) {
        words.push(punctuationWord);
      }
    } else {
      if (char === '-') {
        hyphenCount++;
      }
      addToCurrentWord(elements[i]);
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
    // Shared state so word indices progress naturally across chunks and words
    const wordState = { index: 0 };
    const chunkElements = alignedChunks.map((chunk, chunkIdx) => {
        const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex, isFocused));
        if (renderedText.every(c => c === null)) return null;

        const chunkBaseIndex = wordState.index;
        const groupedText = groupWords(renderedText, chunk.chars, isFocused, hasSpacingText, wordState, isAdlib);

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
                    cleanTrans = cleanTrans.replace(/[()[\]{}]/g, '').trim();
                }
                // Pronunciation for this chunk animates alongside the chunk itself
                const pronState = { index: chunkBaseIndex };
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
                        {renderFormattedTranslation(cleanTrans, isFocused, pronState, isAdlib)}
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