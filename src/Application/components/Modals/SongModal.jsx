/* --- src/components/SongModal.jsx --- */
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModalLeft from './ModalLeft.jsx';
import ModalRight from './ModalRight.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { buildTranslationWorkspaceData } from '../../../Studio/utils/translationWorkspaceData.js';
import { parseLyrics } from '../../../Studio/utils/lyricsUtils.js';
import { useSongData } from '../../../Application/hooks/data/useSongData.js';
import { useLyricsDisplay } from '../../../Studio/hooks/sync/useLyricsDisplay.js';
import { useSyncWorkspace } from '../../../Studio/hooks/sync/useSyncWorkspace.js';
import './SongModal.css';

const hasUntimedLyrics = (syncLines, lyrics, artistName, masterPalette) => {
  const lyricLines = lyrics?.trim()
    ? parseLyrics(lyrics, artistName, masterPalette).filter(line => line.text?.trim())
    : [];
  if (!lyricLines.length) return false;
  if (!Array.isArray(syncLines) || syncLines.length < lyricLines.length) return true;

  return lyricLines.some((_, index) => {
    const line = syncLines[index];
    const start = line?.start;
    return start === null || start === undefined || start === '' || !Number.isFinite(Number(start));
  })
};

const getNotificationTone = ({ type, progress, message = '' }) => {
  if (['warning', 'error', 'success', 'loading', 'info'].includes(type)) return type;

  const normalizedMessage = message.toLowerCase();
  if (/failed|error|could not|couldn't|no valid|not found/.test(normalizedMessage)) return 'error';
  if (progress !== null && progress !== undefined && progress < 100) return 'loading';
  if (/fetching|loading|digging|translating|grouping|running/.test(normalizedMessage)) return 'loading';
  if (progress === 100 || /saved|loaded|complete|successful|imported|switched|found/.test(normalizedMessage)) return 'success';
  return 'info';
};

const NotificationIcon = ({ tone }) => {
  const commonProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };

  if (tone === 'loading') {
    return (
      <svg {...commonProps} className="notification-icon notification-icon-loading">
        <circle cx="12" cy="12" r="8.5" opacity=".24" />
        <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
      </svg>
    );
  }
  if (tone === 'success') {
    return (
      <svg {...commonProps} className="notification-icon">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16.5 9" />
      </svg>
    );
  }
  if (tone === 'warning' || tone === 'error') {
    return (
      <svg {...commonProps} className="notification-icon">
        <path d="M10.3 4.6 2.9 17.2A1.9 1.9 0 0 0 4.5 20h15a1.9 1.9 0 0 0 1.6-2.8L13.7 4.6a2 2 0 0 0-3.4 0Z" />
        {tone === 'warning' ? <path d="M12 9v4m0 3h.01" /> : <path d="m9.5 9.5 5 5m0-5-5 5" />}
      </svg>
    );
  }
  return (
    <svg {...commonProps} className="notification-icon">
      <path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
};

const NotificationToast = ({ notification, onDismiss }) => {
  const tone = getNotificationTone(notification);

  return (
    <div
      className={`notification-toast is-${tone}${notification.show ? ' is-visible' : ' is-exiting'}`}
      role={tone === 'warning' || tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'warning' || tone === 'error' ? 'assertive' : 'polite'}
      onAnimationEnd={event => {
        if (event.target !== event.currentTarget) return;
        if (event.animationName === 'notification-toast-exit') onDismiss();
      }}
    >
      <div className="notification-toast-icon">
        <NotificationIcon tone={tone} />
      </div>
      <div className="notification-toast-body">
        <p>{notification.message}</p>
        {notification.progress !== null && notification.progress !== undefined && (
          <div
            className="notification-progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={notification.progress}
            aria-label="Task progress"
          >
            <div className="notification-progress-fill" style={{ width: `${notification.progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
};

const SongModal = ({ selectedSong, isSongModalReady, onModalReady, setSelectedSong, isSaved, toggleLibrary, updateSongInLibrary, library, setCurrentTrack, currentTrack, settings }) => {
  const [toastItems, setToastItems] = useState([]);
  const [isAutomatedVaultAddRunning, setIsAutomatedVaultAddRunning] = useState(false);
  const [automatedTranslationRequest, setAutomatedTranslationRequest] = useState(null);
  const automatedAddRunningRef = useRef(false);
  const automatedRequestIdRef = useRef(0);
  const lyricsCheckTimerRef = useRef(null);
  const toastSequenceRef = useRef(0);
  const toastDismissTimersRef = useRef(new Map());
  const latestToastIdRef = useRef(null);
  const loadingToastIdRef = useRef(null);
  const unsyncedWarningTrackIdRef = useRef(null);
  const dismissToast = useCallback(id => {
    const timer = toastDismissTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastDismissTimersRef.current.delete(id);
    }
    if (latestToastIdRef.current === id) latestToastIdRef.current = null;
    if (loadingToastIdRef.current === id) loadingToastIdRef.current = null;
    setToastItems(items => items.filter(item => item.id !== id));
  }, []);
  const exitToast = useCallback(id => {
    if (latestToastIdRef.current === id) latestToastIdRef.current = null;
    if (loadingToastIdRef.current === id) loadingToastIdRef.current = null;
    setToastItems(items => items.map(item => (
      item.id === id
        ? { ...item, notification: { ...item.notification, show: false } }
        : item
    )));
    const previousTimer = toastDismissTimersRef.current.get(id);
    if (previousTimer) clearTimeout(previousTimer);
    const fallbackTimer = setTimeout(() => dismissToast(id), 500);
    toastDismissTimersRef.current.set(id, fallbackTimer);
  }, [dismissToast]);
  const setNotification = useCallback(nextNotification => {
    if (nextNotification.show) {
      const tone = getNotificationTone(nextNotification);
      const activeLoadingId = loadingToastIdRef.current;
      const isLoadingUpdate = tone === 'loading' && activeLoadingId !== null;
      const isLoadingCompletion = ['success', 'warning', 'error'].includes(tone) &&
        activeLoadingId !== null;
      const updateId = isLoadingUpdate || isLoadingCompletion ? activeLoadingId : null;
      const toast = {
        id: updateId ?? ++toastSequenceRef.current,
        notification: nextNotification
      };
      const previousTimer = updateId === null ? null : toastDismissTimersRef.current.get(updateId);
      if (previousTimer) {
        clearTimeout(previousTimer);
        toastDismissTimersRef.current.delete(updateId);
      }
      latestToastIdRef.current = toast.id;
      loadingToastIdRef.current = tone === 'loading'
        ? toast.id
        : isLoadingCompletion
          ? null
          : loadingToastIdRef.current;
      setToastItems(items => {
        const replaceIndex = items.findIndex(item => item.id === updateId && item.notification.show);
        if (replaceIndex !== -1) {
          return items.map((item, index) => index === replaceIndex ? toast : item);
        }
        return [...items, toast];
      });
      if (tone !== 'loading') {
        const delay = tone === 'warning' || tone === 'error' ? 8000 : 4500;
        const timer = setTimeout(() => exitToast(toast.id), delay);
        toastDismissTimersRef.current.set(toast.id, timer);
      }
      return;
    }

    const toastId = latestToastIdRef.current;
    if (toastId !== null) exitToast(toastId);
  }, [exitToast]);
  const selectedTrackId = selectedSong?.trackId;
  const previousTrackIdRef = useRef(selectedTrackId);
  const markModalReady = useCallback(trackId => {
    onModalReady?.(trackId);
  }, [onModalReady]);
  useEffect(() => {
    const previousTrackId = previousTrackIdRef.current;
    previousTrackIdRef.current = selectedTrackId;
    if (
      selectedTrackId == null ||
      previousTrackId == null ||
      String(previousTrackId) === String(selectedTrackId)
    ) return undefined;

    const frame = window.requestAnimationFrame(() => markModalReady(selectedTrackId));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedTrackId, markModalReady]);
  useEffect(() => {
    if (selectedTrackId == null || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const frame = window.requestAnimationFrame(() => markModalReady(selectedTrackId));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedTrackId, markModalReady]);
  const previousTrackIdForNotificationRef = useRef(selectedSong?.trackId);
  const translationCancelHandlerRef = useRef(null);
  const registerTranslationCancelHandler = useCallback(handler => {
    translationCancelHandlerRef.current = handler;
  }, []);
  const closeTranslationWorkspace = useCallback(onClosed => {
    translationCancelHandlerRef.current?.(onClosed);
  }, []);
  useEffect(() => {
    if (previousTrackIdForNotificationRef.current === selectedSong?.trackId) return;
    previousTrackIdForNotificationRef.current = selectedSong?.trackId;
    if (lyricsCheckTimerRef.current) clearTimeout(lyricsCheckTimerRef.current);
    toastDismissTimersRef.current.forEach(timer => clearTimeout(timer));
    toastDismissTimersRef.current.clear();
    latestToastIdRef.current = null;
    loadingToastIdRef.current = null;
    setToastItems([]);
  }, [selectedSong?.trackId, setNotification]);
  useEffect(() => () => {
    if (lyricsCheckTimerRef.current) clearTimeout(lyricsCheckTimerRef.current);
    toastDismissTimersRef.current.forEach(timer => clearTimeout(timer));
    toastDismissTimersRef.current.clear();
  }, []);

  const dismissAutomatedNotificationAfter = useCallback(delay => {
    const toastId = latestToastIdRef.current;
    if (toastId === null) return;
    const previousTimer = toastDismissTimersRef.current.get(toastId);
    if (previousTimer) clearTimeout(previousTimer);
    const timer = setTimeout(() => exitToast(toastId), delay);
    toastDismissTimersRef.current.set(toastId, timer);
  }, [exitToast]);
  const showSaveNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, progress: type === 'success' ? 100 : null, type });
    dismissAutomatedNotificationAfter(4500);
  }, [dismissAutomatedNotificationAfter, setNotification]);
  const showUntimedLyricsWarning = useCallback(() => {
    setNotification({
      show: true,
      message: 'Some lyrics do not have timestamps. Click Edit Sync Timing to open the Sync Workspace.',
      progress: null,
      type: 'warning'
    });
    dismissAutomatedNotificationAfter(8000);
  }, [dismissAutomatedNotificationAfter, setNotification]);
  const songDataProps = useSongData(selectedSong, isSaved, updateSongInLibrary, library);
  const syncProps = useSyncWorkspace(
    selectedSong, isSaved, songDataProps.customData, songDataProps.setCustomData,
    songDataProps.masterPalette, updateSongInLibrary, setNotification, settings
  );
  const handleAutoSyncDatabases = syncProps.handleAutoSyncDatabases;
  const handleAutomatedAddToVault = useCallback(async (event, song) => {
    event?.stopPropagation();
    if (automatedAddRunningRef.current) return;
    automatedAddRunningRef.current = true;
    setIsAutomatedVaultAddRunning(true);
    toggleLibrary(event, song);
    setNotification({
      show: true,
      message: 'Digging through the black hole for lyrics and sync data...',
      progress: 5
    });

    try {
      const hasTimedManualData = Array.isArray(song.syncData) &&
        song.syncData.some(line => line?.start !== null && line?.start !== undefined);
      const hasTimedAutoData = Array.isArray(song.autoSyncData) &&
        song.autoSyncData.some(line => line?.start !== null && line?.start !== undefined);
      const hasTimedSyncData = hasTimedManualData || hasTimedAutoData;
      const fetchedSong = hasTimedSyncData
        ? song
        : await handleAutoSyncDatabases(true, { silent: true });
      if (!fetchedSong) {
        throw new Error('No lyrics or synchronized lines were found in available sources.');
      }

      const preparedSong = {
        ...fetchedSong,
        syncData: hasTimedManualData
          ? fetchedSong.syncData
          : hasTimedAutoData
            ? fetchedSong.autoSyncData
            : fetchedSong.syncData?.length
              ? fetchedSong.syncData
              : fetchedSong.autoSyncData || []
      };

      const fetchedLyrics = preparedSong.lyrics || song.lyrics || '';
      const requestSong = { ...preparedSong, lyrics: fetchedLyrics };
      const detectedData = buildTranslationWorkspaceData(
        requestSong,
        { ...songDataProps.customData, lyrics: fetchedLyrics },
        songDataProps.masterPalette,
        []
      );

      if (!detectedData.length) {
        setNotification({
          show: true,
          message: 'Lyrics and sync data loaded, but no translatable lyric lines were found.',
          progress: 100
        });
        dismissAutomatedNotificationAfter(6000);
        return;
      }

      setNotification({
        show: true,
        message: 'Lyrics and sync data loaded.',
        progress: 100
      });
      setTimeout(() => {
        setAutomatedTranslationRequest({
          id: ++automatedRequestIdRef.current,
          song: requestSong,
          customData: { ...songDataProps.customData, lyrics: fetchedLyrics }
        });
      }, 700);
    } catch (error) {
      console.error('Could not prepare the song after adding it to the Vault.', error);
      setNotification({
        show: true,
        message: `Song added to your Vault, but lyric loading failed: ${error.message}`,
        progress: 100
      });
      dismissAutomatedNotificationAfter(6000);
    } finally {
      automatedAddRunningRef.current = false;
      setIsAutomatedVaultAddRunning(false);
    }
  }, [
    songDataProps.customData,
    songDataProps.masterPalette,
    dismissAutomatedNotificationAfter,
    handleAutoSyncDatabases,
    setNotification,
    toggleLibrary
  ]);
  const handleAutomatedTranslationComplete = useCallback(() => {
    setAutomatedTranslationRequest(null);
    dismissAutomatedNotificationAfter(6000);
  }, [dismissAutomatedNotificationAfter]);

  const location = useLocation();
  const navigate = useNavigate();
  const openAudioDelaySettings = () => navigate('/settings', {
    state: { returnPath: `${location.pathname}${location.search}` }
  });

  const effectiveSong = useMemo(() => {
    if (!selectedSong) return null;
    
    const hasManual = selectedSong.syncData && selectedSong.syncData.some(l => l.start !== null);
    const hasAuto = selectedSong.autoSyncData && selectedSong.autoSyncData.some(l => l.start !== null);
    const activeData = syncProps.isSyncMode
      ? syncProps.isShowingAutoSync && hasAuto ? selectedSong.autoSyncData : selectedSong.syncData
      : hasManual ? selectedSong.syncData : hasAuto ? selectedSong.autoSyncData : selectedSong.syncData;
    
    return {
      ...selectedSong,
      syncData: activeData
    };
  }, [selectedSong, syncProps.isShowingAutoSync, syncProps.isSyncMode]);

  const displayProps = useLyricsDisplay(
    effectiveSong, songDataProps.customData, songDataProps.masterPalette, 
    syncProps.isSyncMode, songDataProps.isEditing, songDataProps.isImageManagerOpen, currentTrack, settings
  );

  useEffect(() => {
    if (selectedTrackId == null) {
      unsyncedWarningTrackIdRef.current = null;
      return;
    }
    if (!isSongModalReady || !songDataProps.customData.lyrics?.trim()) return;

    if (!hasUntimedLyrics(
      effectiveSong?.syncData,
      songDataProps.customData.lyrics,
      selectedSong?.artistName,
      songDataProps.masterPalette
    ) || String(unsyncedWarningTrackIdRef.current) === String(selectedTrackId)) return;

    unsyncedWarningTrackIdRef.current = selectedTrackId;
    showUntimedLyricsWarning();
  }, [
    selectedTrackId,
    isSongModalReady,
    songDataProps.customData.lyrics,
    songDataProps.masterPalette,
    selectedSong?.artistName,
    effectiveSong?.syncData,
    showUntimedLyricsWarning
  ]);

  // ------------------------------------------------------------------
  // 1. URL -> STATE: The URL is the absolute single source of truth
  // ------------------------------------------------------------------
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlViewMode = ['live', 'focused', 'group-chat', 'plain'].includes(pathParts[2]) ? pathParts[2] : 'live';
  const urlDebug = pathParts.includes('debug');

  const validWorkspaces = ['edit', 'translate', 'sync-workspace', 'manage-artists'];
  const urlWorkspace = pathParts.find(part => validWorkspaces.includes(part)) || null;

  const isSync = urlWorkspace === 'sync-workspace';
  const isTranslate = urlWorkspace === 'translate';
  const isEdit = urlWorkspace === 'edit';
  const isManage = urlWorkspace === 'manage-artists';

  useEffect(() => {
    if (!selectedSong) return;
    if (pathParts[0] === 'song' && String(selectedSong.trackId) !== String(pathParts[1])) return;
    
    // Handle deep-linking explicitly into Sync Workspace
    if (isSync && !syncProps.isSyncMode) {
        syncProps.startSyncMode(); 
    } else if (!isSync && syncProps.isSyncMode) {
        syncProps.setIsSyncMode(false);
    }
    
    if (songDataProps.isTranslationManagerOpen !== isTranslate) songDataProps.setIsTranslationManagerOpen(isTranslate);
    if (songDataProps.isEditing !== isEdit) songDataProps.setIsEditing(isEdit);
    if (songDataProps.isImageManagerOpen !== isManage) songDataProps.setIsImageManagerOpen(isManage);
    
    if (displayProps.lyricsViewMode !== urlViewMode) displayProps.setLyricsViewMode(urlViewMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlWorkspace, urlViewMode, urlDebug, selectedSong]); 

  // ------------------------------------------------------------------
  // 2. STATE -> URL: Intercept actions to drive the URL instead of state
  // ------------------------------------------------------------------
  const buildUrl = (updates = {}) => {
    const trackId = selectedSong.trackId;
    const vMode = updates.viewMode !== undefined ? updates.viewMode : urlViewMode;
    const dbg = updates.debug !== undefined ? updates.debug : urlDebug;
    const ws = updates.workspace !== undefined ? updates.workspace : urlWorkspace;

    let parts = [`/song/${trackId}`];
    if (vMode) parts.push(vMode);
    if (dbg && ['focused', 'live', 'group-chat'].includes(vMode)) parts.push('debug');
    if (ws) parts.push(ws);

    return parts.join('/');
  };

  const handleWorkspaceToggle = (wsName, isOpen) => {
    navigate(buildUrl({ workspace: isOpen ? wsName : null }));
  };

  const sharedProps = {
    selectedSong: effectiveSong,
    isSongModalReady,
    realSelectedSong: selectedSong,
    isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings,
    setNotification,
    
    ...songDataProps, 
    ...displayProps, 
    ...syncProps,
    onAutomatedAddToVault: handleAutomatedAddToVault,
    isAutomatedVaultAddRunning,
    openAudioDelaySettings,
    registerTranslationCancelHandler,
    closeTranslationWorkspace,

    // EXPLICIT OVERRIDES: Bypass internal hooks to force the UI to render what the URL dictates
    isEditing: isEdit,
    isTranslationManagerOpen: isTranslate,
    isImageManagerOpen: isManage,
    isSyncMode: isSync,

    // INTERCEPT SETTERS: Divert internal clicks to push to URL history stack instead
    onReturnToVault: () => {
        setSelectedSong(null);
        navigate('/vault');
    },
    setIsEditing: (val) => {
        songDataProps.setIsEditing(val);
        handleWorkspaceToggle('edit', val);
    },
    setIsTranslationManagerOpen: (val) => {
        songDataProps.setIsTranslationManagerOpen(val);
        handleWorkspaceToggle('translate', val);
    },
    setIsImageManagerOpen: (val) => {
        songDataProps.setIsImageManagerOpen(val);
        handleWorkspaceToggle('manage-artists', val);
    },
    setIsSyncMode: (val) => {
        syncProps.setIsSyncMode(val);
        handleWorkspaceToggle('sync-workspace', val);
    },
    startSyncMode: async () => {
        await syncProps.startSyncMode(); // Allow hook to parse lyrics internally
        handleWorkspaceToggle('sync-workspace', true); // But let the URL dictate the visible render
    },
    setLyricsViewMode: (val) => {
        displayProps.setLyricsViewMode(val);
        navigate(buildUrl({ viewMode: val, debug: false }), {
          state: location.state
        });
    },
    
    // Debug toggles
    showAdlibDebug: urlDebug,
    setShowAdlibDebug: (val) => navigate(buildUrl({ viewMode: 'focused', debug: val })),
    showLiveDebug: urlDebug,
    setShowLiveDebug: (val) => navigate(buildUrl({ viewMode: 'live', debug: val })),
    showGroupChatDebug: urlDebug,
    setShowGroupChatDebug: (val) => navigate(buildUrl({ viewMode: 'group-chat', debug: val })),
    
    // Hijack Save functions so the URL closes cleanly after saving
    saveData: () => {
        const originalLyrics = selectedSong.lyrics ||
            (selectedSong.syncData ? selectedSong.syncData.map(line => line.text).join('\n') : '');
        const lyricsChanged = songDataProps.customData.lyrics !== originalLyrics;
        const linksChanged = ['spotify', 'yt', 'deezer', 'hasLocal', 'localName'].some(key => (
            songDataProps.customData[key] !== (selectedSong.customLinks?.[key] ?? (key === 'hasLocal' ? false : ''))
        ));
        const savedSong = songDataProps.saveData();
        if (savedSong === false) return;
        if (!lyricsChanged && !linksChanged) {
            showSaveNotification('No changes were made to song info or lyrics.', 'info');
        } else if (lyricsChanged && songDataProps.customData.lyrics?.trim()) {
            if (lyricsCheckTimerRef.current) clearTimeout(lyricsCheckTimerRef.current);
            setNotification({
                show: true,
                message: 'Song info and lyrics saved. Checking the supernova for untimed lines...',
                progress: null,
                type: 'loading'
            });
            lyricsCheckTimerRef.current = setTimeout(() => {
                lyricsCheckTimerRef.current = null;
                const hasTimedManualData = savedSong.syncData?.some(line => (
                    line?.start !== null && line?.start !== undefined && line?.start !== '' && Number.isFinite(Number(line.start))
                ));
                const hasTimedAutoData = savedSong.autoSyncData?.some(line => (
                    line?.start !== null && line?.start !== undefined && line?.start !== '' && Number.isFinite(Number(line.start))
                ));
                const syncLines = hasTimedManualData
                    ? savedSong.syncData
                    : hasTimedAutoData
                      ? savedSong.autoSyncData
                      : savedSong.syncData;
                if (hasUntimedLyrics(
                    syncLines,
                    savedSong.lyrics,
                    savedSong.artistName,
                    songDataProps.masterPalette
                )) {
                    setNotification({
                        show: true,
                        message: 'Song info and lyrics saved, but some lyrics do not have timestamps. Click Edit Sync Timing to fix them.',
                        progress: null,
                        type: 'warning'
                    });
                    dismissAutomatedNotificationAfter(8000);
                    return;
                }
                setNotification({
                    show: true,
                    message: 'Song info and lyrics saved. All lyric lines have timestamps.',
                    progress: 100,
                    type: 'success'
                });
                dismissAutomatedNotificationAfter(5000);
            }, 650);
        } else {
            showSaveNotification('Song info saved.');
        }
        navigate(buildUrl({ workspace: null }));
    },
    saveImageManager: () => {
        const hasChanges =
            JSON.stringify(songDataProps.customData.artistImages || {}) !== JSON.stringify(selectedSong.artistImages || {}) ||
            JSON.stringify(songDataProps.customData.artistColors || {}) !== JSON.stringify(selectedSong.artistColors || {});
        songDataProps.saveImageManager();
        showSaveNotification(
            hasChanges ? 'Artist images and colors saved.' : 'No artist data changes were made.',
            hasChanges ? 'success' : 'info'
        );
        navigate(buildUrl({ workspace: null }));
    },
    saveSyncData: () => {
        const hasChanges =
            JSON.stringify(syncProps.syncData) !== JSON.stringify(selectedSong.syncData || []) ||
            songDataProps.customData.lyrics !== (selectedSong.lyrics || '');
        syncProps.saveSyncData();
        showSaveNotification(
            hasChanges ? 'Sync timings saved.' : 'No sync timing changes were made.',
            hasChanges ? 'success' : 'info'
        );
        navigate(buildUrl({ workspace: null }));
    }
  };

  if (!selectedSong) return null;

  return (
    <div className="modal-backdrop" onClick={() => setSelectedSong(null)}>
      <div
        className="modal-window glass-panel"
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.animationName === 'modalWindowEnter'
          ) {
            markModalReady(selectedSong.trackId);
          }
        }}
      >
        <img
          key={songDataProps.highResArt || selectedSong.trackId}
          src={songDataProps.highResArt || undefined}
          alt=""
          className="modal-dynamic-bg"
          aria-hidden="true"
          onLoad={(event) => event.currentTarget.classList.add('is-ready')}
          onError={(event) => event.currentTarget.classList.add('is-ready')}
        />
        
        <div className="modal-content-wrapper">
          <button className="close-btn glass-button" onClick={() => setSelectedSong(null)}></button>
          
          <div className="modal-two-column-layout">
            <ModalLeft {...sharedProps} />
            <div id="song-modal-player-slot" className="song-modal-player-slot" />
            <ModalRight 
              {...sharedProps} 
              activeLineRef={syncProps.activeLineRef}
              activePreviewRef={displayProps.activePreviewRef}
              automatedTranslationRequest={automatedTranslationRequest}
              onAutomatedTranslationComplete={handleAutomatedTranslationComplete}
            />
          </div>

          <ConfirmModal
            isOpen={syncProps.showBluetoothSyncPrompt && isSync}
            title="Bluetooth Audio Timing"
            message={`Are you using Bluetooth headphones? Bluetooth can add playback delay. Choose Yes to apply ${Number.isFinite(settings?.audioDelayCompensationMs) ? `${Math.round(settings.audioDelayCompensationMs)} ms` : '200 ms'} to newly manual-synced lines. Other source timings are unchanged.`}
            confirmText="Yes, compensate"
            cancelText="No, use normal timing"
            onConfirm={() => syncProps.handleBluetoothSyncChoice(true)}
            onCancel={() => syncProps.handleBluetoothSyncChoice(false)}
            extraAction={<button type="button" onClick={openAudioDelaySettings}>Test audio delay in Settings</button>}
          />

          <div className="notification-toast-stack">
            {toastItems.map(item => (
              <NotificationToast
                key={item.id}
                notification={item.notification}
                onDismiss={() => dismissToast(item.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {syncProps.showRefreshPrompt && (
        <div className="confirm-overlay" onClick={syncProps.cancelRefreshLyrics}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Clear All Timings?</h3>
            <p>Are you sure you want to clear all timings, translations, and ad-lib splits from the workspace? You will need to click <strong>Save Timings</strong> to finalize this action.</p>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={syncProps.cancelRefreshLyrics}>Cancel</button>
              <button className="confirm-btn delete" onClick={syncProps.confirmRefreshLyrics}>Clear Timings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongModal;