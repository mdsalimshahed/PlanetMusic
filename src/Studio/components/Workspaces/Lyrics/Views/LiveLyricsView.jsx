/* --- src/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx --- */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import { buildTimedLineData, findActiveLineIndex } from './liveLyricsUtils.js';
import './LiveLyricsView.css';

const getActiveLineScrollTop = (container, node) => {
  const containerBounds = container.getBoundingClientRect();
  const activeBounds = node.getBoundingClientRect();
  const visibleTop = containerBounds.top + container.clientTop;
  const visibleBottom = visibleTop + container.clientHeight;
  const safeInset = container.clientHeight * 0.04;
  const desiredCenter = visibleTop + container.clientHeight * 0.45;
  const centeredTarget = container.scrollTop +
    activeBounds.top + activeBounds.height / 2 - desiredCenter;
  const firstFullyVisibleTarget = container.scrollTop +
    activeBounds.bottom - (visibleBottom - safeInset);
  const lastFullyVisibleTarget = container.scrollTop +
    activeBounds.top - (visibleTop + safeInset);
  const safeVisibleHeight = container.clientHeight - safeInset * 2;
  const targetTop = activeBounds.height <= safeVisibleHeight
    ? Math.max(firstFullyVisibleTarget, Math.min(centeredTarget, lastFullyVisibleTarget))
    : lastFullyVisibleTarget;

  return Math.max(0, Math.min(targetTop, container.scrollHeight - container.clientHeight));
};

const isAtDesiredLinePosition = (container, node) => {
  const targetTop = getActiveLineScrollTop(container, node);
  const tolerance = Math.max(1, container.clientHeight * 0.005);
  return Math.abs(container.scrollTop - targetTop) <= tolerance;
};

const cancelPendingScroll = pendingTargetRef => {
  const pendingTarget = pendingTargetRef.current;
  if (pendingTarget) window.cancelAnimationFrame(pendingTarget.frame);
  pendingTargetRef.current = null;
};

const scrollToActiveLineNormally = (container, node, pendingTargetRef) => {
  const targetTop = getActiveLineScrollTop(container, node);
  if (isAtDesiredLinePosition(container, node)) {
    cancelPendingScroll(pendingTargetRef);
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cancelPendingScroll(pendingTargetRef);
    container.scrollTop = targetTop;
    return;
  }

  cancelPendingScroll(pendingTargetRef);
  const startTop = container.scrollTop;
  const distance = targetTop - startTop;
  const duration = Math.min(280, Math.max(130, Math.abs(distance) * 0.45));
  const animation = {
    type: 'normal',
    container,
    node,
    top: targetTop,
    frame: null,
    startTop,
    startTime: null,
    duration
  };
  pendingTargetRef.current = animation;

  const animate = timestamp => {
    if (pendingTargetRef.current !== animation) return;
    if (!animation.node.isConnected) {
      pendingTargetRef.current = null;
      return;
    }

    if (animation.startTime === null) animation.startTime = timestamp;
    const progress = Math.min(1, (timestamp - animation.startTime) / animation.duration);
    container.scrollTop = animation.startTop + distance * progress;
    if (progress === 1) {
      pendingTargetRef.current = null;
      return;
    }
    animation.frame = window.requestAnimationFrame(animate);
  };

  animation.frame = window.requestAnimationFrame(animate);
};

