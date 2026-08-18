/* --- src/components/Workspaces/Lyrics/LyricsLineRenderer.jsx --- */
import React, { useMemo } from 'react';
import SplitLine from '../../LyricsRenderer/SplitLine';
import StandardLine from '../../LyricsRenderer/StandardLine';
import { extractCharsAndSegments } from '../../LyricsRenderer/LanguageEngines/EngineUtils';
import './LyricsLineRenderer.css';

// Re-export formatter utilities from their new centralized locations so the Views don't break
export { normalizeTrans } from '../../LyricsRenderer/textUtils';
export { renderFormattedTranslation } from '../../LyricsRenderer/LanguageEngines/EngineUtils';

export const renderLine = (lineObj, savedNode, isFocused, masterPalette, isPlayingCurrentSong) => {
  const { chars, hasSpacingText } = extractCharsAndSegments(lineObj, savedNode);

  const commonProps = {
    lineObj,
    savedNode,
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