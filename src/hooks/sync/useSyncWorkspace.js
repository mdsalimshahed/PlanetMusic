/* --- src/hooks/useSyncWorkspace.js --- */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getAudioFile } from '../../services/db';
import { parseLyrics, extractYouTubeId } from '../../utils/songHelpers';
import { workspaceClock } from '../../utils/clockEngine';
import { useSyncEngine, useSyncKeyboard, useSyncActions } from './useSyncLogic';

export const useSyncWorkspace = (selectedSong, isSaved, customData, setCustomData, masterPalette, updateSongInLibrary, setCurrentTrack, setNotification, settings) => {
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isShowingAutoSync, setIsShowingAutoSync] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isLrcFetching, setIsLrcFetching] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [syncData, setSyncData] = useState([]);
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  
  // Dedicated local playback states for the Sync Workspace
  const [syncAudioSrc, setSyncAudioSrc] = useState(undefined);
  const [syncYtVideoId, setSyncYtVideoId] = useState(null);
  const [activeSyncSource, setActiveSyncSource] = useState(null);
  const [manualSource, setManualSource] = useState(null); // Explicit user override state
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [debugInfo, setDebugInfo] = useState({ source: 'None', rawData: null });
  const [constrainedEnd, setConstrainedEnd] = useState(null);
  const [loopRange, setLoopRange] = useState(null);
  
  const syncAudioRef = useRef(null);
  const syncYtPlayerRef = useRef(null);
  const activeLineRef = useRef(null);
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);
  const constrainedEndRef = useRef(constrainedEnd);
  const loopRangeRef = useRef(loopRange);
  const prevTrackRef = useRef(null);
  
  // Caches binary audio blobs for the lifecycle of the track so we never re-request Deezer streams on toggle
  const cachedUrlsRef = useRef({ local: null, deezer: null });

  useEffect(() => {
    workspaceClock.setEventName('workspaceTimeUpdate');
  }, []);

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

  // Handle global unmount memory clearance
  useEffect(() => {
    return () => {
      if (cachedUrlsRef.current.local) URL.revokeObjectURL(cachedUrlsRef.current.local);
      if (cachedUrlsRef.current.deezer) URL.revokeObjectURL(cachedUrlsRef.current.deezer);
    };
  }, []);

  useEffect(() => {
    if (selectedSong && selectedSong.trackId !== prevTrackRef.current) {
      prevTrackRef.current = selectedSong.trackId;
      setIsSyncMode(false);
      setIsShowingAutoSync(false);
      setPlaybackRate(1.0);
      setDebugInfo({ source: 'Local Vault / Cache', rawData: null });
      setConstrainedEnd(null);
      setLoopRange(null);
      setManualSource(null);

      // Clean up previous blobs from memory
      if (cachedUrlsRef.current.local) URL.revokeObjectURL(cachedUrlsRef.current.local);
      if (cachedUrlsRef.current.deezer) URL.revokeObjectURL(cachedUrlsRef.current.deezer);
      cachedUrlsRef.current = { local: null, deezer: null };
    }
  }, [selectedSong]);

  // Compute available valid sources dynamically based on current track data
  const availableSources = useMemo(() => {
    const sources = [];
    if (customData.hasLocal) sources.push('local');
    if (customData.deezer || selectedSong?.customLinks?.deezer) sources.push('deezer');
    const ytUrl = customData.yt || selectedSong?.customLinks?.yt || selectedSong?.yt;
    if (extractYouTubeId(ytUrl)) sources.push('youtube');
    return sources;
  }, [customData.hasLocal, customData.deezer, customData.yt, selectedSong]);

  const computedSource = manualSource && availableSources.includes(manualSource)
    ? manualSource
    : (availableSources[0] || null); // Local -> Deezer -> YouTube Strict Fallback

  // Load YouTube stream URL or local audio / deezer fetch
  useEffect(() => {
    const loadSyncAudio = async () => {
      if (isSyncMode && selectedSong) {
        const sourceToLoad = computedSource;

        if (!sourceToLoad) {
          setActiveSyncSource(null);
          setSyncYtVideoId(null);
          setSyncAudioSrc(undefined);
          setIsSyncLoading(false);
          return;
        }

        // Force stop players to prevent malfunction/overlap on rapid switching
        setIsSyncPlaying(false);
        workspaceClock.pause();
        if (syncAudioRef.current) {
          syncAudioRef.current.pause();
          syncAudioRef.current.currentTime = 0;
        }
        if (syncYtPlayerRef.current) {
          try { syncYtPlayerRef.current.pauseVideo(); } catch(e){}
        }

        setSyncYtVideoId(null);
        setSyncAudioSrc(undefined);

        if (sourceToLoad === 'local') {
          if (cachedUrlsRef.current.local) {
            setSyncAudioSrc(cachedUrlsRef.current.local);
            setActiveSyncSource('local');
            setIsSyncLoading(false);
          } else {
            const file = await getAudioFile(selectedSong.trackId);
            if (file) {
              const url = URL.createObjectURL(file);
              cachedUrlsRef.current.local = url;
              setSyncAudioSrc(url);
              setActiveSyncSource('local');
            }
            setIsSyncLoading(false);
          }
        } else if (sourceToLoad === 'youtube') {
          const ytUrl = customData.yt || selectedSong.customLinks?.yt || selectedSong.yt;
          setSyncYtVideoId(extractYouTubeId(ytUrl));
          setActiveSyncSource('youtube');
          setIsSyncLoading(false);
        } else if (sourceToLoad === 'deezer') {
          setActiveSyncSource('deezer');
          
          if (cachedUrlsRef.current.deezer) {
            setSyncAudioSrc(cachedUrlsRef.current.deezer);
            setIsSyncLoading(false);
            return;
          }

          setIsSyncLoading(true);
          const dzUrl = customData.deezer || selectedSong.customLinks?.deezer;
          try {
            const formData = new FormData();
            formData.append('session_id', `stream_${Date.now()}`);
            formData.append('url', dzUrl);
            formData.append('arl_token', settings?.deezerArl || '');
            formData.append('quality', '1');
            formData.append('action', 'stream');
            
            const response = await fetch('https://ytdownloader-jnt0.onrender.com/download-deezer', {
              method: 'POST',
              body: formData
            });

            if (!response.ok) throw new Error("Deezer secure stream buffer failed.");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            cachedUrlsRef.current.deezer = url;
            setSyncAudioSrc(url);
          } catch (e) {
            console.error("Deezer buffer issue, falling back:", e);
            if (availableSources.includes('youtube')) setManualSource('youtube');
            else if (availableSources.includes('local')) setManualSource('local');
          } finally {
            setIsSyncLoading(false);
          }
        }
      }
    };
    loadSyncAudio();
  }, [isSyncMode, computedSource, selectedSong]);

  // Sync playback rate with workspace clock
  useEffect(() => {
    workspaceClock.setRate(playbackRate);
    if (isSyncMode) {
      const savedVolume = localStorage.getItem('playerVolume');
      const vol = savedVolume !== null ? parseFloat(savedVolume) : 1;
      
      if (syncYtPlayerRef.current) {
        try {
          syncYtPlayerRef.current.setVolume(vol * 100);
          syncYtPlayerRef.current.setPlaybackRate(playbackRate);
        } catch (e) {}
      }
      if (syncAudioRef.current) {
        syncAudioRef.current.volume = vol;
        syncAudioRef.current.playbackRate = playbackRate;
      }
    }
  }, [isSyncMode, syncAudioSrc, playbackRate]);

  // Pause Sync Player if Global Player plays
  useEffect(() => {
    const handleGlobalPlay = () => {
      if (syncYtPlayerRef.current) {
        try { syncYtPlayerRef.current.pauseVideo(); } catch (e) {}
      }
      if (syncAudioRef.current && !syncAudioRef.current.paused) {
        syncAudioRef.current.pause();
      }
      setIsSyncPlaying(false);
      workspaceClock.pause();
    };
    window.addEventListener('globalPlayerDidPlay', handleGlobalPlay);
    return () => window.removeEventListener('globalPlayerDidPlay', handleGlobalPlay);
  }, []);

  // AUTO SCROLL ACTIVE LINE
  useEffect(() => {
    if (isSyncMode && activeLineRef.current) {
      const container = activeLineRef.current.parentElement;
      if (container) {
        const scrollPos = activeLineRef.current.offsetTop - (container.clientHeight / 2) + (activeLineRef.current.clientHeight / 2);
        container.scrollTo({ top: scrollPos, behavior: 'smooth' });
      }
    }
  }, [activeSyncIndex, isSyncMode]);

  const toggleWorkspaceMode = () => {
    if (isShowingAutoSync) {
      setIsShowingAutoSync(false);
      setSyncData(selectedSong.syncData || []);
      syncDataRef.current = selectedSong.syncData || [];
      setActiveSyncIndex(0);
    } else {
      if (!selectedSong.autoSyncData || selectedSong.autoSyncData.length === 0) {
        return alert("No Auto-Sync data available! Please fetch it from the dashboard first.");
      }
      setIsShowingAutoSync(true);
      setSyncData(selectedSong.autoSyncData);
      syncDataRef.current = selectedSong.autoSyncData;
      setActiveSyncIndex(0);
    }
  };

  const updateWorkspaceData = (newData) => {
    setSyncData(newData);
    syncDataRef.current = newData;
  };

  useSyncEngine({
    syncAudioRef, syncYtVideoId, syncYtPlayerRef, isSyncPlaying, setIsSyncPlaying,
    workspaceLinesRef, activeIdxRef, setActiveSyncIndex,
    syncDataRef, updateWorkspaceData,
    loopRangeRef, setLoopRange,
    constrainedEndRef, setConstrainedEnd
  });

  useSyncKeyboard({
    isSyncMode, syncAudioRef, syncYtVideoId, syncYtPlayerRef, activeIdxRef, workspaceLinesRef,
    syncDataRef, updateWorkspaceData, setActiveSyncIndex, setLoopRange,
    loopRangeRef, isShowingAutoSync
  });

  const {
      handleSplitAdlibs, handleUndoSplit, handleAutoSyncDatabases, handleTranslate, handleMapAutoSync
    } = useSyncActions({
    selectedSong, isSaved, customData, setCustomData, masterPalette,
    updateSongInLibrary, isShowingAutoSync, setIsShowingAutoSync,
    isSyncMode, setSyncData, syncDataRef, setNotification,
    setIsLrcFetching, setIsTranslating, updateWorkspaceData,
    setLoopRange, setDebugInfo
  });

  const startSyncMode = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before syncing!");
    if (availableSources.length === 0) {
      return alert("No full-length audio source available! Please add a Local MP3, Deezer link, or YouTube link to sync. iTunes Preview snippets are not allowed in the sync workspace.");
    }

    window.dispatchEvent(new CustomEvent('pauseGlobalPlayer'));
    setIsSyncLoading(true);

    const hasManualText = Boolean(customData.lyrics && customData.lyrics.trim());
    const parsedLines = parseLyrics(hasManualText ? customData.lyrics : '', selectedSong.artistName, masterPalette);
    let initialData = [];
    const sourceData = isShowingAutoSync && selectedSong.autoSyncData ? selectedSong.autoSyncData : selectedSong.syncData;
    
    if (hasManualText) {
      initialData = parsedLines.map((line, i) => {
        const existingNode = selectedSong?.syncData?.[i] || {};
        return {
          ...line,
          translation: existingNode.translation || '',
          pronunciation: existingNode.pronunciation || null,
          start: existingNode.start !== undefined ? existingNode.start : null,
          end: existingNode.end !== undefined ? existingNode.end : null,
          isSplit: existingNode.isSplit || false,
          adlibs: existingNode.adlibs || undefined
        };
      });
    } else if (sourceData && sourceData.length > 0) {
      initialData = sourceData.map((node) => ({ ...node }));
    }

    setSyncData(initialData);
    syncDataRef.current = initialData;
    setActiveSyncIndex(0);
    setIsSyncMode(true);
  };

  const handleRefreshLyrics = () => {
    setShowRefreshPrompt(true);
  };

  const confirmRefreshLyrics = () => {
    // Clear timing for currently active workspace mode only
    const resetData = syncDataRef.current.map(line => ({
      ...line,
      start: null,
      end: null,
      isSplit: false,
      adlibs: undefined
    }));
    setSyncData(resetData);
    syncDataRef.current = resetData;
    
    if (setNotification) {
      const modeLabel = isShowingAutoSync ? "Auto-Sync" : "Manual Sync";
      setNotification({ show: true, message: `${modeLabel} timings cleared! Click "Save Timings" to apply changes.`, progress: 100 });
      setTimeout(() => setNotification({ show: false }), 3000);
    }
    setShowRefreshPrompt(false);
  };

  const cancelRefreshLyrics = () => {
    setShowRefreshPrompt(false);
  };

  const saveSyncData = () => {
    if (isShowingAutoSync) {
      updateSongInLibrary({ ...selectedSong, autoSyncData: syncDataRef.current });
    } else {
      updateSongInLibrary({ ...selectedSong, syncData: syncDataRef.current, lyrics: customData.lyrics });
    }
    setIsSyncMode(false);
    setIsShowingAutoSync(false);
    workspaceClock.pause();
  };

  const toggleSyncPlay = () => {
    if (syncYtVideoId && syncYtPlayerRef.current) {
      try {
        if (isSyncPlaying) {
          syncYtPlayerRef.current.pauseVideo();
          setIsSyncPlaying(false);
          workspaceClock.pause();
        } else {
          window.dispatchEvent(new CustomEvent('pauseGlobalPlayer'));
          syncYtPlayerRef.current.playVideo();
          setIsSyncPlaying(true);
          workspaceClock.start(workspaceClock.getCurrentTime());
        }
      } catch (e) {}
      return;
    }
    if (!syncAudioRef.current) return;

    if (syncAudioRef.current.paused) {
      window.dispatchEvent(new CustomEvent('pauseGlobalPlayer'));
      syncAudioRef.current.play().catch(e => console.log(e));
      setIsSyncPlaying(true);
      workspaceClock.start(syncAudioRef.current.currentTime || 0);
    } else {
      syncAudioRef.current.pause();
      setIsSyncPlaying(false);
      workspaceClock.pause();
    }
  };

  const handleSyncSeek = (e) => {
    const time = Number(e.target.value);
    workspaceClock.seek(time);
    if (syncYtVideoId && syncYtPlayerRef.current) {
      try { syncYtPlayerRef.current.seekTo(time, true); } catch (err) {}
    } else if (syncAudioRef.current) {
      syncAudioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (e) => {
    const spd = parseFloat(e.target.value);
    setPlaybackRate(spd);
    workspaceClock.setRate(spd);
    if (syncYtVideoId && syncYtPlayerRef.current) {
      try { syncYtPlayerRef.current.setPlaybackRate(spd); } catch (err) {}
    }
  };

  return {
    isSyncMode, setIsSyncMode, isShowingAutoSync, setIsShowingAutoSync, isSyncLoading, isLrcFetching, isTranslating, syncData, setSyncData, activeSyncIndex, setActiveSyncIndex,
    syncDuration, setSyncDuration, isSyncPlaying, setIsSyncPlaying, syncAudioSrc, syncYtVideoId, syncYtPlayerRef, activeSyncSource, setActiveSyncSource, playbackRate, debugInfo,
    syncAudioRef, activeLineRef, startSyncMode, handleRefreshLyrics, confirmRefreshLyrics, cancelRefreshLyrics, showRefreshPrompt, saveSyncData, handleAutoSyncDatabases, handleTranslate, handleMapAutoSync, toggleSyncPlay, handleSyncSeek,
    handleSpeedChange, workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange, toggleWorkspaceMode,
    availableSources, setManualSource
  };
};