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

const LIVE_LAYOUT_BATCH_SIZE = 2;
const LIVE_LAYOUT_FRAME_BUDGET_MS = 5;
const pendingLiveLayoutMeasurements = new Set();
const liveLayoutResizeMeasurements = new Set();
let liveLayoutMeasurementFrame = null;
let liveLayoutResizeListenerAttached = false;

const handleLiveLayoutResize = () => {
  liveLayoutResizeMeasurements.forEach(schedule => schedule());
};

const registerLiveLayoutResizeMeasurement = schedule => {
  liveLayoutResizeMeasurements.add(schedule);
  if (!liveLayoutResizeListenerAttached) {
    window.addEventListener('resize', handleLiveLayoutResize);
    liveLayoutResizeListenerAttached = true;
  }

  return () => {
    liveLayoutResizeMeasurements.delete(schedule);
    if (liveLayoutResizeMeasurements.size === 0 && liveLayoutResizeListenerAttached) {
      window.removeEventListener('resize', handleLiveLayoutResize);
      liveLayoutResizeListenerAttached = false;
    }
  };
};

const flushLiveLayoutMeasurements = () => {
  liveLayoutMeasurementFrame = null;
  const batch = Array.from(pendingLiveLayoutMeasurements)
    .slice(0, LIVE_LAYOUT_BATCH_SIZE);
  const deadline = performance.now() + LIVE_LAYOUT_FRAME_BUDGET_MS;
  batch.forEach((measure, index) => {
    if (index > 0 && performance.now() >= deadline) {
      pendingLiveLayoutMeasurements.add(measure);
      return;
    }
    pendingLiveLayoutMeasurements.delete(measure);
    measure();
  });

  if (pendingLiveLayoutMeasurements.size > 0) {
    liveLayoutMeasurementFrame = window.requestAnimationFrame(
      flushLiveLayoutMeasurements
    );
  }
};

