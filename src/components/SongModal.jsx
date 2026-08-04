/* --- src/components/SongModal.jsx --- */
import React, { useState, useMemo } from 'react';
import ModalLeft from './ModalLeft';
import ModalRight from './ModalRight';
import { useSongData } from '../hooks/useSongData';
import { useLyricsDisplay } from '../hooks/useLyricsDisplay';
import { useSyncWorkspace } from '../hooks/useSyncWorkspace';
import './SongModal.css';

const SongModal = ({ selectedSong, setSelectedSong, isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings }) => {
  const [notification, setNotification] = useState({ show: false, message: '', progress: null });
  const [showAdlibDebug, setShowAdlibDebug] = useState(false);

  const songDataProps = useSongData(selectedSong, isSaved, updateSongInLibrary);
  
  const syncProps = useSyncWorkspace(
    selectedSong, isSaved, songDataProps.customData, songDataProps.setCustomData,
    songDataProps.masterPalette, updateSongInLibrary, setCurrentTrack, setNotification
  );

  // Hierarchy: Explicit Workspace Mode -> Manual Sync -> Auto Sync -> Empty Array
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

  const sharedProps = {
    selectedSong: effectiveSong,
    realSelectedSong: selectedSong,
    isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings,
    setNotification, showAdlibDebug, setShowAdlibDebug,
    ...songDataProps, ...displayProps, ...syncProps
  };

  if (!selectedSong) return null;

  return (
    <div className="modal-backdrop" onClick={() => setSelectedSong(null)}>
      <div className="modal-window glass-panel" onClick={(e) => e.stopPropagation()}>
        <img src={songDataProps.highResArt || undefined} alt="" className="modal-dynamic-bg" aria-hidden="true" />
        
        <div className="modal-content-wrapper">
          <button className="close-btn glass-button" onClick={() => setSelectedSong(null)}>✕</button>
          
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

      {/* Sync Workspace 'Clear Timings' Red Danger Modal Overlay */}
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