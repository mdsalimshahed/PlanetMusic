import React from 'react';
import { getGraphemes } from './textUtils.js';
import {
  groupWords,
  interpolateColor,
  renderColoredChar
} from './LanguageEngines/EngineUtils.jsx';

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
    const chars = [];
    let globalCharacterIndex = 0;
    let codePointIndex = 0;

    segments.forEach(segment => {
      const artists = Array.isArray(segment.artists) ? segment.artists : [];
      let colors = artists.map(artist => masterPalette[artist] || '#ffffff');
      if (!colors.length && segment.isGradient && segment.gradient) {
        colors = [...segment.gradient.matchAll(/#([a-f\d]{3,6})/gi)]
          .map(match => match[0]);
      }
      if (!colors.length) colors = [segment.color || '#ffffff'];

      const segmentChars = getGraphemes(segment.text || '').map((character, index, all) => {
        const cpStart = codePointIndex;
        codePointIndex += Array.from(character).length;
        const ratio = all.length > 1 ? index / (all.length - 1) : 0.5;
        const computedColor = colors.length > 1
          ? interpolateColor(colors, ratio)
          : colors[0];
        const char = {
          char: character,
          seg: segment,
          globalIndex: globalCharacterIndex++,
          cpStart,
          cpEnd: codePointIndex,
          computedColor
        };
        return isAdlibCharacter(cpStart) ? null : char;
      });
      chars.push(...segmentChars);
    });

    const renderedChars = chars.map(char => (
      char ? renderColoredChar(char, char.globalIndex, false) : null
    ));
    const groupedText = groupWords(
      renderedChars,
      chars,
      false,
      true,
      { index: 0 }
    );

    return (
      <span className="lyric-text-span" style={{ whiteSpace: 'pre-line' }}>
        {groupedText}
      </span>
    );
  }

  const singer = line?.singer || line?.artistName || '';
  const defaultArtist = singer.split(/\s*(?:&|,|\band\b)\s*/i)[0]?.trim();
  const defaultColor = masterPalette[defaultArtist] || '#ffffff';
  let codePointIndex = 0;
  const text = line?.displayText ?? line?.text ?? '';
  const chars = getGraphemes(text).map((character, index) => {
    const cpStart = codePointIndex;
    codePointIndex += Array.from(character).length;
    return {
      char: character,
      globalIndex: index,
      cpStart,
      cpEnd: codePointIndex,
      computedColor: defaultColor
    };
  });
  const renderedChars = chars.map(char => (
    isAdlibCharacter(char.cpStart)
      ? null
      : renderColoredChar(char, char.globalIndex, false)
  ));

  return (
    <span className="lyric-text-span" style={{ color: defaultColor }}>
      {groupWords(renderedChars, chars, false, true, { index: 0 })}
    </span>
  );
};

const TranslationOriginalText = ({ line, masterPalette, savedNode, excludeAdlibs = false }) => (
  <>{renderTranslationOriginalText(line, masterPalette, { savedNode, excludeAdlibs })}</>
);

export default TranslationOriginalText;
