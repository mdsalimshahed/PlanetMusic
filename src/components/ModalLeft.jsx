/* --- src/components/ModalLeft.jsx --- */
import React from 'react';
import { formatDate, parseTrackName } from '../utils/songHelpers';
import './ModalLeft.css';

const ModalLeft = ({ 
  selectedSong, realSelectedSong, setSelectedSong, highResArt, releaseType, isSaved, toggleLibrary, customData, 
  handleDataChange, handleLocalFileChange, handleClearLocal, isEditing, setIsEditing, 
  saveData, finalLinks, setCurrentTrack, isSyncMode, setIsSyncMode, isSyncLoading, 
  startSyncMode, saveSyncData, isImageManagerOpen, setIsImageManagerOpen, 
  saveImageManager, lyricsViewMode, cycleViewMode, hasValidSyncData, allPotentialSingers, 
  handleAutoSyncDatabases, isLrcFetching, isShowingAutoSync, isTranslationManagerOpen, setIsTranslationManagerOpen, 
  handleMapAutoSync, showAdlibDebug, setShowAdlibDebug
}) => {
  const { mainTitle, extras, featuredArtists } = parseTrackName(selectedSong.trackName);

  const handleProtectedAction = (actionCallback) => {
    if (isTranslationManagerOpen) {
      const workspaceElement = document.querySelector('.tw-container');
      if (workspaceElement) {
        const cancelBtn = workspaceElement.querySelector('.tw-btn-cancel');
        if (cancelBtn) {
          cancelBtn.click();
          const isStillActive = document.querySelector('.tw-container');
          if (isStillActive) return;
        }
      }
    }
    if (actionCallback) actionCallback();
  };

  const handleCloseModal = () => {
    handleProtectedAction(() => {
      if (setSelectedSong) {
        setSelectedSong(null);
      } else {
        const hiddenCloseBtn = document.querySelector('.close-btn');
        if (hiddenCloseBtn) hiddenCloseBtn.click();
      }
    });
  };

  const hasAutoSyncAvailable = Boolean(selectedSong?.autoSyncData && selectedSong.autoSyncData.length > 0);

  return (
    <div className="modal-left-col">
      <div className="modal-left-static">
        <div className="modal-top">
          <img src={highResArt} alt="Artwork" className="modal-cover" />
          <div className="modal-header-info">
            <h2>
              {mainTitle}
              {selectedSong.trackExplicitness === 'explicit' && <span className="explicit-tag">E</span>}
              {extras.map((extra, idx) => (
                <span key={idx} className="title-extra"> ({extra})</span>
              ))}
            </h2>
            <div className="modal-artist-row">
              <strong>{selectedSong.artistName}</strong>
              {selectedSong.releaseDate && (
                <span className="release-date">{formatDate(selectedSong.releaseDate)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-details glass-panel-light">
          {featuredArtists.length > 0 && (
            <div className="detail-item">
              <label>Featured Artists</label>
              <p>{featuredArtists.join(', ')}</p>
            </div>
          )}
          <div className="detail-item">
            <label>Album / Release</label>
            <p>{selectedSong.trackNumber && releaseType !== 'Single' ? `#${selectedSong.trackNumber} on ${releaseType}` : releaseType}</p>
          </div>
          {selectedSong.primaryGenreName && (
            <div className="detail-item">
              <label>Genre</label>
              <p>{selectedSong.primaryGenreName}</p>
            </div>
          )}
        </div>
      </div>

      <div className="modal-left-scrollable">
        <div className="modal-links glass-panel-light">
          <div className="links-header"><label>Listen on Platforms</label></div>
          {isEditing ? (
            <div className="platform-inputs-grid">
              <div className="platform-input-row"><span className="platform-label spotify-color">Spotify</span><input type="text" name="spotify" value={customData.spotify} onChange={handleDataChange} /></div>
              <div className="platform-input-row"><span className="platform-label yt-color">YT Music</span><input type="text" name="yt" value={customData.yt} onChange={handleDataChange} /></div>
              <div className="platform-input-row">
                <span className="platform-label local-color">Local MP3</span>
                <input type="file" accept="audio/*" id="localFileInput" style={{ display: 'none' }} onChange={handleLocalFileChange} />
                <label htmlFor="localFileInput" className={`local-file-btn ${customData.hasLocal ? 'has-file' : ''}`}>
                  {customData.hasLocal ? customData.localName : "Browse Local Files..."}
                </label>
                {customData.hasLocal && (<button className="clear-local-btn" onClick={handleClearLocal}>✖</button>)}
              </div>
            </div>
          ) : (
            <div className="platform-links">
              <a href={finalLinks.spotify} target="_blank" rel="noreferrer" className="platform-btn spotify">Spotify</a>
              <a href={finalLinks.yt} target="_blank" rel="noreferrer" className="platform-btn yt">YT Music</a>
              {customData.hasLocal && (<button className="platform-btn local" onClick={() => setCurrentTrack({ ...selectedSong, customLinks: customData })}>Play Local Audio</button>)}
            </div>
          )}
        </div>

        <div className="workspace-controls glass-panel-light">
          <div className="links-header"><label>Workspace Controls</label></div>
          
          {isSyncMode && !isTranslationManagerOpen && (
            <div className="sync-instructions-left">
              <div className="instruction-row"><span><strong>1.</strong> Press <strong>↓</strong> to set Start Time</span></div>
              <div className="instruction-row"><span><strong>2.</strong> Press <strong>↓</strong> to set End Time <em>(Auto advances)</em></span></div>
              <div className="instruction-row subtle"><span><em>(Press <strong>↑</strong> anytime to rewind)</em></span></div>
            </div>
          )}

          <div className="action-buttons-grid">
            {isTranslationManagerOpen ? (
                <button className="edit-links-btn save-mode" onClick={() => handleProtectedAction(() => setIsTranslationManagerOpen(false))}>Close Editor</button>
            ) : isSyncMode ? (
              <>
                <button className="edit-links-btn" onClick={() => setIsSyncMode(false)}>✖ Cancel Sync</button>
                {hasAutoSyncAvailable && (
                  <button 
                    className="edit-links-btn" 
                    onClick={handleMapAutoSync}
                    style={{ background: 'rgba(251, 191, 36, 0.2)', borderColor: '#fbbf24', color: '#fbbf24' }}
                    title="Sequentially split and map Auto-Sync timings onto Manual Lyrics based on line length"
                  >
                    ✦ Map Sync Data from Auto
                  </button>
                )}
                <button className="edit-links-btn save-mode" onClick={saveSyncData}>✔ Save Timings</button>
              </>
            ) : isEditing ? (
              <>
                <button className="edit-links-btn save-mode" onClick={saveData}>✔ Save Info & Lyrics</button>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} lyrics`)}`} target="_blank" rel="noreferrer" className="edit-links-btn search-google-btn">🔍 Search Google for Lyrics</a>
              </>
            ) : isImageManagerOpen ? (
              <button className="edit-links-btn save-mode" onClick={saveImageManager}>✔ Save Artists Data</button>
            ) : (
              <>
                <button className="edit-links-btn" onClick={() => setIsEditing(true)}>✎ Edit Info</button>
                <button 
                  className="edit-links-btn" 
                  onClick={() => handleAutoSyncDatabases()} 
                  disabled={isLrcFetching || isSyncLoading}
                  style={{ opacity: isLrcFetching ? 0.6 : 1, cursor: isLrcFetching ? 'wait' : 'pointer', background: 'rgba(29, 185, 84, 0.2)', borderColor: '#1DB954' }}
                >
                  {isLrcFetching ? '⚡ Fetching Databases...' : (realSelectedSong?.autoSyncData?.length > 0 ? (isShowingAutoSync ? '⚡ Show Manual Sync' : '⚡ Show Auto-Sync') : '⚡ Auto-Sync Lyrics')}
                </button>
                
                {customData.lyrics ? (
                  <>
                    <button className="edit-links-btn" onClick={startSyncMode} disabled={isSyncLoading || isLrcFetching} style={{ opacity: isSyncLoading ? 0.6 : 1, cursor: isSyncLoading ? 'wait' : 'pointer' }}>
                      {isSyncLoading ? '⏱ Parsing Engine...' : hasValidSyncData ? '⏱ Edit Timings' : '⏱ Manual Sync'}
                    </button>
                    
                    <button 
                      className="edit-links-btn" 
                      onClick={() => setIsTranslationManagerOpen(true)}
                    >
                      文 Edit Translation
                    </button>
                    
                    <button className="edit-links-btn" onClick={() => setIsImageManagerOpen(true)}>👥 Manage Artists</button>
                    
                    {hasValidSyncData && !isSyncLoading && (
                      <>
                        <button className="edit-links-btn toggle-view-btn" onClick={cycleViewMode}>
                          {lyricsViewMode === 'live' ? '⌖ Show Focused Sync' : 
                             lyricsViewMode === 'focused' ? '📄 Show Plain Text' : '▶ Show Live Sync'}
                        </button>
                        
                        {lyricsViewMode === 'focused' && (
                           <button 
                             className="edit-links-btn toggle-view-btn" 
                             onClick={() => setShowAdlibDebug(!showAdlibDebug)}
                             style={{ background: showAdlibDebug ? 'rgba(255, 0, 255, 0.2)' : '', borderColor: showAdlibDebug ? '#ff00ff' : '', color: showAdlibDebug ? '#ff00ff' : '' }}
                           >
                             {showAdlibDebug ? '🛑 Hide Adlib Debug' : '🛠 Show Adlib Debug'}
                           </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button className="edit-links-btn" onClick={() => setIsEditing(true)}>➕ Add Custom Lyrics</button>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} lyrics`)}`} target="_blank" rel="noreferrer" className="edit-links-btn search-google-btn">🔍 Search Google</a>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div id="mobile-player-slot"></div>

        <div className="bottom-actions">
          {isSaved ? (
            <button className="delete-icon-btn" onClick={(e) => toggleLibrary(e, selectedSong)} title="Remove from Vault">
              <span aria-hidden="true">✖</span> Remove from Vault
            </button>
          ) : (
            <button className="edit-links-btn save-mode" onClick={(e) => {
                toggleLibrary(e, selectedSong);
                handleAutoSyncDatabases(true);
                }}>+ Add to Vault</button>
          )}
          <button className="return-dashboard-btn" onClick={handleCloseModal}>
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalLeft;