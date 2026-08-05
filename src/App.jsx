/* --- src/App.jsx --- */
import React, { useState, useEffect } from 'react';
import './App.css';
import Background from './components/Background';
import Topbar from './components/Topbar';
import SongCard from './components/SongCard';
import SongModal from './components/SongModal';
import Player from './components/Player';
import SettingsTab from './components/SettingsTab';

// --- PURE FLEX GRID ---
const TrackGrid = ({ items, library, toggleLibrary, setSelectedSong, setCurrentTrack }) => {
  return (
    <div className="track-grid">
      {items.map((song, idx) => (
        // Added idx fallback to key just in case of duplicate IDs
        <div key={`${song.trackId}-${idx}`} className="track-grid-item">
          <SongCard 
            song={song} 
            isSaved={library.some((s) => s.trackId === song.trackId)}
            toggleLibrary={toggleLibrary}
            setSelectedSong={setSelectedSong}
            setCurrentTrack={setCurrentTrack}
          />
        </div>
      ))}
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('main');
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.bgImageOpacity === undefined) parsed.bgImageOpacity = 0.25;
      if (parsed.cosmosSplitRatio === undefined) parsed.cosmosSplitRatio = 60;
      if (parsed.cardFontSize === undefined) parsed.cardFontSize = 1.6;
      if (parsed.modalFontSize === undefined) parsed.modalFontSize = 5.5;
      if (parsed.liveSyncFontSize === undefined) parsed.liveSyncFontSize = 4.5;
      if (parsed.focusedSyncFontSize === undefined) parsed.focusedSyncFontSize = 5.5;
      if (parsed.focusedAdlibFontSize === undefined) parsed.focusedAdlibFontSize = 3.5;
      if (parsed.artistNameFontSize === undefined) parsed.artistNameFontSize = 3.5;
      if (parsed.modalSplitRatio === undefined) parsed.modalSplitRatio = 50;
      if (parsed.bgPreemptionTime === undefined) parsed.bgPreemptionTime = 400;
      if (parsed.modalPaddingY === undefined) parsed.modalPaddingY = 5;
      if (parsed.eqFadeOutTime === undefined) parsed.eqFadeOutTime = 500;
      if (parsed.translationColor === undefined) parsed.translationColor = '#ffffff';
      if (parsed.translationOpacity === undefined) parsed.translationOpacity = 0.9;
      if (parsed.transliterationColor === undefined) parsed.transliterationColor = '#ffffff';
      if (parsed.transliterationOpacity === undefined) parsed.transliterationOpacity = 0.8;
      if (parsed.cardWidth === undefined || parsed.cardWidth > 50) parsed.cardWidth = 12;
      
      delete parsed.youtubeApiKey;
      delete parsed.spotifyClientId;
      delete parsed.spotifyClientSecret;
      
      return parsed;
    }
    return {
      cardFontSize: 1.6,
      modalFontSize: 5.5,
      cardWidth: 12,
      cardPadding: 16,
      cardGap: 28,
      isRounded: true,
      borderRadius: 16,
      persistentMemory: true,
      bgImageOpacity: 0.25,
      cosmosSplitRatio: 60,
      liveSyncFontSize: 4.5,
      focusedSyncFontSize: 5.5,
      focusedAdlibFontSize: 3.5,
      artistNameFontSize: 3.5,
      modalSplitRatio: 50,
      bgPreemptionTime: 400,
      modalPaddingY: 5,
      eqFadeOutTime: 500,
      translationColor: '#ffffff',
      translationOpacity: 0.9,
      transliterationColor: '#ffffff',
      transliterationOpacity: 0.8,
      deezerArl: ''
    };
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('searchQuery') || '';
  });

  const [searchResults, setSearchResults] = useState(() => {
    const saved = localStorage.getItem('searchResults');
    return saved ? JSON.parse(saved) : [];
  });

  const [library, setLibrary] = useState(() => {
    const saved = localStorage.getItem('songLibrary');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedSong, setSelectedSong] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [songToRemove, setSongToRemove] = useState(null);
  const [isExplicitSearch, setIsExplicitSearch] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  useEffect(() => {
    if (settings.persistentMemory) {
      localStorage.setItem('appSettings', JSON.stringify(settings));
      localStorage.setItem('songLibrary', JSON.stringify(library));
      localStorage.setItem('searchQuery', searchQuery);
      localStorage.setItem('searchResults', JSON.stringify(searchResults));
    } else {
      localStorage.removeItem('appSettings');
      localStorage.removeItem('songLibrary');
      localStorage.removeItem('searchQuery');
      localStorage.removeItem('searchResults');
    }
  }, [settings, library, searchQuery, searchResults]);

  const handleTabSwitch = (tab) => {
    setSearchQuery('');
    setSearchResults([]);
    setIsExplicitSearch(false);
    setActiveTab(tab);
  };

  const handleHomeClick = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsExplicitSearch(false);
    setActiveTab('main');
  };

  const filteredLibrary = library.filter(song => {
    if (activeTab !== 'main' || !searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.trackName?.toLowerCase().includes(query) ||
      song.artistName?.toLowerCase().includes(query) ||
      song.collectionName?.toLowerCase().includes(query)
    );
  });

  // --- SEPARATE & INTERLEAVED SEARCH ENGINE (iTunes + Deezer) ---
  // --- SEPARATE & INTERLEAVED SEARCH ENGINE (iTunes + Deezer) ---
  const performOnlineSearch = async (query) => {
    if (!query.trim()) return;
    setIsSearching(true);
    
    try {
      // Fetch both APIs concurrently
      const [itunesRes, deezerRes] = await Promise.all([
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25&explicit=Yes&country=US`)
          .then(res => res.json())
          .catch(err => {
            console.error("iTunes Search Error:", err);
            return { results: [] };
          }),
        fetch(`https://ytdownloader-jnt0.onrender.com/search-deezer?q=${encodeURIComponent(query)}`)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
          })
          .catch(err => {
            console.error("Deezer Search Error:", err);
            return { results: [] };
          })
      ]);

      // Format iTunes Results
      const itunesResults = (itunesRes.results || []).map(song => ({
        ...song,
        sourceName: 'iTunes'
      }));

      // Format Deezer Results
      const deezerResults = (deezerRes.results || []).map(dz => ({
        trackId: `dz_${dz.id}`,
        trackName: dz.title,
        artistName: dz.artist,
        collectionName: dz.album,
        artworkUrl100: dz.cover,
        trackTimeMillis: (dz.duration || 0) * 1000,
        previewUrl: '', // Will stream directly from python backend
        trackExplicitness: 'explicit', 
        sourceName: 'Deezer',
        customLinks: { deezer: dz.link }
      }));

      // Interleave results (1 iTunes, 1 Deezer, 1 iTunes...) so they mix nicely
      const finalResults = [];
      const maxLength = Math.max(itunesResults.length, deezerResults.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (itunesResults[i]) finalResults.push(itunesResults[i]);
        if (deezerResults[i]) finalResults.push(deezerResults[i]);
      }
      
      setSearchResults(finalResults);
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'main') return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsExplicitSearch(false);
      return;
    }
    setIsExplicitSearch(false);
    
    if (filteredLibrary.length > 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      performOnlineSearch(searchQuery);
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeTab, filteredLibrary.length]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsExplicitSearch(true);
    performOnlineSearch(searchQuery);
  };

  const toggleLibrary = (e, song) => {
    if (e) e.stopPropagation();
    const isSaved = library.some((s) => s.trackId === song.trackId);
    
    if (isSaved) {
      setSongToRemove(song);
    } else {
      setLibrary([...library, song]);
    }
  };

  const confirmRemove = () => {
    if (songToRemove) {
      setLibrary(library.filter((s) => s.trackId !== songToRemove.trackId));
      if (selectedSong?.trackId === songToRemove.trackId) setSelectedSong(null);
      setSongToRemove(null);
    }
  };

  const cancelRemove = () => {
    setSongToRemove(null);
  };

  const updateSongInLibrary = (updatedSong) => {
    setLibrary(prevLibrary => {
      const exists = prevLibrary.some(s => s.trackId === updatedSong.trackId);
      if (exists) {
        return prevLibrary.map(s => s.trackId === updatedSong.trackId ? updatedSong : s);
      } else {
        return [...prevLibrary, updatedSong];
      }
    });
    setSelectedSong(updatedSong);
    setCurrentTrack(prevTrack => {
      if (prevTrack && prevTrack.trackId === updatedSong.trackId) {
        return { ...prevTrack, ...updatedSong };
      }
      return prevTrack;
    });
  };

  const handleExport = () => {
    if (library.length === 0) return alert("Your vault is empty! Add songs before exporting.");
    
    const optimizedLibrary = library.map(song => {
      const optimizedSong = { ...song, lyrics: song.lyrics || "", syncData: song.syncData || [] };
      delete optimizedSong.artworkUrl30;
      delete optimizedSong.artworkUrl60;
      delete optimizedSong.trackCensoredName;
      delete optimizedSong.collectionCensoredName;
      delete optimizedSong.artistViewUrl;
      delete optimizedSong.trackViewUrl;
      return optimizedSong;
    });
    
    const exportData = { library: optimizedLibrary, settings: { ...settings } };
    delete exportData.settings.deezerArl; // SECURITY FIX: DO NOT EXPORT ARL TOKEN

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PlanetMusic_Backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target ? event.target.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
        applyParsedData(parsedData);
      } catch (err) {
        alert('Could not read the JSON file.');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
  };

  const applyParsedData = (parsedData) => {
    const newLibrary = [...library];

    const mergeSongs = (importedSongs) => {
      importedSongs.forEach(newSong => {
        const existingIdx = newLibrary.findIndex(s => s.trackId === newSong.trackId);
        if (existingIdx >= 0) newLibrary[existingIdx] = { ...newLibrary[existingIdx], ...newSong };
        else newLibrary.push(newSong);
      });
    };

    if (parsedData.library && Array.isArray(parsedData.library)) {
      mergeSongs(parsedData.library);
      setLibrary(newLibrary);
      if (parsedData.settings) setSettings(prev => ({ ...prev, ...parsedData.settings }));
      handleHomeClick();
      alert(`Successfully imported ${parsedData.library.length} songs and applied settings!`);
    } else if (Array.isArray(parsedData)) {
      mergeSongs(parsedData);
      setLibrary(newLibrary);
      handleHomeClick();
      alert(`Successfully imported ${parsedData.length} songs!`);
    }
  };

  const handleLoadSample = async () => {
    setIsLoadingSample(true);
    try {
      const res = await fetch('/PlanetMusic_Backup.json');
      if (!res.ok) {
        throw new Error('File not found');
      }
      const data = await res.json();
      applyParsedData(data);
    } catch (err) {
      alert("Could not load sample backup file from public folder. Please make sure 'PlanetMusic_Backup.json' is placed inside the 'public/' directory.");
    } finally {
      setIsLoadingSample(false);
    }
  };

  const dynamicStyles = {
    '--dyn-card-font-size': `${settings.cardFontSize}vh`,
    '--dyn-modal-font-size': `${settings.modalFontSize}vh`,
    '--dyn-cosmos-split': `${settings.cosmosSplitRatio ?? 60}%`,
    
    '--dyn-card-width': `${settings.cardWidth || 12}vw`,
    '--dyn-card-padding': `clamp(8px, 1vw, ${settings.cardPadding}px)`,
    '--dyn-card-gap': `clamp(12px, 1.5vw, ${settings.cardGap}px)`,
    '--dyn-border-radius': settings.isRounded ? `${settings.borderRadius}px` : '0px',
    
    '--dyn-live-sync-font-size': `${settings.liveSyncFontSize}vh`,
    '--dyn-focused-sync-font-size': `${settings.focusedSyncFontSize}vh`,
    '--dyn-focused-adlib-font-size': `${settings.focusedAdlibFontSize ?? 3.5}vh`,
    '--dyn-artist-name-font-size': `${settings.artistNameFontSize ?? 3.5}vh`,
    '--dyn-modal-split': settings.modalSplitRatio,
    '--dyn-modal-padding-y': `${settings.modalPaddingY}vh`,
    '--dyn-live-sync-gap': `${settings.liveSyncLineGap ?? 16}px`,
    
    '--dyn-trans-color': settings.translationColor ?? '#ffffff',
    '--dyn-trans-opacity': settings.translationOpacity ?? 0.9,
    '--dyn-trans-top-padding': `${settings.translationTopPadding ?? 8}px`,
    '--dyn-trans-font-size': `${settings.translationFontSize ?? 0.55}em`,
    
    '--dyn-translit-color': settings.transliterationColor ?? '#ffffff',
    '--dyn-translit-opacity': settings.transliterationOpacity ?? 0.8,
    '--dyn-translit-bottom-padding': `${settings.transliterationBottomPadding ?? 4}px`,
    '--dyn-translit-font-size': `${settings.transliterationFontSize ?? 0.55}em`,
  };

  const uniqueOnlineResults = searchResults.filter(
    onlineSong => !filteredLibrary.some(localSong => 
        localSong.trackId === onlineSong.trackId ||
       (localSong.trackName.toLowerCase() === onlineSong.trackName.toLowerCase() && localSong.artistName.toLowerCase() === onlineSong.artistName.toLowerCase())
    )
  );

  return (
    <div className="app-layout" style={dynamicStyles}>
      <Background songs={library} />
      
      <Topbar 
        activeTab={activeTab} 
        handleHomeClick={handleHomeClick}
        handleExport={handleExport}
        handleImport={handleImport}
        handleLoadSample={handleLoadSample}
        openSettings={() => handleTabSwitch('settings')}
      />

      <main className="main-content">
        {activeTab !== 'settings' && (
          <div className="search-container">
            <form onSubmit={handleSearchSubmit} className="search-box">
              <input
                type="text"
                placeholder="Search vault (press Enter for full cosmos search)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="search-submit-btn" title="Search Cosmos">
                {isSearching ? (
                  <span className="search-spinner"></span>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                )}
              </button>
            </form>
          </div>
        )}

        <div className={`content-scroll-area ${isExplicitSearch && activeTab === 'main' && searchQuery.trim() ? 'no-scroll' : ''}`}>
          {activeTab === 'main' && (
            <section className="view-section">
              {!searchQuery.trim() ? (
                library.length > 0 ? (
                  <TrackGrid 
                    items={library} 
                    library={library} 
                    toggleLibrary={toggleLibrary} 
                    setSelectedSong={setSelectedSong} 
                    setCurrentTrack={setCurrentTrack} 
                  />
                ) : (
                  <div className="empty-message glass-panel">
                    <h2>Your Vault is Empty</h2>
                    <p>Type in the search bar above to start your journey.</p>
                    <button 
                      className="sample-vault-btn" 
                      onClick={handleLoadSample}
                      disabled={isLoadingSample}
                    >
                      {isLoadingSample ? 'Loading Sample Vault...' : '  Load Sample Vault'}
                    </button>
                  </div>
                )
              ) : isExplicitSearch ? (
                <div className="dual-search-container">
                  <div className="search-column vault-column">
                    <div className="column-header">
                      <span>VAULT ({filteredLibrary.length})</span>
                    </div>
                    <div className="column-scroll-area">
                      {filteredLibrary.length > 0 ? (
                        <TrackGrid 
                          items={filteredLibrary} 
                          library={library} 
                          toggleLibrary={toggleLibrary} 
                          setSelectedSong={setSelectedSong} 
                          setCurrentTrack={setCurrentTrack} 
                        />
                      ) : (
                        <div className="column-empty-box">No matches in your Vault</div>
                      )}
                    </div>
                  </div>

                  <div className="search-column cosmos-column">
                    <div className="column-header">
                      <span>COSMOS ({uniqueOnlineResults.length})</span>
                    </div>
                    <div className="column-scroll-area">
                      {isSearching ? (
                        <div className="column-empty-box">Searching the Cosmos...</div>
                      ) : uniqueOnlineResults.length > 0 ? (
                        <TrackGrid 
                          items={uniqueOnlineResults} 
                          library={library} 
                          toggleLibrary={toggleLibrary} 
                          setSelectedSong={setSelectedSong} 
                          setCurrentTrack={setCurrentTrack} 
                        />
                      ) : (
                        <div className="column-empty-box">No online matches found</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                filteredLibrary.length > 0 ? (
                  <TrackGrid 
                    items={filteredLibrary} 
                    library={library} 
                    toggleLibrary={toggleLibrary} 
                    setSelectedSong={setSelectedSong} 
                    setCurrentTrack={setCurrentTrack} 
                  />
                ) : searchResults.length > 0 ? (
                  <TrackGrid 
                    items={searchResults} 
                    library={library} 
                    toggleLibrary={toggleLibrary} 
                    setSelectedSong={setSelectedSong} 
                    setCurrentTrack={setCurrentTrack} 
                  />
                ) : isSearching ? (
                  <div className="empty-message glass-panel">
                    <h2>Searching the Cosmos...</h2>
                    <p>Looking for "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="empty-message glass-panel">
                    <h2>No matches found</h2>
                    <p>No songs match "{searchQuery}" in your Vault or Cosmos.</p>
                  </div>
                )
              )}
            </section>
          )}

          {activeTab === 'settings' && (
            <SettingsTab settings={settings} setSettings={setSettings} />
          )}
        </div>
      </main>

      <SongModal 
        key={selectedSong ? selectedSong.trackId : 'modal-empty'}
        selectedSong={selectedSong}
        setSelectedSong={setSelectedSong}
        isSaved={selectedSong ? library.some(s => s.trackId === selectedSong.trackId) : false}
        toggleLibrary={toggleLibrary}
        updateSongInLibrary={updateSongInLibrary}
        setCurrentTrack={setCurrentTrack}
        currentTrack={currentTrack}
        settings={settings}
      />

      <Player 
        currentTrack={currentTrack} 
        setCurrentTrack={setCurrentTrack} 
        selectedSong={selectedSong}
        setSelectedSong={setSelectedSong}
        settings={settings}
      />

      {songToRemove && (
        <div className="confirm-overlay" onClick={cancelRemove}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Remove Song?</h3>
            <p>Are you sure you want to delete <strong>{songToRemove.trackName}</strong> from your Vault? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={cancelRemove}>Cancel</button>
              <button className="confirm-btn delete" onClick={confirmRemove}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;