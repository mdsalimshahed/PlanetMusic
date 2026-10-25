import React from 'react';
import { getGraphemes } from './textUtils.js';
import { toSmartPunctuation } from '../../utils/smartPunctuation.js';

export const renderPlainColoredText = (item, masterPalette, wordState = { index: 0 }) => {
  let artists = Array.isArray(item.artists) ? item.artists : [];
  if (artists.length === 0 && item.singer) {
    artists = item.singer
      .split(/\s*(?:&|,|\band\b|\+)\s*/i)
      .filter(Boolean)
      .map(artist => artist.trim());
  }

  let isGradient = false;
  let gradientStyle = '';
  let activeColor = '#ffffff';

  if (artists.length > 1) {
    isGradient = true;
    const gradientColors = artists.map(artist => masterPalette[artist] || '#ffffff').join(', ');
    gradientStyle = `linear-gradient(90deg, ${gradientColors})`;
  } else if (artists.length === 1) {
    activeColor = masterPalette[artists[0]] || item.color || '#ffffff';
  } else if (item.isGradient && item.gradient) {
    isGradient = true;
    gradientStyle = item.gradient;
  } else {
    activeColor = item.color || '#ffffff';
  }

  const parentStyle = isGradient
    ? {
      backgroundImage: gradientStyle,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      display: 'inline'
    }
    : { color: activeColor };

  const chars = getGraphemes(toSmartPunctuation(item.text || ''));
  const renderedChars = chars.map((char, index) => {
    const isPunctuation = /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(char);
    const childStyle = isPunctuation && char.trim() !== ''
      ? {
        color: '#fbbf24',
        WebkitTextFillColor: '#fbbf24',
        textShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
        backgroundImage: 'none'
      }
      : null;

    return childStyle ? (
      <span key={index} style={childStyle}>{char}</span>
    ) : (
      <React.Fragment key={index}>{char}</React.Fragment>
    );
  });

  const words = [];
  let currentWord = [];
  let hyphenCount = 0;
  const flushWord = () => {
    if (currentWord.length === 0) return;
    const isHyphenatedWord = hyphenCount > 4;
    words.push(
      <span
        key={`word-${wordState.index}`}
        className={`lyric-word${isHyphenatedWord ? ' hyphenated-word' : ''}`}
        style={{
          whiteSpace: isHyphenatedWord ? 'normal' : 'pre-wrap',
          wordBreak: 'normal',
          overflowWrap: 'normal',
          display: 'inline-block',
          '--word-index': wordState.index++
        }}
      >
        {currentWord}
      </span>
    );
    currentWord = [];
    hyphenCount = 0;
  };

  renderedChars.forEach((node, index) => {
    if (/^\s+$/u.test(chars[index])) {
      flushWord();
      words.push(<React.Fragment key={`space-${index}`}>{chars[index]}</React.Fragment>);
      return;
    }
    if (chars[index] === '-') hyphenCount++;
    currentWord.push(node);
  });
  flushWord();

  return (
    <span className="lyric-text-span" style={{ ...parentStyle, whiteSpace: 'pre-line' }}>
      {words}
    </span>
  );
};

export const renderPlainLyricsText = (line, masterPalette) => {
  const wordState = { index: 0 };
  const segments = Array.isArray(line?.segments) && line.segments.length > 0
    ? line.segments
    : [line];

  return segments.map((segment, index) => (
    <React.Fragment key={index}>
      {renderPlainColoredText(segment || {}, masterPalette, wordState)}
    </React.Fragment>
  ));
};
