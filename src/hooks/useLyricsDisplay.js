/* --- src/hooks/useLyricsDisplay.js --- */
import { useState, useEffect, useRef } from 'react';
import { parseLyrics } from '../utils/songHelpers';

export const useLyricsDisplay = (selectedSong, customData, masterPalette, isSyncMode, isEditing, isImageManagerOpen, currentTrack) => {
  const [lyricsViewMode, setLyricsViewMode] = useState('live');
  const [globalProgress, setGlobalProgress] = useState(0);
  const [liveParsedLyrics, setLiveParsedLyrics] = useState([]);
  
  const [playState, setPlayState] = useState({ isPlaying: false, isEnded: false });
  const [displaySingerBg, setDisplaySingerBg] = useState(null);
  const [isSingerVisible, setIsSingerVisible] = useState(false);
  
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
      const rawLyrics = customData.lyrics || '';
      // Initial robust parse
      const cleanedLiveLines = parseLyrics(rawLyrics, selectedSong.artistName, masterPalette);
      
      // POST-PROCESS: Enforce "No Artist" on generic sections without explicit headers
      // Guarantees [Intro] or untagged sections stay white with no attribution
      const rawLines = rawLyrics.split('\n');
      const sectionMap = [];
      
      let currentSectionSinger = selectedSong.artistName;
      let isBlankSection = false;

      for (let line of rawLines) {
        // Strip inline timestamps securely to read headers and text properly
        const lineWithoutTime = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
        if (!lineWithoutTime) continue;

        if (lineWithoutTime.startsWith('[') && lineWithoutTime.endsWith(']')) {
          if (lineWithoutTime.includes(':')) {
            // Explicit tag found, e.g., [Verse 1: Eminem]
            currentSectionSinger = lineWithoutTime.split(':')[1].replace(']', '').trim();
            isBlankSection = false;
          } else {
            // Generic tag with no artist, e.g., [Intro], [Chorus]
            currentSectionSinger = '';
            isBlankSection = true;
          }
        } else {
          sectionMap.push({
            text: lineWithoutTime.replace(/_/g, ''), // Strip underscores for safer matching
            singer: currentSectionSinger,
            isBlank: isBlankSection
          });
        }
      }

      // Apply the corrected states to the parsed lines safely
      let mapIndex = 0;
      const finalLines = cleanedLiveLines.map(lineObj => {
        const cleanText = lineObj.text.replace(/_/g, '').trim();
        
        // Fast-forward until we match the parsed text
        while (mapIndex < sectionMap.length && sectionMap[mapIndex].text !== cleanText) {
          mapIndex++;
        }
        
        if (mapIndex < sectionMap.length) {
          const matched = sectionMap[mapIndex];
          mapIndex++; 
          
          if (matched.isBlank) {
            return {
              ...lineObj,
              singer: '',
              color: '#ffffff',
              isGradient: false
            };
          }
        }
        return lineObj;
      });

      setLiveParsedLyrics(finalLines);
    }
  }, [customData.lyrics, customData.artistColors, selectedSong, masterPalette]);

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

  // Handle Dynamic Singer Display Transitions
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

    if (activeLineObj) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Treat missing/empty singers securely as a blank state (white background, no name text)
      const targetSinger = activeLineObj.singer || '';
      const targetColor = targetSinger 
        ? (activeLineObj.isGradient ? '#fff' : activeLineObj.color) 
        : '#ffffff';

      // Transition only if the singer changed, OR if rendering for the very first time
      if (targetSinger !== (displaySingerBg?.name || '') || !displaySingerBg) {
        setIsSingerVisible(false); 
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        
        transitionTimerRef.current = setTimeout(() => {
          setDisplaySingerBg({
            name: targetSinger,
            color: targetColor
          });
          setIsSingerVisible(true); 
        }, transitionTiming); 
      } else {
        setIsSingerVisible(true);
      }
    } else {
      // Break between lines
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
  }, [activePreviewIndex, liveParsedLyrics, selectedSong?.artistName, hasValidSyncData, isPlayingCurrentSong, playState.isEnded, displaySingerBg, transitionTiming]);

  return {
    lyricsViewMode, cycleViewMode, globalProgress, liveParsedLyrics, 
    currentSingerBg: displaySingerBg, isSingerVisible,
    activePreviewIndex, activePreviewRef, handleLineClick, hasValidSyncData
  };
};