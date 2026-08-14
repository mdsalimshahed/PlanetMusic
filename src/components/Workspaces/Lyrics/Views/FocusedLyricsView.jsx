/* --- src/components/Workspaces/Lyrics/Views/FocusedLyricsView.jsx --- */
import React, { useEffect, useRef } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer';
import { FocusedAdlibsTracker } from '../../Sync/FocusedAdlibsTracker';

const FocusedLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette, isPlayingCurrentSong, handleLineClick, currentTrack }) => {
  const containerRef = useRef(null);
  const cachedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);

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
        const { start, end, nextStart } = lines[i];
        if (!isNaN(start) && time >= start) {
            const isBeforeEnd = isNaN(end) || time <= end;
            const isBeforeNext = isNaN(nextStart) || time < nextStart;
            if (isBeforeEnd && isBeforeNext) {
                newActiveIndex = i;
                break;
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const shouldBeActive = (i === newActiveIndex);
        
        if (shouldBeActive && !item.isActive) {
            item.node.classList.add('active');
            item.isActive = true;
        } else if (!shouldBeActive && item.isActive) {
            item.node.classList.remove('active');
            item.isActive = false;
        }
    }

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
            if (item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
        });
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