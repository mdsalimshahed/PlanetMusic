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

const LIVE_LAYOUT_IDLE_BUDGET_MS = 5;
const pendingLiveLayoutMeasurements = [];
const liveLayoutResizeMeasurements = new Set();
let liveLayoutMeasurementIdleCallback = null;
let liveLayoutMeasurementTimeout = null;
let liveLayoutResizeListenerAttached = false;
let liveLayoutMeasurementsPrioritized = false;
const liveLineLayoutCache = new WeakMap();
const LIVE_LAYOUT_CLASS_NAMES = [
  'has-main-shift-for-foreign-adlib',
  'is-main-shifted-for-pronounced-foreign-adlib',
  'is-main-shifted-for-foreign-adlib-baseline',
  'is-main-wrapped',
  'has-secondary',
  'is-adlib-wrapped',
  'is-adlib-new-row',
  'is-adlib-inline-after-wrapped-main',
  'is-english-adlib-on-foreign-line',
  'is-nonforeign-adlib-on-foreign-main'
];
const LIVE_LAYOUT_STYLE_PROPERTIES = [
  'width',
  '--live-main-foreign-adlib-offset-y',
  '--live-main-foreign-adlib-baseline-offset-y',
  '--live-main-foreign-adlib-following-row-offset-y',
  '--live-adlib-neighbor-clearance',
  '--live-adlib-glyph-offset-y',
  '--live-adlib-inline-x',
  '--live-adlib-inline-y',
  '--live-adlib-neighbor-clearance-start',
  '--live-adlib-collision-gap',
  '--live-translation-offset-x',
  '--live-translation-offset-y'
];

const getLiveLayoutCacheTargets = wrapper => [
  wrapper,
  ...wrapper.querySelectorAll([
    '.core-chunks',
    '.live-split-line',
    '.adlib-node',
    '.chunk-translation.live-translation'
  ].join(', '))
];

const applyCachedLiveLayout = (wrapper, cacheEntry) => {
  if (wrapper.clientWidth !== cacheEntry.width) return false;
  const targets = getLiveLayoutCacheTargets(wrapper);
  if (targets.length !== cacheEntry.targets.length) return false;

  targets.forEach((target, index) => {
    const cachedTarget = cacheEntry.targets[index];
    LIVE_LAYOUT_CLASS_NAMES.forEach(className => {
      target.classList.toggle(className, cachedTarget.classes.includes(className));
    });
    LIVE_LAYOUT_STYLE_PROPERTIES.forEach(property => {
      const value = cachedTarget.styles[property];
      if (value) target.style.setProperty(property, value);
      else target.style.removeProperty(property);
    });
  });
  return true;
};

const cacheLiveLayout = (wrapper, lineObj, savedNode, lineIndex, cacheKey) => {
  if (document.fonts && document.fonts.status !== 'loaded') return;
  liveLineLayoutCache.set(lineObj, {
    savedNode,
    lineIndex,
    cacheKey,
    width: wrapper.clientWidth,
    targets: getLiveLayoutCacheTargets(wrapper).map(target => ({
      classes: LIVE_LAYOUT_CLASS_NAMES.filter(className =>
        target.classList.contains(className)
      ),
      styles: Object.fromEntries(
        LIVE_LAYOUT_STYLE_PROPERTIES
          .map(property => [property, target.style.getPropertyValue(property)])
          .filter(([, value]) => value)
      )
    }))
  });
};

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

const cancelLiveLayoutMeasurementFlush = () => {
  if (liveLayoutMeasurementIdleCallback !== null) {
    window.cancelIdleCallback?.(liveLayoutMeasurementIdleCallback);
    liveLayoutMeasurementIdleCallback = null;
  }
  if (liveLayoutMeasurementTimeout !== null) {
    window.clearTimeout(liveLayoutMeasurementTimeout);
    liveLayoutMeasurementTimeout = null;
  }
};

