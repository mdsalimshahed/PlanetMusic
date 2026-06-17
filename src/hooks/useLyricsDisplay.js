/* --- src/hooks/useLyricsDisplay.js --- */
import { useState, useEffect, useRef } from 'react';
import { parseLyrics } from '../utils/songHelpers';

export const useLyricsDisplay = (selectedSong, customData, masterPalette, isSyncMode, isEditing, isImageManagerOpen, currentTrack) => {
  const [lyricsViewMode, setLyricsViewMode] = useState('live');
  const [globalProgress, setGlobalProgress] = useState(0);
  const [liveParsedLyrics, setLiveParsedLyrics] = useState([]);
  
  // Track player state directly from Player.jsx events
  const [playState, setPlayState] = useState({ isPlaying: false, isEnded: false });
  
  // Controlled transition states
  const [displaySingerBg, setDisplaySingerBg] = useState(null);
  const [isSingerVisible, setIsSingerVisible] = useState(false);
  
  // Dynamic Transition Timing (defaults to 150ms for snappiness)
  const [transitionTiming, setTransitionTiming] = useState(() => {
    return parseInt(localStorage.getItem('artistTransitionTime')) || 150;
  });
  
  const activePreviewRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const previousTrackId = useRef(null);

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);

  useEffect(() => {
    const handleGlobalTime = (e) => setGlobalProgress(e.detail);
    const handlePlayState = (e) => setPlayState(e.detail);
    const handleTimingUpdate = (e) => setTransitionTiming(e.detail);
    
    window.addEventListener('globalTimeUpdate', handleGlobalTime);
    window.addEventListener('globalPlayState', handlePlayState);
    window.addEventListener('updateTransitionTime', handleTimingUpdate);
    
    return () => {
      window.removeEventListener('globalTimeUpdate', handleGlobalTime);
      window.removeEventListener('globalPlayState', handlePlayState);
      window.removeEventListener('updateTransitionTime', handleTimingUpdate);
    };
  }, []);

  useEffect(() => {
    if (selectedSong && selectedSong.trackId !== previousTrackId.current) {
      previousTrackId.current = selectedSong.trackId;
      setLyricsViewMode('live');
      setDisplaySingerBg(null);
      setIsSingerVisible(false);
    }
  }, [selectedSong]);

  useEffect(() => {
    if (selectedSong) {
      const cleanedLiveLines = parseLyrics(customData.lyrics || '', selectedSong.artistName, masterPalette);
      setLiveParsedLyrics(cleanedLiveLines);
    }
  }, [customData.lyrics, customData.artistColors, selectedSong]);

  const cycleViewMode = () => setLyricsViewMode(prev => 
    prev === 'live' ? 'focused' : prev === 'focused' ? 'karaoke' : prev === 'karaoke' ? 'debug' : prev === 'debug' ? 'plain' : 'live'
  );

  const handleLineClick = (startTime) => {
    if (startTime === null || isSyncMode || isEditing || isImageManagerOpen) return;
    window.dispatchEvent(new CustomEvent('globalSeekRequest', { detail: { time: startTime, track: selectedSong } }));
  };

  const isPlayingCurrentSong = currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId;
  let activePreviewIndex = -1;

  if (hasValidSyncData && !isSyncMode && !isEditing && !isImageManagerOpen && isPlayingCurrentSong && !playState.isEnded) {
    activePreviewIndex = selectedSong.syncData.findIndex((savedNode, i) => {
      if (!savedNode || savedNode.start === null) return false;
      const nextNode = selectedSong.syncData[i + 1];
      const isStarted = globalProgress >= savedNode.start;
      const isBeforeEnd = savedNode.end !== null ? globalProgress <= savedNode.end : true;
      const isBeforeNext = nextNode && nextNode.start !== null ? globalProgress < nextNode.start : true;
      return isStarted && isBeforeEnd && isBeforeNext;
    });
  }

  useEffect(() => {
    if (!isSyncMode && !isEditing && !isImageManagerOpen && ['live', 'focused', 'karaoke'].includes(lyricsViewMode) && activePreviewRef.current) {
      const container = activePreviewRef.current.parentElement;
      const offsetTop = activePreviewRef.current.offsetTop;
      const scrollPos = offsetTop - (container.clientHeight / 2) + (activePreviewRef.current.clientHeight / 2);
      if (lyricsViewMode === 'focused') container.scrollTo({ top: scrollPos, behavior: 'smooth' });
      else container.scrollTop = scrollPos;
    }
  }, [activePreviewIndex, isSyncMode, isEditing, isImageManagerOpen, lyricsViewMode]);

  // Handle the Snappy Transition Logic and Idle Fade
  useEffect(() => {
    if (!selectedSong) return;
    
    if (!hasValidSyncData) {
      if (isPlayingCurrentSong && !playState.isEnded) {
        setDisplaySingerBg({ name: selectedSong.artistName, color: '#fff' });
        setIsSingerVisible(true);
      } else {
        setIsSingerVisible(false);
      }
      return;
    }

    const activeLineObj = liveParsedLyrics[activePreviewIndex];

    if (activeLineObj && activeLineObj.singer) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      if (activeLineObj.singer !== displaySingerBg?.name) {
        // Fade out
        setIsSingerVisible(false);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        
        // Wait for the requested transitionTiming duration, then fade in the new artist
        transitionTimerRef.current = setTimeout(() => {
          setDisplaySingerBg({
            name: activeLineObj.singer,
            color: activeLineObj.isGradient ? '#fff' : activeLineObj.color
          });
          setIsSingerVisible(true);
        }, transitionTiming); 
      } else {
        setIsSingerVisible(true);
      }
    } else {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      
      silenceTimerRef.current = setTimeout(() => {
        setIsSingerVisible(false);
      }, 2000); // 2-second silence rule
    }
    
    return () => { 
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); 
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current); 
    };
  }, [activePreviewIndex, liveParsedLyrics, selectedSong?.artistName, hasValidSyncData, isPlayingCurrentSong, playState.isEnded, displaySingerBg?.name, transitionTiming]);

  return {
    lyricsViewMode, cycleViewMode, globalProgress, liveParsedLyrics, 
    currentSingerBg: displaySingerBg, isSingerVisible,
    activePreviewIndex, activePreviewRef, handleLineClick, hasValidSyncData
  };
};