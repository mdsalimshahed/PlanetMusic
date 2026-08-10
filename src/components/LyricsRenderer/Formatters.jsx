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
        <span key={pIdx} style={{ color: '#fbbf24', textShadow: shadow }}>
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
      // If in Focused View and the word has more than 4 hyphens, allow it to wrap naturally
      const shouldWrap = isFocused && hyphenCount > 4;
      words.push(
        <span
          key={`w-${keySuffix}`}
          style={
            shouldWrap
              ? {
                  whiteSpace: 'normal',
                  display: 'inline-block',
                  maxWidth: '100%',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }
              : {
                  whiteSpace: 'nowrap',
                  display: 'inline-block'
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

    // Properly chunk spaces and CJK without destroying the element's color spans
    const isSpace = /\s/.test(char);
    const shouldBreak = hasSpacingText ? isSpace : (isSpace || isCJ(char));

    if (shouldBreak) {
      flushWord(i);
      words.push(elements[i]); // Push the actual styled element directly
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

export const alignChunksWithTransliteration = (chars, parsedChunks, fullTrans, renderColoredChar, basePronStyle, isRTL, isFocused, hasSpacingText = false) => {
  let alignedChunks = [];

  // --- 1:1 Word Mapping for Manually Spaced Lyrics ---
  if (hasSpacingText) {
    const wordBlocks = [];
    let currentBlock = [];

    chars.forEach((c) => {
      if (/\s/.test(c.char)) {
        if (currentBlock.length > 0) {
          wordBlocks.push(currentBlock);
          currentBlock = [];
        }
        wordBlocks.push([c]);
      } else {
        currentBlock.push(c);
      }
    });
    if (currentBlock.length > 0) wordBlocks.push(currentBlock);

    const transString = fullTrans || (parsedChunks && parsedChunks.map(p => p.trans || p.text).join(' ')) || '';
    const transWords = transString.split(/\s+/).filter(Boolean);
    let transIdx = 0;

    wordBlocks.forEach((block) => {
      const isSpaceBlock = block.length === 1 && /\s/.test(block[0].char);
      if (isSpaceBlock) {
        alignedChunks.push({ type: 'main', trans: '', chars: block });
      } else {
        const blockText = block.map(c => c.char).join('');
        // Ensure English parts within the spaced Japanese lyrics skip the transliteration chunk wrapper
        const isEnglish = /^[\p{Script=Latin}\p{P}\p{S}\p{N}]+$/u.test(blockText);
        
        if (isEnglish) {
           alignedChunks.push({ type: 'en', trans: '', chars: block });
           transIdx++; // FIX: Advance the pointer so the skipped English transliteration is discarded!
        } else {
           const assignedTrans = transWords[transIdx] || '';
           transIdx++;
           alignedChunks.push({ type: 'foreign', trans: assignedTrans, chars: block });
        }
      }
    });
  } 
  else if (parsedChunks && Array.isArray(parsedChunks)) {
    let charIdxPointer = 0;
    parsedChunks.forEach((chunk) => {
      const chunkText = chunk.text || '';
      
      // --- Smart character slicing to align spaces correctly ---
      const nonSpaceGraphemes = getGraphemes(chunkText.replace(/\s+/g, ''));
      let charsToConsume = 0;
      let tempPointer = charIdxPointer;

      if (nonSpaceGraphemes.length > 0) {
        let matched = 0;
        // Consume characters until we match the expected amount of visible characters
        while (matched < nonSpaceGraphemes.length && tempPointer < chars.length) {
          if (!/\s/.test(chars[tempPointer].char)) {
            matched++;
          }
          charsToConsume++;
          tempPointer++;
        }
      } else {
        // If it's a pure space chunk, only consume characters if they are actually spaces
        while (tempPointer < chars.length && /\s/.test(chars[tempPointer].char)) {
          charsToConsume++;
          tempPointer++;
        }
      }

      const chunkChars = chars.slice(charIdxPointer, charIdxPointer + charsToConsume);
      charIdxPointer += charsToConsume;
      // -----------------------------------------------------------------

      if (chunkChars.length > 0) {
        alignedChunks.push({
          type: chunk.type,
          trans: chunk.trans,
          chars: chunkChars
        });
      }
    });

    if (charIdxPointer < chars.length) {
      alignedChunks.push({
        type: 'main',
        trans: '',
        chars: chars.slice(charIdxPointer)
      });
    }
  } else {
    alignedChunks = [{
      type: 'main',
      trans: fullTrans || '',
      chars: chars
    }];
  }

  return alignedChunks.map((chunk, chunkIdx) => {
    const renderedText = chunk.chars.map(c => renderColoredChar(c, c.globalIndex));
    if (renderedText.every(c => c === null)) return null;

    const groupedText = groupWords(renderedText, chunk.chars, isFocused, hasSpacingText);

    if (isRTL) {
      return (
        <span key={chunkIdx} style={{ whiteSpace: isFocused ? 'normal' : 'pre-wrap', verticalAlign: 'middle', maxWidth: '100%' }}>
          {groupedText}
        </span>
      );
    } else {
      // Exclude English chunks from receiving transliterations
      if (chunk.type !== 'en' && chunk.trans && chunk.trans.trim()) {
        const cleanTrans = normalizeTrans(chunk.trans);
        return (
          <span
            key={chunkIdx}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              verticalAlign: 'bottom',
              margin: '0 2px',
              maxWidth: '100%'
            }}
          >
            <span style={{ display: 'inline-block', whiteSpace: isFocused ? 'normal' : 'pre-wrap', maxWidth: '100%' }}>{groupedText}</span>
            {cleanTrans ? (
              <span className="pronunciation-text" style={basePronStyle} dir="ltr">
                {renderFormattedTranslation(cleanTrans, isFocused)}
              </span>
            ) : null}
          </span>
        );
      } else {
        return (
          <span key={chunkIdx} style={{ whiteSpace: isFocused ? 'normal' : 'pre-wrap', verticalAlign: 'bottom', display: 'inline-block', maxWidth: '100%' }}>
            {groupedText}
          </span>
        );
      }
    }
  }).filter(Boolean);
};