const scheduleLiveLayoutMeasurementFlush = () => {
  if (
    liveLayoutMeasurementIdleCallback !== null ||
    liveLayoutMeasurementTimeout !== null
  ) return;

  if (typeof window.requestIdleCallback === 'function') {
    liveLayoutMeasurementIdleCallback = window.requestIdleCallback(
      flushLiveLayoutMeasurements,
      { timeout: 100 }
    );
  } else {
    liveLayoutMeasurementTimeout = window.setTimeout(() => {
      liveLayoutMeasurementTimeout = null;
      flushLiveLayoutMeasurements({ didTimeout: true, timeRemaining: () => 0 });
    }, 32);
  }
};

function flushLiveLayoutMeasurements(deadline) {
  liveLayoutMeasurementIdleCallback = null;
  liveLayoutMeasurementTimeout = null;
  if (!liveLayoutMeasurementsPrioritized) {
    pendingLiveLayoutMeasurements.forEach(entry => {
      const container = entry.wrapper.closest('.live-lyrics-preview');
      const lineBounds = entry.wrapper.getBoundingClientRect();
      const containerBounds = container?.getBoundingClientRect();
      const isVisible = containerBounds &&
        lineBounds.bottom > containerBounds.top &&
        lineBounds.top < containerBounds.bottom;
      entry.priority = entry.wrapper.classList.contains('active')
        ? 0
        : isVisible ? 1 : 2;
      entry.distance = isVisible && containerBounds
        ? Math.abs(
          (lineBounds.top + lineBounds.bottom) / 2 -
          (containerBounds.top + containerBounds.bottom) / 2
        )
        : 0;
    });
    pendingLiveLayoutMeasurements.sort((first, second) =>
      first.priority - second.priority || first.distance - second.distance
    );
    liveLayoutMeasurementsPrioritized = true;
  }

  if (
    pendingLiveLayoutMeasurements.length > 0 &&
    (deadline.didTimeout ||
      deadline.timeRemaining() >= LIVE_LAYOUT_IDLE_BUDGET_MS)
  ) {
    const { measure } = pendingLiveLayoutMeasurements.shift();
    measure();
  }

  if (pendingLiveLayoutMeasurements.length > 0) {
    scheduleLiveLayoutMeasurementFlush();
  } else {
    liveLayoutMeasurementsPrioritized = false;
  }
}

