/* --- src/components/Workspaces/Lyrics/LyricsLineRenderer.jsx --- */
import React, { useMemo } from 'react';
import { getGraphemes, cleanTranslationText, isRTLLanguage, parsePronunciation } from '../../LyricsRenderer/textUtils';
import SplitLine from '../../LyricsRenderer/SplitLine';
import StandardLine from '../../LyricsRenderer/StandardLine';

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
  let originalCpIdx = 0; 

  const activeSpacingText = savedNode?.spacingText || lineObj?.spacingText || '';
  const useSpacingText = Boolean(activeSpacingText && activeSpacingText.trim());
  const activeDisplayText = useSpacingText ? activeSpacingText : (lineObj.text || '');

  // EXACT DUAL-POINTER MATCHING ALGORITHM
  if (useSpacingText) {
    const spacedGraphemes = getGraphemes(activeDisplayText);
    const origGraphemes = getGraphemes(lineObj.text || '');
    
    let origPointer = 0;
    let segmentPointer = 0;
    let charPointerInSegment = 0;
    let currentCpStart = 0;
    const segments = lineObj.segments || [];

    spacedGraphemes.forEach(char => {
      let currentSeg = segments[segmentPointer];
      let isOrigChar = false;

      if (origPointer < origGraphemes.length && char === origGraphemes[origPointer]) {
        isOrigChar = true;
      } else if (/\s/.test(char) && origPointer < origGraphemes.length && !/\s/.test(origGraphemes[origPointer])) {
        // Space injected by auto-spacing
        isOrigChar = false;
      } else {
        // Failsafe fallback
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
    hasSpacingText: useSpacingText 
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