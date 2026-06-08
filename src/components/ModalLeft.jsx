/* --- src/components/ModalLeft.jsx --- */
import React from 'react';
import { formatTime, formatDate } from '../utils/songHelpers';
import './ModalLeft.css';

const ModalLeft = ({
  selectedSong, highResArt, releaseType, isSaved, toggleLibrary, customData,
  handleDataChange, handleLocalFileChange, handleClearLocal, isEditing, setIsEditing,
  saveData, finalLinks, setCurrentTrack, isSyncMode, setIsSyncMode, isSyncLoading,
  startSyncMode, saveSyncData, isImageManagerOpen, setIsImageManagerOpen,
  saveImageManager, lyricsViewMode, cycleViewMode, hasValidSyncData, allPotentialSingers
}) => {
  return (
    <div className="modal-left-col">
      <div className="modal-left-static">
        <div className="modal-top">
          <img src={highResArt} alt="Artwork" className="modal-cover" />
          <div className="modal-header-info">
            <span className="modal-type">{selectedSong.primaryGenreName}</span>
            <h2 className="text-glow">{selectedSong.trackName}</h2>
            <div className="modal-artist-row">
              <strong>{selectedSong.artistName}</strong>
              <span>•</span><span>{formatDate(selectedSong.releaseDate)}</span>
              <span>•</span><span>{formatTime(selectedSong.trackTimeMillis)}</span>
            </div>
          </div>
        </div>
        <div className="modal-details glass-panel-light">
          <div className="detail-item"><label>Album / Release</label><p>{releaseType}</p></div>
          <div className="detail-item"><label>Track Number</label><p>{selectedSong.trackNumber ? `${selectedSong.trackNumber} of ${selectedSong.trackCount || '?'}` : 'N/A'}</p></div>
          <div className="detail-item"><label>Explicit</label><p>{selectedSong.trackExplicitness === 'explicit' ? 'Yes' : 'No'}</p></div>
        </div>
      </div>

      <div className="modal-left-scrollable">
        <div className="modal-links glass-panel-light">
          <div className="links-header"><label>Listen on Platforms</label></div>
          {isEditing ? (
            <div className="platform-inputs-grid">
              <div className="platform-input-row"><span className="platform-label spotify-color">Spotify</span><input type="text" name="spotify" value={customData.spotify} onChange={handleDataChange} /></div>
              <div className="platform-input-row"><span className="platform-label yt-color">YT Music</span><input type="text" name="yt" value={customData.yt} onChange={handleDataChange} /></div>
              <div className="platform-input-row"><span className="platform-label deezer-color">Deezer</span><input type="text" name="deezer" value={customData.deezer} onChange={handleDataChange} /></div>
              <div className="platform-input-row">
                <span className="platform-label local-color">Local MP3</span>
                <input type="file" accept="audio/*" id="localFileInput" style={{ display: 'none' }} onChange={handleLocalFileChange} />
                <label htmlFor="localFileInput" className={`local-file-btn ${customData.hasLocal ? 'has-file' : ''}`}>
                  {customData.hasLocal ? customData.localName : "Browse Local Files..."}
                </label>
                {customData.hasLocal && (<button className="clear-local-btn" onClick={handleClearLocal}>✕</button>)}
              </div>
            </div>
          ) : (
            <div className="platform-links">
              <a href={finalLinks.spotify} target="_blank" rel="noreferrer" className="platform-btn spotify">Spotify</a>
              <a href={finalLinks.yt} target="_blank" rel="noreferrer" className="platform-btn yt">YT Music</a>
              <a href={finalLinks.deezer} target="_blank" rel="noreferrer" className="platform-btn deezer">Deezer</a>
              {customData.hasLocal && (<button className="platform-btn local" onClick={() => setCurrentTrack({ ...selectedSong, customLinks: customData })}>Play Local Audio</button>)}
            </div>
          )}
        </div>

        <div className="workspace-controls glass-panel-light">
          <div className="links-header"><label>Workspace Controls</label></div>
          
          {/* Relocated Sync Instructions */}
          {isSyncMode && (
            <div className="sync-instructions-left">
              <div className="instruction-row"><span><strong>1.</strong> Press <strong>↓</strong> to set Start Time</span></div>
              <div className="instruction-row"><span><strong>2.</strong> Press <strong>↓</strong> to set End Time <em>(Auto advances)</em></span></div>
              <div className="instruction-row subtle"><span><em>(Press <strong>↑</strong> anytime to rewind)</em></span></div>
            </div>
          )}

          <div className="action-buttons-grid">
            {isSyncMode ? (
              <>
                <button className="edit-links-btn" onClick={() => setIsSyncMode(false)}>✕ Cancel Sync</button>
                <button className="edit-links-btn save-mode" onClick={saveSyncData}>✓ Save Timings</button>
              </>
            ) : isEditing ? (
              <button className="edit-links-btn save-mode" onClick={saveData}>✓ Save Info & Lyrics</button>
            ) : isImageManagerOpen ? (
              <button className="edit-links-btn save-mode" onClick={saveImageManager}>✓ Save Images</button>
            ) : (
              <>
                <button className="edit-links-btn" onClick={() => setIsEditing(true)}>✎ Edit Info</button>
                {customData.lyrics ? (
                  <>
                    <button className="edit-links-btn" onClick={startSyncMode} disabled={isSyncLoading} style={{ opacity: isSyncLoading ? 0.6 : 1, cursor: isSyncLoading ? 'wait' : 'pointer' }}>
                      {isSyncLoading ? '⏳ Parsing Engine...' : hasValidSyncData ? '⏱ Edit Timings' : '⏱ Sync Lyrics'}
                    </button>
                    {allPotentialSingers.length > 1 && (<button className="edit-links-btn" onClick={() => setIsImageManagerOpen(true)}>🖼️ Manage Artist Images</button>)}
                    {hasValidSyncData && !isSyncLoading && (<button className="edit-links-btn toggle-view-btn" onClick={cycleViewMode}>{lyricsViewMode === 'live' ? '🎯 Show Focused Sync' : lyricsViewMode === 'focused' ? '📄 Show Plain Text' : '✨ Show Live Sync'}</button>)}
                  </>
                ) : (
                  <>
                    <button className="edit-links-btn" onClick={() => setIsEditing(true)}>✎ Add Lyrics</button>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} lyrics`)}`} target="_blank" rel="noreferrer" className="edit-links-btn search-google-btn">🔍 Search Google</a>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bottom-actions">
          {isSaved ? (
            <button className="delete-icon-btn" onClick={(e) => toggleLibrary(e, selectedSong)} title="Remove from Vault">🗑</button>
          ) : (
            <button className="edit-links-btn save-mode" onClick={(e) => toggleLibrary(e, selectedSong)}>+ Add to Vault</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalLeft;