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
    const container = pendingLiveLayoutMeasurements[0]?.wrapper.closest(
      '.live-lyrics-preview'
    );
    const containerBounds = container?.getBoundingClientRect();
    pendingLiveLayoutMeasurements.forEach(entry => {
      const lineBounds = entry.wrapper.getBoundingClientRect();
      const isVisible = containerBounds &&
        lineBounds.bottom > containerBounds.top &&
        lineBounds.top < containerBounds.bottom;
      entry.priority = entry.wrapper.classList.contains('active')
        ? 0
        : isVisible ? 1 : 2;
      entry.distance = containerBounds
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

  if (deadline.didTimeout) {
    pendingLiveLayoutMeasurements.shift()?.measure();
  } else {
    while (
      pendingLiveLayoutMeasurements.length > 0 &&
      deadline.timeRemaining() >= LIVE_LAYOUT_IDLE_BUDGET_MS
    ) {
      pendingLiveLayoutMeasurements.shift().measure();
    }
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
    isAdlib = false,
    autoLiveLayout = false
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
    focusedMainLyrics,
    autoLiveLayout
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
  isPlayingCurrentSong
}) => {
  const wrapperRef = useRef(null);
  const start = savedNode?.start ?? 'NaN';
  const end = savedNode?.end ?? 'NaN';
  const isLiveRender = viewMode === 'live' || viewMode === 'live-scroll';
  const renderPlaybackState = isLiveRender ? false : isPlayingCurrentSong;

  const renderedContent = useMemo(() =>
    renderLine(
      lineObj,
      savedNode,
      viewMode === 'focused',
      masterPalette,
      renderPlaybackState,
      {
        focusedMainLyrics: isLiveRender,
        autoLiveLayout: viewMode === 'live'
      }
    ),
    [lineObj, savedNode, viewMode, masterPalette, renderPlaybackState, isLiveRender]
  );

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || (viewMode !== 'focused' && !isLiveRender)) return undefined;

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

    if (isLiveRender) {
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

        if (adlibNodes.length === 0 && !mainTranslation) return;
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
          adlib.classList.remove('is-english-adlib-on-foreign-line');
          adlib.classList.remove('is-nonforeign-adlib-on-foreign-main');
          adlib.style.removeProperty('--live-adlib-glyph-offset-y');
          adlib.style.removeProperty('--live-adlib-neighbor-clearance-start');
          adlib.style.removeProperty('--live-adlib-collision-gap');
        });

        if (adlibNodes.length === 0) {
          const scaleX = wrapper.offsetWidth
            ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
            : 1;
          const translation = mainTranslation;
          const glyphs = wrapper.querySelector('.core-chunks > .main-lyrics-layer');
          if (translation && glyphs) {
            const widestLine = measureWidestLine(glyphs);
            if (widestLine) {
              const width = (widestLine.right - widestLine.left) / scaleX;
              translation.style.width = `${Math.max(1, Math.floor(width))}px`;
            }
          }

          return;
        }

        const scaleX = wrapper.offsetWidth
          ? wrapper.getBoundingClientRect().width / wrapper.offsetWidth
          : 1;
        const scaleY = wrapper.offsetHeight
          ? wrapper.getBoundingClientRect().height / wrapper.offsetHeight
          : 1;
        const mainGlyphs = wrapper.querySelector('.core-chunks > .main-lyrics-layer');
        const hasMainLyrics = Boolean(mainGlyphs?.textContent.trim());
        let mainGlyphRows = getGlyphRows(mainGlyphs);
        splitLine?.classList.toggle('is-main-wrapped', mainGlyphRows.length > 1);
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
        adlibMeasurements.forEach(({ adlib, hasSecondary }) => {
          adlib.classList.toggle('has-secondary', hasSecondary);
          if (!hasMainLyrics) {
            adlib.classList.add('is-adlib-wrapped');
          }
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
            return;
          }

          translation.style.width = `${Math.max(1, Math.floor(width))}px`;
        });

        let shiftMainForForeignAdlibBaseline = false;
        adlibMeasurements.forEach(({ adlib }) => {
          const mainBounds = coreChunks?.getBoundingClientRect();
          const adlibBounds = adlib.getBoundingClientRect();
          const fitsBesideMain = Boolean(
            mainBounds &&
            adlibBounds.left < mainBounds.right &&
            adlibBounds.right > mainBounds.left &&
            adlibBounds.top < mainBounds.bottom &&
            adlibBounds.bottom > mainBounds.top
          );
          const adlibHasPronunciation = Boolean(
            adlib.querySelector('.pronunciation-text')
          );
          adlib.classList.toggle(
            'is-nonforeign-adlib-on-foreign-main',
            fitsBesideMain &&
              mainIsForeignOnly &&
              !adlibHasPronunciation
          );
          if (
            fitsBesideMain &&
            mainIsNonForeignOnly &&
            adlibHasPronunciation
          ) {
            shiftMainForForeignAdlibBaseline = true;
          }
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
            adlib.classList.add('is-adlib-wrapped');
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

          if (neighborStartClearance > 0) {
            adlib.classList.add('is-adlib-wrapped');
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

      };
      const queueInitialLayoutMeasurement = () => {
        if (viewMode === 'live') {
          measureLiveTranslations();
          return;
        }
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
    lineObj,
    renderedContent,
    savedNode,
    isLiveRender,
    viewMode
  ]);

  return (
    <div
      ref={wrapperRef}
      className={`lyric-line-wrapper ${viewMode === 'focused' ? 'focused-line' : 'preview-line'}${viewMode === 'live-scroll' ? ' live-scroll-line' : ''}${viewMode === 'live' ? ' live-layout-auto' : ''}`}
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