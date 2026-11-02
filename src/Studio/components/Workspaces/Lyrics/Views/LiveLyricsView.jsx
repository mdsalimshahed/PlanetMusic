import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import {
  buildTimedLineData,
  findActiveLineIndex,
  getAnchoredScrollTop
} from './liveLyricsUtils.js';
import './LiveLyricsView.css';

const ACTIVE_MAIN_TOP_RATIO = 0.42;

const getActiveMainLyricsNode = line => (
  line.querySelector('.core-chunks > .main-lyrics-layer') ||
  line.querySelector('.main-lyrics-layer') ||
  line.querySelector('.core-chunks > .primary-text') ||
  line.querySelector('.primary-text') ||
  line
);

const getActiveMainTopOffset = (container, line) => {
  const containerBounds = container.getBoundingClientRect();
  const node = getActiveMainLyricsNode(line);
  const activeBounds = node.getBoundingClientRect();
  if (
    !Number.isFinite(containerBounds.top) ||
    !Number.isFinite(activeBounds.top) ||
    activeBounds.height <= 0
  ) {
    return null;
  }

  const scaleY = container.offsetHeight > 0
    ? containerBounds.height / container.offsetHeight
    : 1;
  const viewportTop = containerBounds.top + container.clientTop * scaleY;
  return (activeBounds.top - viewportTop) / scaleY;
};

const getActiveLinePosition = (container, line) => {
  const activeTop = getActiveMainTopOffset(container, line);
  if (activeTop === null) {
    return { activeTop: null, targetTop: container.scrollTop };
  }

  return {
    activeTop,
    targetTop: getAnchoredScrollTop({
      scrollTop: container.scrollTop,
      viewportTop: 0,
      activeTop,
      targetOffset: container.clientHeight * ACTIVE_MAIN_TOP_RATIO,
      maxScrollTop: container.scrollHeight - container.clientHeight
    })
  };
};

const cancelActiveLineScroll = pendingScrollRef => {
  const animation = pendingScrollRef.current;
  if (!animation) return;
  if (animation.frame !== null) window.cancelAnimationFrame(animation.frame);
  pendingScrollRef.current = null;
};

const alignActiveLine = (container, line, pendingScrollRef, activeMainTopRef) => {
  cancelActiveLineScroll(pendingScrollRef);
  const { activeTop, targetTop } = getActiveLinePosition(container, line);
  container.scrollTop = targetTop;
  activeMainTopRef.current = activeTop;
};

const animateToActiveLine = (
  container,
  line,
  pendingScrollRef,
  activeMainTopRef
) => {
  const { activeTop, targetTop } = getActiveLinePosition(container, line);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cancelActiveLineScroll(pendingScrollRef);
    container.scrollTop = targetTop;
    activeMainTopRef.current = activeTop;
    return;
  }

  const existingAnimation = pendingScrollRef.current;
  if (existingAnimation?.line?.isConnected) {
    existingAnimation.line = line;
    existingAnimation.targetTop = targetTop;
    existingAnimation.startScrollTop = container.scrollTop;
    existingAnimation.startActiveTop = activeTop;
    activeMainTopRef.current = activeTop;
    return;
  }
  cancelActiveLineScroll(pendingScrollRef);
  if (Math.abs(targetTop - container.scrollTop) < 1) {
    container.scrollTop = targetTop;
    activeMainTopRef.current = activeTop;
    return;
  }

  const animation = {
    frame: null,
    lastTimestamp: null,
    velocity: 0,
    line,
    targetTop,
    startScrollTop: container.scrollTop,
    startActiveTop: activeTop
  };
  pendingScrollRef.current = animation;
  activeMainTopRef.current = activeTop;

  const step = timestamp => {
    if (pendingScrollRef.current !== animation) return;
    if (!animation.line.isConnected) {
      pendingScrollRef.current = null;
      return;
    }
    const elapsed = animation.lastTimestamp === null
      ? 0
      : Math.min((timestamp - animation.lastTimestamp) / 1000, 0.05);
    animation.lastTimestamp = timestamp;
    const nextTargetTop = animation.targetTop;
    const displacement = container.scrollTop - nextTargetTop;
    const angularFrequency = 16;
    const velocityCoefficient = animation.velocity +
      angularFrequency * displacement;
    const decay = Math.exp(-angularFrequency * elapsed);
    animation.velocity = (
      animation.velocity -
      angularFrequency * velocityCoefficient * elapsed
    ) * decay;
    container.scrollTop = nextTargetTop + (
      displacement + velocityCoefficient * elapsed
    ) * decay;
    activeMainTopRef.current = Number.isFinite(animation.startActiveTop)
      ? animation.startActiveTop - (
        container.scrollTop - animation.startScrollTop
      )
      : null;
    if (
      Math.abs(nextTargetTop - container.scrollTop) < 0.5 &&
      Math.abs(animation.velocity) < 4
    ) {
      container.scrollTop = nextTargetTop;
      activeMainTopRef.current = getActiveMainTopOffset(
        container,
        animation.line
      );
      pendingScrollRef.current = null;
      return;
    }
    animation.frame = window.requestAnimationFrame(step);
  };
  animation.frame = window.requestAnimationFrame(step);
};