const queueLiveLayoutMeasurement = measure => {
  pendingLiveLayoutMeasurements.add(measure);
  if (liveLayoutMeasurementFrame === null) {
    liveLayoutMeasurementFrame = window.requestAnimationFrame(
      flushLiveLayoutMeasurements
    );
  }
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
  lineObj,
  savedNode,
  nextStart,
  viewMode,
  handleLineClick,
  masterPalette,
  isPlayingCurrentSong,
  lineIndex,
  isSongModalReady = true,
  onLiveLayoutReady
}) => {
  const wrapperRef = useRef(null);
  const start = savedNode?.start ?? 'NaN';
  const end = savedNode?.end ?? 'NaN';
  const renderPlaybackState = viewMode === 'live' ? false : isPlayingCurrentSong;

  const renderedContent = useMemo(() =>
    renderLine(
      lineObj,
      savedNode,
      viewMode === 'focused',
      masterPalette,
      renderPlaybackState,
      { focusedMainLyrics: viewMode === 'live' }
    ),
    [lineObj, savedNode, viewMode, masterPalette, renderPlaybackState]
  );

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || (viewMode !== 'focused' && viewMode !== 'live')) return undefined;
    if (viewMode === 'live' && !isSongModalReady) return undefined;

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

    const getTextRects = element => {
      if (!element || !element.textContent.trim()) return [];
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()]
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        }));
    };

    if (viewMode === 'live') {
      let cancelled = false;
      let queuedMeasurement = null;
      let measurementQueued = false;
      let observedWidth = wrapper.getBoundingClientRect().width;
      let resizeObserver = null;
      const previousSibling = wrapper.previousElementSibling;
      const nextSibling = wrapper.nextElementSibling;
      const previousLineWrapper = previousSibling?.classList.contains('lyric-line-wrapper')
        ? previousSibling
        : null;
      const neighboringLineWrappers = [
        previousLineWrapper,
        nextSibling?.classList.contains('lyric-line-wrapper') ? nextSibling : null
      ].filter(Boolean);
      const measureLiveTranslations = () => {
        if (cancelled || !wrapper.isConnected) return;
        const adlibNodes = wrapper.querySelectorAll('.live-split-line > .adlib-node');
        const coreChunks = wrapper.querySelector('.core-chunks');
        const splitLine = wrapper.querySelector('.live-split-line');
        const mainTranslation = wrapper.querySelector('.main-live-translation');

        if (adlibNodes.length === 0 && !mainTranslation) {
          onLiveLayoutReady?.(lineIndex);
          return;
        }
        coreChunks?.classList.remove('is-main-shifted-for-pronounced-foreign-adlib');
        coreChunks?.style.removeProperty('--live-main-foreign-adlib-offset-y');
        splitLine?.classList.remove('is-main-shifted-for-pronounced-foreign-adlib');
        splitLine?.style.removeProperty('--live-main-foreign-adlib-offset-y');
        splitLine?.style.removeProperty('--live-adlib-neighbor-clearance');
        adlibNodes.forEach(adlib => {
          adlib.classList.remove('is-adlib-wrapped');
          adlib.classList.remove('is-adlib-new-row');
          adlib.classList.remove('is-adlib-inline-after-wrapped-main');
          adlib.classList.remove('is-english-adlib-on-foreign-line');
          adlib.style.removeProperty('--live-adlib-glyph-offset-y');
          adlib.style.removeProperty('--live-adlib-inline-x');
          adlib.style.removeProperty('--live-adlib-inline-y');
          adlib.style.removeProperty('--live-adlib-neighbor-clearance-start');
          adlib.style.removeProperty('--live-adlib-collision-gap');
          const translation = adlib.querySelector(':scope > .adlib-live-translation');
          translation?.style.removeProperty('--live-translation-offset-x');
          translation?.style.removeProperty('--live-translation-offset-y');
        });

        if (adlibNodes.length === 0) {
          const scaleX = wrapper.offsetWidth
            ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
            : 1;
          const scaleY = wrapper.offsetHeight
            ? wrapper.getBoundingClientRect().height / wrapper.offsetHeight
            : 1;
          const translation = mainTranslation;
          const glyphs = wrapper.querySelector('.core-chunks > .main-lyrics-layer');
          if (translation && glyphs) {
            const widestLine = measureWidestLine(glyphs);
            if (widestLine) {
              const width = (widestLine.right - widestLine.left) / scaleX;
              const parentBounds = translation.parentElement.getBoundingClientRect();
              const center = (widestLine.left + widestLine.right) / 2;
              translation.style.width = `${Math.max(1, Math.floor(width))}px`;
              translation.style.setProperty(
                '--live-translation-offset-x',
                `${(center - parentBounds.left) / scaleX - width / 2}px`
              );
              translation.style.setProperty('--live-translation-offset-y', '0px');
              const translationBounds = translation.getBoundingClientRect();
              const desiredGap = (
                parseFloat(getComputedStyle(translation).marginBottom) || 0
              ) * scaleY;
              translation.style.setProperty(
                '--live-translation-offset-y',
                `${(
                  glyphs.getBoundingClientRect().top -
                  translationBounds.bottom -
                  desiredGap
                ) / scaleY}px`
              );
            }
          }

          onLiveLayoutReady?.(lineIndex);
          return;
        }

        const scaleX = wrapper.offsetWidth
          ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
          : 1;
        const scaleY = wrapper.offsetHeight
          ? wrapper.getBoundingClientRect().height / wrapper.offsetHeight
          : 1;
        const mainGlyphs = wrapper.querySelector('.core-chunks > .main-lyrics-layer');
        const mainHasPronunciation = Boolean(
          coreChunks?.querySelector('.pronunciation-text')
        );
        let mainGlyphRows = getGlyphRows(mainGlyphs);
        splitLine?.classList.toggle('is-main-wrapped', mainGlyphRows.length > 1);
        let splitLineBounds = splitLine?.getBoundingClientRect();
        const direction = mainGlyphs ? getComputedStyle(mainGlyphs).direction : 'ltr';
        let lastMainRow = mainGlyphRows[mainGlyphRows.length - 1];
        let hasForeignPronunciation = false;
        let hasOnlyPronouncedForeignGlyphs = Boolean(mainGlyphs);
        if (mainGlyphs) {
          const walker = document.createTreeWalker(mainGlyphs, NodeFilter.SHOW_TEXT, {
            acceptNode: textNode => (
              textNode.parentElement?.closest('.pronunciation-text')
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT
            )
          });
          let textNode;
          while ((textNode = walker.nextNode())) {
            const meaningfulText = textNode.textContent.replace(/[^\p{L}\p{N}]/gu, '');
            if (!meaningfulText) continue;
            const foreignChunk = textNode.parentElement?.closest('.inline-cjk-chunk');
            if (!foreignChunk?.querySelector('.pronunciation-text')) {
              hasOnlyPronouncedForeignGlyphs = false;
              break;
            }
            hasForeignPronunciation = true;
          }
        }
        const isFullyPronouncedForeignLine =
          hasOnlyPronouncedForeignGlyphs && hasForeignPronunciation;
        const adlibMeasurements = Array.from(adlibNodes, adlib => {
          const glyphs = adlib.querySelector(':scope > .primary-text');
          const glyphText = glyphs?.textContent || '';
          const meaningfulGlyphText = glyphText.replace(/[^\p{L}\p{N}]/gu, '');
          const isForeignScript = meaningfulGlyphText.length > 0 &&
            !/^\p{Script=Latin}+$/u.test(meaningfulGlyphText);
          const isEnglishAdlib = /\p{Script=Latin}/u.test(glyphText) &&
            /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]*$/u.test(glyphText);
          return {
            adlib,
            glyphRows: getGlyphRows(glyphs),
            bounds: adlib.getBoundingClientRect(),
            hasSecondary: Boolean(
              adlib.querySelector('.adlib-live-translation, .pronunciation-text')
            ),
            needsForeignLineOffset: isFullyPronouncedForeignLine && isEnglishAdlib,
            needsMainLineOffset: !mainHasPronunciation &&
              isForeignScript &&
              Boolean(adlib.querySelector('.pronunciation-text'))
          };
        });
        const getAdlibStructureRects = adlib => {
          const adlibTransform = getComputedStyle(adlib).transform;
          const adlibAnimationOffset = adlibTransform === 'none'
            ? 0
            : new DOMMatrixReadOnly(adlibTransform).m42;
          const pronunciation = adlib.querySelector(':scope > .pronunciation-text');
          const pronunciationTransform = pronunciation
            ? getComputedStyle(pronunciation).transform
            : 'none';
          const pronunciationAnimationOffset = pronunciationTransform === 'none'
            ? 0
            : new DOMMatrixReadOnly(pronunciationTransform).m42;
          const structureElements = [
            {
              element: adlib.querySelector(':scope > .primary-text'),
              isPronunciation: false
            },
            {
              element: adlib.querySelector(':scope > .adlib-live-translation'),
              isPronunciation: false
            },
            { element: pronunciation, isPronunciation: true }
          ];

          return structureElements.flatMap(({ element, isPronunciation }) => {
            const rows = isPronunciation
              ? getTextRects(element)
              : getGlyphRows(element);
            const animationOffset = adlibAnimationOffset +
              (isPronunciation ? pronunciationAnimationOffset : 0);
            return rows.map(rect => {
              const restingTop = rect.top - animationOffset;
              const restingBottom = rect.bottom - animationOffset;
              return {
                ...rect,
                top: Math.min(rect.top, restingTop),
                bottom: Math.max(rect.bottom, restingBottom)
              };
            });
          });
        };
        const getStructureBounds = rects => rects.reduce((bounds, rect) => ({
          left: Math.min(bounds.left, rect.left),
          right: Math.max(bounds.right, rect.right),
          top: Math.min(bounds.top, rect.top),
          bottom: Math.max(bounds.bottom, rect.bottom)
        }), {
          left: Infinity,
          right: -Infinity,
          top: Infinity,
          bottom: -Infinity
        });
        const lyricContentSelector = [
          '.main-lyrics-layer',
          '.adlib-node > .primary-text',
          '.main-live-translation',
          '.adlib-live-translation',
          '.core-chunks > .pronunciation-text',
          '.adlib-node > .pronunciation-text'
        ].join(', ');
        const staticContentRectsByLine = new Map();
        const getStaticContentRects = line => {
          if (!staticContentRectsByLine.has(line)) {
            const rects = Array.from(line.querySelectorAll(lyricContentSelector))
              .filter(element => !element.closest('.adlib-node'))
              .flatMap(element => (
                element.matches('.pronunciation-text')
                  ? getTextRects(element)
                  : getGlyphRows(element)
              ));
            staticContentRectsByLine.set(line, rects);
          }
          return staticContentRectsByLine.get(line);
        };
        const getOccupiedContentRects = (line, excludedAdlib = null) => [
          ...getStaticContentRects(line),
          ...Array.from(line.querySelectorAll('.adlib-node'))
            .filter(adlib => adlib !== excludedAdlib)
            .flatMap(getAdlibStructureRects)
        ];
        const hasAdlibStructureCollision = (adlib, clearance = 3) => {
          const structureBounds = getStructureBounds(getAdlibStructureRects(adlib));
          if (!Number.isFinite(structureBounds.left)) return false;
          const adlibRects = [structureBounds];
          const occupiedRects = [
            ...getOccupiedContentRects(wrapper, adlib),
            ...neighboringLineWrappers
              .flatMap(line => getOccupiedContentRects(line))
          ];

          return adlibRects.some(rect => occupiedRects.some(other => (
            rect.left < other.right + clearance &&
            rect.right > other.left - clearance &&
            rect.top < other.bottom + clearance &&
            rect.bottom > other.top - clearance
          )));
        };
        const pronouncedForeignAdlib = adlibMeasurements.find(item => (
          item.needsMainLineOffset && item.glyphRows.length > 0
        ));
        const firstMainGlyphRow = mainGlyphRows[0];
        const pronouncedForeignAdlibRow = pronouncedForeignAdlib?.glyphRows[0];
        const adlibPronunciation = pronouncedForeignAdlib?.adlib.querySelector('.pronunciation-text');
        if (
          pronouncedForeignAdlibRow &&
          firstMainGlyphRow &&
          adlibPronunciation &&
          coreChunks &&
          window.innerHeight > 0
        ) {
          const pronunciationStyle = getComputedStyle(adlibPronunciation);
          const desiredShift = (
            parseFloat(pronunciationStyle.fontSize) +
            parseFloat(pronunciationStyle.marginTop)
          ) / 2;
          coreChunks.classList.add('is-main-shifted-for-pronounced-foreign-adlib');
          splitLine?.classList.add('is-main-shifted-for-pronounced-foreign-adlib');
          splitLine?.style.setProperty(
            '--live-main-foreign-adlib-offset-y',
            `${(desiredShift / scaleY / window.innerHeight) * 100}vh`
          );
          coreChunks.style.setProperty(
            '--live-main-foreign-adlib-offset-y',
            `${(desiredShift / scaleY / window.innerHeight) * 100}vh`
          );
          mainGlyphRows = getGlyphRows(mainGlyphs);
          lastMainRow = mainGlyphRows[mainGlyphRows.length - 1];
          splitLineBounds = splitLine?.getBoundingClientRect();
        }
        let previousGlyphRows = mainGlyphRows;
        const mainPronunciationRects = Array.from(
          coreChunks?.querySelectorAll('.pronunciation-text') || []
        ).flatMap(getTextRects);
        const mainTranslationRects = getTextRects(
          wrapper.querySelector('.main-live-translation')
        );
        const lastMainRowInlineEdge = direction === 'rtl'
          ? Math.min(
            lastMainRow?.left ?? Infinity,
            ...mainPronunciationRects.map(rect => rect.left),
            ...mainTranslationRects.map(rect => rect.left)
          )
          : Math.max(
            lastMainRow?.right ?? -Infinity,
            ...mainPronunciationRects.map(rect => rect.right),
            ...mainTranslationRects.map(rect => rect.right)
          );
        let wrappedMainInlineCursor = direction === 'rtl'
          ? (Number.isFinite(lastMainRowInlineEdge) ? lastMainRowInlineEdge : undefined)
          : (Number.isFinite(lastMainRowInlineEdge) ? lastMainRowInlineEdge : undefined);
        let mainPartInlineCursor = lastMainRow
          ? (direction === 'rtl' ? lastMainRow.left : lastMainRow.right)
          : undefined;
        let wrappedAdlibInlineAnchor;

        adlibMeasurements.forEach(({
          adlib,
          glyphRows: adlibGlyphRows,
          bounds,
          hasSecondary,
          needsForeignLineOffset
        }, adlibIndex) => {
          const previousAdlib = adlibMeasurements[adlibIndex - 1]?.adlib;
          if (previousAdlib) {
            const previousStructureBounds = getStructureBounds(
              getAdlibStructureRects(previousAdlib)
            );
            const previousGlyphRow = getGlyphRows(
              previousAdlib.querySelector(':scope > .primary-text')
            )[0];
            if (previousGlyphRow && Number.isFinite(previousStructureBounds.left)) {
              wrappedAdlibInlineAnchor = {
                cursor: direction === 'rtl'
                  ? previousStructureBounds.left
                  : previousStructureBounds.right,
                glyphRow: previousGlyphRow
              };
            }
          }

          adlib.classList.toggle(
            'is-english-adlib-on-foreign-line',
            needsForeignLineOffset && !hasSecondary
          );
          adlib.classList.toggle(
            'has-secondary',
            hasSecondary
          );

          const mainWrappedInlineCandidate = lastMainRow &&
            splitLineBounds &&
            adlibGlyphRows.length > 0 &&
            (wrappedAdlibInlineAnchor !== undefined ||
              (hasSecondary
                ? wrappedMainInlineCursor !== undefined
                : mainPartInlineCursor !== undefined));
          let adlibStructureCollision = false;
          if (mainWrappedInlineCandidate) {
            const structureBounds = getStructureBounds(
              getAdlibStructureRects(adlib)
            );
            const startsAfterPreviousAdlib = wrappedAdlibInlineAnchor !== undefined;
            const inlineCursor = startsAfterPreviousAdlib
              ? wrappedAdlibInlineAnchor.cursor
              : hasSecondary
                ? wrappedMainInlineCursor
                : mainPartInlineCursor;
            const inlineGap = 12 * scaleX;
            const inlineLeft = direction === 'rtl'
              ? inlineCursor - inlineGap -
                (structureBounds.right - structureBounds.left)
              : inlineCursor + inlineGap;
            const inlineRight = inlineLeft +
              (structureBounds.right - structureBounds.left);
            const fitsBesideLastContent = direction === 'rtl'
              ? inlineLeft >= splitLineBounds.left
              : inlineRight <= splitLineBounds.right;

            if (fitsBesideLastContent) {
              const glyphRow = adlibGlyphRows[0];
              adlib.classList.remove('is-adlib-new-row', 'is-adlib-wrapped');
              adlib.classList.add('is-adlib-inline-after-wrapped-main');
              const positionedAdlibBounds = adlib.getBoundingClientRect();
              const positionedStructureBounds = getStructureBounds(
                getAdlibStructureRects(adlib)
              );
              const structureOffsetLeft =
                positionedStructureBounds.left - positionedAdlibBounds.left;
              const structureOffsetRight =
                positionedStructureBounds.right - positionedAdlibBounds.left;
              const nodeLeft = direction === 'rtl'
                ? inlineRight - structureOffsetRight
                : inlineLeft - structureOffsetLeft;
              adlib.style.removeProperty('--live-adlib-glyph-offset-y');
              adlib.style.setProperty(
                '--live-adlib-inline-x',
                `${(nodeLeft - splitLineBounds.left) / scaleX}px`
              );
              const inlineAnchorRow = startsAfterPreviousAdlib
                ? wrappedAdlibInlineAnchor.glyphRow
                : lastMainRow;
              let inlineTop = (
                inlineAnchorRow.bottom - (glyphRow.bottom - glyphRow.top) -
                (glyphRow.top - bounds.top) - splitLineBounds.top
              ) / scaleY;
              adlib.style.setProperty('--live-adlib-inline-y', `${inlineTop}px`);
              const positionedGlyphRow = getGlyphRows(
                adlib.querySelector(':scope > .primary-text')
              )[0];
              if (positionedGlyphRow) {
                const animationOffsetY = new DOMMatrixReadOnly(
                  getComputedStyle(adlib).transform
                ).m42;
                const alignGlyphBottom = startsAfterPreviousAdlib || !hasSecondary;
                const alignedEdge = alignGlyphBottom
                  ? positionedGlyphRow.bottom - animationOffsetY
                  : positionedGlyphRow.top - animationOffsetY;
                const targetEdge = startsAfterPreviousAdlib
                  ? wrappedAdlibInlineAnchor.glyphRow.bottom
                  : hasSecondary
                  ? lastMainRow.top
                  : lastMainRow.bottom;
                const verticalCorrection = (targetEdge - alignedEdge) / scaleY;
                inlineTop += verticalCorrection;
                adlib.style.setProperty('--live-adlib-inline-y', `${inlineTop}px`);
              }
              adlibStructureCollision = hasAdlibStructureCollision(adlib, 0);
              if (!adlibStructureCollision) {
                const positionedAdlibGlyphRow = getGlyphRows(
                  adlib.querySelector(':scope > .primary-text')
                )[0];
                wrappedAdlibInlineAnchor = {
                  cursor: direction === 'rtl' ? inlineLeft : inlineRight,
                  glyphRow: positionedAdlibGlyphRow
                };
                if (!startsAfterPreviousAdlib && hasSecondary) {
                  wrappedMainInlineCursor = direction === 'rtl'
                    ? inlineLeft
                    : inlineRight;
                } else if (!startsAfterPreviousAdlib) {
                  mainPartInlineCursor = direction === 'rtl'
                    ? inlineLeft
                    : inlineRight;
                }
                return;
              }
            }
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
            if (startsAfterPreviousAdlib) {
              wrappedAdlibInlineAnchor = undefined;
            } else if (hasSecondary) {
              wrappedMainInlineCursor = undefined;
            } else {
              mainPartInlineCursor = undefined;
            }
          } else {
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
          }

          if (
            !adlibStructureCollision &&
            !adlib.classList.contains('is-adlib-inline-after-wrapped-main')
          ) {
            adlibStructureCollision = hasAdlibStructureCollision(adlib);
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
          const isPositionedInline = adlib.classList.contains(
            'is-adlib-inline-after-wrapped-main'
          );
          const mustMoveToOwnRow = !isPositionedInline && (
            adlibStructureCollision ||
            (
              adlib.classList.contains('has-secondary') &&
              (
                mainGlyphRows.length > 1 ||
                !isInlineWithPreviousRow
              )
            )
          );
          adlib.classList.toggle('is-adlib-wrapped', mustMoveToOwnRow);
          adlib.classList.toggle(
            'is-adlib-new-row',
            !isPositionedInline &&
              (!isInlineWithPreviousRow || mustMoveToOwnRow)
          );

          {
            const rowGlyph = getGlyphRows(
              adlib.querySelector(':scope > .primary-text')
            )[0];
            const rowStructureBounds = getStructureBounds(
              getAdlibStructureRects(adlib)
            );
            if (rowGlyph && Number.isFinite(rowStructureBounds.left)) {
              wrappedAdlibInlineAnchor = {
                cursor: direction === 'rtl'
                  ? rowStructureBounds.left
                  : rowStructureBounds.right,
                glyphRow: rowGlyph
              };
            }
          }

          if (!isInlineWithPreviousRow || mustMoveToOwnRow || isPositionedInline) {
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
          const positionedGlyphRow = getGlyphRows(
            adlib.querySelector(':scope > .primary-text')
          )[0];
          const positionedStructureBounds = getStructureBounds(
            getAdlibStructureRects(adlib)
          );
          if (positionedGlyphRow && Number.isFinite(positionedStructureBounds.left)) {
            wrappedAdlibInlineAnchor = {
              cursor: direction === 'rtl'
                ? positionedStructureBounds.left
                : positionedStructureBounds.right,
              glyphRow: positionedGlyphRow
            };
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
          const desiredGap = (parseFloat(getComputedStyle(translation).marginBottom) || 0) * scaleY;
          const verticalOffset = glyphs.getBoundingClientRect().top -
            translationBounds.bottom - desiredGap;
          translation.style.setProperty('--live-translation-offset-y', `${verticalOffset / scaleY}px`);
        });

        adlibMeasurements.forEach(({ adlib }) => {
          const translation = adlib.querySelector(':scope > .adlib-live-translation');
          if (!translation || mainGlyphRows.length === 0) return;

          const animationOffsetY = new DOMMatrixReadOnly(
            getComputedStyle(adlib).transform
          ).m42;
          const horizontalOverlap = (first, second) => (
            first.left < second.right && first.right > second.left
          );
          const findOverlappingRows = (translationRows, appliedGap) => (
            translationRows.flatMap(translationRow =>
              mainGlyphRows
                .filter(mainRow => (
                  horizontalOverlap(translationRow, mainRow) &&
                  translationRow.bottom - appliedGap - animationOffsetY >
                    mainRow.top &&
                  translationRow.top - appliedGap - animationOffsetY <
                    mainRow.bottom
                ))
                .map(mainRow => ({
                  translationRow,
                  mainRow
                }))
            )
          );
          let appliedGap = parseFloat(getComputedStyle(adlib).marginBlockStart) || 0;
          let translationRows = getGlyphRows(translation);
          let overlappingRows = findOverlappingRows(translationRows, appliedGap);

          if (
            overlappingRows.length > 0 &&
            !adlib.classList.contains('is-adlib-wrapped')
          ) {
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.classList.add('is-adlib-wrapped', 'is-adlib-new-row');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
            translation.style.removeProperty('--live-translation-offset-x');
            translation.style.removeProperty('--live-translation-offset-y');
            appliedGap = parseFloat(getComputedStyle(adlib).marginBlockStart) || 0;
            translationRows = getGlyphRows(translation);
            overlappingRows = findOverlappingRows(translationRows, appliedGap);
          }

          if (overlappingRows.length === 0 || window.innerHeight <= 0) {
            adlib.style.removeProperty('--live-adlib-collision-gap');
            return;
          }

          const desiredGap = Math.max(
            0,
            ...overlappingRows.map(({ translationRow, mainRow }) => (
              mainRow.bottom - (
                translationRow.top - appliedGap - animationOffsetY
              )
            ))
          );
          const rowGap = parseFloat(getComputedStyle(translation).marginBottom) || 0;
          const clearanceVh = (
            (desiredGap + rowGap * scaleY) / scaleY / window.innerHeight
          ) * 100;
          adlib.style.setProperty(
            '--live-adlib-collision-gap',
            `${Math.ceil(clearanceVh * 100) / 100}vh`
          );
        });

        let neighborBottomClearance = 0;
        adlibMeasurements.forEach(({ adlib }) => {
          const adlibRects = getAdlibStructureRects(adlib);
          let neighborStartClearance = 0;
          const splitLineBottom = splitLine?.getBoundingClientRect().bottom;
          if (splitLineBottom !== undefined) {
            neighborBottomClearance = Math.max(
              neighborBottomClearance,
              ...adlibRects.map(rect => rect.bottom + 3 - splitLineBottom)
            );
          }
          [wrapper, ...neighboringLineWrappers].forEach(line => {
            const occupiedRects = getOccupiedContentRects(
              line,
              line === wrapper ? adlib : null
            );
            occupiedRects.forEach(occupiedRect => {
              adlibRects.forEach(adlibRect => {
                const intersects = adlibRect.left < occupiedRect.right + 1 &&
                  adlibRect.right > occupiedRect.left - 1 &&
                  adlibRect.top < occupiedRect.bottom + 1 &&
                  adlibRect.bottom > occupiedRect.top - 1;
                if (!intersects) return;

                if (line === wrapper || line === previousLineWrapper) {
                  neighborStartClearance = Math.max(
                    neighborStartClearance,
                    occupiedRect.bottom + 1 - adlibRect.top
                  );
                } else {
                  neighborBottomClearance = Math.max(
                    neighborBottomClearance,
                    adlibRect.bottom + 1 - occupiedRect.top
                  );
                }
              });
            });
          });

          if (neighborStartClearance > 0) {
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.classList.add('is-adlib-wrapped', 'is-adlib-new-row');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
            adlib.style.removeProperty('--live-translation-offset-x');
            adlib.style.removeProperty('--live-translation-offset-y');
            adlib.style.setProperty(
              '--live-adlib-neighbor-clearance-start',
              `${Math.ceil(neighborStartClearance)}px`
            );
          }
        });
        if (neighborBottomClearance > 0) {
          splitLine?.style.setProperty(
            '--live-adlib-neighbor-clearance',
            `${Math.ceil(neighborBottomClearance)}px`
          );
        }

        onLiveLayoutReady?.(lineIndex);
      };
      const queueInitialLayoutMeasurement = () => {
        if (measurementQueued || cancelled) return;
        measurementQueued = true;
        queuedMeasurement = () => {
          queuedMeasurement = null;
          measurementQueued = false;
          if (cancelled) return;
          measureLiveTranslations();
        };
        queueLiveLayoutMeasurement(queuedMeasurement);
      };

      const unregisterResizeMeasurement = registerLiveLayoutResizeMeasurement(
        queueInitialLayoutMeasurement
      );
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(entries => {
          const width = entries[0]?.contentRect.width;
          if (width === undefined || Math.abs(width - observedWidth) < 0.5) return;
          observedWidth = width;
          queueInitialLayoutMeasurement();
        });
        resizeObserver.observe(wrapper);
      }

      if (!document.fonts || document.fonts.status === 'loaded') {
        queueInitialLayoutMeasurement();
      } else {
        document.fonts.ready.then(queueInitialLayoutMeasurement);
      }

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
        unregisterResizeMeasurement();
        if (queuedMeasurement) {
          pendingLiveLayoutMeasurements.delete(queuedMeasurement);
        }
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
    if (!document.fonts || document.fonts.status === 'loaded') {
      measureFocusedTranslationWidths();
    } else {
      document.fonts.ready.then(() => {
        if (!cancelled) measureFocusedTranslationWidths();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isSongModalReady, lineIndex, onLiveLayoutReady, renderedContent, viewMode]);

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