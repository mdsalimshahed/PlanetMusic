/* --- src/hooks/useSyncWorkspace.js --- */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getAudioFile } from '../db';
import { parseLyrics, mergeSyncWithGenius } from '../utils/songHelpers';
import { useSyncEngine, useSyncKeyboard, useSyncActions } from './useSyncLogic';

export const useSyncWorkspace = (selectedSong, isSaved, customData, setCustomData, masterPalette, updateSongInLibrary, setCurrentTrack, setNotification) => {
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isShowingAutoSync, setIsShowingAutoSync] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isLrcFetching, setIsLrcFetching] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [syncData, setSyncData] = useState([]);
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [syncAudioSrc, setSyncAudioSrc] = useState(undefined);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [debugInfo, setDebugInfo] = useState({ source: 'None', rawData: null });
  const [constrainedEnd, setConstrainedEnd] = useState(null);
  const [loopRange, setLoopRange] = useState(null);
  
  const syncAudioRef = useRef(null);
  const activeLineRef = useRef(null);
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);
  const constrainedEndRef = useRef(constrainedEnd);
  const loopRangeRef = useRef(loopRange);
  const prevTrackRef = useRef(null);

  useEffect(() => { activeIdxRef.current = activeSyncIndex; }, [activeSyncIndex]);
  useEffect(() => { syncDataRef.current = syncData; }, [syncData]);
  useEffect(() => { constrainedEndRef.current = constrainedEnd; }, [constrainedEnd]);
  useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);

  const workspaceLines = useMemo(() => {
    const lines = [];
    syncData.forEach((line, i) => {
      lines.push({ type: 'main', lineIndex: i, ref: line });
      if (line.isSplit && line.adlibs) {
        line.adlibs.forEach((adlib, j) => {
          lines.push({ type: 'adlib', lineIndex: i, adlibIndex: j, ref: adlib, parentRef: line });
        });
      }
    });
    return lines;
  }, [syncData]);

  const workspaceLinesRef = useRef(workspaceLines);
  useEffect(() => { workspaceLinesRef.current = workspaceLines; }, [workspaceLines]);

  useEffect(() => {
    if (selectedSong && selectedSong.trackId !== prevTrackRef.current) {
      prevTrackRef.current = selectedSong.trackId;
      setIsSyncMode(false);
      setIsShowingAutoSync(false);
      setPlaybackRate(1.0);
      setDebugInfo({ source: 'Local Vault / Cache', rawData: null });
      setConstrainedEnd(null);
      setLoopRange(null);
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

  const updateWorkspaceData = (newData) => {
    if (isShowingAutoSync) {
      setIsShowingAutoSync(false);
      setNotification({ show: true, message: 'Edit detected: Converted to Manual Sync', progress: 100 });
      setTimeout(() => setNotification({ show: false }), 2000);
    }
    setSyncData(newData);
    syncDataRef.current = newData;
  };

  useSyncEngine({
    syncAudioRef, isSyncPlaying, setIsSyncPlaying,
    workspaceLinesRef, activeIdxRef, setActiveSyncIndex,
    syncDataRef, updateWorkspaceData,
    loopRangeRef, setLoopRange,
    constrainedEndRef, setConstrainedEnd
  });

  useSyncKeyboard({
    isSyncMode, syncAudioRef, activeIdxRef, workspaceLinesRef,
    syncDataRef, updateWorkspaceData, setActiveSyncIndex, setLoopRange,
    loopRangeRef // CRITICAL FIX: Ensure parameter is explicitly passed down
  });

  const { 
    handleSplitAdlibs, handleUndoSplit, handleAutoSyncDatabases, handleTranslate 
  } = useSyncActions({
    selectedSong, isSaved, customData, setCustomData, masterPalette,
    updateSongInLibrary, isShowingAutoSync, setIsShowingAutoSync,
    isSyncMode, setSyncData, syncDataRef, setNotification,
    setIsLrcFetching, setIsTranslating, updateWorkspaceData,
    setLoopRange, setDebugInfo
  });

  const startSyncMode = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before syncing!");
    setCurrentTrack(null);
    setIsSyncLoading(true);
    
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
    let initialData = [];
    const sourceData = isShowingAutoSync && selectedSong.autoSyncData ? selectedSong.autoSyncData : selectedSong.syncData;
    
    if (sourceData?.length === parsedLines.length) {
      initialData = parsedLines.map((line, i) => ({ ...line, pronunciation: sourceData[i].pronunciation || null, start: sourceData[i].start, end: sourceData[i].end, isSplit: sourceData[i].isSplit || false, adlibs: sourceData[i].adlibs || undefined }));
    } else if (sourceData?.some(l => l.start !== null)) {
      const salvagedData = mergeSyncWithGenius(sourceData, customData.lyrics, selectedSong.artistName, masterPalette);
      initialData = salvagedData.map((line) => ({ ...line, pronunciation: line.pronunciation || null }));
    } else {
      initialData = parsedLines.map((line) => ({ ...line, pronunciation: null, start: null, end: null }));
    }
    
    setSyncData(initialData);
    syncDataRef.current = initialData;
    setActiveSyncIndex(0);
    setIsSyncMode(true);
    setIsSyncLoading(false);
  };

  const saveSyncData = () => {
    updateSongInLibrary({ ...selectedSong, syncData: syncDataRef.current, lyrics: customData.lyrics });
    setIsSyncMode(false);
    setIsShowingAutoSync(false);
  };

  const toggleSyncPlay = () => {
    if (!syncAudioRef.current) return;
    if (syncAudioRef.current.paused) syncAudioRef.current.play().catch(e => console.log(e));
    else syncAudioRef.current.pause();
  };

  const handleSyncSeek = (e) => {
    const time = Number(e.target.value);
    if (syncAudioRef.current) syncAudioRef.current.currentTime = time;
    window.dispatchEvent(new CustomEvent('workspaceTimeUpdate', { detail: time }));
  };

  const handleSpeedChange = (e) => setPlaybackRate(parseFloat(e.target.value));

  return {
    isSyncMode, setIsSyncMode, isShowingAutoSync, setIsShowingAutoSync, isSyncLoading, isLrcFetching, isTranslating, syncData, setSyncData, activeSyncIndex, setActiveSyncIndex,
    syncDuration, setSyncDuration, isSyncPlaying, setIsSyncPlaying, syncAudioSrc, playbackRate, debugInfo,
    syncAudioRef, activeLineRef, startSyncMode, saveSyncData, handleAutoSyncDatabases, handleTranslate, toggleSyncPlay, handleSyncSeek,
    handleSpeedChange, workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange
  };
};