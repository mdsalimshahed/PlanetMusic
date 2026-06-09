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
      // Ensure the new settings exist for returning users
      if (parsed.bgImageOpacity === undefined) parsed.bgImageOpacity = 0.25;
      if (parsed.liveSyncFontSize === undefined) parsed.liveSyncFontSize = 34;
      if (parsed.focusedSyncFontSize === undefined) parsed.focusedSyncFontSize = 42;
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
      focusedSyncFontSize: 42
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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (activeTab === 'library' || activeTab === 'settings') return; 

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=30`
      );
      const data = await response.json();
      setSearchResults(data.results);
      setActiveTab('search'); 
    } catch (error) {
      console.error('Error fetching songs:', error);
      alert('Failed to search for songs.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleLibrary = (e, song) => {
    e.stopPropagation(); 
    const isSaved = library.some((s) => s.trackId === song.trackId);
    
    if (isSaved) {
      setLibrary(library.filter((s) => s.trackId !== song.trackId));
      if (selectedSong?.trackId === song.trackId) setSelectedSong(null);
    } else {
      setLibrary([...library, song]);
    }
  };

  const updateSongInLibrary = (updatedSong) => {
    setLibrary(prevLibrary => 
      prevLibrary.map(s => s.trackId === updatedSong.trackId ? updatedSong : s)
    );
    setSelectedSong(updatedSong);
  };

  const handleExport = () => {
    if (library.length === 0) return alert("Your vault is empty! Add songs before exporting.");
    
    const optimizedLibrary = library.map(song => {
      const optimizedSong = { ...song };
      // REMOVED: The line that deleted raw lyrics when sync data was present is now gone.
      // The raw pasted lyrics will now be exported exactly as they are.
      delete optimizedSong.artworkUrl30;
      delete optimizedSong.artworkUrl60;
      delete optimizedSong.trackCensoredName;
      delete optimizedSong.collectionCensoredName;
      delete optimizedSong.artistViewUrl;
      delete optimizedSong.trackViewUrl;
      return optimizedSong;
    });

    const exportData = { library: optimizedLibrary, settings: settings };
    const jsonString = JSON.stringify(exportData); 
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
        if (parsedData.library && Array.isArray(parsedData.library)) {
          const newLibrary = [...library];
          parsedData.library.forEach(newSong => {
            if (!newLibrary.some(s => s.trackId === newSong.trackId)) newLibrary.push(newSong);
          });
          setLibrary(newLibrary);
          if (parsedData.settings) setSettings({ ...settings, ...parsedData.settings });
          setActiveTab('library');
          alert(`Successfully imported ${parsedData.library.length} songs and applied UI settings!`);
        } else if (Array.isArray(parsedData)) {
          const newLibrary = [...library];
          parsedData.forEach(newSong => {
            if (!newLibrary.some(s => s.trackId === newSong.trackId)) newLibrary.push(newSong);
          });
          setLibrary(newLibrary);
          setActiveTab('library');
          alert(`Successfully imported ${parsedData.length} songs!`);
        }
      } catch (err) {
        alert('Could not read the JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const dynamicStyles = {
    '--dyn-card-font-size': `${settings.cardFontSize}px`,
    '--dyn-modal-font-size': `${settings.modalFontSize}px`,
    '--dyn-card-width': `${settings.cardWidth}px`,
    '--dyn-card-padding': `${settings.cardPadding}px`,
    '--dyn-card-gap': `${settings.cardGap}px`,
    '--dyn-border-radius': settings.isRounded ? `${settings.borderRadius}px` : '0px',
    '--dyn-live-sync-font-size': `${settings.liveSyncFontSize}px`,
    '--dyn-focused-sync-font-size': `${settings.focusedSyncFontSize}px`,
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
        setActiveTab={setActiveTab} 
        handleExport={handleExport}
        handleImport={handleImport}
        openSettings={() => setActiveTab('settings')}
      />

      <main className="main-content">
        {activeTab !== 'settings' && (
          <div className="search-container glass-panel-light">
            <form onSubmit={handleSearch} className="search-box glass-input">
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

      <Player currentTrack={currentTrack} setCurrentTrack={setCurrentTrack} />
    </div>
  );
};

export default App;