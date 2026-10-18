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

const pendingTranslationMeasurements = new Set();
const pendingTranslationFinalizations = new Set();
let translationMeasurementFrame = null;
let translationFinalizationFrame = null;

const scheduleTranslationMeasurement = measure => {
  pendingTranslationMeasurements.add(measure);
  if (translationMeasurementFrame !== null) return;

  translationMeasurementFrame = window.requestAnimationFrame(() => {
    translationMeasurementFrame = null;
    const measurements = Array.from(pendingTranslationMeasurements);
    pendingTranslationMeasurements.clear();
    measurements
      .map(measurement => measurement())
      .filter(Boolean)
      .forEach(write => write());
  });
};

const scheduleTranslationFinalization = measure => {
  pendingTranslationFinalizations.add(measure);
  if (translationFinalizationFrame !== null) return;

  translationFinalizationFrame = window.requestAnimationFrame(() => {
    translationFinalizationFrame = null;
    const measurements = Array.from(pendingTranslationFinalizations);
    pendingTranslationFinalizations.clear();
    measurements
      .map(measurement => measurement())
      .filter(Boolean)
      .forEach(write => write());
  });
};

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

    const measureTranslationWidths = () => {
      if (cancelled || !wrapper.isConnected) return null;
      const translations = wrapper.querySelectorAll(viewMode === 'focused'
        ? '.chunk-translation.focused-translation'
        : '.chunk-translation.live-translation');
      const scaleX = wrapper.offsetWidth
        ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
        : 1;
      const updates = [];

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
        updates.push({
          translation,
          parent,
          width,
          nextWidth: `${Math.floor(width)}px`,
          center: (widestLine.left + widestLine.right) / 2,
          gap: viewMode === 'live'
            ? parseFloat(getComputedStyle(translation).getPropertyValue('--dyn-trans-top-padding')) || 0
            : 0
        });
      });

      return () => {
        if (cancelled) return;
        updates.forEach(({ translation, nextWidth }) => {
          if (translation.style.width !== nextWidth) {
            translation.style.width = nextWidth;
          }
          if (viewMode === 'focused' && translation.style.minWidth !== '0px') {
            translation.style.minWidth = '0px';
          }
        });

        if (viewMode !== 'live' || updates.length === 0) return;
        scheduleTranslationFinalization(() => {
          if (cancelled) return null;
          const finalized = updates
            .filter(({ translation, parent }) => translation.isConnected && parent.isConnected)
            .map(({ translation, parent, width, center, gap }) => ({
              translation,
              parent,
              width,
              center,
              gap,
              height: translation.offsetHeight,
              parentLeft: parent.getBoundingClientRect().left,
              parentClientLeft: parent.clientLeft
            }));

          return () => finalized.forEach(({
            translation,
            parent,
            width,
            center,
            gap,
            height,
            parentLeft,
            parentClientLeft
          }) => {
            const nextPadding = `${height + gap}px`;
            if (parent.style.paddingTop !== nextPadding) {
              parent.style.paddingTop = nextPadding;
            }

            const left = (center - parentLeft) / scaleX - parentClientLeft - width / 2;
            const nextLeft = `${left}px`;
            if (translation.style.left !== nextLeft) {
              translation.style.left = nextLeft;
            }
          });
        });
      };
    };

    let cancelled = false;
    let layoutStarted = false;
    let updateFrame = null;
    let intersectionObserver = null;
    let resizeObserver = null;
    const startLayoutTracking = () => {
      if (cancelled || layoutStarted) return;
      layoutStarted = true;
      scheduleTranslationMeasurement(measureTranslationWidths);

      const getTypographySignature = () => {
        const style = getComputedStyle(wrapper);
        return [
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.letterSpacing,
          style.lineHeight,
          style.wordSpacing
        ].join('|');
      };
      const observedWidths = new WeakMap();
      let previousTypography = getTypographySignature();
      resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(entries => {
          let contentWidthChanged = false;
          entries.forEach(entry => {
            const width = entry.contentRect.width;
            const previousWidth = observedWidths.get(entry.target);
            observedWidths.set(entry.target, width);
            if (previousWidth === undefined || Math.abs(width - previousWidth) > 0.5) {
              contentWidthChanged = true;
            }
          });
          const typography = getTypographySignature();
          const layoutChanged = contentWidthChanged || typography !== previousTypography;
          previousTypography = typography;
          if (layoutChanged) scheduleTranslationWidthUpdate();
        });
      const layoutInputs = [
        wrapper,
        ...wrapper.querySelectorAll('.core-chunks, .pronunciation-text')
      ];
      layoutInputs.forEach(element => {
        observedWidths.set(element, element.getBoundingClientRect().width);
        resizeObserver?.observe(element);
      });

      document.fonts?.ready.then(() => {
        if (!cancelled) scheduleTranslationWidthUpdate();
      });
    };
    const scheduleTranslationWidthUpdate = () => {
      if (updateFrame !== null) return;
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = null;
        scheduleTranslationMeasurement(measureTranslationWidths);
      });
    };

    if (viewMode === 'live' && typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          intersectionObserver?.disconnect();
          startLayoutTracking();
        }
      }, {
        rootMargin: '120px 0px'
      });
      intersectionObserver.observe(wrapper);
    } else {
      startLayoutTracking();
    }

    return () => {
      cancelled = true;
      intersectionObserver?.disconnect();
      if (updateFrame !== null) window.cancelAnimationFrame(updateFrame);
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