/* --- src/components/Workspaces/Lyrics/Views/FocusedLyricsView.jsx --- */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  LyricLineWrapper,
  measureFocusedLineLayout,
  measureFocusedTranslationWidths
} from '../LyricsLineRenderer.jsx';
import { getFocusedLyricsAnimationTiming } from '../focusedLyricsTiming.js';
import { FocusedAdlibsTracker } from '../../Sync/FocusedAdlibsTracker.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import './FocusedLyricsView.css';

const FocusedLyricsView = ({ syncWorkspaceLyrics, selectedSong, masterPalette, isPlayingCurrentSong, handleLineClick, currentTrack, lyricsPlaybackOffsetSeconds = 0 }) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const timedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const adlibTimelineRef = useRef([]);
  const adlibCursorRef = useRef(0);
  const lastAdlibTimeRef = useRef(null);
  const pendingSeekRef = useRef(false);
  const activeLineIndexRef = useRef(-1);
  const syncList = selectedSong?.syncData;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const animationTiming = getFocusedLyricsAnimationTiming();
    container.style.setProperty('--focused-enter-duration', `${animationTiming.enterDuration}s`);
    container.style.setProperty('--focused-enter-stagger', `${animationTiming.enterStagger}s`);
    container.style.setProperty('--focused-exit-duration', `${animationTiming.exitDuration}s`);
    container.style.setProperty(
      '--focused-exit-layer-duration',
      `${animationTiming.exitLayerDuration}s`
    );

    cachedLinesRef.current = Array.from(container.querySelectorAll('.lyric-line-wrapper')).map(node => {
      const start = parseFloat(node.dataset.start);
      const end = parseFloat(node.dataset.end);
      return {
        node,
        start,
        end,
        exitBoundary: end,
        isActive: node.classList.contains('active')
      };
    });
    timedLinesRef.current = cachedLinesRef.current
      .map((line, index) => ({ ...line, index }))
      .filter(line => Number.isFinite(line.start))
      .sort((first, second) => first.start - second.start);
    activeLineIndexRef.current = cachedLinesRef.current.findIndex(line => line.isActive);

    cachedAdlibsRef.current = Array.from(containerRef.current.querySelectorAll('.adlib-node')).map(node => ({
      node,
      start: parseFloat(node.dataset.start),
      end: parseFloat(node.dataset.end),
      state: node.classList.contains('adlib-active') ? 'active' : (node.classList.contains('adlib-visible') ? 'visible' : 'hidden')
    }));
    adlibTimelineRef.current = buildAdlibTimeline(cachedAdlibsRef.current);
    adlibCursorRef.current = 0;
    lastAdlibTimeRef.current = null;

  }, [syncWorkspaceLyrics, selectedSong?.syncData, lyricsPlaybackOffsetSeconds]);

  const handleTimeUpdate = useCallback((time, isSeek = false) => {
    if (!isPlayingCurrentSong) return;

    const lines = cachedLinesRef.current;
    const timedLines = timedLinesRef.current;
    let low = 0;
    let high = timedLines.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (timedLines[middle].start <= time) low = middle + 1;
        else high = middle;
    }

    const candidate = timedLines[low - 1];
    let newActiveIndex = candidate &&
      (isNaN(candidate.exitBoundary) || time < candidate.exitBoundary)
      ? candidate.index
      : -1;

    const previousActiveIndex = activeLineIndexRef.current;
    if (previousActiveIndex !== newActiveIndex) {
        if (previousActiveIndex !== -1) {
            const previousLine = lines[previousActiveIndex];
            measureFocusedLineLayout(previousLine.node);
            previousLine.node.classList.remove('active', 'past');
            if (isSeek) {
              previousLine.node.classList.remove('exiting');
            } else {
              previousLine.node.classList.add('exiting');
            }
            previousLine.isActive = false;
        }

        if (newActiveIndex !== -1) {
            const activeLine = lines[newActiveIndex];
            activeLine.node.classList.add('active');
            measureFocusedLineLayout(activeLine.node);
            measureFocusedTranslationWidths(activeLine.node);
            activeLine.node.classList.remove('exiting', 'past');
            activeLine.isActive = true;
        }
        activeLineIndexRef.current = newActiveIndex;
    }

    if (isSeek && newActiveIndex !== -1 && previousActiveIndex === newActiveIndex) {
      const activeLine = lines[newActiveIndex];
      activeLine.node.classList.remove('active', 'exiting', 'past');
      measureFocusedLineLayout(activeLine.node);
      measureFocusedTranslationWidths(activeLine.node);
      void activeLine.node.offsetWidth;
      activeLine.node.classList.add('active');
      activeLine.isActive = true;
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
  }, [isPlayingCurrentSong]);

  useEffect(() => {
    const clearAllActive = () => {
        cachedLinesRef.current.forEach(item => {
            item.node.classList.remove('active', 'exiting', 'past');
            item.isActive = false;
        });
        activeLineIndexRef.current = -1;
        pendingSeekRef.current = false;
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

    const handleTimeEvent = (e) => {
        const isSeek = pendingSeekRef.current;
        pendingSeekRef.current = false;
        handleTimeUpdate(e.detail - lyricsPlaybackOffsetSeconds, isSeek);
    };
    const handleTimeSeek = () => {
        pendingSeekRef.current = true;
    };
    const handlePlayState = (e) => {
        if (
          !e.detail?.isEnded ||
          String(e.detail.trackId) !== String(selectedSong?.trackId)
        ) return;

        const activeIndex = activeLineIndexRef.current;
        if (activeIndex !== -1) {
          const activeLine = cachedLinesRef.current[activeIndex];
          measureFocusedLineLayout(activeLine.node);
          activeLine.node.classList.remove('active', 'past');
          activeLine.node.classList.add('exiting');
          activeLine.isActive = false;
          activeLineIndexRef.current = -1;
        }

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

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalTimeSeek', handleTimeSeek);
    window.addEventListener('globalPlayState', handlePlayState);

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime - lyricsPlaybackOffsetSeconds);
    } else {
        clearAllActive();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalTimeSeek', handleTimeSeek);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
    }, [isPlayingCurrentSong, currentTrack, syncWorkspaceLyrics, syncList, selectedSong?.trackId, lyricsPlaybackOffsetSeconds, handleTimeUpdate]);

  return (
    <div className="focused-lyrics-preview" ref={containerRef}>
      {syncWorkspaceLyrics.map((line, i) => {
        return (
            <LyricLineWrapper
                key={i}
                lineObj={line}
                savedNode={syncList?.[i]}
                viewMode="focused"
                handleLineClick={handleLineClick}
                masterPalette={masterPalette}
                isPlayingCurrentSong={isPlayingCurrentSong}
            />
        )
      })}
      <FocusedAdlibsTracker
        syncData={selectedSong?.syncData}
        handleLineClick={handleLineClick}
        masterPalette={masterPalette}
        isPlayingCurrentSong={isPlayingCurrentSong}
            lyricsPlaybackOffsetSeconds={lyricsPlaybackOffsetSeconds}
      />
    </div>
  );
};

export default FocusedLyricsView;