const smoothScrollToActiveLine = (container, node, pendingTargetRef) => {
  const pendingTarget = pendingTargetRef.current;
  if (isAtDesiredLinePosition(container, node)) {
    if (pendingTarget) window.cancelAnimationFrame(pendingTarget.frame);
    pendingTargetRef.current = null;
    return;
  }

  const targetTop = getActiveLineScrollTop(container, node);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (pendingTarget) window.cancelAnimationFrame(pendingTarget.frame);
    container.scrollTop = targetTop;
    pendingTargetRef.current = null;
    return;
  }

  if (pendingTarget) {
    if (pendingTarget.container === container && pendingTarget.type === 'smooth') {
      pendingTarget.node = node;
      if (Math.abs(pendingTarget.top - targetTop) >= 0.5) pendingTarget.top = targetTop;
      return;
    }
    window.cancelAnimationFrame(pendingTarget.frame);
  } else if (Math.abs(targetTop - container.scrollTop) < 1) {
    return;
  }

  const animation = {
    type: 'smooth',
    container,
    node,
    top: targetTop,
    frame: null,
    lastTimestamp: null,
    velocity: 0
  };
  pendingTargetRef.current = animation;

  const animate = timestamp => {
    if (pendingTargetRef.current !== animation) return;
    if (!animation.node.isConnected) {
      pendingTargetRef.current = null;
      return;
    }
    if (isAtDesiredLinePosition(container, animation.node)) {
      container.scrollTop = getActiveLineScrollTop(container, animation.node);
      pendingTargetRef.current = null;
      return;
    }

    const elapsed = animation.lastTimestamp === null
      ? 0
      : Math.min((timestamp - animation.lastTimestamp) / 1000, 0.032);
    animation.lastTimestamp = timestamp;

    if (elapsed > 0) {
      const omega = 5;
      const error = container.scrollTop - animation.top;
      const combinedVelocity = animation.velocity + omega * error;
      const decay = Math.exp(-omega * elapsed);
      const nextError = (error + combinedVelocity * elapsed) * decay;
      animation.velocity = (animation.velocity - omega * combinedVelocity * elapsed) * decay;

      if (Math.abs(nextError) < 0.5 && Math.abs(animation.velocity) < 5) {
        container.scrollTop = animation.top;
        pendingTargetRef.current = null;
        return;
      }

      container.scrollTop = animation.top + nextError;
      if (isAtDesiredLinePosition(container, animation.node)) {
        container.scrollTop = getActiveLineScrollTop(container, animation.node);
        pendingTargetRef.current = null;
        return;
      }
    }

    animation.frame = window.requestAnimationFrame(animate);
  };

  animation.frame = window.requestAnimationFrame(animate);
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
  onEntranceAnimationStart
}) => {
  const containerRef = useRef(null);
  const activeLineResizeObserverRef = useRef(null);
  const suppressLayoutScrollUntilRef = useRef(0);
  const pendingSeekRef = useRef(false);
  const shouldAnimateEntranceRef = useRef(shouldAnimateEntrance);
  const revealedLinesRef = useRef(new WeakSet());
  const cachedLinesRef = useRef([]);
    const timedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
    const adlibTimelineRef = useRef([]);
    const adlibCursorRef = useRef(0);
    const lastAdlibTimeRef = useRef(null);
    const pendingCenterTargetRef = useRef(null);
    const activeLineIndexRef = useRef(-1);
    const needsInitialCenterRef = useRef(true);
    const previousSelectedTrackIdRef = useRef(
      selectedSong?.trackId == null ? null : String(selectedSong.trackId)
    );
    const syncList = selectedSong?.syncData;
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

  useEffect(() => {
    shouldAnimateEntranceRef.current = shouldAnimateEntrance;
  }, [shouldAnimateEntrance]);

  const centerActiveLine = useCallback((node, isSeek) => {
    if (!node) return;
    const container = containerRef.current;
    if (!container) return;

    if (isSeek) {
      smoothScrollToActiveLine(container, node, pendingCenterTargetRef);
    } else {
      scrollToActiveLineNormally(container, node, pendingCenterTargetRef);
    }
    needsInitialCenterRef.current = false;
  }, []);

  const handleTimeUpdate = useCallback((time) => {
    if (!isPlayingCurrentSong) return;
    
    const lines = cachedLinesRef.current;
    const timedLines = timedLinesRef.current;
    const newActiveIndex = findActiveLineIndex(timedLines, time);

    const previousActiveIndex = activeLineIndexRef.current;
    const activeLineChanged = previousActiveIndex !== newActiveIndex;
    const isSeek = pendingSeekRef.current;
    pendingSeekRef.current = false;
    if (activeLineChanged) {
      suppressLayoutScrollUntilRef.current = performance.now() + 100;
      lines.forEach((line, index) => {
        if (index === newActiveIndex) {
          line.node.classList.add('active');
          line.isActive = true;
        } else if (line.isActive) {
          line.node.classList.remove('active');
          line.isActive = false;
        }
      });
      activeLineIndexRef.current = newActiveIndex;
    }

    const activeLine = lines[newActiveIndex];
    if (activeLine && (activeLineChanged || needsInitialCenterRef.current || isSeek)) {
      centerActiveLine(activeLine.node, isSeek || needsInitialCenterRef.current);
    }

    const adlibTimeline = adlibTimelineRef.current;
    const lastAdlibTime = lastAdlibTimeRef.current;
    if (lastAdlibTime === null || time < lastAdlibTime) {
        cachedAdlibsRef.current.forEach(item => updateAdlibStateAtTime(item, time));
        adlibCursorRef.current = findAdlibBoundaryCursor(adlibTimeline, time);
    } else {
        while (adlibCursorRef.current < adlibTimeline.length && adlibTimeline[adlibCursorRef.current].time <= time) {
            updateAdlibStateAtTime(adlibTimeline[adlibCursorRef.current].item, time);
            adlibCursorRef.current++;
        }
    }
    lastAdlibTimeRef.current = time;
  }, [centerActiveLine, isPlayingCurrentSong]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    cachedLinesRef.current = Array.from(container.querySelectorAll('.lyric-line-wrapper')).map(node => ({
      node,
      isActive: node.classList.contains('active')
    }));
    timedLinesRef.current = timedLineData
      .filter(line => cachedLinesRef.current[line.index])
      .map(line => ({
        ...line,
        node: cachedLinesRef.current[line.index].node
      }));
    activeLineIndexRef.current = cachedLinesRef.current.findIndex(line => line.isActive);

    cachedAdlibsRef.current = Array.from(container.querySelectorAll('.adlib-node')).map(node => ({
      node,
      start: parseFloat(node.dataset.start),
      end: parseFloat(node.dataset.end),
      state: node.classList.contains('adlib-active') ? 'active' : (node.classList.contains('adlib-visible') ? 'visible' : 'hidden')
    }));
    adlibTimelineRef.current = buildAdlibTimeline(cachedAdlibsRef.current);
    adlibCursorRef.current = 0;
    lastAdlibTimeRef.current = null;

    if (isPlayingCurrentSong && typeof window.currentAudioTime === 'number') {
      handleTimeUpdate(window.currentAudioTime - lyricsPlaybackOffsetSeconds);
    } else if (!isPlayingCurrentSong) {
      cachedAdlibsRef.current.forEach(item => {
        item.node.classList.add('adlib-visible');
        item.node.classList.remove('adlib-hidden', 'adlib-active');
        item.state = 'visible';
      });
    }
    if (!isPlayingCurrentSong) {
      needsInitialCenterRef.current = true;
    }
  }, [
    handleTimeUpdate,
    isPlayingCurrentSong,
    syncWorkspaceLyrics,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.syncData,
    timedLineData
  ]);

  useLayoutEffect(() => {
    if (!isSongModalReady) return undefined;
    let frame = null;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      const container = containerRef.current;
      const activeLine = container?.querySelector('.lyric-line-wrapper.active');
      if (container && activeLine) {
        smoothScrollToActiveLine(container, activeLine, pendingCenterTargetRef);
      }
    });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [isSongModalReady, selectedSong?.trackId, currentTrack?.trackId, timedLineData]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    let frame = null;
    const linePositions = new Map(
      Array.from(container.querySelectorAll('.lyric-line-wrapper'))
        .map((line, index) => [line, index])
    );
    const observer = new ResizeObserver(entries => {
      if (performance.now() < suppressLayoutScrollUntilRef.current) return;
      const activeLine = container.querySelector('.lyric-line-wrapper.active');
      if (!activeLine) return;
      const activeLineIndex = linePositions.get(activeLine);
      const affectsActivePosition = entries.some(({ target }) => (
        target === container ||
        (linePositions.has(target) && linePositions.get(target) <= activeLineIndex)
      ));
      if (!affectsActivePosition || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (performance.now() < suppressLayoutScrollUntilRef.current) return;
        const currentActiveLine = container.querySelector('.lyric-line-wrapper.active');
        if (currentActiveLine) {
          smoothScrollToActiveLine(container, currentActiveLine, pendingCenterTargetRef);
        }
      });
    });
    observer.observe(container);
    container.querySelectorAll('.lyric-line-wrapper').forEach(line => {
      observer.observe(line);
    });
    activeLineResizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      activeLineResizeObserverRef.current = null;
    };
  }, [syncWorkspaceLyrics]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !isSongModalReady || selectedSong?.trackId == null) return undefined;

    const containerBounds = container.getBoundingClientRect();
    const mountedLines = Array.from(container.querySelectorAll('.lyric-line-wrapper'));
    const visibleLines = mountedLines.filter(line => {
      const bounds = line.getBoundingClientRect();
      return bounds.height > 0 &&
        bounds.bottom > containerBounds.top &&
        bounds.top < containerBounds.bottom &&
        bounds.bottom > 0 &&
        bounds.top < window.innerHeight;
    });
    if (visibleLines.length === 0) return undefined;

    const firstVisibleLineIndex = mountedLines.indexOf(visibleLines[0]);
    const lastVisibleLineIndex = mountedLines.indexOf(visibleLines[visibleLines.length - 1]);
    const revealLines = mountedLines
      .slice(firstVisibleLineIndex, lastVisibleLineIndex + 4)
      .filter(line => !revealedLinesRef.current.has(line));
    if (revealLines.length === 0) return undefined;
    if (!shouldAnimateEntranceRef.current) {
      revealLines.forEach(line => revealedLinesRef.current.add(line));
      return undefined;
    }
    onEntranceAnimationStart?.(selectedSong?.trackId);
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      revealLines.forEach(line => revealedLinesRef.current.add(line));
      return undefined;
    }

    revealLines.forEach(line => line.classList.add('is-preparing-reveal'));
    let revealFrame = null;
    let cancelled = false;
    revealFrame = window.requestAnimationFrame(() => {
      revealFrame = null;
      if (cancelled) return;

      revealLines.forEach(line => {
        if (!line.isConnected) return;
        revealedLinesRef.current.add(line);
        const lineIndex = mountedLines.indexOf(line);
        const staggerIndex = Math.max(0, lineIndex - firstVisibleLineIndex);
        line.style.setProperty('--initial-reveal-delay', `${staggerIndex * 55}ms`);
        const finishReveal = event => {
          if (event.target !== line) return;
          line.classList.add('has-revealed');
          line.classList.remove('initial-reveal');
          line.style.removeProperty('--initial-reveal-delay');
          line.removeEventListener('animationend', finishReveal);
        };
        line.addEventListener('animationend', finishReveal);
        line.classList.remove('is-preparing-reveal');
        line.classList.add('initial-reveal');
      });
    });

    return () => {
      cancelled = true;
      if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
      revealLines.forEach(line => line.classList.remove('is-preparing-reveal'));
    };
  }, [
    syncWorkspaceLyrics,
    selectedSong?.trackId,
    isSongModalReady,
    onEntranceAnimationStart
  ]);

  useEffect(() => {
    return () => {
      activeLineResizeObserverRef.current?.disconnect();
      activeLineResizeObserverRef.current = null;
      if (pendingCenterTargetRef.current) {
        window.cancelAnimationFrame(pendingCenterTargetRef.current.frame);
        pendingCenterTargetRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const clearActiveLines = () => {
        cachedLinesRef.current.forEach(item => {
            if (item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
        });
        activeLineIndexRef.current = -1;
        needsInitialCenterRef.current = true;
    };

    const handleTimeEvent = (e) => handleTimeUpdate(e.detail - lyricsPlaybackOffsetSeconds);
    const handleTimeSeek = () => {
      pendingSeekRef.current = true;
    };
    const handlePlayState = (e) => {
        if (e.detail.isEnded) {
            clearActiveLines();
        }
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalTimeSeek', handleTimeSeek);
    window.addEventListener('globalPlayState', handlePlayState);

    const selectedTrackId = selectedSong?.trackId == null ? null : String(selectedSong.trackId);
    const selectedTrackChanged = previousSelectedTrackIdRef.current !== selectedTrackId;
    previousSelectedTrackIdRef.current = selectedTrackId;

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime - lyricsPlaybackOffsetSeconds);
    } else if (currentTrack || selectedTrackChanged) {
        clearActiveLines();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalTimeSeek', handleTimeSeek);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
    }, [isPlayingCurrentSong, currentTrack, selectedSong?.trackId, lyricsPlaybackOffsetSeconds, handleTimeUpdate]);

  return (
    <div
      className="live-lyrics-preview"
      ref={containerRef}
      style={{ '--dyn-live-sync-gap': settings?.liveSyncLineGap ?? 16 }}
    >
      {syncWorkspaceLyrics.map((line, i) => {
        return (
            <LyricLineWrapper
              key={i}
              lineObj={line}
              savedNode={syncList?.[i]}
              nextStart={nextStarts[i]}
              viewMode="live"
              handleLineClick={handleLineClick}
              masterPalette={masterPalette}
              isPlayingCurrentSong={false}
            />
        )
      })}
    </div>
  );
};

export default LiveLyricsView;