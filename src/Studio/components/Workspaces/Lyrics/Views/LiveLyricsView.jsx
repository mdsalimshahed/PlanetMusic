/* --- src/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx --- */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import { buildTimedLineData, findActiveLineIndex, getCenteredScrollTop } from './liveLyricsUtils.js';
import './LiveLyricsView.css';

const getActiveLineScrollTop = (container, node) => {
  const containerBounds = container.getBoundingClientRect();
  const activeBounds = node.getBoundingClientRect();
  return getCenteredScrollTop({
    scrollTop: container.scrollTop,
    viewportTop: containerBounds.top + container.clientTop,
    viewportHeight: container.clientHeight,
    activeTop: activeBounds.top,
    activeHeight: activeBounds.height,
    maxScrollTop: container.scrollHeight - container.clientHeight
  });
};

const LiveLyricsView = ({
  liveParsedLyrics,
  selectedSong,
  masterPalette,
  isPlayingCurrentSong,
  handleLineClick,
  settings,
  currentTrack,
  isSongModalReady = true,
  lyricsPlaybackOffsetSeconds = 0,
  shouldAnimateEntrance = false,
  onEntranceAnimationComplete
}) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
    const timedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
    const adlibTimelineRef = useRef([]);
    const adlibCursorRef = useRef(0);
    const lastAdlibTimeRef = useRef(null);
    const pendingCenterTargetRef = useRef(null);
    const activeLineIndexRef = useRef(-1);
    const needsInitialCenterRef = useRef(true);
    const layoutReadyRef = useRef(false);
    const previousSelectedTrackIdRef = useRef(
      selectedSong?.trackId == null ? null : String(selectedSong.trackId)
    );
    const syncList = selectedSong?.syncData;
  const [readyLayoutSource, setReadyLayoutSource] = useState(null);
  const layoutSource = useMemo(() => ({
    lyrics: liveParsedLyrics,
    syncData: syncList,
    readyLines: new Set()
  }), [liveParsedLyrics, syncList]);
  const isLayoutReady = isSongModalReady &&
    (liveParsedLyrics.length === 0 || readyLayoutSource === layoutSource);
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

  const centerActiveLine = useCallback((node) => {
    if (!node) return;
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = getActiveLineScrollTop(container, node);
    if (Math.abs(scrollTop - container.scrollTop) >= 1) {
      const pendingTarget = pendingCenterTargetRef.current;
      if (pendingTarget && Math.abs(pendingTarget.top - scrollTop) < 1) {
        needsInitialCenterRef.current = false;
        return;
      }

      if (pendingTarget) window.clearTimeout(pendingTarget.timeout);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        container.scrollTop = scrollTop;
        pendingCenterTargetRef.current = null;
      } else {
        const timeout = window.setTimeout(() => {
          pendingCenterTargetRef.current = null;
        }, 800);
        pendingCenterTargetRef.current = { top: scrollTop, timeout };
        container.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }
    needsInitialCenterRef.current = false;
  }, []);

  const reportLineLayoutReady = useCallback(lineIndex => {
    if (layoutSource.readyLines.has(lineIndex)) return;
    layoutSource.readyLines.add(lineIndex);
    if (layoutSource.readyLines.size < layoutSource.lyrics.length) return;

    if (!layoutReadyRef.current) setReadyLayoutSource(layoutSource);
    layoutReadyRef.current = true;
    const activeLine = cachedLinesRef.current[activeLineIndexRef.current];
    if (activeLine) centerActiveLine(activeLine.node);
  }, [centerActiveLine, layoutSource]);

  const handleTimeUpdate = useCallback((time) => {
    if (!isPlayingCurrentSong) return;
    
    const lines = cachedLinesRef.current;
    const timedLines = timedLinesRef.current;
    const newActiveIndex = findActiveLineIndex(timedLines, time);

    const previousActiveIndex = activeLineIndexRef.current;
    const activeLineChanged = previousActiveIndex !== newActiveIndex;
    if (activeLineChanged) {
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
    if (activeLine && (activeLineChanged || needsInitialCenterRef.current) && layoutReadyRef.current) {
      centerActiveLine(activeLine.node);
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
    layoutReadyRef.current = isLayoutReady;
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
    if (isLayoutReady && !isPlayingCurrentSong) {
      needsInitialCenterRef.current = true;
    }
  }, [
    handleTimeUpdate,
    isPlayingCurrentSong,
    liveParsedLyrics,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.syncData,
    timedLineData,
    isLayoutReady
  ]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldAnimateEntrance || !isLayoutReady) return undefined;
    if (
      settings?.disableAnimations ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      onEntranceAnimationComplete?.(selectedSong?.trackId);
      return undefined;
    }

    let revealTimeout = null;
    let fallbackTimeout = null;
    let revealFrame = null;
    let revealed = false;
    let cancelled = false;
    let preparedLines = new Set();
    const getVisibleLines = () => {
      const bounds = container.getBoundingClientRect();
      return new Set(Array.from(container.querySelectorAll('.lyric-line-wrapper'))
        .filter(line => {
          const lineBounds = line.getBoundingClientRect();
          return lineBounds.height > 0 &&
            lineBounds.bottom > bounds.top &&
            lineBounds.top < bounds.bottom;
        }));
    };
    const prepareVisibleLines = () => {
      const visibleLines = getVisibleLines();
      preparedLines.forEach(line => {
        if (!visibleLines.has(line)) line.classList.remove('is-preparing-reveal');
      });
      visibleLines.forEach(line => line.classList.add('is-preparing-reveal'));
      preparedLines = visibleLines;
    };
    const clearRevealTimeout = () => {
      if (revealTimeout !== null) {
        window.clearTimeout(revealTimeout);
        revealTimeout = null;
      }
    };
    const finishReveal = line => {
      line.classList.add('has-revealed');
      line.classList.remove('initial-reveal', 'is-preparing-reveal');
      line.style.removeProperty('--initial-reveal-delay');
      line.removeEventListener('animationend', handleAnimationEnd);
    };
    const handleAnimationEnd = event => {
      if (event.target !== event.currentTarget) return;
      finishReveal(event.currentTarget);
      if (!container.querySelector('.initial-reveal')) {
        if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
        onEntranceAnimationComplete?.(selectedSong?.trackId);
      }
    };
    const revealVisibleLines = () => {
      if (revealed) return;
      clearRevealTimeout();
      const pendingTarget = pendingCenterTargetRef.current;
      if (pendingTarget && Math.abs(container.scrollTop - pendingTarget.top) > 1) {
        revealTimeout = window.setTimeout(revealVisibleLines, 100);
        return;
      }

      const visibleLines = Array.from(getVisibleLines());

      if (visibleLines.length === 0) {
        revealTimeout = window.setTimeout(revealVisibleLines, 100);
        return;
      }

      revealed = true;
      container.removeEventListener('scroll', scheduleReveal);
      container.removeEventListener('scrollend', revealVisibleLines);
      prepareVisibleLines();
      revealFrame = window.requestAnimationFrame(() => {
        revealFrame = null;
        if (cancelled) return;
        visibleLines.forEach((line, index) => {
          if (!line.isConnected) return;
          line.style.setProperty('--initial-reveal-delay', `${index * 55}ms`);
          line.addEventListener('animationend', handleAnimationEnd);
          line.classList.remove('is-preparing-reveal');
          line.classList.add('initial-reveal');
        });
        fallbackTimeout = window.setTimeout(() => {
          visibleLines.forEach(finishReveal);
          onEntranceAnimationComplete?.(selectedSong?.trackId);
        }, 260 + Math.max(0, visibleLines.length - 1) * 55 + 100);
      });
    };
    const scheduleReveal = () => {
      prepareVisibleLines();
      clearRevealTimeout();
      revealVisibleLines();
    };

    prepareVisibleLines();
    container.addEventListener('scroll', scheduleReveal, { passive: true });
    container.addEventListener('scrollend', revealVisibleLines);
    revealVisibleLines();

    return () => {
      cancelled = true;
      clearRevealTimeout();
      if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
      if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
      container.removeEventListener('scroll', scheduleReveal);
      container.removeEventListener('scrollend', revealVisibleLines);
      container.querySelectorAll('.initial-reveal')
        .forEach(finishReveal);
      preparedLines.forEach(line => line.classList.remove('is-preparing-reveal'));
    };
  }, [
    liveParsedLyrics,
    onEntranceAnimationComplete,
    isLayoutReady,
    selectedSong?.trackId,
    settings?.disableAnimations,
    shouldAnimateEntrance
  ]);

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

    const clearAllActive = () => {
        clearActiveLines();
        cachedAdlibsRef.current.forEach(item => {
            if (item.state !== 'hidden') {
                item.node.classList.add('adlib-hidden');
                item.node.classList.remove('adlib-active', 'adlib-visible');
                item.state = 'hidden';
            }
        });
        adlibCursorRef.current = 0;
        lastAdlibTimeRef.current = null;
    };

    const handleTimeEvent = (e) => handleTimeUpdate(e.detail - lyricsPlaybackOffsetSeconds);
    const handlePlayState = (e) => {
        if (e.detail.isEnded) {
            clearActiveLines();
        }
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalPlayState', handlePlayState);

    const selectedTrackId = selectedSong?.trackId == null ? null : String(selectedSong.trackId);
    const selectedTrackChanged = previousSelectedTrackIdRef.current !== selectedTrackId;
    previousSelectedTrackIdRef.current = selectedTrackId;

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime - lyricsPlaybackOffsetSeconds);
    } else if (currentTrack || selectedTrackChanged) {
        clearAllActive();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
    }, [isPlayingCurrentSong, currentTrack, selectedSong?.trackId, lyricsPlaybackOffsetSeconds, handleTimeUpdate]);

  return (
    <div
      className={`live-lyrics-preview${isLayoutReady ? '' : ' is-layout-pending'}`}
      ref={containerRef}
      aria-hidden={!isLayoutReady}
      style={{ '--dyn-live-sync-gap': `${settings?.liveSyncLineGap ?? 16}px` }}
    >
      {liveParsedLyrics.map((line, i) => {
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
              lineIndex={i}
              isSongModalReady={isSongModalReady}
              onLiveLayoutReady={reportLineLayoutReady}
            />
        )
      })}
    </div>
  );
};

export default LiveLyricsView;