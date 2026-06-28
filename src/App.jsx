/* --- src/App.jsx --- */
import React, { useState, useEffect } from 'react';
import './App.css';
import Background from './components/Background';
import Topbar from './components/Topbar';
import SongCard from './components/SongCard';
import SongModal from './components/SongModal';
import Player from './components/Player';
import SettingsTab from './components/SettingsTab';

const App = () => {
  const [activeTab, setActiveTab] = useState('search');
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.bgImageOpacity === undefined) parsed.bgImageOpacity = 0.25;
      if (parsed.liveSyncFontSize === undefined) parsed.liveSyncFontSize = 34;
      if (parsed.focusedSyncFontSize === undefined) parsed.focusedSyncFontSize = 42;
      if (parsed.modalSplitRatio === undefined) parsed.modalSplitRatio = 50;
      if (parsed.bgPreemptionTime === undefined) parsed.bgPreemptionTime = 400;
      if (parsed.modalPaddingY === undefined) parsed.modalPaddingY = 5;
      return parsed;
    }
    return {
      cardFontSize: 16,
      modalFontSize: 56,
      cardWidth: 200,
      cardPadding: 16,
      cardGap: 28,
      isRounded: true,
      borderRadius: 16,
      persistentMemory: true,
      bgImageOpacity: 0.25,
      liveSyncFontSize: 34,
      focusedSyncFontSize: 42,
      modalSplitRatio: 50,
      bgPreemptionTime: 400,
      modalPaddingY: 5
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
    if (activeTab !== tab) {
      setSearchQuery('');
      setActiveTab(tab);
    }
  };

  useEffect(() => {
    if (activeTab !== 'search') return;
    if (!searchQuery.trim()) return;

    const debounceTimer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=30`
        );
        const data = await response.json();
        
        const sortedResults = data.results.sort((a, b) => {
          const isAExplicit = a.trackExplicitness === 'explicit' ? 1 : 0;
          const isBExplicit = b.trackExplicitness === 'explicit' ? 1 : 0;
          return isBExplicit - isAExplicit; 
        });

        setSearchResults(sortedResults);
      } catch (error) {
        console.error('Error fetching songs:', error);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
  };

  const toggleLibrary = (e, song) => {
    e.stopPropagation(); 
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

    const exportData = { library: optimizedLibrary, settings: settings };
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
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
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
          if (parsedData.settings) setSettings({ ...settings, ...parsedData.settings });
          handleTabSwitch('library');
          alert(`Successfully imported ${parsedData.library.length} songs and applied UI settings!`);
        } else if (Array.isArray(parsedData)) {
          mergeSongs(parsedData);
          setLibrary(newLibrary);
          handleTabSwitch('library');
          alert(`Successfully imported ${parsedData.length} songs!`);
        }
      } catch (err) {
        alert('Could not read the JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  // --- FULLY RESPONSIVE FLUID TYPOGRAPHY ---
  const dynamicStyles = {
    '--dyn-card-font-size': `clamp(12px, 1.2vw, ${settings.cardFontSize}px)`,
    '--dyn-modal-font-size': `clamp(24px, 4vw, ${settings.modalFontSize}px)`,
    '--dyn-card-width': `clamp(120px, 15vw, ${settings.cardWidth}px)`,
    '--dyn-card-padding': `clamp(8px, 1vw, ${settings.cardPadding}px)`,
    '--dyn-card-gap': `clamp(12px, 1.5vw, ${settings.cardGap}px)`,
    '--dyn-border-radius': settings.isRounded ? `${settings.borderRadius}px` : '0px',
    '--dyn-live-sync-font-size': `clamp(16px, 4vw, ${settings.liveSyncFontSize}px)`,
    '--dyn-focused-sync-font-size': `clamp(20px, 5vw, ${settings.focusedSyncFontSize}px)`,
    '--dyn-modal-split': settings.modalSplitRatio,
    '--dyn-modal-padding-y': `${settings.modalPaddingY}vh`,
  };

  const filteredLibrary = library.filter(song => {
    if (activeTab !== 'library' || !searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.trackName?.toLowerCase().includes(query) ||
      song.artistName?.toLowerCase().includes(query) ||
      song.collectionName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="app-layout" style={dynamicStyles}>
      <Background />

      <Topbar 
        activeTab={activeTab} 
        setActiveTab={handleTabSwitch} 
        handleExport={handleExport}
        handleImport={handleImport}
        openSettings={() => handleTabSwitch('settings')}
      />

      <main className="main-content">
        {activeTab !== 'settings' && (
          <div className="search-container glass-panel-light">
            <form onSubmit={handleSearchSubmit} className="search-box glass-input">
              <span className="search-icon">🔎</span>
              <input
                type="text"
                placeholder={activeTab === 'search' ? "Search for artists, songs, or albums..." : "Search your vault..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="hidden-submit" disabled={isSearching}></button>
            </form>
          </div>
        )}

        <div className="content-scroll-area">
          {activeTab === 'search' && (
            <section className="view-section">
              {searchResults.length > 0 ? (
                <div className="track-grid">
                  {searchResults.map((song) => (
                    <SongCard 
                      key={song.trackId} 
                      song={song} 
                      isSaved={library.some((s) => s.trackId === song.trackId)}
                      toggleLibrary={toggleLibrary}
                      setSelectedSong={setSelectedSong}
                      setCurrentTrack={setCurrentTrack}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-message glass-panel">
                  <h2>Explore the Cosmos</h2>
                  <p>Type in the persistent search bar above to start your journey.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === 'library' && (
            <section className="view-section">
              {library.length > 0 ? (
                filteredLibrary.length > 0 ? (
                  <div className="track-grid">
                    {filteredLibrary.map((song) => (
                      <SongCard 
                        key={song.trackId} 
                        song={song} 
                        isSaved={true}
                        toggleLibrary={toggleLibrary}
                        setSelectedSong={setSelectedSong}
                        setCurrentTrack={setCurrentTrack}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-message glass-panel">
                    <h2>No matches found</h2>
                    <p>No songs in your vault match "{searchQuery}".</p>
                  </div>
                )
              ) : (
                <div className="empty-message glass-panel">
                  <h2>Your vault is empty</h2>
                  <p>Songs you collect will appear orbiting here.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === 'settings' && (
            <SettingsTab settings={settings} setSettings={setSettings} />
          )}
        </div>
      </main>

      <SongModal 
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