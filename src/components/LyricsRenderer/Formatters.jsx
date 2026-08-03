/* --- src/components/LyricsRenderer/Formatters.jsx --- */
import React from 'react';
import { isCJ, getGraphemes, normalizeTrans } from './textUtils';

export const renderFormattedTranslation = (text) => {
  if (!text) return null;
  const parts = text.split(/([\p{P}\p{S}\s]+)/u);
  return parts.map((part, pIdx) => {
    if (!part) return null;
    const isPunct = /^[\p{P}\p{S}\s]+$/u.test(part);
    if (isPunct && part.trim() !== '') {
      return (
        <span key={pIdx} style={{ color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.6)' }}>
          {part}
        </span>
      );
    }
    return <span key={pIdx}>{part}</span>;
  });
};

export const groupWords = (elements, charData, isFocused) => {
  const words = [];
  let currentWord = [];
  for (let i = 0; i < elements.length; i++) {
    if (!elements[i]) {
      if (currentWord.length > 0) {
        words.push(
          <span key={`w-${i}`} style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
            {currentWord}
          </span>
        );
        currentWord = [];
      }
      words.push(elements[i]);
      continue;
    }

    const char = charData[i].char;

    // Properly chunk spaces and CJK without destroying the element's color spans
    if (/\s/.test(char) || isCJ(char)) {
      if (currentWord.length > 0) {
        words.push(
          <span key={`w-${i}`} style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
            {currentWord}
          </span>
        );
        currentWord = [];
      }
      words.push(elements[i]); // Push the actual styled element directly
    } else {
      currentWord.push(elements[i]);
    }
  }
  if (currentWord.length > 0) {
    words.push(
      <span key="w-end" style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
        {currentWord}
      </span>
    );
  }
  return words;
};

export const alignChunksWithTransliteration = (chars, parsedChunks, fullTrans, renderColoredChar, basePronStyle, isRTL, isFocused) => {
  let alignedChunks = [];
  
  if (parsedChunks && Array.isArray(parsedChunks)) {
    let charIdxPointer = 0;
    parsedChunks.forEach((chunk) => {
      const chunkText = chunk.text || '';
      const chunkGraphemeCount = getGraphemes(chunkText).length;
      const chunkChars = chars.slice(charIdxPointer, charIdxPointer + chunkGraphemeCount);
      charIdxPointer += chunkGraphemeCount;
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

    const groupedText = groupWords(renderedText, chunk.chars, isFocused);

    if (isRTL) {
      return (
        <span key={chunkIdx} style={{ whiteSpace: isFocused ? 'normal' : 'pre-wrap', verticalAlign: 'middle', maxWidth: '100%' }}>
          {groupedText}
        </span>
      );
    } else {
      if (chunk.trans && chunk.trans.trim()) {
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
                {renderFormattedTranslation(cleanTrans)}
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