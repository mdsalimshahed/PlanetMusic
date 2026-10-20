/* --- src/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx --- */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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
  lyricsPlaybackOffsetSeconds = 0
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
    if (activeLine && (activeLineChanged || needsInitialCenterRef.current)) {
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
    liveParsedLyrics,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.syncData,
    timedLineData
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
      className="live-lyrics-preview"
      ref={containerRef}
      style={{ '--dyn-live-sync-gap': settings?.liveSyncLineGap ?? 16 }}
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
            />
        )
      })}
    </div>
  );
};

export default LiveLyricsView;