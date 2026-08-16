/* --- src/components/LyricsRenderer/Formatters.jsx --- */
import React from 'react';
import { isCJ, getGraphemes, normalizeTrans } from './textUtils';

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

  const flushWord = (keySuffix) => {
    if (currentWord.length > 0) {
      words.push(
        <span
          key={`w-${keySuffix}`}
          style={{
            // Restored standard inline text flow so the browser natively 
            // binds punctuation to words and wraps them together.
            whiteSpace: 'pre-wrap', 
            wordBreak: 'normal', 
            overflowWrap: 'normal'
          }}
        >
          {currentWord}
        </span>
      );
      currentWord = [];
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
      currentWord.push(elements[i]);
    }
  }
  flushWord('end');
  return words;
};

export const alignChunksWithTransliteration = (chars, parsedChunks, fullTrans, renderColoredChar, basePronStyle, isRTL, isFocused, hasSpacingText = false, getSegmentStyle = null) => {
  let alignedChunks = [];

  let canDo1to1 = false;
  let spacedWordsBlocks = [];
  let pronWords = [];

  if (hasSpacingText && fullTrans) {
    let currentBlock = [];
    chars.forEach(c => {
      if (/\s/.test(c.char)) {
        if (currentBlock.length > 0) {
          spacedWordsBlocks.push(currentBlock);
          currentBlock = [];
        }
      } else {
        currentBlock.push(c);
      }
    });
    if (currentBlock.length > 0) spacedWordsBlocks.push(currentBlock);

    pronWords = fullTrans.split(/\s+/).filter(Boolean);
    if (spacedWordsBlocks.length === pronWords.length && spacedWordsBlocks.length > 0) {
      canDo1to1 = true;
    }
  }

  if (canDo1to1) {
    let tIdx = 0;
    let currentBlock = [];
    chars.forEach(c => {
      if (/\s/.test(c.char)) {
        if (currentBlock.length > 0) {
          const textStr = currentBlock.map(x => x.char).join('');
          const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(textStr);
          const isOnlyPunct = /^[\p{P}\p{S}]+$/u.test(textStr);
          
          if (isOnlyPunct || isLatin) {
             alignedChunks.push({ type: 'main', trans: '', chars: currentBlock });
          } else {
             alignedChunks.push({ type: 'main', trans: pronWords[tIdx] || '', chars: currentBlock });
          }
          tIdx++;
          currentBlock = [];
        }
        alignedChunks.push({ type: 'space', trans: '', chars: [c] });
      } else {
        currentBlock.push(c);
      }
    });
    if (currentBlock.length > 0) {
       const textStr = currentBlock.map(x => x.char).join('');
       const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(textStr);
       const isOnlyPunct = /^[\p{P}\p{S}]+$/u.test(textStr);
       
       if (isOnlyPunct || isLatin) {
          alignedChunks.push({ type: 'main', trans: '', chars: currentBlock });
       } else {
          alignedChunks.push({ type: 'main', trans: pronWords[tIdx] || '', chars: currentBlock });
       }
    }
  } 
  else if (parsedChunks && Array.isArray(parsedChunks)) {
    let charIdxPointer = 0;
    parsedChunks.forEach((chunk) => {
      const chunkText = chunk.text || '';
      const nonSpaceGraphemes = getGraphemes(chunkText.replace(/\s+/g, ''));
      let charsToConsume = 0;
      let tempPointer = charIdxPointer;

      if (nonSpaceGraphemes.length > 0) {
        let matched = 0;
        while (matched < nonSpaceGraphemes.length && tempPointer < chars.length) {
          if (!/\s/.test(chars[tempPointer].char)) {
            matched++;
          }
          charsToConsume++;
          tempPointer++;
        }
      } else {
        while (tempPointer < chars.length && /\s/.test(chars[tempPointer].char)) {
          charsToConsume++;
          tempPointer++;
        }
      }

      const chunkChars = chars.slice(charIdxPointer, charIdxPointer + charsToConsume);
      charIdxPointer += charsToConsume;

      if (chunkChars.length > 0) {
        const cClean = chunkText.toLowerCase().replace(/[\W_]+/g, '');
        const tClean = (chunk.trans || '').toLowerCase().replace(/[\W_]+/g, '');
        
        if (chunk.type === 'en' || (cClean && cClean === tClean)) {
           alignedChunks.push({ type: 'en', trans: '', chars: chunkChars });
        } else {
           alignedChunks.push({ type: chunk.type || 'foreign', trans: chunk.trans, chars: chunkChars });
        }
      }
    });
    
    if (charIdxPointer < chars.length) {
      alignedChunks.push({ type: 'main', trans: '', chars: chars.slice(charIdxPointer) });
    }
  } 
  else {
    const isCJKLine = chars.some(c => isCJ(c.char));
    if (isCJKLine) {
      const transString = fullTrans || '';
      let blocks = [];
      let currentBlock = [];
      let isLatinMode = null;
      
      chars.forEach(c => {
        const isLatin = /^[\p{Script=Latin}\d\s' ".,!?:\-&()\[\]]+$/u.test(c.char);
        if (isLatinMode === null) {
          isLatinMode = isLatin;
          currentBlock.push(c);
        } else if (isLatinMode === isLatin) {
          currentBlock.push(c);
        } else {
          blocks.push({ isLatin: isLatinMode, chars: currentBlock });
          isLatinMode = isLatin;
          currentBlock = [c];
        }
      });
      if (currentBlock.length > 0) blocks.push({ isLatin: isLatinMode, chars: currentBlock });

      const transWords = transString.split(/\s+/).filter(Boolean);
      let tIdx = 0;
      
      blocks.forEach(b => {
        const blockStr = b.chars.map(c => c.char).join('');
        if (b.isLatin && blockStr.trim().length > 0) {
          const latinWords = blockStr.split(/\s+/).filter(Boolean);
          latinWords.forEach(lw => {
            const lwClean = lw.toLowerCase().replace(/[\W_]+/g, '');
            if (tIdx < transWords.length) {
               const twClean = transWords[tIdx].toLowerCase().replace(/[\W_]+/g, '');
               if (twClean === lwClean || twClean.includes(lwClean) || lwClean.includes(twClean)) {
                   tIdx++;
               }
            }
          });
          alignedChunks.push({ type: 'en', trans: '', chars: b.chars });
        } else if (!b.isLatin) {
          let cjkTrans = [];
          const nextLatinBlock = blocks.find(nb => nb.isLatin && nb !== b && blocks.indexOf(nb) > blocks.indexOf(b) && nb.chars.map(c=>c.char).join('').trim().length > 0);
          const nextLatinFirstWord = nextLatinBlock ? nextLatinBlock.chars.map(c=>c.char).join('').split(/\s+/).filter(Boolean)[0] : null;
          const nlwClean = nextLatinFirstWord ? nextLatinFirstWord.toLowerCase().replace(/[\W_]+/g, '') : '';

          while (tIdx < transWords.length) {
            if (nlwClean) {
              let matchFound = false;
              let lookAhead = '';
              for (let i = tIdx; i < Math.min(tIdx + 4, transWords.length); i++) {
                lookAhead += transWords[i].toLowerCase().replace(/[\W_]+/g, '');
                if (lookAhead === nlwClean) {
                  matchFound = true;
                  break;
                }
              }
              if (matchFound) break;
            }
            cjkTrans.push(transWords[tIdx]);
            tIdx++;
          }
          alignedChunks.push({ type: 'main', trans: cjkTrans.join(' '), chars: b.chars });
        } else {
          alignedChunks.push({ type: 'en', trans: '', chars: b.chars });
        }
      });
    } else {
      let currentSeg = null;
      let currentChars = [];
      chars.forEach(c => {
          if (currentSeg === null) currentSeg = c.seg;
          
          if (currentSeg === c.seg) {
              currentChars.push(c);
          } else {
              alignedChunks.push({ type: 'main', trans: '', chars: currentChars });
              currentChars = [c];
              currentSeg = c.seg;
          }
      });
      if (currentChars.length > 0) {
          alignedChunks.push({ type: 'main', trans: fullTrans || '', chars: currentChars });
      }
    }
  }

  const chunkElements = alignedChunks.map((chunk, chunkIdx) => {
    const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex));
    if (renderedText.every(c => c === null)) return null;
    
    const groupedText = groupWords(renderedText, chunk.chars, isFocused, hasSpacingText);
    let chunkJSX;

    if (isRTL) {
      chunkJSX = (
        <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'middle', maxWidth: '100%' }}>
          {groupedText}
        </span>
      );
    } else {
      if (chunk.type !== 'en' && chunk.trans && chunk.trans.trim()) {
        const cleanTrans = normalizeTrans(chunk.trans);
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
          <span key={chunkIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'baseline', display: 'inline', maxWidth: '100%' }}>
            {groupedText}
          </span>
        );
      }
    }
    
    return { seg: chunk.chars[0]?.seg, jsx: chunkJSX };
  }).filter(item => item !== null);

  if (!getSegmentStyle) {
    return chunkElements.map(item => item.jsx);
  }

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
    const parentStyle = getSegmentStyle(group.seg);
    return <span key={`seg-${idx}`} style={parentStyle}>{group.elements}</span>;
  });
};