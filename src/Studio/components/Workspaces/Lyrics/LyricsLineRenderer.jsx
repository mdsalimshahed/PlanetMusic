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
  lineObj,
  savedNode,
  nextStart,
  viewMode,
  handleLineClick,
  masterPalette,
  isPlayingCurrentSong,
  lineIndex,
  onLiveLayoutReady
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
      if (!element || !element.textContent.trim()) return null;
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = [];
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
      return lines.reduce((widest, line) => (
        !widest || line.right - line.left > widest.right - widest.left
          ? line
          : widest
      ), null);
    };

    const getGlyphRows = element => {
      if (!element) return [];
      const rows = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: textNode => (
          textNode.parentElement?.closest('.pronunciation-text')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT
        )
      });
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (!textNode.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        [...range.getClientRects()].forEach(rect => {
          if (!rect.width || !rect.height) return;
          const row = rows.find(candidate => (
            Math.min(candidate.bottom, rect.bottom) -
              Math.max(candidate.top, rect.top) >
            Math.min(candidate.bottom - candidate.top, rect.height) * 0.5
          ));
          if (row) {
            row.left = Math.min(row.left, rect.left);
            row.right = Math.max(row.right, rect.right);
            row.top = Math.min(row.top, rect.top);
            row.bottom = Math.max(row.bottom, rect.bottom);
          } else {
            rows.push({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom
            });
          }
        });
      }
      return rows.sort((first, second) => first.top - second.top);
    };

    if (viewMode === 'live') {
      let cancelled = false;
      let updateFrame = null;
      let resizeObserver = null;
      let initialLayoutReady = false;
      const measureLiveTranslations = () => {
        if (cancelled || !wrapper.isConnected) return;
        const adlibNodes = wrapper.querySelectorAll('.live-split-line > .adlib-node');
        adlibNodes.forEach(adlib => {
          adlib.classList.remove('is-adlib-wrapped');
          adlib.classList.remove('is-adlib-new-row');
          adlib.classList.remove('is-adlib-inline-after-wrapped-main');
          adlib.style.removeProperty('--live-adlib-glyph-offset-y');
          adlib.style.removeProperty('--live-adlib-inline-x');
          adlib.style.removeProperty('--live-adlib-inline-y');
        });

        const scaleX = wrapper.offsetWidth
          ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
          : 1;
        const scaleY = wrapper.offsetHeight
          ? wrapper.getBoundingClientRect().height / wrapper.offsetHeight
          : 1;
        const mainGlyphs = wrapper.querySelector('.core-chunks > .main-lyrics-layer');
        const mainGlyphRows = getGlyphRows(mainGlyphs);
        const splitLine = wrapper.querySelector('.live-split-line');
        splitLine?.classList.toggle('is-main-wrapped', mainGlyphRows.length > 1);
        const splitLineBounds = splitLine?.getBoundingClientRect();
        const direction = mainGlyphs ? getComputedStyle(mainGlyphs).direction : 'ltr';
        const lastMainRow = mainGlyphRows[mainGlyphRows.length - 1];
        const adlibMeasurements = Array.from(adlibNodes, adlib => {
          const glyphs = adlib.querySelector(':scope > .primary-text');
          return {
            adlib,
            glyphRows: getGlyphRows(glyphs),
            bounds: adlib.getBoundingClientRect(),
            hasSecondary: Boolean(
              adlib.querySelector('.adlib-live-translation, .pronunciation-text')
            )
          };
        });
        let previousGlyphRows = mainGlyphRows;
        let wrappedMainInlineCursor = direction === 'rtl'
          ? lastMainRow?.left
          : lastMainRow?.right;

        adlibMeasurements.forEach(({ adlib, glyphRows: adlibGlyphRows, bounds, hasSecondary }) => {
          adlib.classList.toggle(
            'has-secondary',
            hasSecondary
          );

          const mainWrappedInlineCandidate = mainGlyphRows.length > 1 &&
            !hasSecondary &&
            lastMainRow &&
            splitLineBounds &&
            wrappedMainInlineCursor !== undefined;
          if (mainWrappedInlineCandidate) {
            const margin = parseFloat(getComputedStyle(adlib).marginInlineStart) * scaleX;
            const inlineLeft = direction === 'rtl'
              ? wrappedMainInlineCursor - margin - bounds.width
              : wrappedMainInlineCursor + margin;
            const inlineRight = inlineLeft + bounds.width;
            const fitsBesideLastMainRow = direction === 'rtl'
              ? inlineLeft >= splitLineBounds.left
              : inlineRight <= splitLineBounds.right;

            if (fitsBesideLastMainRow) {
              const glyphRow = adlibGlyphRows[0];
              adlib.classList.remove('is-adlib-new-row', 'is-adlib-wrapped');
              adlib.classList.add('is-adlib-inline-after-wrapped-main');
              adlib.style.removeProperty('--live-adlib-glyph-offset-y');
              adlib.style.setProperty(
                '--live-adlib-inline-x',
                `${(direction === 'rtl'
                  ? inlineRight - splitLineBounds.left
                  : inlineLeft - splitLineBounds.left) / scaleX}px`
              );
              adlib.style.setProperty(
                '--live-adlib-inline-y',
                `${(lastMainRow.bottom - (glyphRow.bottom - glyphRow.top) -
                  (glyphRow.top - bounds.top) - splitLineBounds.top) / scaleY}px`
              );
              wrappedMainInlineCursor = direction === 'rtl'
                ? inlineLeft
                : inlineRight;
              return;
            }
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
            wrappedMainInlineCursor = undefined;
          } else {
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
          }

          const previousRow = previousGlyphRows[previousGlyphRows.length - 1];
          const firstAdlibRow = adlibGlyphRows[0];
          const rowsOverlap = previousRow && firstAdlibRow &&
            firstAdlibRow.top < previousRow.bottom &&
            firstAdlibRow.bottom > previousRow.top;
          const isAfterPreviousRow = previousRow && firstAdlibRow && (
            direction === 'rtl'
              ? firstAdlibRow.right <= previousRow.left
              : firstAdlibRow.left >= previousRow.right
          );
          const isInlineWithPreviousRow = rowsOverlap && isAfterPreviousRow;
          const mustMoveToOwnRow = adlib.classList.contains('has-secondary') &&
            (mainGlyphRows.length > 1 || !isInlineWithPreviousRow);
          adlib.classList.toggle('is-adlib-wrapped', mustMoveToOwnRow);
          adlib.classList.toggle(
            'is-adlib-new-row',
            !isInlineWithPreviousRow || mustMoveToOwnRow
          );

          if (!isInlineWithPreviousRow || mustMoveToOwnRow) {
            adlib.style.removeProperty('--live-adlib-glyph-offset-y');
            previousGlyphRows = adlibGlyphRows;
            return;
          }

          const previousOffset = parseFloat(
            adlib.style.getPropertyValue('--live-adlib-glyph-offset-y')
          ) || 0;
          const adlibGlyphBottom = adlibGlyphRows.reduce(
            (bottom, row) => Math.max(bottom, row.bottom),
            -Infinity
          ) - previousOffset * scaleX;

          if (Number.isFinite(adlibGlyphBottom) && previousRow) {
            adlib.style.setProperty(
              '--live-adlib-glyph-offset-y',
              `${(previousRow.bottom - adlibGlyphBottom) / scaleX}px`
            );
          }
          previousGlyphRows = adlibGlyphRows;
        });

        wrapper.querySelectorAll('.chunk-translation.live-translation').forEach(translation => {
          const parent = translation.parentElement;
          const isWrappedAdlibTranslation = translation.classList.contains('adlib-live-translation') &&
            parent?.classList.contains('is-adlib-wrapped');
          const glyphs = translation.classList.contains('main-live-translation')
            ? wrapper.querySelector('.core-chunks > .main-lyrics-layer')
            : parent?.querySelector(':scope > .primary-text');
          if (!parent || !glyphs) return;

          const widestLine = measureWidestLine(glyphs);
          if (!widestLine) return;

          const width = (widestLine.right - widestLine.left) / scaleX;
          if (isWrappedAdlibTranslation) {
            translation.style.width = `${Math.max(1, Math.floor(width))}px`;
            translation.style.removeProperty('--live-translation-offset-x');
            translation.style.removeProperty('--live-translation-offset-y');
            return;
          }

          const parentBounds = parent.getBoundingClientRect();
          const center = (widestLine.left + widestLine.right) / 2;
          const offset = translation.classList.contains('main-live-translation')
            ? (center - parentBounds.left) / scaleX - width / 2
            : (center - parentBounds.left) / scaleX - parent.offsetWidth / 2;
          translation.style.width = `${Math.max(1, Math.floor(width))}px`;
          translation.style.setProperty('--live-translation-offset-y', '0px');
          translation.style.setProperty('--live-translation-offset-x', `${offset}px`);
          const translationBounds = translation.getBoundingClientRect();
          const desiredGap = (parseFloat(getComputedStyle(translation).marginBottom) || 0) * scaleX;
          const verticalOffset = glyphs.getBoundingClientRect().top -
            translationBounds.bottom - desiredGap;
          translation.style.setProperty('--live-translation-offset-y', `${verticalOffset / scaleX}px`);
        });

        if (!initialLayoutReady) {
          initialLayoutReady = true;
          onLiveLayoutReady?.(lineIndex);
        }
      };
      const scheduleTranslationUpdate = () => {
        if (updateFrame !== null) return;
        updateFrame = window.requestAnimationFrame(() => {
          updateFrame = null;
          measureLiveTranslations();
        });
      };

      resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(scheduleTranslationUpdate);
      [wrapper, ...wrapper.querySelectorAll('.main-lyrics-layer, .primary-text')]
        .forEach(element => resizeObserver?.observe(element));

      if (document.fonts?.status === 'loaded') {
        measureLiveTranslations();
      } else if (document.fonts) {
        document.fonts.ready.then(() => {
          if (!cancelled) scheduleTranslationUpdate();
        });
      } else {
        measureLiveTranslations();
      }

      return () => {
        cancelled = true;
        if (updateFrame !== null) window.cancelAnimationFrame(updateFrame);
        resizeObserver?.disconnect();
      };
    }

    const measureFocusedTranslationWidths = () => {
      if (cancelled || !wrapper.isConnected) return;
      const translations = wrapper.querySelectorAll('.chunk-translation.focused-translation');
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
        translation.style.width = `${Math.floor(width)}px`;
        translation.style.minWidth = '0px';
      });
    };

    let cancelled = false;
    let updateFrame = null;
    let resizeObserver = null;
    const scheduleTranslationWidthUpdate = () => {
      if (updateFrame !== null) return;
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = null;
        measureFocusedTranslationWidths();
      });
    };
    measureFocusedTranslationWidths();
    resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleTranslationWidthUpdate);
    [
      wrapper,
      ...wrapper.querySelectorAll('.core-chunks, .pronunciation-text')
    ].forEach(element => resizeObserver?.observe(element));
    document.fonts?.ready.then(() => {
      if (!cancelled) scheduleTranslationWidthUpdate();
    });

    return () => {
      cancelled = true;
      if (updateFrame !== null) window.cancelAnimationFrame(updateFrame);
      resizeObserver?.disconnect();
    };
  }, [lineIndex, onLiveLayoutReady, renderedContent, viewMode]);

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