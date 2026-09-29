/* --- src/components/Workspaces/Lyrics/LyricsLineRenderer.jsx --- */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import SplitLine from '../../../../components/LyricsRenderer/SplitLine.jsx';
import StandardLine from '../../../../components/LyricsRenderer/StandardLine.jsx';
import { extractCharsAndSegments } from '../../../../components/LyricsRenderer/LanguageEngines/EngineUtils.jsx';
import { normalizeStructuredPunctuation, toSmartPunctuation } from '../../../../utils/smartPunctuation.js';
import './LyricsLineRenderer.css';

// Re-export formatter utilities from their new centralized locations so the Views don't break
export { normalizeTrans } from '../../../../components/LyricsRenderer/textUtils.js';
export { renderFormattedTranslation } from '../../../../components/LyricsRenderer/LanguageEngines/EngineUtils.jsx';

export const renderLine = (lineObj, savedNode, isFocused, masterPalette, isPlayingCurrentSong) => {
  const displayLine = {
    ...lineObj,
    text: toSmartPunctuation(lineObj.text),
    segments: lineObj.segments?.map(segment => ({
      ...segment,
      text: toSmartPunctuation(segment.text)
    }))
  };
  const displayNode = savedNode ? {
    ...savedNode,
    spacingText: toSmartPunctuation(savedNode.spacingText),
    translation: toSmartPunctuation(savedNode.translation),
    pronunciation: normalizeStructuredPunctuation(savedNode.pronunciation),
    adlibs: savedNode.adlibs?.map(adlib => ({
      ...adlib,
      text: toSmartPunctuation(adlib.text),
      translation: toSmartPunctuation(adlib.translation),
      pronunciation: normalizeStructuredPunctuation(adlib.pronunciation)
    }))
  } : savedNode;
  const { chars, hasSpacingText } = extractCharsAndSegments(displayLine, displayNode);

  const commonProps = {
    lineObj: displayLine,
    savedNode: displayNode,
    masterPalette,
    isPlayingCurrentSong,
    chars,
    lang: savedNode?.lang || lineObj.lang || 'auto',
    translation: savedNode?.translation || lineObj.translation,
    pronunciation: savedNode?.pronunciation || lineObj.pronunciation,
    hasSpacingText
  };

  if (!isFocused && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    return <SplitLine {...commonProps} />;
  }

  return <StandardLine {...commonProps} isFocused={isFocused} />;
};

export const measureFocusedLineLayout = (wrapper) => {
  const tokens = Array.from(wrapper.querySelectorAll('.lyric-word, .trans-word'));
  const rowTops = [...new Set(tokens.map(token => Math.round(token.getBoundingClientRect().top)))]
    .sort((firstTop, secondTop) => firstTop - secondTop);
  wrapper.classList.toggle('has-wrapped-content', rowTops.length > 1);

  tokens.forEach(token => {
    const top = Math.round(token.getBoundingClientRect().top);
    const rowIndex = rowTops.findIndex(rowTop => Math.abs(rowTop - top) <= 6);
    token.style.setProperty('--wrapped-line-index', rowIndex);
  });

  wrapper.querySelectorAll('.inline-cjk-chunk > .pronunciation-text').forEach(pronunciation => {
    const pairedToken = pronunciation.parentElement?.querySelector('.lyric-word, .trans-word');
    if (pairedToken) {
      pronunciation.style.setProperty(
        '--wrapped-line-index',
        pairedToken.style.getPropertyValue('--wrapped-line-index')
      );
    }
  });

  wrapper.style.setProperty('--wrapped-line-count', rowTops.length);
  wrapper.style.setProperty('--focused-wrap-exit-stagger', '0.07s');
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