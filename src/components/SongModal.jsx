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
  const songDataProps = useSongData(selectedSong, isSaved, updateSongInLibrary);
  const syncProps = useSyncWorkspace(
    selectedSong, isSaved, songDataProps.customData, songDataProps.setCustomData,
    songDataProps.masterPalette, updateSongInLibrary, setCurrentTrack, setNotification
  );

  // CRITICAL FIX: Ensure effectiveSong retains all translation fields across sync modes
  const effectiveSong = useMemo(() => {
    if (!selectedSong) return null;
    const activeData = syncProps.isShowingAutoSync && selectedSong.autoSyncData ? selectedSong.autoSyncData : selectedSong.syncData;
    return {
        ...selectedSong,
        syncData: activeData
    };
  }, [selectedSong, syncProps.isShowingAutoSync]);

  const displayProps = useLyricsDisplay(
    effectiveSong, songDataProps.customData, songDataProps.masterPalette, 
    syncProps.isSyncMode, songDataProps.isEditing, songDataProps.isImageManagerOpen, currentTrack, settings
  );
  displayProps.isSyncMode = syncProps.isSyncMode;

  const sharedProps = {
    selectedSong: effectiveSong,
    realSelectedSong: selectedSong,
    isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings,
    setNotification,
    ...songDataProps, ...displayProps, ...syncProps
  };

  if (!selectedSong) return null;

  return (
    <div className="modal-backdrop" onClick={() => setSelectedSong(null)}>
      <div className="modal-window glass-panel" onClick={(e) => e.stopPropagation()}>
        <img src={songDataProps.highResArt || undefined} alt="" className="modal-dynamic-bg" aria-hidden="true" />
        
        <div className="modal-content-wrapper">
          <button className="close-btn glass-button" onClick={() => setSelectedSong(null)}> </button>
          
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
    </div>
  );
};

export default SongModal;