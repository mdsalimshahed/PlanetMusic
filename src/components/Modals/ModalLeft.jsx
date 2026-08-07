/* --- src/components/Modals/ModalLeft.jsx --- */
import React, { useState, useEffect } from 'react';
import { formatDate, parseTrackName, extractYouTubeId, formatTime } from '../../utils/songHelpers';
import './ModalLeft.css';

// Universal monochromatic SVG Icon Helper
const Icon = ({ name }) => {
  const baseProps = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flexShrink: 0 } };
  switch (name) {
    case 'eye': return <svg {...baseProps}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
    case 'eye-off': return <svg {...baseProps}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>;
    case 'tools': return <svg {...baseProps}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>;
    case 'x': return <svg {...baseProps}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
    case 'trash': return <svg {...baseProps}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
    case 'save': return <svg {...baseProps}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
    case 'search': return <svg {...baseProps}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
    case 'edit': return <svg {...baseProps}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
    case 'clock': return <svg {...baseProps}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
    case 'refresh': return <svg {...baseProps}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
    case 'zap': return <svg {...baseProps}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
    case 'translate': return <svg {...baseProps}><path d="M5 8l6 6"></path><path d="M4 14l6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="M22 22l-5-10-5 10"></path><path d="M14 18h6"></path></svg>;
    case 'users': return <svg {...baseProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 1 0 7.75"></path></svg>;
    case 'plus': return <svg {...baseProps}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
    default: return null;
  }
};

