import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import {
  buildTimedLineData,
  findActiveLineIndex
} from './liveLyricsUtils.js';
import './LiveLyricsView.css';

const getActiveLineScrollTop = (container, node) => {
  const viewportAnchor = container.clientHeight * 0.5;
  const layoutTop = node.offsetTop;
  const layoutHeight = node.offsetHeight;
  const targetTop = layoutTop + layoutHeight / 2 - viewportAnchor;

  return Math.max(
    0,
    Math.min(targetTop, container.scrollHeight - container.clientHeight)
  );
};

const alignActiveLine = (container, node, frameRef) => {
  if (frameRef?.current !== null && frameRef?.current !== undefined) {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
  container.scrollTop = getActiveLineScrollTop(container, node);
};

const scrollToActiveLine = (container, node, frameRef) => {
  const targetTop = getActiveLineScrollTop(container, node);
  const startTop = container.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) {
    container.scrollTop = targetTop;
    return;
  }

  if (frameRef.current !== null) {
    window.cancelAnimationFrame(frameRef.current);
  }
  const startedAt = performance.now();
  const duration = 420;
  const step = now => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - ((1 - progress) ** 3);
    container.scrollTop = startTop + distance * eased;
    if (progress < 1) {
      frameRef.current = window.requestAnimationFrame(step);
    } else {
      frameRef.current = null;
    }
  };
  frameRef.current = window.requestAnimationFrame(step);
};

const animateActiveLineHandoff = (container, previousLine, activeLine) => {
  if (!previousLine || !activeLine || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    alignActiveLine(container, activeLine);
    return;
  }

  const startTop = container.scrollTop;
  const targetTop = getActiveLineScrollTop(container, activeLine);
  if (Math.abs(targetTop - startTop) < 1) {
    alignActiveLine(container, activeLine);
    return;
  }

  previousLine.classList.add('is-line-exiting');
  activeLine.classList.add('is-line-entering');
  const duration = 420;
  const startedAt = performance.now();

  const step = now => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - ((1 - progress) ** 3);
    container.scrollTop = startTop + (targetTop - startTop) * eased;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      container.scrollTop = targetTop;
      previousLine.classList.remove('is-line-exiting');
      activeLine.classList.remove('is-line-entering');
    }
  };

  window.requestAnimationFrame(step);
};

const LiveLyricsView = ({
  syncWorkspaceLyrics,
  selectedSong,
  masterPalette,
  isPlayingCurrentSong,
  handleLineClick,
  settings,
  currentTrack,
  lyricsPlaybackOffsetSeconds = 0
}) => {
  const containerRef = useRef(null);
  const activeScrollFrameRef = useRef(null);
  const hasProcessedPlaybackTimeRef = useRef(false);
  const pendingSeekRef = useRef(false);
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
      }
      if (newActiveIndex >= 0) {
        lines[newActiveIndex]?.node.classList.add('active');
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
        if (activeLineChanged && !isSeek && !alignImmediately) {
          scrollToActiveLine(container, activeLine, activeScrollFrameRef);
        } else {
          alignActiveLine(container, activeLine, activeScrollFrameRef);
        }
      }
    }
    hasProcessedPlaybackTimeRef.current = true;

    const adlibTimeline = adlibTimelineRef.current;
    const lastAdlibTime = lastAdlibTimeRef.current;
    if (lastAdlibTime === null || time < lastAdlibTime) {
      cachedAdlibsRef.current.forEach(item => updateAdlibStateAtTime(
        item,
        time
      ));
      adlibCursorRef.current = findAdlibBoundaryCursor(adlibTimeline, time);
    } else {
      while (
        adlibCursorRef.current < adlibTimeline.length &&
        adlibTimeline[adlibCursorRef.current].time <= time
      ) {
        updateAdlibStateAtTime(
          adlibTimeline[adlibCursorRef.current].item,
          time
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
      cachedLinesRef.current.forEach(line => line.node.classList.remove('active'));
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
      if (event.detail?.isEnded) clearActiveLine();
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

    const realignActiveLine = () => {
      const activeLine = container.querySelector('.preview-line.active');
      if (activeLine) {
        alignActiveLine(container, activeLine, activeScrollFrameRef);
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

  return (
    <div
      className={`live-lyrics-preview${!isPlayingCurrentSong ? ' playback-stopped' : ''}`}
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
