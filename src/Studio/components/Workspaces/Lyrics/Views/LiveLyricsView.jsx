import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import {
  buildTimedLineData,
  findActiveLineIndex
} from './liveLyricsUtils.js';
import './LiveLyricsView.css';

const getActiveLineScrollTop = (container, node) => {
  const containerBounds = container.getBoundingClientRect();
  const activeBounds = node.getBoundingClientRect();
  if (
    !Number.isFinite(containerBounds.top) ||
    !Number.isFinite(activeBounds.top) ||
    !Number.isFinite(activeBounds.height) ||
    activeBounds.height <= 0
  ) {
    return container.scrollTop;
  }

  const scaleY = container.offsetHeight > 0
    ? containerBounds.height / container.offsetHeight
    : 1;
  const viewportTop = containerBounds.top + container.clientTop * scaleY;
  const activeTop = container.scrollTop +
    (activeBounds.top - viewportTop) / scaleY;
  const activeHeight = activeBounds.height / scaleY;
  const preferredTop = container.clientHeight * 0.42;
  const safeInset = Math.min(24, container.clientHeight * 0.06);
  const targetTop = activeHeight + safeInset * 2 <= container.clientHeight
    ? activeTop + activeHeight / 2 - preferredTop
    : activeTop - safeInset;

  return Math.max(
    0,
    Math.min(targetTop, container.scrollHeight - container.clientHeight)
  );
};

const cancelActiveLineScroll = pendingScrollRef => {
  const animation = pendingScrollRef.current;
  if (!animation) return;
  if (animation.frame !== null) window.cancelAnimationFrame(animation.frame);
  pendingScrollRef.current = null;
};

const alignActiveLine = (container, node, pendingScrollRef) => {
  cancelActiveLineScroll(pendingScrollRef);
  container.scrollTop = getActiveLineScrollTop(container, node);
};

const animateToActiveLine = (container, node, pendingScrollRef) => {
  cancelActiveLineScroll(pendingScrollRef);
  const startTop = container.scrollTop;
  const targetTop = getActiveLineScrollTop(container, node);
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    Math.abs(targetTop - startTop) < 1
  ) {
    container.scrollTop = targetTop;
    return;
  }

  const duration = 420;
  const animation = { frame: null, startedAt: null };
  pendingScrollRef.current = animation;

  const step = timestamp => {
    if (pendingScrollRef.current !== animation) return;
    if (!node.isConnected) {
      pendingScrollRef.current = null;
      return;
    }
    if (animation.startedAt === null) animation.startedAt = timestamp;
    const progress = Math.min((timestamp - animation.startedAt) / duration, 1);
    const easedProgress = 1 - ((1 - progress) ** 3);
    container.scrollTop = startTop + (targetTop - startTop) * easedProgress;
    if (progress === 1) {
      pendingScrollRef.current = null;
      return;
    }
    animation.frame = window.requestAnimationFrame(step);
  };
  animation.frame = window.requestAnimationFrame(step);
};

