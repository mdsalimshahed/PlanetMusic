/* --- src/hooks/useLyricsDisplay.js --- */
import { useState, useEffect, useRef } from 'react';
import { parseLyrics } from '../utils/songHelpers';

export const useLyricsDisplay = (selectedSong, customData, masterPalette, isSyncMode, isEditing, isImageManagerOpen, currentTrack) => {
  const [lyricsViewMode, setLyricsViewMode] = useState('live');
  const [globalProgress, setGlobalProgress] = useState(0);
  const [liveParsedLyrics, setLiveParsedLyrics] = useState([]);
  
  // Controlled transition states
  const [displaySingerBg, setDisplaySingerBg] = useState(null);
  const [isSingerVisible, setIsSingerVisible] = useState(false);
  
  const activePreviewRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const previousTrackId = useRef(null);

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);

  useEffect(() => {
    const handleGlobalTime = (e) => setGlobalProgress(e.detail);
    window.addEventListener('globalTimeUpdate', handleGlobalTime);
    return () => window.removeEventListener('globalTimeUpdate', handleGlobalTime);
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

  if (hasValidSyncData && !isSyncMode && !isEditing && !isImageManagerOpen && isPlayingCurrentSong) {
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

  // Handle the 150ms Snappy Transition Logic
  useEffect(() => {
    if (!selectedSong) return;
    if (!hasValidSyncData) {
      setDisplaySingerBg({ name: selectedSong.artistName, color: '#fff' });
      setIsSingerVisible(true);
      return;
    }

    const activeLineObj = liveParsedLyrics[activePreviewIndex];
    const newSingerName = activeLineObj?.singer || null;

    if (newSingerName !== displaySingerBg?.name) {
      setIsSingerVisible(false); // Trigger fade-out class via CSS
      
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (activeLineObj && activeLineObj.singer) {
          setDisplaySingerBg({
            name: activeLineObj.singer,
            color: activeLineObj.isGradient ? '#fff' : activeLineObj.color
          });
          setIsSingerVisible(true); // Trigger fade-in class via CSS
        } else {
          setDisplaySingerBg(null);
        }
      }, 150); // Exact delay for snap transition
      
    } else {
      if (activeLineObj && activeLineObj.singer) {
        setIsSingerVisible(true);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      } else {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => setIsSingerVisible(false), 2000);
      }
    }
    
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [activePreviewIndex, liveParsedLyrics, selectedSong?.artistName, hasValidSyncData]);

  // Rename variables going out to match your old hook format so components don't break
  return {
    lyricsViewMode, cycleViewMode, globalProgress, liveParsedLyrics, 
    currentSingerBg: displaySingerBg, isSingerVisible,
    activePreviewIndex, activePreviewRef, handleLineClick, hasValidSyncData
  };
};