const queueLiveLayoutMeasurement = (measure, wrapper) => {
  if (pendingLiveLayoutMeasurements.length === 0) {
    liveLayoutMeasurementsPrioritized = false;
  }
  pendingLiveLayoutMeasurements.push({ measure, wrapper });
  scheduleLiveLayoutMeasurementFlush();
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
  liveLayoutCacheKey,
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
      const cachedLayout = liveLineLayoutCache.get(lineObj);
      if (
        cachedLayout?.savedNode === savedNode &&
        cachedLayout.lineIndex === lineIndex &&
        cachedLayout.cacheKey === liveLayoutCacheKey &&
        applyCachedLiveLayout(wrapper, cachedLayout)
      ) {
        queueMicrotask(() => onLiveLayoutReady?.(lineIndex));
        return undefined;
      }

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
        coreChunks?.classList.remove('is-main-shifted-for-foreign-adlib-baseline');
        coreChunks?.style.removeProperty('--live-main-foreign-adlib-baseline-offset-y');
        wrapper.classList.remove('has-main-shift-for-foreign-adlib');
        wrapper.style.removeProperty('--live-main-foreign-adlib-following-row-offset-y');
        splitLine?.classList.remove('is-main-shifted-for-pronounced-foreign-adlib');
        splitLine?.style.removeProperty('--live-main-foreign-adlib-offset-y');
        splitLine?.style.removeProperty('--live-adlib-neighbor-clearance');
        adlibNodes.forEach(adlib => {
          adlib.classList.remove('is-adlib-wrapped');
          adlib.classList.remove('is-adlib-new-row');
          adlib.classList.remove('is-adlib-inline-after-wrapped-main');
          adlib.classList.remove('is-english-adlib-on-foreign-line');
          adlib.classList.remove('is-nonforeign-adlib-on-foreign-main');
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
                `${(
                  ((center - parentBounds.left) / scaleX - width / 2) /
                  window.innerWidth
                ) * 100}vw`
              );
              translation.style.setProperty('--live-translation-offset-y', '0vh');
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
                ) / scaleY / window.innerHeight * 100}vh`
              );
            }
          }

          cacheLiveLayout(
            wrapper,
            lineObj,
            savedNode,
            lineIndex,
            liveLayoutCacheKey
          );
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
        let mainGlyphRows = getGlyphRows(mainGlyphs);
        splitLine?.classList.toggle('is-main-wrapped', mainGlyphRows.length > 1);
        let splitLineBounds = splitLine?.getBoundingClientRect();
        const direction = mainGlyphs ? getComputedStyle(mainGlyphs).direction : 'ltr';
        const mainHasForeignText = Boolean(
          mainGlyphs?.querySelector('.inline-cjk-chunk > .pronunciation-text')
        );
        let mainHasNonForeignText = false;
        if (mainGlyphs) {
          const textWalker = document.createTreeWalker(
            mainGlyphs,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: textNode => (
                textNode.parentElement?.closest('.pronunciation-text') ||
                !textNode.textContent.trim()
                  ? NodeFilter.FILTER_REJECT
                  : NodeFilter.FILTER_ACCEPT
              )
            }
          );
          let textNode;
          while ((textNode = textWalker.nextNode())) {
            const foreignChunk = textNode.parentElement?.closest('.inline-cjk-chunk');
            if (!foreignChunk?.querySelector(':scope > .pronunciation-text')) {
              mainHasNonForeignText = true;
              break;
            }
          }
        }
        const mainIsForeignOnly = mainHasForeignText && !mainHasNonForeignText;
        const mainIsNonForeignOnly = !mainGlyphs?.querySelector('.pronunciation-text') &&
          mainHasNonForeignText;
        const adlibMeasurements = Array.from(adlibNodes, adlib => {
          return {
            adlib,
            hasSecondary: Boolean(
              adlib.querySelector('.adlib-live-translation, .pronunciation-text')
            )
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
        const getBoundsForRects = rects => rects.reduce((bounds, rect) => ({
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
        const occupiedContentByLine = new Map();
        const finalAdlibRectsByNode = new Map();
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
        const getFinalAdlibRects = adlib => {
          if (!finalAdlibRectsByNode.has(adlib)) {
            finalAdlibRectsByNode.set(adlib, getAdlibStructureRects(adlib));
          }
          return finalAdlibRectsByNode.get(adlib);
        };
        const getOccupiedContentItems = line => {
          if (!occupiedContentByLine.has(line)) {
            const items = [{
              adlib: null,
              rects: getStaticContentRects(line)
            }];
            line.querySelectorAll('.adlib-node').forEach(adlib => {
              items.push({
                adlib,
                rects: getFinalAdlibRects(adlib)
              });
            });
            occupiedContentByLine.set(line, items);
          }
          return occupiedContentByLine.get(line);
        };
        const mainBoxBounds = getBoundsForRects([
          ...mainGlyphRows,
          ...Array.from(
            coreChunks?.querySelectorAll('.pronunciation-text') || []
          ).flatMap(getTextRects)
        ]);
        let rowCursor = mainBoxBounds
          ? direction === 'rtl' ? mainBoxBounds.left : mainBoxBounds.right
          : undefined;
        let rowBottom = mainBoxBounds?.bottom;
        let rowBaseline = mainGlyphRows[mainGlyphRows.length - 1]?.bottom;
        const inlineGap = Math.min(
          window.innerWidth * 0.0072,
          window.innerHeight * 0.015
        ) * scaleX;
        const currentLineBounds = wrapper.getBoundingClientRect();
        const previousLineBounds = previousLineWrapper?.getBoundingClientRect();
        const normalLineGap = previousLineBounds
          ? Math.max(0, currentLineBounds.top - previousLineBounds.bottom)
          : 0;

        adlibMeasurements.forEach(({ adlib, hasSecondary }) => {
          adlib.classList.toggle('has-secondary', hasSecondary);
          if (!splitLineBounds || rowCursor === undefined || rowBottom === undefined) return;

          adlib.classList.remove('is-adlib-new-row', 'is-adlib-wrapped');
          adlib.classList.add('is-adlib-inline-after-wrapped-main');
          const adlibNodeBounds = adlib.getBoundingClientRect();
          const adlibBoxBounds = getBoundsForRects(getAdlibStructureRects(adlib));
          const adlibWidth = adlibBoxBounds.right - adlibBoxBounds.left;
          const adlibHeight = adlibBoxBounds.bottom - adlibBoxBounds.top;
          const adlibMainBounds = getBoundsForRects(
            getGlyphRows(adlib.querySelector(':scope > .primary-text'))
          );
          let targetLeft = direction === 'rtl'
            ? rowCursor - inlineGap - adlibWidth
            : rowCursor + inlineGap;
          let targetTop = adlibMainBounds && rowBaseline !== undefined
            ? adlibBoxBounds.top + rowBaseline - adlibMainBounds.bottom
            : rowBottom - adlibHeight;
          const fitsBesidePreviousBox = direction === 'rtl'
            ? targetLeft >= splitLineBounds.left
            : targetLeft + adlibWidth <= splitLineBounds.right;

          if (!fitsBesidePreviousBox) {
            targetLeft = direction === 'rtl'
              ? splitLineBounds.right - adlibWidth
              : splitLineBounds.left;
            targetTop = rowBottom + normalLineGap;
            rowBottom = targetTop + adlibHeight;
          }
          const adlibHasPronunciation = Boolean(
            adlib.querySelector('.pronunciation-text')
          );
          adlib.classList.toggle(
            'is-nonforeign-adlib-on-foreign-main',
            fitsBesidePreviousBox &&
              mainIsForeignOnly &&
              !adlibHasPronunciation
          );
          if (adlibMainBounds) {
            rowBaseline = adlibMainBounds.bottom + targetTop - adlibBoxBounds.top;
          }

          adlib.style.removeProperty('--live-adlib-glyph-offset-y');
          adlib.style.setProperty(
            '--live-adlib-inline-x',
            `${(
              (
                adlibNodeBounds.left + targetLeft - adlibBoxBounds.left -
                splitLineBounds.left
              ) / scaleX /
              window.innerWidth
            ) * 100}vw`
          );
          adlib.style.setProperty(
            '--live-adlib-inline-y',
            `${(
              (
                adlibNodeBounds.top + targetTop - adlibBoxBounds.top -
                splitLineBounds.top
              ) / scaleY /
              window.innerHeight
            ) * 100}vh`
          );
          rowCursor = direction === 'rtl' ? targetLeft : targetLeft + adlibWidth;
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
          translation.style.setProperty('--live-translation-offset-y', '0vh');
          translation.style.setProperty(
            '--live-translation-offset-x',
            `${offset / window.innerWidth * 100}vw`
          );
          const translationBounds = translation.getBoundingClientRect();
          const desiredGap = (parseFloat(getComputedStyle(translation).marginBottom) || 0) * scaleY;
          const verticalOffset = glyphs.getBoundingClientRect().top -
            translationBounds.bottom - desiredGap;
          translation.style.setProperty(
            '--live-translation-offset-y',
            `${verticalOffset / scaleY / window.innerHeight * 100}vh`
          );
        });

        rowCursor = mainBoxBounds
          ? direction === 'rtl' ? mainBoxBounds.left : mainBoxBounds.right
          : undefined;
        rowBottom = mainBoxBounds?.bottom;
        rowBaseline = mainGlyphRows[mainGlyphRows.length - 1]?.bottom;
        let shiftMainForForeignAdlibBaseline = false;
        adlibMeasurements.forEach(({ adlib }) => {
          if (
            !splitLineBounds ||
            rowCursor === undefined ||
            rowBottom === undefined ||
            !adlib.classList.contains('is-adlib-inline-after-wrapped-main')
          ) return;

          const adlibNodeBounds = adlib.getBoundingClientRect();
          const adlibBoxBounds = getBoundsForRects(getAdlibStructureRects(adlib));
          if (!Number.isFinite(adlibBoxBounds.left)) return;
          const adlibWidth = adlibBoxBounds.right - adlibBoxBounds.left;
          const adlibHeight = adlibBoxBounds.bottom - adlibBoxBounds.top;
          const adlibMainBounds = getBoundsForRects(
            getGlyphRows(adlib.querySelector(':scope > .primary-text'))
          );
          let targetLeft = direction === 'rtl'
            ? rowCursor - inlineGap - adlibWidth
            : rowCursor + inlineGap;
          let targetTop = adlibMainBounds && rowBaseline !== undefined
            ? adlibBoxBounds.top + rowBaseline - adlibMainBounds.bottom
            : rowBottom - adlibHeight;
          const fitsBesidePreviousBox = direction === 'rtl'
            ? targetLeft >= splitLineBounds.left
            : targetLeft + adlibWidth <= splitLineBounds.right;

          if (!fitsBesidePreviousBox) {
            targetLeft = direction === 'rtl'
              ? splitLineBounds.right - adlibWidth
              : splitLineBounds.left;
            targetTop = rowBottom + normalLineGap;
            rowBottom = targetTop + adlibHeight;
          }
          const adlibHasPronunciation = Boolean(
            adlib.querySelector('.pronunciation-text')
          );
          adlib.classList.toggle(
            'is-nonforeign-adlib-on-foreign-main',
            fitsBesidePreviousBox &&
              mainIsForeignOnly &&
              !adlibHasPronunciation
          );
          if (
            fitsBesidePreviousBox &&
            mainIsNonForeignOnly &&
            adlibHasPronunciation
          ) {
            shiftMainForForeignAdlibBaseline = true;
          }
          if (adlibMainBounds) {
            rowBaseline = adlibMainBounds.bottom + targetTop - adlibBoxBounds.top;
          }

          adlib.style.setProperty(
            '--live-adlib-inline-x',
            `${(
              (
                adlibNodeBounds.left + targetLeft - adlibBoxBounds.left -
                splitLineBounds.left
              ) / scaleX / window.innerWidth
            ) * 100}vw`
          );
          adlib.style.setProperty(
            '--live-adlib-inline-y',
            `${(
              (
                adlibNodeBounds.top + targetTop - adlibBoxBounds.top -
                splitLineBounds.top
              ) / scaleY / window.innerHeight
            ) * 100}vh`
          );
          rowCursor = direction === 'rtl' ? targetLeft : targetLeft + adlibWidth;
        });

        adlibMeasurements.forEach(({ adlib }) => {
          if (adlib.classList.contains('is-adlib-inline-after-wrapped-main')) return;
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
            !adlib.classList.contains('is-adlib-wrapped') &&
            !adlib.classList.contains('is-adlib-inline-after-wrapped-main')
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
        const collisionClearance = Math.min(
          window.innerWidth * 0.005,
          window.innerHeight * 0.0025
        );
        const splitLineBottom = splitLine?.getBoundingClientRect().bottom;
        adlibMeasurements.forEach(({ adlib }) => {
          const adlibRects = getFinalAdlibRects(adlib);
          let neighborStartClearance = 0;
          if (splitLineBottom !== undefined) {
            neighborBottomClearance = Math.max(
              neighborBottomClearance,
              ...adlibRects.map(
                rect => rect.bottom + collisionClearance - splitLineBottom
              )
            );
          }
          [wrapper, ...neighboringLineWrappers].forEach(line => {
            getOccupiedContentItems(line).forEach(({ adlib: occupiedAdlib, rects }) => {
              if (line === wrapper && occupiedAdlib === adlib) return;
              rects.forEach(occupiedRect => {
                adlibRects.forEach(adlibRect => {
                  const intersects =
                    adlibRect.left < occupiedRect.right + collisionClearance &&
                    adlibRect.right > occupiedRect.left - collisionClearance &&
                    adlibRect.top < occupiedRect.bottom + collisionClearance &&
                    adlibRect.bottom > occupiedRect.top - collisionClearance;
                  if (!intersects) return;

                  if (line === wrapper || line === previousLineWrapper) {
                    neighborStartClearance = Math.max(
                      neighborStartClearance,
                      occupiedRect.bottom + collisionClearance - adlibRect.top
                    );
                  } else {
                    neighborBottomClearance = Math.max(
                      neighborBottomClearance,
                      adlibRect.bottom + collisionClearance - occupiedRect.top
                    );
                  }
                });
              });
            });
          });

          if (
            neighborStartClearance > 0 &&
            !adlib.classList.contains('is-adlib-inline-after-wrapped-main')
          ) {
            adlib.classList.remove('is-adlib-inline-after-wrapped-main');
            adlib.classList.add('is-adlib-wrapped', 'is-adlib-new-row');
            adlib.style.removeProperty('--live-adlib-inline-x');
            adlib.style.removeProperty('--live-adlib-inline-y');
            adlib.style.removeProperty('--live-translation-offset-x');
            adlib.style.removeProperty('--live-translation-offset-y');
            adlib.style.setProperty(
              '--live-adlib-neighbor-clearance-start',
              `${(
                neighborStartClearance / window.innerHeight * 100
              )}vh`
            );
            staticContentRectsByLine.delete(wrapper);
            occupiedContentByLine.delete(wrapper);
            wrapper.querySelectorAll('.adlib-node').forEach(node => {
              finalAdlibRectsByNode.delete(node);
            });
          }
        });
        if (neighborBottomClearance > 0) {
          splitLine?.style.setProperty(
            '--live-adlib-neighbor-clearance',
            `${neighborBottomClearance / window.innerHeight * 100}vh`
          );
        }
        if (shiftMainForForeignAdlibBaseline) {
          coreChunks?.classList.add('is-main-shifted-for-foreign-adlib-baseline');
          coreChunks?.style.setProperty(
            '--live-main-foreign-adlib-baseline-offset-y',
            'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)'
          );
          wrapper.classList.add('has-main-shift-for-foreign-adlib');
          wrapper.style.setProperty(
            '--live-main-foreign-adlib-following-row-offset-y',
            'calc((var(--dyn-translit-font-size, 0.55em) + var(--dyn-translit-bottom-padding, 4px)) / 2)'
          );
        }

        cacheLiveLayout(
          wrapper,
          lineObj,
          savedNode,
          lineIndex,
          liveLayoutCacheKey
        );
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
        queueLiveLayoutMeasurement(queuedMeasurement, wrapper);
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

      queueInitialLayoutMeasurement();
      if (document.fonts?.status !== 'loaded') {
        document.fonts?.ready.then(() => {
          if (!cancelled) queueInitialLayoutMeasurement();
        });
      }

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
        unregisterResizeMeasurement();
        if (queuedMeasurement) {
          const measurementIndex = pendingLiveLayoutMeasurements.findIndex(
            entry => entry.measure === queuedMeasurement
          );
          if (measurementIndex !== -1) {
            pendingLiveLayoutMeasurements.splice(measurementIndex, 1);
            if (pendingLiveLayoutMeasurements.length === 0) {
              liveLayoutMeasurementsPrioritized = false;
              cancelLiveLayoutMeasurementFlush();
            }
          }
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
  }, [
    isSongModalReady,
    lineIndex,
    liveLayoutCacheKey,
    lineObj,
    onLiveLayoutReady,
    renderedContent,
    savedNode,
    viewMode
  ]);

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