/* --- src/hooks/useSyncWorkspace.js --- */
import { useState, useEffect, useRef } from 'react';
import { getAudioFile } from '../db';
import { getBulkPronunciations } from '../transliterator';
import { parseLyrics, mergeSyncWithGenius, fetchYouLyrics, fetchLRCLIB, parseLRC } from '../utils/songHelpers';

export const useSyncWorkspace = (selectedSong, isSaved, customData, setCustomData, masterPalette, updateSongInLibrary, setCurrentTrack, setNotification) => {
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isLrcFetching, setIsLrcFetching] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [syncData, setSyncData] = useState([]);
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [syncAudioSrc, setSyncAudioSrc] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [debugInfo, setDebugInfo] = useState({ source: 'None', rawData: null });

  const syncAudioRef = useRef(null);
  const activeLineRef = useRef(null);
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);

  useEffect(() => { activeIdxRef.current = activeSyncIndex; syncDataRef.current = syncData; }, [activeSyncIndex, syncData]);

  useEffect(() => {
    if (selectedSong) {
      setIsSyncMode(false);
      setPlaybackRate(1.0);
      setDebugInfo({ source: 'Local Vault / Cache', rawData: null });
    }
  }, [selectedSong]);

  useEffect(() => {
    const loadSyncAudio = async () => {
      if (isSyncMode && selectedSong) {
        if (customData.hasLocal) {
          const file = await getAudioFile(selectedSong.trackId);
          setSyncAudioSrc(file ? URL.createObjectURL(file) : selectedSong.previewUrl);
        } else setSyncAudioSrc(selectedSong.previewUrl);
      }
    };
    loadSyncAudio();
  }, [isSyncMode, customData.hasLocal, selectedSong]);

  useEffect(() => {
    if (isSyncMode && syncAudioRef.current) {
      const savedVolume = localStorage.getItem('playerVolume');
      syncAudioRef.current.volume = savedVolume !== null ? parseFloat(savedVolume) : 1;
      syncAudioRef.current.playbackRate = playbackRate;
    }
  }, [isSyncMode, syncAudioSrc, playbackRate]);

  useEffect(() => {
    if (isSyncMode && activeLineRef.current) {
      const container = activeLineRef.current.parentElement;
      const scrollPos = activeLineRef.current.offsetTop - (container.clientHeight / 2) + (activeLineRef.current.clientHeight / 2);
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activeSyncIndex, isSyncMode]);

  useEffect(() => {
    if (!isSyncMode) return;
    const handleKeyDown = (e) => {
      const currentIdx = activeIdxRef.current;
      const data = [...syncDataRef.current];
      const currentLine = data[currentIdx];

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentLine.start === null) currentLine.start = syncAudioRef.current?.currentTime || 0;
        else if (currentLine.end === null) {
          currentLine.end = syncAudioRef.current?.currentTime || 0;
          if (currentIdx < data.length - 1) setActiveSyncIndex(currentIdx + 1);
        } else if (currentIdx < data.length - 1) setActiveSyncIndex(currentIdx + 1);
        setSyncData(data);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentLine.end !== null) {
          currentLine.end = null;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = currentLine.start;
        } else if (currentLine.start !== null) {
          currentLine.start = null;
          const prevEnd = currentIdx > 0 ? data[currentIdx - 1].end : 0;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = prevEnd || 0;
        } else if (currentIdx > 0) {
          setActiveSyncIndex(currentIdx - 1);
          if (syncAudioRef.current) syncAudioRef.current.currentTime = data[currentIdx - 1].start || 0;
        }
        setSyncData(data);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSyncMode]);

  const startSyncMode = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before syncing!");
    setCurrentTrack(null);
    setIsSyncLoading(true);
    
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
    let initialData = [];

    if (selectedSong.syncData?.length === parsedLines.length) {
      initialData = parsedLines.map((line, i) => ({ ...line, pronunciation: selectedSong.syncData[i].pronunciation || null, start: selectedSong.syncData[i].start, end: selectedSong.syncData[i].end }));
    } else if (selectedSong.syncData?.some(l => l.start !== null)) {
      const salvagedData = mergeSyncWithGenius(selectedSong.syncData, customData.lyrics, selectedSong.artistName, masterPalette);
      initialData = salvagedData.map((line) => ({ ...line, pronunciation: line.pronunciation || null }));
    } else {
      initialData = parsedLines.map((line) => ({ ...line, pronunciation: null, start: null, end: null }));
    }
    
    setSyncData(initialData);
    setActiveSyncIndex(0);
    setIsSyncMode(true);
    setIsSyncLoading(false);
  };

  const handleAutoSyncDatabases = async (forceSync = false) => {
    if (!isSaved && !forceSync) return alert("Please add to Vault first before auto-syncing!");
    setIsLrcFetching(true);
    setNotification({ show: true, message: 'Fetching from databases...', progress: null });
    
    try {
      let finalSyncData = null;
      let finalPlainText = "";
      let hasWordSync = false;
      let finalSource = 'None';
      let finalRawData = null;

      const youData = await fetchYouLyrics(selectedSong.trackName, selectedSong.artistName, selectedSong.trackTimeMillis);
      let youParsed = null;
      let youHasWordSync = false;

      if (youData?.syncedLyrics) {
        youParsed = parseLRC(youData.syncedLyrics, selectedSong.artistName, masterPalette);
        youHasWordSync = youParsed.syncData.some(line => line.wordSync?.length > 0);
      }

      if (youHasWordSync) {
        finalSyncData = youParsed.syncData; finalPlainText = youParsed.plainTextLyrics; hasWordSync = true; finalSource = 'YouLyrics API'; finalRawData = youData;
      } else {
        const lrcData = await fetchLRCLIB(selectedSong.trackName, selectedSong.artistName, selectedSong.trackTimeMillis);
        if (lrcData?.syncedLyrics) {
          const lrcParsed = parseLRC(lrcData.syncedLyrics, selectedSong.artistName, masterPalette);
          const lrcHasWordSync = lrcParsed.syncData.some(line => line.wordSync?.length > 0);
          if (lrcHasWordSync || !youParsed) {
            finalSyncData = lrcParsed.syncData; finalPlainText = lrcParsed.plainTextLyrics; hasWordSync = lrcHasWordSync; finalSource = 'LRCLIB API'; finalRawData = lrcData;
          } else {
            finalSyncData = youParsed.syncData; finalPlainText = youParsed.plainTextLyrics; finalSource = 'YouLyrics API (Fallback)'; finalRawData = youData;
          }
        } else if (youParsed) {
          finalSyncData = youParsed.syncData; finalPlainText = youParsed.plainTextLyrics; finalSource = 'YouLyrics API (Fallback)'; finalRawData = youData;
        } else {
          if (youData?.plainLyrics) { finalPlainText = youData.plainLyrics; finalSource = 'YouLyrics API (Plain Text)'; finalRawData = youData; }
          else if (lrcData?.plainLyrics) { finalPlainText = lrcData.plainLyrics; finalSource = 'LRCLIB API (Plain Text)'; finalRawData = lrcData; }
        }
      }

      setDebugInfo({ source: finalSource, rawData: finalRawData });

      if (!finalSyncData && !finalPlainText) {
        setNotification({ show: false });
        alert("No lyrics found in databases.");
        return setIsLrcFetching(false);
      }

      if (finalSyncData) {
        if (customData.lyrics) {
          finalSyncData = mergeSyncWithGenius(finalSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
          finalPlainText = customData.lyrics;
        }
        
        updateSongInLibrary({ ...selectedSong, syncData: finalSyncData, lyrics: finalPlainText });
        setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        setSyncData(finalSyncData);
        setNotification({ show: true, message: hasWordSync ? '✨ Word-by-word sync found!' : 'Auto-sync successful!', progress: 100 });
      } else {
        updateSongInLibrary({ ...selectedSong, lyrics: finalPlainText });
        setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        setNotification({ show: true, message: 'Imported plain lyrics.', progress: 100 });
      }
    } catch (error) {
      console.error(error); alert("Error fetching lyrics.");
      setNotification({ show: false });
    } finally { 
      setIsLrcFetching(false); 
      setTimeout(() => setNotification({ show: false }), 3000);
    }
  };

  const handleTranslate = async () => {
    if (!isSaved) return alert("Please add to Vault first before translating!");
    setIsTranslating(true);
    setNotification({ show: true, message: 'Preparing translation...', progress: 0 });

    let targetData = isSyncMode ? [...syncData] : (selectedSong.syncData ? [...selectedSong.syncData] : []);

    if (targetData.length === 0) {
      if (!customData.lyrics) {
        alert("No lyrics to translate!");
        setIsTranslating(false);
        setNotification({ show: false });
        return;
      }
      targetData = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette).map(l => ({...l, start: null, end: null, pronunciation: null}));
    }

    // Always translate everything, passing the full text strings
    const linesToTranslate = targetData.map(l => l.text);

    const pronunciations = await getBulkPronunciations(linesToTranslate, (current, total) => {
      setNotification({ show: true, message: `Translating line ${current} of ${total}...`, progress: Math.round((current/total)*100) });
    });

    targetData = targetData.map((line, i) => ({ ...line, pronunciation: pronunciations[i] || line.pronunciation }));

    if (isSyncMode) setSyncData(targetData);
    
    updateSongInLibrary({ ...selectedSong, syncData: targetData });

    setNotification({ show: true, message: 'Translation complete!', progress: 100 });
    setTimeout(() => setNotification({ show: false }), 3000);
    setIsTranslating(false);
  };

  const saveSyncData = () => {
    updateSongInLibrary({ ...selectedSong, syncData, lyrics: customData.lyrics });
    setIsSyncMode(false);
  };

  const toggleSyncPlay = () => {
    if (!syncAudioRef.current) return;
    if (syncAudioRef.current.paused) syncAudioRef.current.play().catch(e => console.log(e));
    else syncAudioRef.current.pause();
  };

  const autoTrackSyncPlayback = (time) => {
    const isRecording = syncDataRef.current[activeIdxRef.current]?.start !== null && syncDataRef.current[activeIdxRef.current]?.end === null;
    if (isRecording) return;
    const newIdx = syncDataRef.current.findIndex((line, i) => {
      const nextLine = syncDataRef.current[i + 1];
      if (line.start === null) return false;
      return time >= line.start && (line.end !== null ? time <= line.end : true) && (nextLine?.start !== null ? time < nextLine.start : true);
    });
    if (newIdx !== -1 && newIdx !== activeIdxRef.current) setActiveSyncIndex(newIdx);
  };

  const handleSyncTimeUpdate = () => {
    const time = syncAudioRef.current?.currentTime || 0;
    setSyncProgress(time);
    if (isSyncPlaying) autoTrackSyncPlayback(time);
  };

  const handleSyncSeek = (e) => {
    const time = Number(e.target.value);
    if (syncAudioRef.current) syncAudioRef.current.currentTime = time;
    setSyncProgress(time);
    autoTrackSyncPlayback(time);
  };

  const handleSpeedChange = (e) => setPlaybackRate(parseFloat(e.target.value));

  return {
    isSyncMode, setIsSyncMode, isSyncLoading, isLrcFetching, isTranslating, syncData, setSyncData, activeSyncIndex, setActiveSyncIndex,
    syncProgress, syncDuration, setSyncDuration, isSyncPlaying, setIsSyncPlaying, syncAudioSrc, playbackRate, debugInfo,
    syncAudioRef, activeLineRef, startSyncMode, saveSyncData, handleAutoSyncDatabases, handleTranslate, toggleSyncPlay, handleSyncSeek,
    handleSpeedChange, handleSyncTimeUpdate
  };
};