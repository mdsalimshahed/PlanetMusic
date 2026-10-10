/* --- src/Studio/hooks/sync/useSyncWorkspace.js --- */
import { useState, useEffect, useRef, useMemo } from 'react';
import { parseLyrics, extractYouTubeId } from '../../utils/songHelpers.js';
import { globalClock as workspaceClock } from '../../utils/clockEngine.js';
import { useSyncEngine, useSyncKeyboard, useSyncActions } from './useSyncLogic.js';

const cloneSyncData = (data = []) => (Array.isArray(data) ? data : []).map(line => ({
  ...line,
  adlibs: line.adlibs?.map(adlib => ({ ...adlib }))
}));

export const useSyncWorkspace = (selectedSong, isSaved, customData, setCustomData, masterPalette, updateSongInLibrary, setNotification, settings) => {
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isShowingAutoSync, setIsShowingAutoSync] = useState(false);
  const [showBluetoothSyncPrompt, setShowBluetoothSyncPrompt] = useState(false);
  const [isBluetoothDelayCompensationEnabled, setIsBluetoothDelayCompensationEnabled] = useState(false);
  const [bluetoothDelayCompensationMs, setBluetoothDelayCompensationMs] = useState(200);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isLrcFetching, setIsLrcFetching] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [syncData, setSyncData] = useState([]);
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [activeSyncSource, setActiveSyncSource] = useState(null);
  const [manualSource, setManualSource] = useState(null);
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [debugInfo, setDebugInfo] = useState({ source: 'None', rawData: null });
  const [constrainedEnd, setConstrainedEnd] = useState(null);
  const [loopRange, setLoopRange] = useState(null);

  const activeLineRef = useRef(null);
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);
  const constrainedEndRef = useRef(constrainedEnd);
  const loopRangeRef = useRef(loopRange);
  const prevTrackRef = useRef(null);
  const playbackRateRef = useRef(playbackRate);
  const wasSyncModeRef = useRef(isSyncMode);

  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
  useEffect(() => {
    if (wasSyncModeRef.current && !isSyncMode) {
      playbackRateRef.current = 1;
      setPlaybackRate(1);
      setIsSyncPlaying(false);
      workspaceClock.setRate(1);
      window.dispatchEvent(new CustomEvent('globalPlayerCommand', {
        detail: { type: 'rate', rate: 1 }
      }));
    }
    wasSyncModeRef.current = isSyncMode;
  }, [isSyncMode]);
  useEffect(() => { activeIdxRef.current = activeSyncIndex; }, [activeSyncIndex]);
  useEffect(() => { syncDataRef.current = syncData; }, [syncData]);
  useEffect(() => { constrainedEndRef.current = constrainedEnd; }, [constrainedEnd]);
  useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);

  const workspaceLines = useMemo(() => {
    const lines = [];
    (Array.isArray(syncData) ? syncData : []).forEach((line, i) => {
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
      setIsSyncLoading(false);
      setPlaybackRate(1.0);
      setDebugInfo({ source: 'Local Vault / Cache', rawData: null });
      setConstrainedEnd(null);
      setLoopRange(null);
      setManualSource(null);
    }
  }, [selectedSong]);

  // Stabilized primitive dependencies
  const songTrackId = selectedSong?.trackId;
  const ytCustomLink = customData?.yt || selectedSong?.customLinks?.yt || selectedSong?.yt;
  const deezerCustomLink = customData?.deezer || selectedSong?.customLinks?.deezer;
  const hasLocalAudio = customData?.hasLocal;

  const availableSources = useMemo(() => {
    const sources = [];
    if (hasLocalAudio) sources.push('local');
    if (deezerCustomLink) sources.push('deezer');
    const ytUrl = ytCustomLink;
    if (extractYouTubeId(ytUrl)) sources.push('youtube');
    return sources;
  }, [hasLocalAudio, deezerCustomLink, ytCustomLink]);

  const computedSource = manualSource && availableSources.includes(manualSource) 
      ? manualSource 
      : (availableSources[0] || null);

  useEffect(() => {
    if (!isSyncMode || !songTrackId) return;

    if (!computedSource) {
      window.dispatchEvent(new CustomEvent('globalPlayerCommand', {
        detail: { type: 'pause' }
      }));
      return;
    }

    const loadTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('globalPlayerLoadTrack', {
        detail: {
          track: {
            ...selectedSong,
            customLinks: { ...selectedSong.customLinks, ...customData }
          },
          source: computedSource,
          autoplay: false,
          playbackRate: playbackRateRef.current
        },
      }));
    }, 0);
    return () => clearTimeout(loadTimer);
  }, [isSyncMode, songTrackId, computedSource, selectedSong, customData]);

  useEffect(() => {
    workspaceClock.setRate(playbackRate);
    if (isSyncMode) {
      window.dispatchEvent(new CustomEvent('globalPlayerCommand', {
        detail: { type: 'rate', rate: playbackRate }
      }));
    }
  }, [isSyncMode, playbackRate]);

  useEffect(() => {
    const handlePlayState = (event) => {
      if (!isSyncMode) return;
      const { trackId, isPlaying } = event.detail || {};
      if (trackId != null && String(trackId) !== String(songTrackId)) return;
      setIsSyncPlaying(Boolean(isPlaying));
    };
    const handleActiveSource = (event) => {
      if (String(event.detail?.trackId) !== String(songTrackId)) return;
      setActiveSyncSource(event.detail?.source || null);
    };
    window.addEventListener('globalPlayState', handlePlayState);
    window.addEventListener('globalActiveSource', handleActiveSource);
    return () => {
      window.removeEventListener('globalPlayState', handlePlayState);
      window.removeEventListener('globalActiveSource', handleActiveSource);
    };
  }, [isSyncMode, songTrackId]);

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
      const manualSyncDraft = cloneSyncData(selectedSong.syncData || []);
      setSyncData(manualSyncDraft);
      syncDataRef.current = manualSyncDraft;
      setActiveSyncIndex(0);
    } else {
      if (!selectedSong.autoSyncData || selectedSong.autoSyncData.length === 0) {
        return alert("No Auto-Sync data available! Please fetch it from the dashboard first.");
      }
      setIsShowingAutoSync(true);
      const autoSyncDraft = cloneSyncData(selectedSong.autoSyncData);
      setSyncData(autoSyncDraft);
      syncDataRef.current = autoSyncDraft;
      setActiveSyncIndex(0);
    }
  };

  const updateWorkspaceData = (newData, { promoteToManual = true } = {}) => {
    setSyncData(newData);
    syncDataRef.current = newData;
    if (promoteToManual && isShowingAutoSync) setIsShowingAutoSync(false);
  };

  useSyncEngine({
    isSyncMode, isSyncPlaying, trackId: songTrackId,
    workspaceLinesRef, activeIdxRef, setActiveSyncIndex,
    syncDataRef, updateWorkspaceData,
    loopRangeRef, setLoopRange,
    constrainedEndRef, setConstrainedEnd
  });

  const triggerSyncKey = useSyncKeyboard({
    isSyncMode,
    isBluetoothDelayCompensationEnabled,
    bluetoothDelayCompensationMs,
    activeIdxRef, workspaceLinesRef, selectedSong,
    syncDataRef, updateWorkspaceData, setActiveSyncIndex, setLoopRange,
    loopRangeRef, isShowingAutoSync
  });

  const { 
    handleSplitAdlibs, handleUndoSplit, handleAutoSyncDatabases, handleTranslate, handleMapAutoSync, handleShiftTimings 
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

    playbackRateRef.current = 1.0;
    setPlaybackRate(1.0);
    setIsSyncPlaying(false);
    workspaceClock.setRate(1.0);
    workspaceClock.pause();
    workspaceClock.seek(0);
    window.currentAudioTime = 0;
    setIsBluetoothDelayCompensationEnabled(false);
    setBluetoothDelayCompensationMs(Number.isFinite(settings?.audioDelayCompensationMs)
      ? Math.max(-250, Math.min(250, settings.audioDelayCompensationMs))
      : 200);
    setShowBluetoothSyncPrompt(true);
    setIsSyncLoading(true);
    try {
      window.dispatchEvent(new CustomEvent('pauseGlobalPlayer'));
      const hasManualText = Boolean(customData.lyrics && customData.lyrics.trim());
      const parsedLines = parseLyrics(hasManualText ? customData.lyrics : '', selectedSong.artistName, masterPalette);
      let initialData = [];
      const hasManualSync = Array.isArray(selectedSong.syncData) && selectedSong.syncData.some(line => line.start !== null);
      const hasAutoSync = Array.isArray(selectedSong.autoSyncData) && selectedSong.autoSyncData.some(line => line.start !== null);
      const useAutoSync = isShowingAutoSync || (!hasManualSync && hasAutoSync);
      const sourceData = useAutoSync
        ? (Array.isArray(selectedSong.autoSyncData) ? selectedSong.autoSyncData : [])
        : (Array.isArray(selectedSong.syncData) ? selectedSong.syncData : []);

      if (hasManualText) {
        initialData = parsedLines.map((line, i) => {
          const existingNode = sourceData?.[i] || {};
          return {
            ...line,
            translation: existingNode.translation || '',
            pronunciation: existingNode.pronunciation || null,
            spacingText: existingNode.spacingText || '',
            lang: existingNode.lang || 'auto',
            start: existingNode.start !== undefined ? existingNode.start : null,
            end: existingNode.end !== undefined ? existingNode.end : null,
            isSplit: existingNode.isSplit || false,
            adlibs: existingNode.adlibs?.map(adlib => ({ ...adlib }))
          };
        });
      } else if (sourceData && sourceData.length > 0) {
        initialData = cloneSyncData(sourceData);
      }

      setIsShowingAutoSync(false);
      setSyncData(initialData);
      syncDataRef.current = initialData;
      setActiveSyncIndex(0);
      setIsSyncMode(true);
    } catch (err) {
      setShowBluetoothSyncPrompt(false);
      console.error("Error launching sync workspace:", err);
    } finally {
      setIsSyncLoading(false);
    }
  };

  const handleBluetoothSyncChoice = (shouldCompensate) => {
    setIsBluetoothDelayCompensationEnabled(shouldCompensate);
    setShowBluetoothSyncPrompt(false);
  };

  const handleRefreshLyrics = () => {
    setShowRefreshPrompt(true);
  };

  const confirmRefreshLyrics = () => {
    const resetData = syncDataRef.current.map(line => ({
      ...line,
      start: null,
      end: null,
      isSplit: false,
      adlibs: undefined
    }));
    updateWorkspaceData(resetData);
    
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
    updateSongInLibrary({ ...selectedSong, syncData: syncDataRef.current, lyrics: customData.lyrics });
    setIsSyncMode(false);
    setIsShowingAutoSync(false);
    workspaceClock.pause();
  };

  const toggleSyncPlay = () => {
    window.dispatchEvent(new CustomEvent('globalPlayerCommand', {
      detail: { type: 'toggle', trackId: songTrackId }
    }));
  };

  const handleSpeedChange = (e) => {
    const spd = parseFloat(e.target.value);
    setPlaybackRate(spd);
    workspaceClock.setRate(spd);
    window.dispatchEvent(new CustomEvent('globalPlayerCommand', {
      detail: { type: 'rate', rate: spd, trackId: songTrackId }
    }));
  };

  return {
    isSyncMode, setIsSyncMode, isShowingAutoSync, setIsShowingAutoSync, showBluetoothSyncPrompt, handleBluetoothSyncChoice, isSyncLoading, isLrcFetching, isTranslating, syncData, setSyncData, activeSyncIndex, setActiveSyncIndex,
    isSyncPlaying, activeSyncSource, playbackRate, debugInfo,
    activeLineRef, startSyncMode, handleRefreshLyrics, confirmRefreshLyrics, cancelRefreshLyrics, showRefreshPrompt, saveSyncData, handleAutoSyncDatabases, handleTranslate, handleMapAutoSync, toggleSyncPlay,
    handleSpeedChange, workspaceLines, handleSplitAdlibs, handleUndoSplit, setConstrainedEnd, loopRange, setLoopRange, toggleWorkspaceMode,
    availableSources, setManualSource, handleShiftTimings, triggerSyncKey
  };
};