const LINE_SHINE_TOTAL_DURATION_MS = 420;
const LINE_SHINE_LETTER_DURATION_MS = 240;
const glyphShineTimeouts = new WeakMap();
const lineActivationTimeouts = new WeakMap();

const getShineTextNode = activeLine => (
  activeLine.matches('.adlib-node')
    ? activeLine.querySelector(':scope > .primary-text')
    : activeLine.querySelector('.main-lyrics-layer')
);

const unwrapShineLetters = textNode => {
  textNode?.querySelectorAll('.live-shine-letter').forEach(letter => {
    letter.replaceWith(document.createTextNode(letter.textContent));
  });
  textNode?.normalize();
};

const clearGlyphShine = activeLine => {
  if (!activeLine) return;
  const pendingTimeout = glyphShineTimeouts.get(activeLine);
  if (pendingTimeout !== undefined) {
    window.clearTimeout(pendingTimeout);
    glyphShineTimeouts.delete(activeLine);
  }
  activeLine.classList.remove('is-shining');
  unwrapShineLetters(getShineTextNode(activeLine));
};

const clearLineActivation = line => {
  if (!line) return;
  line.classList.remove('is-activating');
  const pendingTimeout = lineActivationTimeouts.get(line);
  if (pendingTimeout !== undefined) {
    window.clearTimeout(pendingTimeout);
    lineActivationTimeouts.delete(line);
  }
};

const retriggerLineActivation = activeLine => {
  if (!activeLine) return;
  clearLineActivation(activeLine);
  void activeLine.offsetWidth;
  activeLine.classList.add('is-activating');
  lineActivationTimeouts.set(activeLine, window.setTimeout(() => {
    activeLine.classList.remove('is-activating');
    lineActivationTimeouts.delete(activeLine);
  }, 320));
};

const retriggerGlyphShine = activeLine => {
  if (!activeLine) return;
  const textNode = getShineTextNode(activeLine);
  if (!textNode) return;

  clearGlyphShine(activeLine);
  const textWalker = document.createTreeWalker(
    textNode,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: text => (
        text.parentElement?.closest('.pronunciation-text')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
      )
    }
  );
  const textNodes = [];
  let text;
  while ((text = textWalker.nextNode())) {
    if (text.textContent) textNodes.push(text);
  }
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
  const letters = [];
  textNodes.forEach(textNodeToWrap => {
    const graphemes = segmenter
      ? Array.from(segmenter.segment(textNodeToWrap.textContent), item => item.segment)
      : Array.from(textNodeToWrap.textContent);
    const fragment = document.createDocumentFragment();
    graphemes.forEach(grapheme => {
      const letter = document.createElement('span');
      letter.className = 'live-shine-letter';
      letter.textContent = grapheme;
      fragment.append(letter);
      letters.push(letter);
    });
    textNodeToWrap.replaceWith(fragment);
  });
  if (letters.length === 0) return;

  const letterDelay = letters.length > 1
    ? (LINE_SHINE_TOTAL_DURATION_MS - LINE_SHINE_LETTER_DURATION_MS) /
      (letters.length - 1)
    : 0;
  letters.forEach((letter, index) => {
    letter.style.setProperty('--letter-shine-delay', `${index * letterDelay}ms`);
  });
  void activeLine.offsetWidth;
  activeLine.classList.add('is-shining');
  const timeout = window.setTimeout(() => {
    if (glyphShineTimeouts.get(activeLine) !== timeout) return;
    activeLine.classList.remove('is-shining');
    unwrapShineLetters(textNode);
    glyphShineTimeouts.delete(activeLine);
  }, LINE_SHINE_TOTAL_DURATION_MS);
  glyphShineTimeouts.set(activeLine, timeout);
};

