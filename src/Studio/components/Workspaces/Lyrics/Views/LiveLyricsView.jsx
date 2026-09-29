/* --- src/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx --- */
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import './LiveLyricsView.css';

const LiveLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette, isPlayingCurrentSong, handleLineClick, settings, currentTrack, lyricsPlaybackOffsetSeconds = 0 }) => {
  const containerRef = useRef(null);
    const initialRevealTrackRef = useRef(null);
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

    useLayoutEffect(() => {
        const container = containerRef.current;
        const trackId = selectedSong?.trackId;
        if (!container || trackId == null || initialRevealTrackRef.current === trackId) return;
        if (settings?.disableAnimations || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            initialRevealTrackRef.current = trackId;
            return;
        }

        const containerBounds = container.getBoundingClientRect();
        const visibleLines = Array.from(container.querySelectorAll('.lyric-line-wrapper')).filter(node => {
            const bounds = node.getBoundingClientRect();
            return bounds.height > 0 && bounds.bottom > containerBounds.top && bounds.top < containerBounds.bottom;
        });
        if (visibleLines.length === 0) return;

        initialRevealTrackRef.current = trackId;
        visibleLines.forEach((node, index) => {
            node.style.setProperty('--initial-reveal-delay', `${index * 55}ms`);
            const finishReveal = (event) => {
                if (event.target !== node) return;
                node.classList.remove('initial-reveal');
                node.style.removeProperty('--initial-reveal-delay');
                node.removeEventListener('animationend', finishReveal);
            };
            node.addEventListener('animationend', finishReveal);
            node.classList.add('initial-reveal');
        });
    }, [liveParsedLyrics, selectedSong?.trackId, settings?.disableAnimations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            nextStart: parseFloat(node.dataset.nextStart),
            isActive: node.classList.contains('active')
        }));
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
        const isBeforeEnd = isNaN(candidate.end) || time <= candidate.end;
        const isBeforeNext = isNaN(candidate.nextStart) || time < candidate.nextStart;
        if (isBeforeEnd && isBeforeNext) {
            newActiveIndex = candidate.index;
            break;
        }
    }

    const previousActiveIndex = activeLineIndexRef.current;
    if (previousActiveIndex !== newActiveIndex) {
        if (previousActiveIndex !== -1) {
            lines[previousActiveIndex].node.classList.remove('active');
            lines[previousActiveIndex].isActive = false;
        }

        if (newActiveIndex !== -1) {
            const item = lines[newActiveIndex];
            item.node.classList.add('active');
            item.isActive = true;

            if (containerRef.current) {
                const offsetTop = item.node.offsetTop;
                const scrollPos = offsetTop - (containerRef.current.clientHeight / 2) + (item.node.clientHeight / 2);
                containerRef.current.scrollTo({
                   top: scrollPos,
                   behavior: settings?.disableAnimations ? 'auto' : 'smooth'
                });
            }
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
            if (item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
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
        if (e.detail.isEnded) {
            clearAllActive();
        }
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
    }, [isPlayingCurrentSong, currentTrack, settings?.disableAnimations, lyricsPlaybackOffsetSeconds]);

  return (
    <div
      className="live-lyrics-preview"
      ref={containerRef}
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
              isPlayingCurrentSong={isPlayingCurrentSong}
            />
        )
      })}
    </div>
  );
};

export default LiveLyricsView;