/* --- src/components/Workspaces/Lyrics/LyricsLineRenderer.jsx --- */
import React, { useMemo } from 'react';
import { getGraphemes, cleanTranslationText, isRTLLanguage, parsePronunciation } from '../../LyricsRenderer/textUtils';
import SplitLine from '../../LyricsRenderer/SplitLine';
import StandardLine from '../../LyricsRenderer/StandardLine';

// Re-export specific utilities that other parts of the app rely on
export { normalizeTrans } from '../../LyricsRenderer/textUtils';
export { renderFormattedTranslation } from '../../LyricsRenderer/Formatters';

const renderLine = (lineObj, savedNode, isFocused, masterPalette, isPlayingCurrentSong) => {
  const pronString = savedNode?.pronunciation || lineObj?.pronunciation;
  const isRTL = isRTLLanguage(lineObj.text || '');
  let rawTranslation = cleanTranslationText(savedNode?.translation || lineObj?.translation);

  const normalizeForMatch = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]/gu, '')
      .trim();

  const cleanMainText = normalizeForMatch(lineObj?.text);
  const cleanTransText = normalizeForMatch(rawTranslation);
  const displayTranslation = (cleanMainText && cleanMainText === cleanTransText) ? '' : rawTranslation;

  const transClass = isFocused ? 'focused-translation' : 'live-translation';
  const basePronStyle = {
    fontSize: 'var(--dyn-translit-font-size, 0.55em)',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'center',
    marginTop: 'var(--dyn-translit-bottom-padding, 4px)',
    display: 'inline-block',
    whiteSpace: 'nowrap'
  };

  const { parsedChunks, fullTrans } = parsePronunciation(pronString);
  const chars = [];
  let gIdx = 0;
  let originalCpIdx = 0; // Track exact Code Point Index to bridge getGraphemes and Array.from

  // 1. Core Fix: Check the saved database node for the custom spacing string
  const activeSpacingText = savedNode?.spacingText || lineObj?.spacingText || '';
  const useSpacingText = Boolean(activeSpacingText && activeSpacingText.trim());
  const activeDisplayText = useSpacingText ? activeSpacingText : (lineObj.text || '');

  // 2. Safely map segments to the new Spaced Text
  if (useSpacingText) {
    const spacedGraphemes = getGraphemes(activeDisplayText);
    let segmentPointer = 0;
    let charPointerInSegment = 0;
    const segments = lineObj.segments || [];

    spacedGraphemes.forEach(char => {
      const isSpace = /\s/.test(char);
      const cpLen = Array.from(char).length;
      let currentSeg = segments[segmentPointer];

      chars.push({ 
        char, 
        seg: currentSeg, 
        globalIndex: gIdx++, 
        cpStart: originalCpIdx, 
        cpEnd: originalCpIdx + cpLen 
      });

      if (!isSpace) {
        originalCpIdx += cpLen;
        charPointerInSegment += getGraphemes(char).length;
        if (currentSeg && charPointerInSegment >= getGraphemes(currentSeg.text).length) {
          segmentPointer++;
          charPointerInSegment = 0;
        }
      }
    });
  } else {
    // Legacy mapping
    const segments = lineObj.segments || [];
    segments.forEach(seg => {
      const segChars = getGraphemes(seg.text);
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

  const commonProps = {
    lineObj,
    savedNode,
    masterPalette,
    isPlayingCurrentSong,
    chars,
    parsedChunks,
    fullTrans,
    isRTL,
    transClass,
    basePronStyle,
    displayTranslation,
    pronString,
    hasSpacingText: useSpacingText // Injecting new flag
  };

  if (!isFocused && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    return <SplitLine {...commonProps} />;
  }

  return <StandardLine {...commonProps} isFocused={isFocused} />;
};

export const LyricLineWrapper = React.memo(({
  lineObj, savedNode, nextStart, viewMode, handleLineClick, masterPalette, isPlayingCurrentSong
}) => {
  const start = savedNode?.start ?? 'NaN';
  const end = savedNode?.end ?? 'NaN';

  const renderedContent = useMemo(() =>
    renderLine(lineObj, savedNode, viewMode === 'focused', masterPalette, isPlayingCurrentSong),
    [lineObj, savedNode, viewMode, masterPalette, isPlayingCurrentSong]
  );

  return (
    <div
      className={`lyric-line-wrapper ${viewMode === 'focused' ? 'focused-line' : 'preview-line'}`}
      data-start={start}
      data-end={end}
      data-next-start={nextStart}
      onClick={() => handleLineClick(start === 'NaN' ? null : start)}
      style={{ cursor: start !== 'NaN' ? 'pointer' : 'default' }}
    >
      {renderedContent}
    </div>
  );
});