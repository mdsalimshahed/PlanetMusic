/* --- src/components/Workspaces/Lyrics/Views/FocusedLyricsView.jsx --- */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { LyricLineWrapper, measureFocusedLineLayout } from '../LyricsLineRenderer.jsx';
import { getFocusedLyricsAnimationTiming } from '../focusedLyricsTiming.js';
import { FocusedAdlibsTracker } from '../../Sync/FocusedAdlibsTracker.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import './FocusedLyricsView.css';

const FocusedLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette, isPlayingCurrentSong, handleLineClick, currentTrack, lyricsPlaybackOffsetSeconds = 0 }) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const timedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
  const adlibTimelineRef = useRef([]);
  const adlibCursorRef = useRef(0);
  const lastAdlibTimeRef = useRef(null);
  const lastLyricsTimeRef = useRef(null);
  const activeLineIndexRef = useRef(-1);
  const syncList = selectedSong?.syncData;

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => {
      const indexedWords = Array.from(node.querySelectorAll('.lyric-word, .trans-word'))
        .map(word => parseFloat(word.style.getPropertyValue('--word-index')))
        .filter(Number.isFinite);
      const wordCount = indexedWords.reduce((count, index) => Math.max(count, index + 1), 1);
      const start = parseFloat(node.dataset.start);
      const end = parseFloat(node.dataset.end);
      const lineDuration = Number.isFinite(start) && Number.isFinite(end) && end > start
        ? end - start
        : 0;
      const animationTiming = getFocusedLyricsAnimationTiming(lineDuration, wordCount);
      const { enterDuration, enterStagger, exitDuration } = animationTiming;
      const exitStart = lineDuration > 0 ? end - exitDuration : NaN;

      node.style.setProperty('--total-words', wordCount);
      node.style.setProperty('--focused-enter-duration', `${enterDuration}s`);
      node.style.setProperty('--focused-enter-stagger', `${enterStagger}s`);
      node.style.setProperty('--focused-exit-duration', `${exitDuration}s`);
      node.style.setProperty('--focused-exit-layer-duration', `${animationTiming.exitLayerDuration}s`);
      return {
        node,
        start,
        end,
        exitStart,
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

  }, [liveParsedLyrics, selectedSong?.syncData, lyricsPlaybackOffsetSeconds]);

  const handleTimeUpdate = useCallback((time) => {
    if (!isPlayingCurrentSong) return;

    const previousTime = lastLyricsTimeRef.current;
    const isSeek = previousTime !== null && Math.abs(time - previousTime) > 0.35;
    lastLyricsTimeRef.current = time;
    
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

    const scheduledExitIndex = newActiveIndex;
    if (scheduledExitIndex !== -1) {
        const line = lines[scheduledExitIndex];
        if (!isNaN(line.exitStart) && time >= line.exitStart && time < line.exitBoundary) {
            newActiveIndex = -1;
        }
    }

    const previousActiveIndex = activeLineIndexRef.current;
    if (previousActiveIndex !== newActiveIndex) {
        if (previousActiveIndex !== -1) {
            const previousLine = lines[previousActiveIndex];
            measureFocusedLineLayout(previousLine.node);
            previousLine.node.classList.remove('active', 'past');
            previousLine.node.classList.add('exiting');
            previousLine.isActive = false;
        }

        if (newActiveIndex !== -1) {
            const activeLine = lines[newActiveIndex];
            activeLine.node.style.setProperty(
              '--focused-enter-elapsed',
              `${isSeek ? 0 : Math.max(0, time - activeLine.start)}s`
            );
            activeLine.node.classList.add('active');
            activeLine.node.classList.remove('exiting', 'past');
            activeLine.isActive = true;
        }
        activeLineIndexRef.current = newActiveIndex;
    }

    if (isSeek && newActiveIndex !== -1 && previousActiveIndex === newActiveIndex) {
      const activeLine = lines[newActiveIndex];
      activeLine.node.classList.remove('active', 'exiting', 'past');
      void activeLine.node.offsetWidth;
      activeLine.node.style.setProperty('--focused-enter-elapsed', '0s');
      activeLine.node.classList.add('active');
      activeLine.isActive = true;
    }

    const isInsideExitWindow = candidate &&
      Number.isFinite(candidate.exitStart) &&
      time >= candidate.exitStart &&
      time < candidate.exitBoundary;
    if (isSeek && isInsideExitWindow) {
      const exitLine = lines[candidate.index];
      measureFocusedLineLayout(exitLine.node);
      exitLine.node.classList.remove('active', 'exiting', 'past');
      void exitLine.node.offsetWidth;
      exitLine.node.classList.add('exiting');
      exitLine.isActive = false;
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
        lastLyricsTimeRef.current = null;
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
        if (e.detail.isEnded) clearAllActive();
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalPlayState', handlePlayState);

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime - lyricsPlaybackOffsetSeconds);
    } else {
        clearAllActive();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
    }, [isPlayingCurrentSong, currentTrack, liveParsedLyrics, syncList, lyricsPlaybackOffsetSeconds, handleTimeUpdate]);

  return (
    <div className="focused-lyrics-preview" ref={containerRef}>
      {liveParsedLyrics.map((line, i) => {
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