const updateLiveAdlibAtTime = (item, time, { triggerShine = true } = {}) => {
  const previousState = item.state;
  updateAdlibStateAtTime(item, time, { persistActive: true });

  if (previousState === 'active' && item.state !== 'active') {
    clearGlyphShine(item.node);
  } else if (triggerShine && previousState !== 'active' && item.state === 'active') {
    retriggerGlyphShine(item.node);
  }
};

const LiveLyricsView = ({
  syncWorkspaceLyrics,
  selectedSong,
  masterPalette,
  isPlayingCurrentSong,
  handleLineClick,
  settings,
  currentTrack,
  lyricsPlaybackOffsetSeconds = 0,
  isSongModalReady = true,
  shouldAnimateEntrance = true,
  isViewActive = true
}) => {
  const containerRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const activeMainTopRef = useRef(null);
  const seekScrollTimeoutRef = useRef(null);
  const hasProcessedPlaybackTimeRef = useRef(false);
  const pendingSeekRef = useRef(false);
  const [isEntrancePending, setIsEntrancePending] = useState(() => (
    shouldAnimateEntrance &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const hasAlignedMountRef = useRef(false);
  const wasViewActiveRef = useRef(false);
  const cachedLinesRef = useRef([]);
  const timedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const adlibTimelineRef = useRef([]);
  const adlibCursorRef = useRef(0);
  const lastAdlibTimeRef = useRef(null);
  const activeLineIndexRef = useRef(-1);
  const syncList = selectedSong?.syncData;
  const shouldUseSelectedSongTime = Boolean(
    selectedSong &&
    isPlayingCurrentSong
  );
  const nextStarts = useMemo(() => {
    const syncData = syncList || [];
    const result = Array(syncData.length).fill('NaN');
    let nextStart = 'NaN';
    for (let index = syncData.length - 1; index >= 0; index--) {
      result[index] = nextStart;
      if (syncData[index]?.start != null) nextStart = syncData[index].start;
    }
    return result;
  }, [syncList]);

  const timedLineData = useMemo(
    () => buildTimedLineData(syncList, nextStarts),
    [syncList, nextStarts]
  );

  const handleTimeUpdate = useCallback((time, {
    isSeek = false,
    alignImmediately = false,
    suppressPlaybackShine = false,
    suppressAdlibShine = false,
    forceActiveLineShine = false
  } = {}) => {
    if (!shouldUseSelectedSongTime || !Number.isFinite(time)) return;

    const lines = cachedLinesRef.current;
    const newActiveIndex = findActiveLineIndex(timedLinesRef.current, time);
    const previousActiveIndex = activeLineIndexRef.current;
    const activeLineChanged = previousActiveIndex !== newActiveIndex;
    if (activeLineChanged) {
      if (previousActiveIndex >= 0) {
        const previousLine = lines[previousActiveIndex]?.node;
          previousLine?.classList.remove('active');
          clearGlyphShine(previousLine);
        clearLineActivation(previousLine);
      }
      if (newActiveIndex >= 0) {
        const nextActiveLine = lines[newActiveIndex]?.node;
        if (nextActiveLine) {
          nextActiveLine.classList.add('active');
          retriggerLineActivation(nextActiveLine);
        }
        if (!isSeek && !suppressPlaybackShine) {
          retriggerGlyphShine(nextActiveLine);
        }
      }
      activeLineIndexRef.current = newActiveIndex;
    }

    const activeLine = lines[newActiveIndex]?.node;
    if (
      activeLine &&
      !activeLineChanged &&
      forceActiveLineShine &&
      !isSeek &&
      !suppressPlaybackShine
    ) {
      retriggerLineActivation(activeLine);
      retriggerGlyphShine(activeLine);
    }
    if (isSeek) {
      if (seekScrollTimeoutRef.current !== null) {
        window.clearTimeout(seekScrollTimeoutRef.current);
      }
      if (activeLine) {
        seekScrollTimeoutRef.current = window.setTimeout(() => {
          seekScrollTimeoutRef.current = null;
          const container = containerRef.current;
          const latestActiveLine = container?.querySelector('.preview-line.active');
          if (container && latestActiveLine) {
            animateToActiveLine(
              container,
              latestActiveLine,
              pendingScrollRef,
              activeMainTopRef
            );
          }
        }, 100);
      }
    } else if (activeLine && (
      activeLineChanged ||
      alignImmediately
    )) {
      const container = containerRef.current;
      if (container) {
        if (alignImmediately) {
          alignActiveLine(
            container,
            activeLine,
            pendingScrollRef,
            activeMainTopRef
          );
        } else {
          animateToActiveLine(
            container,
            activeLine,
            pendingScrollRef,
            activeMainTopRef
          );
        }
      }
    }
    hasProcessedPlaybackTimeRef.current = true;

    const adlibTimeline = adlibTimelineRef.current;
    const lastAdlibTime = lastAdlibTimeRef.current;
    if (lastAdlibTime === null || time < lastAdlibTime) {
      cachedAdlibsRef.current.forEach(item => updateLiveAdlibAtTime(
        item,
        time,
        { triggerShine: !isSeek && !suppressPlaybackShine && !suppressAdlibShine }
      ));
      adlibCursorRef.current = findAdlibBoundaryCursor(adlibTimeline, time);
    } else {
      while (
        adlibCursorRef.current < adlibTimeline.length &&
        adlibTimeline[adlibCursorRef.current].time <= time
      ) {
        updateLiveAdlibAtTime(
          adlibTimeline[adlibCursorRef.current].item,
          time,
          { triggerShine: !isSeek && !suppressPlaybackShine && !suppressAdlibShine }
        );
        adlibCursorRef.current++;
      }
    }
    lastAdlibTimeRef.current = time;
  }, [shouldUseSelectedSongTime]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wasViewActive = wasViewActiveRef.current;
    wasViewActiveRef.current = isViewActive;

    cachedLinesRef.current = Array.from(
      container.querySelectorAll('.lyric-line-wrapper')
    ).map(node => ({ node }));
    timedLinesRef.current = timedLineData
      .filter(line => cachedLinesRef.current[line.index])
      .map(line => ({
        ...line,
        node: cachedLinesRef.current[line.index].node
      }));
    activeLineIndexRef.current = cachedLinesRef.current.findIndex(
      line => line.node.classList.contains('active')
    );

    cachedAdlibsRef.current = Array.from(
      container.querySelectorAll('.adlib-node')
    ).map(node => ({
      node,
      start: parseFloat(node.dataset.start),
      end: parseFloat(node.dataset.end),
      state: node.classList.contains('adlib-active')
        ? 'active'
        : node.classList.contains('adlib-visible') ? 'visible' : 'hidden'
    }));
    adlibTimelineRef.current = buildAdlibTimeline(cachedAdlibsRef.current);
    adlibCursorRef.current = 0;
    lastAdlibTimeRef.current = null;

    if (!isViewActive) {
      if (seekScrollTimeoutRef.current !== null) {
        window.clearTimeout(seekScrollTimeoutRef.current);
        seekScrollTimeoutRef.current = null;
      }
      cancelActiveLineScroll(pendingScrollRef);
      pendingSeekRef.current = false;
      activeMainTopRef.current = null;
    } else if (shouldUseSelectedSongTime) {
      const currentTime = Number.isFinite(window.currentAudioTime)
        ? window.currentAudioTime
        : 0;
      handleTimeUpdate(currentTime - lyricsPlaybackOffsetSeconds, {
        alignImmediately: !hasAlignedMountRef.current || !wasViewActive,
        suppressAdlibShine: !wasViewActive,
        forceActiveLineShine: !wasViewActive
      });
      hasAlignedMountRef.current = true;
    } else {
      cachedLinesRef.current.forEach(line => {
        line.node.classList.remove('active');
        clearLineActivation(line.node);
      });
      activeLineIndexRef.current = -1;
      activeMainTopRef.current = null;
      hasProcessedPlaybackTimeRef.current = false;
      pendingSeekRef.current = false;
      cachedAdlibsRef.current.forEach(item => {
        item.node.classList.add('adlib-visible');
        item.node.classList.remove('adlib-hidden', 'adlib-active');
        item.state = 'visible';
      });
      adlibCursorRef.current = 0;
      lastAdlibTimeRef.current = null;
    }
  }, [
    handleTimeUpdate,
    isViewActive,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.trackId,
    shouldUseSelectedSongTime,
    syncWorkspaceLyrics,
    timedLineData
  ]);

  useEffect(() => {
    const clearActiveLine = () => {
      cachedLinesRef.current.forEach(line => {
        line.node.classList.remove('active');
        clearGlyphShine(line.node);
        clearLineActivation(line.node);
      });
      activeLineIndexRef.current = -1;
      activeMainTopRef.current = null;
      hasProcessedPlaybackTimeRef.current = false;
      pendingSeekRef.current = false;
      cachedAdlibsRef.current.forEach(item => {
        item.node.classList.add('adlib-visible');
        item.node.classList.remove('adlib-active', 'adlib-hidden');
        item.state = 'visible';
      });
      adlibCursorRef.current = 0;
      lastAdlibTimeRef.current = null;
    };

    const handleTimeEvent = event => {
      if (!isViewActive) return;
      const time = Number(event.detail);
      if (!Number.isFinite(time)) return;
      handleTimeUpdate(time - lyricsPlaybackOffsetSeconds, {
        isSeek: pendingSeekRef.current,
        suppressPlaybackShine: pendingSeekRef.current
      });
      pendingSeekRef.current = false;
    };
    const handleTimeSeek = () => {
      if (!isViewActive) return;
      pendingSeekRef.current = true;
    };
    const handlePlayState = event => {
      if (!isViewActive) return;
      if (event.detail?.isEnded) {
        clearActiveLine();
      }
    };

    if (!isViewActive) return undefined;

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalTimeSeek', handleTimeSeek);
    window.addEventListener('globalPlayState', handlePlayState);
    if (!shouldUseSelectedSongTime) clearActiveLine();

    return () => {
      window.removeEventListener('globalTimeUpdate', handleTimeEvent);
      window.removeEventListener('globalTimeSeek', handleTimeSeek);
      window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [
    currentTrack,
    handleTimeUpdate,
    isViewActive,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.trackId,
    shouldUseSelectedSongTime
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const cancelManualScroll = () => {
      cancelActiveLineScroll(pendingScrollRef);
    };
    const cancelManualScrollKey = event => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
        cancelManualScroll();
      }
    };
    container.addEventListener('wheel', cancelManualScroll, { passive: true });
    container.addEventListener('touchstart', cancelManualScroll, { passive: true });
    container.addEventListener('pointerdown', cancelManualScroll, { passive: true });
    container.addEventListener('keydown', cancelManualScrollKey);

    return () => {
      container.removeEventListener('wheel', cancelManualScroll);
      container.removeEventListener('touchstart', cancelManualScroll);
      container.removeEventListener('pointerdown', cancelManualScroll);
      container.removeEventListener('keydown', cancelManualScrollKey);
      if (seekScrollTimeoutRef.current !== null) {
        window.clearTimeout(seekScrollTimeoutRef.current);
        seekScrollTimeoutRef.current = null;
      }
      cancelActiveLineScroll(pendingScrollRef);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let previousContainerSize = null;
    const updateActiveAnchorBaseline = () => {
      if (pendingScrollRef.current) return;
      const activeLine = container.querySelector('.preview-line.active');
      activeMainTopRef.current = activeLine
        ? getActiveMainTopOffset(container, activeLine)
        : null;
    };

    const handleResize = entries => {
      const containerEntry = entries.find(entry => entry.target === container);
      let containerSizeChanged = false;
      if (containerEntry) {
        const nextSize = {
          width: containerEntry.contentRect.width,
          height: containerEntry.contentRect.height
        };
        containerSizeChanged = previousContainerSize !== null && (
          Math.abs(nextSize.width - previousContainerSize.width) >= 0.5 ||
          Math.abs(nextSize.height - previousContainerSize.height) >= 0.5
        );
        previousContainerSize = nextSize;
      }

      const activeLine = container.querySelector('.preview-line.active');
      const currentTop = activeLine
        ? getActiveMainTopOffset(container, activeLine)
        : null;
      const previousTop = activeMainTopRef.current;
      if (
        activeLine &&
        currentTop !== null &&
        previousTop !== null &&
        Math.abs(currentTop - previousTop) >= 0.5
      ) {
        const layoutShift = currentTop - previousTop;
        container.scrollTop += layoutShift;
        activeMainTopRef.current = getActiveMainTopOffset(container, activeLine);
      } else {
        activeMainTopRef.current = currentTop;
      }

      if (containerSizeChanged && activeLine && isViewActive) {
        if (!pendingScrollRef.current) {
          animateToActiveLine(
            container,
            activeLine,
            pendingScrollRef,
            activeMainTopRef
          );
        }
      }
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleResize);
    resizeObserver?.observe(container);
    container.addEventListener('scroll', updateActiveAnchorBaseline, { passive: true });

    const handleWindowResize = () => {
      const activeLine = container.querySelector('.preview-line.active');
      if (activeLine && isViewActive && !pendingScrollRef.current) {
        animateToActiveLine(
          container,
          activeLine,
          pendingScrollRef,
          activeMainTopRef
        );
      }
    };
    if (!resizeObserver) window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver?.disconnect();
      container.removeEventListener('scroll', updateActiveAnchorBaseline);
      if (!resizeObserver) window.removeEventListener('resize', handleWindowResize);
    };
  }, [isViewActive]);

  useEffect(() => {
    if (!isSongModalReady) return undefined;
    const trackKey = selectedSong?.trackId == null
      ? null
      : String(selectedSong.trackId);
    if (trackKey === null) return undefined;
    if (
      !shouldAnimateEntrance ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) return undefined;

    let frame = null;
    let fallbackTimeout = null;
    let cancelled = false;
    let revealLines = [];
    const animationEndHandlers = new Map();
    const finishReveal = line => {
      line.classList.remove('initial-reveal');
      line.style.removeProperty('--initial-reveal-delay');
      const handler = animationEndHandlers.get(line);
      if (handler) line.removeEventListener('animationend', handler);
      animationEndHandlers.delete(line);
    };
    const startReveal = () => {
      frame = null;
      if (cancelled) return;

      const containerBounds = container.getBoundingClientRect();
      revealLines = Array.from(
        container.querySelectorAll('.lyric-line-wrapper')
      ).filter(line => {
        const bounds = line.getBoundingClientRect();
        return bounds.height > 0 &&
          bounds.bottom > containerBounds.top &&
          bounds.top < containerBounds.bottom;
      });

      if (revealLines.length === 0) {
        setIsEntrancePending(false);
        return;
      }

      revealLines.forEach((line, index) => {
        line.style.setProperty('--initial-reveal-delay', `${index * 35}ms`);
        const handleAnimationEnd = event => {
          if (event.target === line) finishReveal(line);
        };
        animationEndHandlers.set(line, handleAnimationEnd);
        line.addEventListener('animationend', handleAnimationEnd);
      });
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (cancelled) return;
        revealLines.forEach(line => {
          if (line.isConnected) line.classList.add('initial-reveal');
        });
        setIsEntrancePending(false);
        fallbackTimeout = window.setTimeout(() => {
          revealLines.forEach(finishReveal);
          fallbackTimeout = null;
        }, 240 + Math.max(0, revealLines.length - 1) * 35 + 100);
      });
    };

    frame = window.requestAnimationFrame(startReveal);
    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
      revealLines.forEach(finishReveal);
    };
  }, [isSongModalReady, selectedSong?.trackId, shouldAnimateEntrance]);

  return (
    <div
      className={`live-lyrics-preview${!isPlayingCurrentSong ? ' playback-stopped' : ''}${isEntrancePending ? ' live-lyrics-entrance-pending' : ''}`}
      ref={containerRef}
      style={{ '--dyn-live-sync-gap': settings?.liveSyncLineGap ?? 16 }}
    >
      {syncWorkspaceLyrics.map((line, index) => (
        <LyricLineWrapper
          key={index}
          lineObj={line}
          savedNode={syncList?.[index]}
          nextStart={nextStarts[index]}
          liveLayoutCacheKey={JSON.stringify([
            selectedSong?.trackId,
            index,
            line.text,
            syncList?.[index]?.text,
            syncList?.[index]?.translation,
            syncList?.[index]?.pronunciation,
            syncList?.[index]?.adlibs
          ])}
          viewMode="live"
          handleLineClick={handleLineClick}
          masterPalette={masterPalette}
          isPlayingCurrentSong={isPlayingCurrentSong}
        />
      ))}
    </div>
  );
};

export default LiveLyricsView;
