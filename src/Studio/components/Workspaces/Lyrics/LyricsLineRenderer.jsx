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

export const renderLine = (
  lineObj,
  savedNode,
  isFocused,
  masterPalette,
  isPlayingCurrentSong,
  { excludeAdlibs = false, preserveText = false } = {}
) => {
  const displayLine = preserveText ? lineObj : {
    ...lineObj,
    text: toSmartPunctuation(lineObj.text),
    segments: lineObj.segments?.map(segment => ({
      ...segment,
      text: toSmartPunctuation(segment.text)
    }))
  };
  const displayNode = savedNode
    ? preserveText
      ? savedNode
      : {
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
      }
    : savedNode;
  const { chars, hasSpacingText } = extractCharsAndSegments(
    displayLine,
    displayNode,
    { useParsedSegments: preserveText }
  );

  const commonProps = {
    lineObj: displayLine,
    savedNode: displayNode,
    masterPalette,
    isPlayingCurrentSong,
    chars,
    lang: savedNode?.lang || lineObj.lang || 'auto',
    translation: savedNode?.translation || lineObj.translation,
    pronunciation: savedNode?.pronunciation || lineObj.pronunciation,
    hasSpacingText,
    useTranslationFormatting: preserveText
  };

  if (!isFocused && !excludeAdlibs && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    return <SplitLine {...commonProps} />;
  }

  return (
    <StandardLine
      {...commonProps}
      isFocused={isFocused}
      excludeAdlibs={excludeAdlibs}
    />
  );
};

export const measureFocusedLineLayout = (wrapper) => {
  const tokenPositions = Array.from(wrapper.querySelectorAll('.lyric-word, .trans-word'))
    .map(token => {
      let top = 0;
      let element = token;
      while (element && element !== wrapper) {
        top += element.offsetTop;
        element = element.offsetParent;
      }
      return { token, top };
    })
    .sort((first, second) => first.top - second.top);
  let rowIndex = -1;
  let rowTop = null;

  tokenPositions.forEach(({ token, top }) => {
    if (rowTop === null || Math.abs(rowTop - top) > 6) {
      rowIndex++;
      rowTop = top;
    }
    token.style.setProperty('--wrapped-line-index', rowIndex);
  });
  wrapper.classList.toggle('has-wrapped-content', rowIndex > 0);

  wrapper.querySelectorAll('.inline-cjk-chunk > .pronunciation-text').forEach(pronunciation => {
    const pairedToken = pronunciation.parentElement?.querySelector('.lyric-word, .trans-word');
    if (pairedToken) {
      pronunciation.style.setProperty(
        '--wrapped-line-index',
        pairedToken.style.getPropertyValue('--wrapped-line-index')
      );
    }
  });

  const rowCount = rowIndex + 1;
  wrapper.querySelectorAll('.pronunciation-text').forEach(pronunciation => {
    if (!pronunciation.parentElement?.classList.contains('inline-cjk-chunk')) {
      pronunciation.style.setProperty('--wrapped-line-index', rowCount);
    }
  });

  wrapper.style.setProperty('--wrapped-line-count', rowCount);
  const exitDuration = parseFloat(wrapper.style.getPropertyValue('--focused-exit-duration')) || 0;
  const exitLayerDuration = parseFloat(wrapper.style.getPropertyValue('--focused-exit-layer-duration')) || 0;
  wrapper.style.setProperty(
    '--focused-wrap-exit-stagger',
    `${rowCount > 0 ? Math.max(0, exitDuration - exitLayerDuration) / rowCount : 0}s`
  );
};

export const LyricLineWrapper = React.memo(({
  lineObj, savedNode, nextStart, viewMode, handleLineClick, masterPalette, isPlayingCurrentSong
}) => {
  const wrapperRef = useRef(null);
  const start = savedNode?.start ?? 'NaN';
  const end = savedNode?.end ?? 'NaN';

  const renderedContent = useMemo(() =>
    renderLine(
      lineObj,
      savedNode,
      viewMode === 'focused',
      masterPalette,
      isPlayingCurrentSong,
      { preserveText: viewMode === 'live' }
    ),
    [lineObj, savedNode, viewMode, masterPalette, isPlayingCurrentSong]
  );

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || viewMode !== 'focused') return undefined;

    const measureMaxLineWidth = element => {
      if (!element) return 0;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const lines = [];
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        [...range.getClientRects()].forEach(rect => {
          if (!rect.width || !rect.height) return;
          const line = lines.find(candidate => (
            Math.min(candidate.bottom, rect.bottom) -
              Math.max(candidate.top, rect.top) >
            Math.min(candidate.bottom - candidate.top, rect.height) * 0.5
          ));
          if (line) {
            line.left = Math.min(line.left, rect.left);
            line.right = Math.max(line.right, rect.right);
            line.top = Math.min(line.top, rect.top);
            line.bottom = Math.max(line.bottom, rect.bottom);
          } else {
            lines.push({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom
            });
          }
        });
      }
      return lines.reduce(
        (widest, line) => Math.max(widest, line.right - line.left),
        0
      );
    };

    const updateTranslationWidth = () => {
      const core = wrapper.querySelector('.core-chunks');
      const translation = core?.querySelector('.chunk-translation.focused-translation');
      if (!core || !translation) return;

      const glyphWidth = Math.max(
        measureMaxLineWidth(core.querySelector('.main-lyrics-layer')),
        measureMaxLineWidth(core.querySelector('.pronunciation-text'))
      );
      if (!glyphWidth) return;
      const nextWidth = `${Math.floor(glyphWidth)}px`;
      if (translation.style.width !== nextWidth) {
        translation.style.width = nextWidth;
      }
      if (translation.style.minWidth !== '0px') {
        translation.style.minWidth = '0px';
      }
    };

    updateTranslationWidth();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateTranslationWidth);
    resizeObserver?.observe(wrapper);
    wrapper.querySelectorAll('.main-lyrics-layer, .pronunciation-text')
      .forEach(element => resizeObserver?.observe(element));

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) updateTranslationWidth();
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [renderedContent, viewMode]);

  return (
    <div
      ref={wrapperRef}
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