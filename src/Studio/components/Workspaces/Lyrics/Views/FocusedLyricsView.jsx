/* --- src/components/Workspaces/Lyrics/Views/FocusedLyricsView.jsx --- */
import React, { useEffect, useRef } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { FocusedAdlibsTracker } from '../../Sync/FocusedAdlibsTracker.jsx';
import './FocusedLyricsView.css';

const FocusedLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette, isPlayingCurrentSong, handleLineClick, currentTrack }) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
    const activeLineIndexRef = useRef(-1);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => {
            const words = node.querySelectorAll('.lyric-word, .lyric-punctuation, .trans-word, .trans-punctuation');
                        const start = parseFloat(node.dataset.start);
                        const end = parseFloat(node.dataset.end);
                        const nextStart = parseFloat(node.dataset.nextStart);
                        const boundaries = [end, nextStart].filter(value => !isNaN(value));
                        const exitBoundary = boundaries.length > 0 ? Math.min(...boundaries) : NaN;
                        const activeDuration = !isNaN(start) && !isNaN(exitBoundary) && exitBoundary > start
                            ? exitBoundary - start
                            : 0;
                        const exitWindow = activeDuration * 0.05;
                        const exitDuration = Math.max(0.04, exitWindow);
            node.style.setProperty('--total-words', words.length);
                        node.style.setProperty('--focused-exit-duration', `${exitDuration}s`);
                        node.style.setProperty('--focused-exit-stagger', '0s');
            return {
                node,
                                start,
                                end,
                                nextStart,
                                exitStart: !isNaN(start) && activeDuration > 0 ? start + activeDuration * 0.95 : NaN,
                                exitBoundary,
                isActive: node.classList.contains('active')
            };
        });
        
        cachedAdlibsRef.current = Array.from(containerRef.current.querySelectorAll('.adlib-node')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            state: node.classList.contains('adlib-active') ? 'active' : (node.classList.contains('adlib-visible') ? 'visible' : 'hidden')
        }));

        if (isPlayingCurrentSong && typeof window.currentAudioTime === 'number') {
            handleTimeUpdate(window.currentAudioTime);
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [liveParsedLyrics, selectedSong?.syncData]);

  const handleTimeUpdate = (time) => {
    if (!isPlayingCurrentSong) return;
    
    const lines = cachedLinesRef.current;
    let newActiveIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const { start, end } = lines[i];
        if (!isNaN(start) && time >= start && (isNaN(end) || time <= end)) {
            newActiveIndex = i;
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
    for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const shouldBeActive = (i === newActiveIndex);

        if (shouldBeActive) {
            item.node.classList.add('active');
            item.node.classList.remove('exiting', 'past');
            item.isActive = true;
        } else if (i === previousActiveIndex && previousActiveIndex !== newActiveIndex) {
            item.node.classList.remove('active', 'past');
            item.node.classList.add('exiting');
            item.isActive = false;
        } else {
            // Keep an exiting line mounted until its CSS animation finishes.
            item.node.classList.remove('active', 'past');
            item.isActive = false;
        }
    }
    activeLineIndexRef.current = newActiveIndex;

    const adlibs = cachedAdlibsRef.current;
    for (let i = 0; i < adlibs.length; i++) {
        const item = adlibs[i];
        if (isNaN(item.start)) continue;

        let targetState = 'hidden';
        if (time >= item.start && time <= item.end) targetState = 'active';
        else if (time >= item.start) targetState = 'visible';
        
        if (item.state !== targetState) {
            const cl = item.node.classList;
            if (targetState === 'active') {
                cl.add('adlib-active');
                cl.remove('adlib-hidden', 'adlib-visible');
            } else if (targetState === 'visible') {
                cl.add('adlib-visible');
                cl.remove('adlib-hidden', 'adlib-active');
            } else {
                cl.add('adlib-hidden');
                cl.remove('adlib-active', 'adlib-visible');
            }
            item.state = targetState;
        }
    }
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
    };

    const handleTimeEvent = (e) => handleTimeUpdate(e.detail);
    const handlePlayState = (e) => {
        if (e.detail.isEnded) clearAllActive();
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalPlayState', handlePlayState);

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime);
    } else {
        clearAllActive();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [isPlayingCurrentSong, currentTrack]);

  return (
    <div className="focused-lyrics-preview" ref={containerRef}>
      {liveParsedLyrics.map((line, i) => {
        let nextStart = 'NaN';
        const syncList = selectedSong?.syncData || [];
        for (let j = i + 1; j < syncList.length; j++) {
            if (syncList[j]?.start != null) {
                nextStart = syncList[j].start;
                break;
            }
        }

        return (
            <LyricLineWrapper
                key={i}
                lineObj={line}
                savedNode={syncList[i]}
                nextStart={nextStart}
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
      />
    </div>
  );
};

export default FocusedLyricsView;