const ModalLeft = ({ 
  selectedSong, realSelectedSong, setSelectedSong, highResArt, releaseType, isSaved, toggleLibrary, customData,
  handleDataChange, handleLocalFileChange, handleClearLocal, isEditing, setIsEditing,
  saveData, finalLinks, setCurrentTrack, currentTrack, isSyncMode, setIsSyncMode, isSyncLoading,
  startSyncMode, saveSyncData, isImageManagerOpen, setIsImageManagerOpen,
  saveImageManager, lyricsViewMode, setLyricsViewMode, hasValidSyncData, allPotentialSingers,
  handleAutoSyncDatabases, isLrcFetching, isShowingAutoSync, isTranslationManagerOpen, setIsTranslationManagerOpen,
  handleRefreshLyrics, showAdlibDebug, setShowAdlibDebug, settings
}) => {
  const { mainTitle, extras, featuredArtists } = parseTrackName(selectedSong.trackName);
  const [showDeezerNotice, setShowDeezerNotice] = useState(false);
  const [showSpotifyNotice, setShowSpotifyNotice] = useState(false);

  const hasManualSync = realSelectedSong?.syncData?.some(l => l.start !== null);
  const hasPlainLyrics = Boolean(customData?.lyrics && customData.lyrics.trim());

  const ytUrl = customData?.yt || selectedSong?.customLinks?.yt || selectedSong?.yt;
  const hasYtLink = Boolean(extractYouTubeId(ytUrl));
  const hasDeezerLink = Boolean(customData?.deezer || selectedSong?.customLinks?.deezer);
  const hasLocalFile = Boolean(customData?.hasLocal);
  const hasArl = Boolean(settings?.deezerArl);

  // Determine if playing in 30-second preview mode
  const isPlayingPreview = Boolean(
    currentTrack && 
    currentTrack.trackId === selectedSong.trackId && 
    (!hasYtLink && !hasLocalFile && (!hasDeezerLink || !hasArl))
  );

  useEffect(() => {
    if (settings?.deezerArl && showDeezerNotice) {
      setShowDeezerNotice(false);
    }
  }, [settings?.deezerArl, showDeezerNotice]);

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

  const handleDeezerPlay = () => {
    setShowSpotifyNotice(false);
    if (!settings?.deezerArl) {
      setShowDeezerNotice(true);
      // Play 30s preview if no ARL exists
      setCurrentTrack({ ...selectedSong, customLinks: customData, forceSource: 'preview', playId: Date.now() });
    } else {
      setShowDeezerNotice(false);
      setCurrentTrack({ ...selectedSong, customLinks: customData, forceSource: 'deezer', playId: Date.now() });
    }
  };

  const handleYtPlay = () => {
    setShowDeezerNotice(false);
    setShowSpotifyNotice(false);
    setCurrentTrack({ ...selectedSong, customLinks: customData, forceSource: 'youtube', playId: Date.now() });
  };

  const handleLocalPlay = () => {
    setShowDeezerNotice(false);
    setShowSpotifyNotice(false);
    setCurrentTrack({ ...selectedSong, customLinks: customData, forceSource: 'local', playId: Date.now() });
  };

  const handleSpotifyPlay = () => {
    setShowDeezerNotice(false);
    setShowSpotifyNotice(true);
    setTimeout(() => {
      setShowSpotifyNotice(false);
      window.open(finalLinks.spotify, '_blank', 'noopener,noreferrer');
    }, 2000);
  };

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
              <span className="album-subtext">
                {selectedSong.trackNumber && releaseType !== 'Single' ? `#${selectedSong.trackNumber} on ${releaseType}` : releaseType}
              </span>
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
          {selectedSong.releaseDate && (
            <div className="detail-item">
              <label>Release Date</label>
              <p>{formatDate(selectedSong.releaseDate)}</p>
            </div>
          )}
          {selectedSong.primaryGenreName && (
            <div className="detail-item">
              <label>Genre</label>
              <p>{selectedSong.primaryGenreName}</p>
            </div>
          )}
          {selectedSong.trackTimeMillis > 0 && (
            <div className="detail-item">
              <label>Duration</label>
              <p>{formatTime(selectedSong.trackTimeMillis)}</p>
            </div>
          )}
        </div>
      </div>
      <div className="modal-left-scrollable">
        <div className="modal-links glass-panel-light">
          <div className="links-header"><label>Play Music From:</label></div>
          
          {isEditing ? (
            <div className="platform-inputs-grid">
              <div className="platform-input-row">
                <a 
                  href={finalLinks.spotify} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="platform-label spotify-color"
                  title="Click to search Spotify for this song link"
                >
                  Spotify
                </a>
                <input 
                  type="text" 
                  name="spotify" 
                  value={customData.spotify} 
                  onChange={handleDataChange} 
                  placeholder="Paste Spotify URL..." 
                />
              </div>
              <div className="platform-input-row">
                <a 
                  href={finalLinks.deezer} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="platform-label deezer-color"
                  title="Click to search Deezer for this song link"
                >
                  Deezer
                </a>
                <input 
                  type="text" 
                  name="deezer" 
                  value={customData.deezer} 
                  onChange={handleDataChange} 
                  placeholder="Paste Deezer Track URL..." 
                />
              </div>
              <div className="platform-input-row">
                <a 
                  href={finalLinks.yt} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="platform-label yt-color"
                  title="Click to search YouTube Music for this song link"
                >
                  YT Music
                </a>
                <input 
                  type="text" 
                  name="yt" 
                  value={customData.yt} 
                  onChange={handleDataChange} 
                  placeholder="Paste YouTube Video URL..." 
                />
              </div>
              
              <div className="platform-input-row">
                <span className="platform-label local-color">Local MP3</span>
                <input type="file" accept="audio/*" id="localFileInput" style={{ display: 'none' }} onChange={handleLocalFileChange} />
                <label htmlFor="localFileInput" className={`local-file-btn ${customData.hasLocal ? 'has-file' : ''}`}>
                  {customData.hasLocal ? customData.localName : "Browse Local Files..."}
                </label>
                {customData.hasLocal && (<button className="clear-local-btn" onClick={handleClearLocal}><Icon name="x" /></button>)}
              </div>
            </div>
          ) : (
            <div className="platform-links">
              <button 
                className="platform-btn spotify" 
                onClick={handleSpotifyPlay}
              >
                Spotify
              </button>
              
              {hasDeezerLink && (
                <button 
                  className="platform-btn deezer"
                  onClick={handleDeezerPlay}
                >
                  Deezer
                </button>
              )}
              
              {hasYtLink && (
                <button 
                  className="platform-btn yt"
                  onClick={handleYtPlay}
                >
                  YT Music
                </button>
              )}
              
              {customData.hasLocal && (
                <button 
                  className="platform-btn local"
                  onClick={handleLocalPlay}
                >
                  Local Audio File
                </button>
              )}
            </div>
          )}

          {/* WARNING MESSAGE: Shown when falling back to 30s preview */}
          {(!hasYtLink && !hasLocalFile && (!hasDeezerLink || !hasArl)) && (
            <div className="no-sync-warning" style={{ marginTop: '16px', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '12px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.1)', textAlign: 'left' }}>
              <strong>Notice:</strong> Currently playing a 30-second preview snippet. To listen to the full song, please click <strong>Edit Info</strong> and add a YouTube/Deezer link or upload a local file (or set a Deezer ARL in Settings).
            </div>
          )}

          {/* Missing Deezer ARL Notice */}
          {showDeezerNotice && !settings?.deezerArl && (
            <div className="no-sync-warning" style={{ marginTop: '16px', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '12px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.1)', textAlign: 'left' }}>
              A valid <strong>Deezer ARL token</strong> is required for Deezer streaming. Enter your token in Settings or add a YouTube link.
            </div>
          )}

          {/* Spotify Warning */}
          {showSpotifyNotice && (
            <div className="no-sync-warning" style={{ marginTop: '16px', color: '#1DB954', border: '1px solid rgba(29, 185, 84, 0.3)', padding: '12px', borderRadius: '8px', background: 'rgba(29, 185, 84, 0.1)', textAlign: 'left' }}>
              Opening Spotify in a new tab...
            </div>
          )}
        </div>

        {/* LYRICS VIEW MODES */}
        {!isTranslationManagerOpen && !isSyncMode && !isEditing && !isImageManagerOpen && !isSyncLoading && (
          <div className="workspace-controls glass-panel-light">
            <div className="links-header"><label>Lyrics View Modes</label></div>
            <div className="action-buttons-grid" style={{ flexDirection: 'column' }}>
              {hasValidSyncData ? (
                <>
                  <div className="view-mode-segmented-slider">
                    <div className={`slider-pill ${lyricsViewMode}`}></div>
                    <button 
                      className={`segment-btn ${lyricsViewMode === 'live' ? 'active' : ''}`}
                      onClick={() => setLyricsViewMode('live')}
                    >
                      Live
                    </button>
                    <button 
                      className={`segment-btn ${lyricsViewMode === 'focused' ? 'active' : ''}`}
                      onClick={() => setLyricsViewMode('focused')}
                    >
                      Focused
                    </button>
                    <button 
                      className={`segment-btn ${lyricsViewMode === 'plain' ? 'active' : ''}`}
                      onClick={() => setLyricsViewMode('plain')}
                    >
                      Plain Text
                    </button>
                  </div>
                  
                  {lyricsViewMode === 'focused' && (
                    <button 
                      className={`edit-links-btn debug-toggle-btn ${showAdlibDebug ? 'is-active' : ''}`}
                      onClick={() => setShowAdlibDebug(!showAdlibDebug)}
                    >
                      <Icon name={showAdlibDebug ? 'eye-off' : 'tools'} />
                      {showAdlibDebug ? 'Hide Adlib Debug' : 'Show Adlib Debug'}
                    </button>
                  )}
                </>
              ) : hasPlainLyrics ? (
                <span className="no-sync-warning">
                  Lyrics aren't synced. Manual or Auto-Sync is needed.
                </span>
              ) : (
                <span className="no-sync-warning">
                  No lyrics found. Add custom lyrics and sync them.
                </span>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE CONTROLS */}
        <div className="workspace-controls glass-panel-light">
          <div className="links-header"><label>Workspace Controls</label></div>
          
          {isSyncMode && !isTranslationManagerOpen && (
            <div className="sync-instructions-left">
              <div className="instruction-row">
                <span><strong>[Space]</strong> Play / Pause audio</span>
              </div>
              <div className="instruction-row">
                <span><strong>[ ] Down Arrow</strong> Tap to set <strong>Start</strong> time. Tap again to set <strong>End</strong> and advance.</span>
              </div>
              <div className="instruction-row subtle">
                <span><strong>[ ] Up Arrow</strong> Undo last timing & step back</span>
              </div>
            </div>
          )}
          <div className="action-buttons-grid">
            {isTranslationManagerOpen ? (
              <button className="edit-links-btn save-mode" onClick={() => handleProtectedAction(() => setIsTranslationManagerOpen(false))}>
                <Icon name="x" /> Close Editor
              </button>
            ) : isSyncMode ? (
              <>
                <button className="edit-links-btn" onClick={() => setIsSyncMode(false)}>
                  <Icon name="x" /> Cancel Sync
                </button>
                <button 
                  className="edit-links-btn" 
                  onClick={handleRefreshLyrics}
                  style={{ background: 'rgba(250, 36, 60, 0.15)', borderColor: 'rgba(250, 36, 60, 0.3)', color: '#FA243C' }}
                  title="Wipe all timings and ad-lib splits from these lyrics"
                >
                  <Icon name="trash" /> Clear All Timings
                </button>
                <button className="edit-links-btn save-mode" onClick={saveSyncData}>
                  <Icon name="save" /> Save Timings
                </button>
              </>
            ) : isEditing ? (
              <>
                <button className="edit-links-btn save-mode" onClick={saveData}>
                  <Icon name="save" /> Save Info & Lyrics
                </button>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} lyrics`)}`} target="_blank" rel="noreferrer" className="edit-links-btn search-google-btn">
                  <Icon name="search" /> Search Google for Lyrics
                </a>
              </>
            ) : isImageManagerOpen ? (
              <button className="edit-links-btn save-mode" onClick={saveImageManager}>
                <Icon name="save" /> Save Artists Data
              </button>
            ) : (
              <>
                <button className="edit-links-btn" onClick={() => setIsEditing(true)}>
                  <Icon name="edit" /> Edit Info
                </button>
                
                <button 
                  className="edit-links-btn" 
                  onClick={() => handleAutoSyncDatabases()}
                  disabled={isLrcFetching || isSyncLoading}
                  style={{ opacity: isLrcFetching ? 0.6 : 1, cursor: isLrcFetching ? 'wait' : 'pointer', background: 'rgba(29, 185, 84, 0.2)', borderColor: '#1DB954' }}
                >
                  {isLrcFetching ? <Icon name="clock" /> : (realSelectedSong?.autoSyncData?.length > 0 ? (isShowingAutoSync ? <Icon name="refresh" /> : <Icon name="refresh" />) : <Icon name="zap" />)}
                  {isLrcFetching ? 'Fetching Databases...' : (realSelectedSong?.autoSyncData?.length > 0 ? (isShowingAutoSync ? 'Show Manual Sync' : 'Show Auto-Sync') : 'Auto-Sync Lyrics')}
                </button>
                {customData.lyrics ? (
                  <>
                    <button className="edit-links-btn" onClick={startSyncMode} disabled={isSyncLoading || isLrcFetching} style={{ opacity: isSyncLoading ? 0.6 : 1, cursor: isSyncLoading ? 'wait' : 'pointer' }}>
                      {isSyncLoading ? <Icon name="clock" /> : (hasManualSync ? <Icon name="edit" /> : <Icon name="clock" />)}
                      {isSyncLoading ? 'Parsing Engine...' : hasManualSync ? 'Edit Timings' : 'Manual Sync'}
                    </button>
                    
                    <button 
                      className="edit-links-btn" 
                      onClick={() => setIsTranslationManagerOpen(true)}
                    >
                      <Icon name="translate" /> Edit Translation
                    </button>
                    <button className="edit-links-btn" onClick={() => setIsImageManagerOpen(true)}>
                      <Icon name="users" /> Manage Artists
                    </button>
                  </>
                ) : (
                  <>
                    <button className="edit-links-btn" onClick={() => setIsEditing(true)}>
                      <Icon name="plus" /> Add Custom Lyrics
                    </button>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} lyrics`)}`} target="_blank" rel="noreferrer" className="edit-links-btn search-google-btn">
                      <Icon name="search" /> Search Google
                    </a>
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
              <Icon name="trash" /> Remove from Vault
            </button>
          ) : (
            <button className="edit-links-btn save-mode" onClick={(e) => {
              toggleLibrary(e, selectedSong);
              handleAutoSyncDatabases(true);
            }}>
              <Icon name="plus" /> Add to Vault
            </button>
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