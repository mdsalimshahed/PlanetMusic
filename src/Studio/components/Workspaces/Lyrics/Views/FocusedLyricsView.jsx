/* --- src/components/Workspaces/Lyrics/Views/FocusedLyricsView.jsx --- */
import React, { useEffect, useMemo, useRef } from 'react';
import { LyricLineWrapper, measureFocusedLineLayout } from '../LyricsLineRenderer.jsx';
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
    const activeLineIndexRef = useRef(-1);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => {
            const words = node.querySelectorAll('.lyric-word, .trans-word');
            const start = parseFloat(node.dataset.start);
            const end = parseFloat(node.dataset.end);
            const nextStart = parseFloat(node.dataset.nextStart);
            const boundaries = [end, nextStart].filter(value => !isNaN(value));
            const exitBoundary = boundaries.length > 0 ? Math.min(...boundaries) : NaN;
            const activeDuration = !isNaN(start) && !isNaN(exitBoundary) && exitBoundary > start
                ? exitBoundary - start
                : 0;

            const exitDuration = activeDuration > 0 ? Math.max(0.05, Math.min(0.25, activeDuration * 0.2)) : 0.30;
            const exitStart = !isNaN(start) && activeDuration > 0 ? exitBoundary - exitDuration : NaN;

            const enterDuration = activeDuration > 0 ? Math.min(0.36, activeDuration * 0.4) : 0.36;
            const enterStagger = activeDuration > 0 ? Math.min(0.055, (activeDuration * 0.25) / Math.max(1, words.length)) : 0.055;

            node.style.setProperty('--total-words', words.length);
            node.style.setProperty('--focused-enter-duration', `${enterDuration}s`);
            node.style.setProperty('--focused-enter-stagger', `${enterStagger}s`);
            node.style.setProperty('--focused-exit-duration', `${exitDuration}s`);
            node.style.setProperty('--focused-exit-stagger', '0s');
            node.style.setProperty('--focused-exit-layer-duration', `${Math.max(0.10, exitDuration * 0.62)}s`);
            node.style.setProperty('--focused-exit-translation-delay', '0s');
            node.style.setProperty('--focused-exit-pronunciation-delay', `${exitDuration * 0.18}s`);
            node.style.setProperty('--focused-exit-main-delay', `${exitDuration * 0.36}s`);
            return {
                node,
                start,
                end,
                nextStart,
                exitStart,
                exitBoundary,
                isActive: node.classList.contains('active')
            };
        });
                timedLinesRef.current = cachedLinesRef.current
                    .map((line, index) => ({ ...line, index }))
                    .filter(line => !isNaN(line.start))
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

        if (isPlayingCurrentSong && typeof window.currentAudioTime === 'number') {
            handleTimeUpdate(window.currentAudioTime - lyricsPlaybackOffsetSeconds);
        }
      }
    }, 50);
    return () => clearTimeout(timer);
    }, [liveParsedLyrics, selectedSong?.syncData, lyricsPlaybackOffsetSeconds]);

  const handleTimeUpdate = (time) => {
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

    let newActiveIndex = -1;
    for (let i = low - 1; i >= 0; i--) {
        const candidate = timedLines[i];
        if (isNaN(candidate.end) || time <= candidate.end) {
            newActiveIndex = candidate.index;
            break;
        }
    }

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
            activeLine.node.classList.add('active');
            activeLine.node.classList.remove('exiting', 'past');
            activeLine.isActive = true;
        }
        activeLineIndexRef.current = newActiveIndex;
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
  };

  useEffect(() => {
    const clearAllActive = () => {
        cachedLinesRef.current.forEach(item => {
            item.node.classList.remove('active', 'exiting', 'past');
            item.isActive = false;
        });
        activeLineIndexRef.current = -1;
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
    }, [isPlayingCurrentSong, currentTrack, lyricsPlaybackOffsetSeconds]);

  return (
    <div className="focused-lyrics-preview" ref={containerRef}>
      {liveParsedLyrics.map((line, i) => {
        return (
            <LyricLineWrapper
                key={i}
                lineObj={line}
                savedNode={syncList?.[i]}
                nextStart={nextStarts[i]}
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