const retriggerGlyphShine = activeLine => {
  if (!activeLine) return;
  activeLine.classList.remove('is-shining');
  activeLine.querySelectorAll('.lyric-word').forEach((word, index) => {
    word.style.setProperty('--word-index', String(index));
  });
  void activeLine.offsetWidth;
  activeLine.classList.add('is-shining');
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
  shouldAnimateEntrance = true
}) => {
  const containerRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const hasProcessedPlaybackTimeRef = useRef(false);
  const pendingSeekRef = useRef(false);
  const [isEntrancePending, setIsEntrancePending] = useState(shouldAnimateEntrance);
  const hasAlignedMountRef = useRef(false);
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
    alignImmediately = false
  } = {}) => {
    if (!shouldUseSelectedSongTime || !Number.isFinite(time)) return;

    const lines = cachedLinesRef.current;
    const newActiveIndex = findActiveLineIndex(timedLinesRef.current, time);
    const previousActiveIndex = activeLineIndexRef.current;
    const activeLineChanged = previousActiveIndex !== newActiveIndex;
    if (activeLineChanged) {
      if (previousActiveIndex >= 0) {
        lines[previousActiveIndex]?.node.classList.remove('active');
        lines[previousActiveIndex]?.node.classList.remove('is-shining');
      }
      if (newActiveIndex >= 0) {
        lines[newActiveIndex]?.node.classList.add('active');
        retriggerGlyphShine(lines[newActiveIndex].node);
      }
      activeLineIndexRef.current = newActiveIndex;
    }

    const activeLine = lines[newActiveIndex]?.node;
    if (activeLine && (
      activeLineChanged ||
      alignImmediately ||
      isSeek
    )) {
      const container = containerRef.current;
      if (container) {
        if (
          activeLineChanged &&
          !isSeek &&
          !alignImmediately &&
          hasProcessedPlaybackTimeRef.current
        ) {
          animateToActiveLine(container, activeLine, pendingScrollRef);
        } else {
          alignActiveLine(container, activeLine, pendingScrollRef);
        }
      }
    }
    hasProcessedPlaybackTimeRef.current = true;

    const adlibTimeline = adlibTimelineRef.current;
    const lastAdlibTime = lastAdlibTimeRef.current;
    if (lastAdlibTime === null || time < lastAdlibTime) {
      cachedAdlibsRef.current.forEach(item => updateAdlibStateAtTime(
        item,
        time,
        { persistActive: true }
      ));
      adlibCursorRef.current = findAdlibBoundaryCursor(adlibTimeline, time);
    } else {
      while (
        adlibCursorRef.current < adlibTimeline.length &&
        adlibTimeline[adlibCursorRef.current].time <= time
      ) {
        updateAdlibStateAtTime(
          adlibTimeline[adlibCursorRef.current].item,
          time,
          { persistActive: true }
        );
        adlibCursorRef.current++;
      }
    }
    lastAdlibTimeRef.current = time;
  }, [shouldUseSelectedSongTime]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    if (shouldUseSelectedSongTime) {
      const currentTime = Number.isFinite(window.currentAudioTime)
        ? window.currentAudioTime
        : 0;
      handleTimeUpdate(currentTime - lyricsPlaybackOffsetSeconds, {
        alignImmediately: !hasAlignedMountRef.current
      });
      hasAlignedMountRef.current = true;
    } else {
      cachedLinesRef.current.forEach(line => line.node.classList.remove('active'));
      activeLineIndexRef.current = -1;
      cachedAdlibsRef.current.forEach(item => {
        item.node.classList.add('adlib-visible');
        item.node.classList.remove('adlib-hidden', 'adlib-active');
        item.state = 'visible';
      });
    }
  }, [
    handleTimeUpdate,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.trackId,
    shouldUseSelectedSongTime,
    syncWorkspaceLyrics,
    timedLineData
  ]);

  useEffect(() => {
    const clearActiveLine = () => {
      cachedLinesRef.current.forEach(line => {
        line.node.classList.remove('active', 'is-shining');
      });
      activeLineIndexRef.current = -1;
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
      const time = Number(event.detail);
      if (!Number.isFinite(time)) return;
      handleTimeUpdate(time - lyricsPlaybackOffsetSeconds, {
        isSeek: pendingSeekRef.current
      });
      pendingSeekRef.current = false;
    };
    const handleTimeSeek = () => {
      pendingSeekRef.current = true;
    };
    const handlePlayState = event => {
      if (!event.detail?.isPlaying || event.detail?.isEnded) {
        clearActiveLine();
      }
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalTimeSeek', handleTimeSeek);
    window.addEventListener('globalPlayState', handlePlayState);
    if (shouldUseSelectedSongTime) {
      // The mount layout effect establishes the active line and scroll position.
    } else {
      clearActiveLine();
    }

    return () => {
      window.removeEventListener('globalTimeUpdate', handleTimeEvent);
      window.removeEventListener('globalTimeSeek', handleTimeSeek);
      window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [
    currentTrack,
    handleTimeUpdate,
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
      cancelActiveLineScroll(pendingScrollRef);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const realignActiveLine = () => {
      const activeLine = container.querySelector('.preview-line.active');
      if (activeLine) {
        alignActiveLine(container, activeLine, pendingScrollRef);
      }
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(realignActiveLine);
    resizeObserver?.observe(container);
    window.addEventListener('resize', realignActiveLine);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', realignActiveLine);
    };
  }, []);

  useEffect(() => {
    if (!shouldAnimateEntrance) {
      setIsEntrancePending(false);
      return undefined;
    }

    setIsEntrancePending(true);
    if (!isSongModalReady) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsEntrancePending(false);
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
