import React from 'react';
import { getGraphemes } from './textUtils.js';

const isPunctuation = character =>
  /^[\p{P}\p{S}\s\u064B-\u065F\u0670]+$/u.test(character);

const renderCharacter = (character, key, clearGradient = false) => {
  if (isPunctuation(character) && character.trim()) {
    return (
      <span
        key={key}
        style={{
          color: '#fbbf24',
          WebkitTextFillColor: '#fbbf24',
          textShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
          ...(clearGradient ? { backgroundImage: 'none' } : {})
        }}
      >
        {character}
      </span>
    );
  }

  return <React.Fragment key={key}>{character}</React.Fragment>;
};

export const renderTranslationOriginalText = (
  line,
  masterPalette = {},
  { savedNode, excludeAdlibs = false } = {}
) => {
  const adlibs = line?._meta?.isAdlib ? [] : (savedNode?.adlibs || line?.adlibs || []);
  const shouldExcludeAdlibs = excludeAdlibs || Boolean(
    !line?._meta?.isAdlib && line?.isSplit && adlibs.length
  );
  const isAdlibCharacter = codePointIndex => (
    shouldExcludeAdlibs && adlibs.some(adlib =>
      codePointIndex >= adlib.charStart && codePointIndex < adlib.charEnd
    )
  );

  const segments = Array.isArray(line?.segments)
    ? line.segments.filter(segment => segment && typeof segment === 'object')
    : [];

  if (segments.length) {
    let globalCharacterIndex = 0;
    let codePointIndex = 0;

    return segments.map((segment, segmentIndex) => {
      let color = segment.color || '#ffffff';
      let isGradient = Boolean(segment.isGradient);
      let gradient = segment.gradient || '';
      const artists = Array.isArray(segment.artists) ? segment.artists : [];

      if (artists.length > 1) {
        isGradient = true;
        gradient = `linear-gradient(90deg, ${artists.map(artist =>
          masterPalette[artist] || '#ffffff'
        ).join(', ')})`;
      } else if (artists.length === 1) {
        color = masterPalette[artists[0]] || color;
      }

      const parentStyle = isGradient
        ? {
          backgroundImage: gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'inline'
        }
        : { color };

      const characters = getGraphemes(segment.text || '').map(character => {
        const currentCodePointIndex = codePointIndex;
        codePointIndex += Array.from(character).length;
        const key = globalCharacterIndex++;
        if (isAdlibCharacter(currentCodePointIndex)) return null;
        return renderCharacter(character, key, true);
      });

      return <span className="lyric-text-span" key={segmentIndex} style={parentStyle}>{characters}</span>;
    });
  }

  const singer = line?.singer || line?.artistName || '';
  const defaultArtist = singer.split(/\s*(?:&|,|\band\b)\s*/i)[0]?.trim();
  const defaultColor = masterPalette[defaultArtist] || '#ffffff';
  let codePointIndex = 0;
  const text = line?.displayText ?? line?.text ?? '';

  return (
    <span className="lyric-text-span" style={{ color: defaultColor }}>
      {getGraphemes(text).map((character, index) => {
        const currentCodePointIndex = codePointIndex;
        codePointIndex += Array.from(character).length;
        if (isAdlibCharacter(currentCodePointIndex)) return null;
        return renderCharacter(character, index);
      })}
    </span>
  );
};

const TranslationOriginalText = ({ line, masterPalette, savedNode, excludeAdlibs = false }) => (
  <>{renderTranslationOriginalText(line, masterPalette, { savedNode, excludeAdlibs })}</>
);

export default TranslationOriginalText;
