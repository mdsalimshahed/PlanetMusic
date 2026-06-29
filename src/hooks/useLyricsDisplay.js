/* --- src/hooks/useLyricsDisplay.js --- */
import { useState, useEffect, useRef, useCallback } from 'react';
import { parseLyrics } from '../utils/songHelpers';

export const useLyricsDisplay = (selectedSong, customData, masterPalette, isSyncMode, isEditing, isImageManagerOpen, currentTrack, settings) => {
  const [lyricsViewMode, setLyricsViewMode] = useState('live');
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

  const [activePreviewIndex, setActivePreviewIndex] = useState(-1);
  const [bgActiveIndex, setBgActiveIndex] = useState(-1);

  const activeIdxRef = useRef(-1);
  const bgIdxRef = useRef(-1);

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);
  const preemptionTimeSec = (settings?.bgPreemptionTime ?? 400) / 1000; 

  useEffect(() => {
    const handlePlayState = (e) => setPlayState(e.detail);
    const handleTimingUpdate = (e) => setTransitionTiming(e.detail);
    
    window.addEventListener('globalPlayState', handlePlayState);
    window.addEventListener('updateTransitionTime', handleTimingUpdate);
    
    return () => {
      window.removeEventListener('globalPlayState', handlePlayState);
      window.removeEventListener('updateTransitionTime', handleTimingUpdate);
    };
  }, []);

  useEffect(() => {
    const handleGlobalTime = (e) => {
      const time = e.detail;
      const validSync = selectedSong?.syncData?.some(line => line.start !== null);
      const isPlayingCurrentSong = currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId;
      
      if (validSync && !isSyncMode && !isEditing && !isImageManagerOpen && isPlayingCurrentSong && !playState.isEnded) {
        
        let newActiveIndex = activeIdxRef.current;
        const cNode = newActiveIndex >= 0 ? selectedSong.syncData[newActiveIndex] : null;
        const nNode = newActiveIndex >= 0 ? selectedSong.syncData[newActiveIndex + 1] : null;
        
        const stillInCurrent = cNode && cNode.start !== null && time >= cNode.start &&
             (cNode.end !== null ? time <= cNode.end : true) &&
             (nNode && nNode.start !== null ? time < nNode.start : true);
             
        if (!stillInCurrent) {
            newActiveIndex = selectedSong.syncData.findIndex((savedNode, i) => {
              if (!savedNode || savedNode.start === null) return false;
              const nextNode = selectedSong.syncData[i + 1];
              const isStarted = time >= savedNode.start;
              const isBeforeEnd = savedNode.end !== null ? time <= savedNode.end : true;
              const isBeforeNext = nextNode && nextNode.start !== null ? time < nextNode.start : true;
              return isStarted && isBeforeEnd && isBeforeNext;
            });
        }

        if (newActiveIndex !== activeIdxRef.current) {
          activeIdxRef.current = newActiveIndex;
          setActivePreviewIndex(newActiveIndex);
        }

        let newBgIndex = bgIdxRef.current;
        const cbNode = newBgIndex >= 0 ? selectedSong.syncData[newBgIndex] : null;
        const nbNode = newBgIndex >= 0 ? selectedSong.syncData[newBgIndex + 1] : null;

        const stillInBg = cbNode && cbNode.start !== null && time >= (cbNode.start - preemptionTimeSec) &&
             (cbNode.end !== null ? time <= cbNode.end : true) &&
             (nbNode && nbNode.start !== null ? time < (nbNode.start - preemptionTimeSec) : true);

        if (!stillInBg) {
            newBgIndex = selectedSong.syncData.findIndex((savedNode, i) => {
              if (!savedNode || savedNode.start === null) return false;
              const nextNode = selectedSong.syncData[i + 1];
              const isStarted = time >= (savedNode.start - preemptionTimeSec);
              const isBeforeEnd = savedNode.end !== null ? time <= savedNode.end : true;
              const isBeforeNext = nextNode && nextNode.start !== null ? time < (nextNode.start - preemptionTimeSec) : true;
              return isStarted && isBeforeEnd && isBeforeNext;
            });
        }

        if (newBgIndex !== bgIdxRef.current) {
          bgIdxRef.current = newBgIndex;
          setBgActiveIndex(newBgIndex);
        }
      }
    };
    
    window.addEventListener('globalTimeUpdate', handleGlobalTime);
    return () => window.removeEventListener('globalTimeUpdate', handleGlobalTime);
  }, [selectedSong, currentTrack, isSyncMode, isEditing, isImageManagerOpen, playState.isEnded, preemptionTimeSec]);

  useEffect(() => {
    if (selectedSong && selectedSong.trackId !== previousTrackId.current) {
      previousTrackId.current = selectedSong.trackId;
      setLyricsViewMode('live');
      setDisplaySingerBg(null);
      setIsSingerVisible(false);
      activeIdxRef.current = -1;
      bgIdxRef.current = -1;
      setActivePreviewIndex(-1);
      setBgActiveIndex(-1);
    }
  }, [selectedSong]);

  useEffect(() => {
    if (selectedSong) {
      const cleanedLiveLines = parseLyrics(customData.lyrics || '', selectedSong.artistName, masterPalette);
      setLiveParsedLyrics(cleanedLiveLines);
    }
  }, [customData.lyrics, customData.artistColors, selectedSong, masterPalette]);

  // CRITICAL CPU FIX: Stabilize function reference to prevent React.memo failures
  const cycleViewMode = useCallback(() => setLyricsViewMode(prev => 
    prev === 'live' ? 'focused' : prev === 'focused' ? 'plain' : 'live'
  ), []);

  // CRITICAL CPU FIX: Stabilize function reference to prevent 100+ lines from re-rendering simultaneously
  const handleLineClick = useCallback((startTime) => {
    if (startTime === null || isSyncMode || isEditing || isImageManagerOpen) return;
    window.dispatchEvent(new CustomEvent('globalSeekRequest', { detail: { time: startTime, track: selectedSong } }));
  }, [isSyncMode, isEditing, isImageManagerOpen, selectedSong]);

  useEffect(() => {
    if (!isSyncMode && !isEditing && !isImageManagerOpen && ['live', 'focused'].includes(lyricsViewMode) && activePreviewRef.current) {
      const container = activePreviewRef.current.parentElement;
      const offsetTop = activePreviewRef.current.offsetTop;
      
      const scrollPos = offsetTop - (container.clientHeight / 2) + (activePreviewRef.current.clientHeight / 2);
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activePreviewIndex, isSyncMode, isEditing, isImageManagerOpen, lyricsViewMode]);

  useEffect(() => {
    if (!selectedSong) return;
    
    if (!hasValidSyncData) {
      const isPlayingCurrentSong = currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId;
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
  }, [bgActiveIndex, liveParsedLyrics, selectedSong?.artistName, hasValidSyncData, currentTrack, playState.isEnded, displaySingerBg?.name, transitionTiming]);

  return {
    lyricsViewMode, cycleViewMode, liveParsedLyrics, 
    currentSingerBg: displaySingerBg, isSingerVisible,
    activePreviewIndex, activePreviewRef, handleLineClick, hasValidSyncData
  };
};