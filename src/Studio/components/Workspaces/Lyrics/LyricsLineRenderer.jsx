/* --- src/components/Workspaces/Lyrics/LyricsLineRenderer.jsx --- */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import SplitLine from '../../../../components/LyricsRenderer/SplitLine.jsx';
import StandardLine from '../../../../components/LyricsRenderer/StandardLine.jsx';
import { extractCharsAndSegments } from '../../../../components/LyricsRenderer/LanguageEngines/EngineUtils.jsx';
import { normalizeStructuredPunctuation, toSmartPunctuation } from '../../../../utils/smartPunctuation.js';
import { stripPronunciationParentheses } from '../../../../components/LyricsRenderer/textUtils.js';
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
  {
    excludeAdlibs = false,
    preserveText = false,
    focusedMainLyrics = false,
    isAdlib = false
  } = {}
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
    translation: isAdlib
      ? stripPronunciationParentheses(savedNode?.translation || lineObj.translation)
      : savedNode?.translation || lineObj.translation,
    pronunciation: savedNode?.pronunciation || lineObj.pronunciation,
    hasSpacingText,
    useTranslationFormatting: preserveText,
    focusedMainLyrics
  };

  if (!isFocused && !excludeAdlibs && savedNode?.isSplit && savedNode?.adlibs?.length > 0) {
    return <SplitLine {...commonProps} />;
  }

  return (
    <StandardLine
      {...commonProps}
      isFocused={isFocused}
      excludeAdlibs={excludeAdlibs}
      isAdlib={isAdlib}
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
      { focusedMainLyrics: viewMode === 'live' }
    ),
    [lineObj, savedNode, viewMode, masterPalette, isPlayingCurrentSong]
  );

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || (viewMode !== 'focused' && viewMode !== 'live')) return undefined;

    const measureWidestLine = element => {
      if (!element) return null;
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
      return lines.reduce((widest, line) => (
        !widest || line.right - line.left > widest.right - widest.left
          ? line
          : widest
      ), null);
    };

    const updateTranslationWidths = () => {
      const translations = wrapper.querySelectorAll(viewMode === 'focused'
        ? '.chunk-translation.focused-translation'
        : '.chunk-translation.live-translation');
      const scaleX = wrapper.offsetWidth
        ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
        : 1;

      translations.forEach(translation => {
        const parent = translation.parentElement;
        if (!parent) return;

        const glyphLine = measureWidestLine(
          parent.querySelector('.main-lyrics-layer, .primary-text')
        );
        const pronunciationLine = measureWidestLine(
          parent.querySelector('.pronunciation-text')
        );
        const widestLine = !glyphLine ||
          (pronunciationLine &&
            pronunciationLine.right - pronunciationLine.left >
              glyphLine.right - glyphLine.left)
          ? pronunciationLine
          : glyphLine;
        if (!widestLine) return;

        const width = (widestLine.right - widestLine.left) / scaleX;
        const nextWidth = `${Math.floor(width)}px`;
        if (translation.style.width !== nextWidth) {
          translation.style.width = nextWidth;
        }

        if (viewMode === 'focused') {
          if (translation.style.minWidth !== '0px') {
            translation.style.minWidth = '0px';
          }
          return;
        }

        const translationHeight = translation.offsetHeight;
        const gapValue = parseFloat(
          getComputedStyle(translation).getPropertyValue('--dyn-trans-top-padding')
        );
        const gap = Number.isFinite(gapValue) ? gapValue : 0;
        const nextPadding = `${translationHeight + gap}px`;
        if (parent.style.paddingTop !== nextPadding) {
          parent.style.paddingTop = nextPadding;
        }

        const parentLeft = parent.getBoundingClientRect().left;
        const left = (
          (widestLine.left + widestLine.right) / 2 - parentLeft
        ) / scaleX - parent.clientLeft - width / 2;
        const nextLeft = `${left}px`;
        if (translation.style.left !== nextLeft) {
          translation.style.left = nextLeft;
        }
      });
    };

    updateTranslationWidths();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateTranslationWidths);
    resizeObserver?.observe(wrapper);
    wrapper.querySelectorAll(
      '.main-lyrics-layer, .primary-text, .pronunciation-text, .chunk-translation'
    )
      .forEach(element => resizeObserver?.observe(element));

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) updateTranslationWidths();
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