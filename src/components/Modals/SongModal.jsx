/* --- src/components/SongModal.jsx --- */
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModalLeft from './ModalLeft';
import ModalRight from './ModalRight';
import { useSongData } from '../../hooks/data/useSongData';
import { useLyricsDisplay } from '../../hooks/sync/useLyricsDisplay';
import { useSyncWorkspace } from '../../hooks/sync/useSyncWorkspace';
import './SongModal.css';

const SongModal = ({ selectedSong, setSelectedSong, isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings }) => {
  const [notification, setNotification] = useState({ show: false, message: '', progress: null });
  
  const songDataProps = useSongData(selectedSong, isSaved, updateSongInLibrary);
  const syncProps = useSyncWorkspace(
    selectedSong, isSaved, songDataProps.customData, songDataProps.setCustomData,
    songDataProps.masterPalette, updateSongInLibrary, setCurrentTrack, setNotification, settings
  );

  const location = useLocation();
  const navigate = useNavigate();

  const effectiveSong = useMemo(() => {
    if (!selectedSong) return null;
    
    let activeData = selectedSong.syncData;
    const hasManual = selectedSong.syncData && selectedSong.syncData.some(l => l.start !== null);
    const hasAuto = selectedSong.autoSyncData && selectedSong.autoSyncData.some(l => l.start !== null);
    
    if (syncProps.isSyncMode) {
      activeData = syncProps.isShowingAutoSync && hasAuto ? selectedSong.autoSyncData : selectedSong.syncData;
    } else {
      activeData = hasManual ? selectedSong.syncData : (hasAuto ? selectedSong.autoSyncData : selectedSong.syncData);
    }
    
    return {
      ...selectedSong,
      syncData: activeData
    };
  }, [selectedSong, syncProps.isShowingAutoSync, syncProps.isSyncMode]);

  const displayProps = useLyricsDisplay(
    effectiveSong, songDataProps.customData, songDataProps.masterPalette, 
    syncProps.isSyncMode, songDataProps.isEditing, songDataProps.isImageManagerOpen, currentTrack, settings
  );
  displayProps.isSyncMode = syncProps.isSyncMode;


  // ------------------------------------------------------------------
  // 1. URL -> STATE: The URL is the absolute single source of truth
  // ------------------------------------------------------------------
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlViewMode = ['live', 'focused', 'plain'].includes(pathParts[2]) ? pathParts[2] : 'live';
  const urlDebug = pathParts.includes('debug');
  
  const validWorkspaces = ['edit', 'translate', 'sync-workspace', 'manage-artists'];
  const urlWorkspace = pathParts.find(part => validWorkspaces.includes(part)) || null;

  const isSync = urlWorkspace === 'sync-workspace';
  const isTranslate = urlWorkspace === 'translate';
  const isEdit = urlWorkspace === 'edit';
  const isManage = urlWorkspace === 'manage-artists';

  useEffect(() => {
    if (!selectedSong) return;

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
    if (dbg && vMode === 'focused') parts.push('debug');
    if (ws) parts.push(ws);

    return parts.join('/');
  };

  const handleWorkspaceToggle = (wsName, isOpen) => {
    navigate(buildUrl({ workspace: isOpen ? wsName : null }));
  };

  const sharedProps = {
    selectedSong: effectiveSong,
    realSelectedSong: selectedSong,
    isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings,
    setNotification,
    
    ...songDataProps, 
    ...displayProps, 
    ...syncProps,

    // EXPLICIT OVERRIDES: Bypass internal hooks to force the UI to render what the URL dictates
    isEditing: isEdit,
    isTranslationManagerOpen: isTranslate,
    isImageManagerOpen: isManage,
    isSyncMode: isSync,

    // INTERCEPT SETTERS: Divert internal clicks to push to URL history stack instead
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
        navigate(buildUrl({ viewMode: val }));
    },
    
    // Debug toggle
    showAdlibDebug: urlDebug,
    setShowAdlibDebug: (val) => navigate(buildUrl({ debug: val })),
    
    // Hijack Save functions so the URL closes cleanly after saving
    saveData: () => {
        songDataProps.saveData();
        navigate(buildUrl({ workspace: null }));
    },
    saveImageManager: () => {
        songDataProps.saveImageManager();
        navigate(buildUrl({ workspace: null }));
    },
    saveSyncData: () => {
        syncProps.saveSyncData();
        navigate(buildUrl({ workspace: null }));
    }
  };

  if (!selectedSong) return null;

  return (
    <div className="modal-backdrop" onClick={() => setSelectedSong(null)}>
      <div className="modal-window glass-panel" onClick={(e) => e.stopPropagation()}>
        <img src={songDataProps.highResArt || undefined} alt="" className="modal-dynamic-bg" aria-hidden="true" />
        
        <div className="modal-content-wrapper">
          <button className="close-btn glass-button" onClick={() => setSelectedSong(null)}></button>
          
          <div className="modal-two-column-layout">
            <ModalLeft {...sharedProps} />
            <ModalRight 
              {...sharedProps}
              syncAudioRef={syncProps.syncAudioRef}
              activeLineRef={syncProps.activeLineRef}
              activePreviewRef={displayProps.activePreviewRef}
            />
          </div>

          {notification.show && (
            <div className="notification-popup">
              <div className="notification-content">
                <span className="loading-spinner"></span>
                <p>{notification.message}</p>
              </div>
              {notification.progress !== null && (
                <div className="notification-progress-bar">
                  <div className="notification-progress-fill" style={{ width: `${notification.progress}%` }}></div>
                </div>
              )}
            </div>
          )}
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