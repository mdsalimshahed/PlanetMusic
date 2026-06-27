/* --- src/hooks/useLyricsDisplay.js --- */
import { useState, useEffect, useRef } from 'react';
import { parseLyrics } from '../utils/songHelpers';

export const useLyricsDisplay = (selectedSong, customData, masterPalette, isSyncMode, isEditing, isImageManagerOpen, currentTrack, settings) => {
  const [lyricsViewMode, setLyricsViewMode] = useState('live');
  const [globalProgress, setGlobalProgress] = useState(0);
  const [liveParsedLyrics, setLiveParsedLyrics] = useState([]);
  
  const [playState, setPlayState] = useState({ isPlaying: false, isEnded: false });
  
  const [displaySingerBg, setDisplaySingerBg] = useState(null);
  const [isSingerVisible, setIsSingerVisible] = useState(false);
  
  const [transitionTiming, setTransitionTiming] = useState(() => {
    const stored = localStorage.getItem('artistTransitionTime');
    return stored !== null ? parseInt(stored, 10) : 0; 
  });
  
  const activePreviewRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const previousTrackId = useRef(null);

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);
  
  // Dynamically uses the slider setting (defaulting to 400ms) converted to seconds
  const preemptionTimeSec = (settings?.bgPreemptionTime ?? 400) / 1000; 

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
  let bgActiveIndex = -1;

  if (hasValidSyncData && !isSyncMode && !isEditing && !isImageManagerOpen && isPlayingCurrentSong && !playState.isEnded) {
    // 1. Text Tracking (Perfect Sync)
    activePreviewIndex = selectedSong.syncData.findIndex((savedNode, i) => {
      if (!savedNode || savedNode.start === null) return false;
      const nextNode = selectedSong.syncData[i + 1];
      const isStarted = globalProgress >= savedNode.start;
      const isBeforeEnd = savedNode.end !== null ? globalProgress <= savedNode.end : true;
      const isBeforeNext = nextNode && nextNode.start !== null ? globalProgress < nextNode.start : true;
      return isStarted && isBeforeEnd && isBeforeNext;
    });

    // 2. Background Tracking (Preemptive Sync)
    bgActiveIndex = selectedSong.syncData.findIndex((savedNode, i) => {
      if (!savedNode || savedNode.start === null) return false;
      const nextNode = selectedSong.syncData[i + 1];
      
      const isStarted = globalProgress >= (savedNode.start - preemptionTimeSec);
      const isBeforeEnd = savedNode.end !== null ? globalProgress <= savedNode.end : true;
      const isBeforeNext = nextNode && nextNode.start !== null ? globalProgress < (nextNode.start - preemptionTimeSec) : true;
      
      return isStarted && isBeforeEnd && isBeforeNext;
    });
  }

  useEffect(() => {
    if (!isSyncMode && !isEditing && !isImageManagerOpen && ['live', 'focused', 'karaoke'].includes(lyricsViewMode) && activePreviewRef.current) {
      const container = activePreviewRef.current.parentElement;
      const offsetTop = activePreviewRef.current.offsetTop;
      
      const scrollPos = offsetTop - (container.clientHeight / 2) + (activePreviewRef.current.clientHeight / 2);
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activePreviewIndex, isSyncMode, isEditing, isImageManagerOpen, lyricsViewMode]);

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

    const activeBgLineObj = liveParsedLyrics[bgActiveIndex]; 

    if (activeBgLineObj) {
      if (activeBgLineObj.singer) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (activeBgLineObj.singer !== displaySingerBg?.name) {
          setIsSingerVisible(false);
          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
          
          transitionTimerRef.current = setTimeout(() => {
            setDisplaySingerBg({
              name: activeBgLineObj.singer,
              color: activeBgLineObj.isGradient ? '#fff' : activeBgLineObj.color
            });
            setIsSingerVisible(true);
          }, transitionTiming); 
        } else {
          setIsSingerVisible(true);
        }
      } else {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        setIsSingerVisible(false);
      }
    } else {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      
      silenceTimerRef.current = setTimeout(() => {
        setIsSingerVisible(false);
      }, 2000); 
    }
    
    return () => { 
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); 
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current); 
    };
  }, [bgActiveIndex, liveParsedLyrics, selectedSong?.artistName, hasValidSyncData, isPlayingCurrentSong, playState.isEnded, displaySingerBg?.name, transitionTiming]);

  return {
    lyricsViewMode, cycleViewMode, globalProgress, liveParsedLyrics, 
    currentSingerBg: displaySingerBg, isSingerVisible,
    activePreviewIndex, activePreviewRef, handleLineClick, hasValidSyncData
  };
};