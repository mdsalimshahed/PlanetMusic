/* --- src/hooks/sync/useLyricsDisplay.js --- */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export const useLyricsDisplay = (selectedSong, customData, masterPalette, isSyncMode, isEditing, isImageManagerOpen, currentTrack, settings) => {
  const [lyricsViewMode, setLyricsViewMode] = useState('live');
  const [parsedLyrics, setParsedLyrics] = useState({ trackId: null, lines: [] });
  const parserWorkerRef = useRef(null);
  const parserRequestIdRef = useRef(0);
  const [isHeadphoneDelayEnabled, setIsHeadphoneDelayEnabled] = useState(() => localStorage.getItem('lyricsHeadphoneDelayEnabled') === 'true');
  const [playState, setPlayState] = useState({
      isPlaying: typeof window !== 'undefined' ? !!window.globalIsAudioPlaying : false,
      isEnded: false
    });
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
  const [bgActiveIndex, setBgActiveIndex] = useState(-1);
  const bgIdxRef = useRef(-1);

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);
  const preemptionTimeSec = (settings?.bgPreemptionTime ?? 400) / 1000;
  const headphoneDelayMs = Number.isFinite(settings?.audioDelayCompensationMs)
    ? Math.max(-250, Math.min(250, settings.audioDelayCompensationMs))
    : 200;
  const lyricsPlaybackOffsetSeconds = isHeadphoneDelayEnabled ? headphoneDelayMs / 1000 : 0;

  const toggleHeadphoneDelay = () => {
    const next = !isHeadphoneDelayEnabled;
    setIsHeadphoneDelayEnabled(next);
    localStorage.setItem('lyricsHeadphoneDelayEnabled', String(next));
  };

  const trackId = selectedSong?.trackId ?? null;
  const liveParsedLyrics = useMemo(
    () => parsedLyrics.trackId === trackId ? parsedLyrics.lines : [],
    [parsedLyrics, trackId]
  );

  useEffect(() => {
    const worker = new Worker(
      new URL('../../workers/lyricsParser.worker.js', import.meta.url),
      { type: 'module' }
    );
    parserWorkerRef.current = worker;

    worker.onmessage = ({ data }) => {
      if (data.requestId !== parserRequestIdRef.current) return;
      setParsedLyrics({ trackId: data.trackId, lines: data.lyrics });
    };
    worker.onerror = (error) => {
      console.error('Lyrics parsing worker failed.', error);
      parserWorkerRef.current = null;
    };

    return () => {
      worker.terminate();
      parserWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = parserWorkerRef.current;
    if (!worker || !selectedSong) {
      setParsedLyrics({ trackId, lines: [] });
      return;
    }

    const requestId = ++parserRequestIdRef.current;
    setParsedLyrics({ trackId, lines: [] });
    worker.postMessage({
      requestId,
      trackId,
      rawLyrics: customData.lyrics || '',
      artistName: selectedSong.artistName,
      masterPalette
    });
  }, [trackId, customData.lyrics, selectedSong, masterPalette]);

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
      const time = e.detail - lyricsPlaybackOffsetSeconds;
      const validSync = selectedSong?.syncData?.some(line => line.start !== null);
      const isPlayingCurrentSong = currentTrack && selectedSong && String(currentTrack.trackId) === String(selectedSong.trackId);
             
      if (validSync && !isSyncMode && !isEditing && !isImageManagerOpen && isPlayingCurrentSong && !playState.isEnded) {
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
  }, [selectedSong, currentTrack, isSyncMode, isEditing, isImageManagerOpen, playState.isEnded, preemptionTimeSec, lyricsPlaybackOffsetSeconds]);

  useEffect(() => {
    if (selectedSong && selectedSong.trackId !== previousTrackId.current) {
      previousTrackId.current = selectedSong.trackId;
      setLyricsViewMode('live');
      setDisplaySingerBg(null);
      setIsSingerVisible(false);
      bgIdxRef.current = -1;
      setBgActiveIndex(-1);
    }
  }, [selectedSong]);

  const cycleViewMode = useCallback(() => setLyricsViewMode(prev => 
       prev === 'live' ? 'focused' : prev === 'focused' ? 'group-chat' : prev === 'group-chat' ? 'plain' : 'live'
  ), []);

  const handleLineClick = useCallback((startTime) => {
    const time = Number(startTime);
    if (
      startTime == null ||
      !Number.isFinite(time) ||
      time < 0 ||
      isSyncMode ||
      isEditing ||
      isImageManagerOpen ||
      !selectedSong
    ) return;

    const customLinks = { ...selectedSong.customLinks, ...customData };
    const useDeezerForSeek = Boolean(
      customLinks.deezer &&
      settings?.deezerArl?.trim() &&
      settings?.deezerArlValid === true
    );

    window.dispatchEvent(new CustomEvent('globalSeekRequest', {
        detail: { 
         time,
         track: {
           ...selectedSong,
           customLinks,
           ...(useDeezerForSeek ? { forceSource: 'deezer' } : {})
         }
       } 
     }));
  }, [isSyncMode, isEditing, isImageManagerOpen, selectedSong, customData, settings]);

  useEffect(() => {
    if (!selectedSong) return;
    if (playState.isEnded) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
                 
        silenceTimerRef.current = setTimeout(() => {
            setIsSingerVisible(false);
        }, 2000);
        return;
    }
         
    if (!hasValidSyncData) {
      const isPlayingCurrentSong = currentTrack && selectedSong && String(currentTrack.trackId) === String(selectedSong.trackId);
      const frame = window.requestAnimationFrame(() => {
        if (isPlayingCurrentSong && !playState.isEnded) {
          setDisplaySingerBg({ name: selectedSong.artistName, color: '#fff' });
          setIsSingerVisible(true);
        } else {
          setIsSingerVisible(false);
        }
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const activeBgLineObj = liveParsedLyrics[bgActiveIndex];
         
    if (activeBgLineObj) {
      if (activeBgLineObj.singer) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (activeBgLineObj.singer !== displaySingerBg?.name) {
          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
                     
          transitionTimerRef.current = setTimeout(() => {
            setDisplaySingerBg({
              name: activeBgLineObj.singer,
              color: activeBgLineObj.isGradient ? '#fff' : activeBgLineObj.color
            });
            setIsSingerVisible(true);
          }, transitionTiming);
                   
        } else {
          if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = setTimeout(() => setIsSingerVisible(true), 0);
        }
      } else {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        silenceTimerRef.current = setTimeout(() => setIsSingerVisible(false), 0);
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
  }, [bgActiveIndex, liveParsedLyrics, selectedSong, hasValidSyncData, currentTrack, playState.isEnded, displaySingerBg?.name, transitionTiming]);

  return {
    lyricsViewMode, setLyricsViewMode, cycleViewMode, liveParsedLyrics,
    isHeadphoneDelayEnabled, toggleHeadphoneDelay, headphoneDelayMs, lyricsPlaybackOffsetSeconds,
    currentSingerBg: displaySingerBg, isSingerVisible,
    activePreviewRef, handleLineClick, hasValidSyncData,
    isPlaying: playState.isPlaying
  };
};