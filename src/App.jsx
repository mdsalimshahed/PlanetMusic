/* --- src/App.jsx --- */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import Background from './components/Background';
import Topbar from './components/Topbar';
import SongCard from './components/SongCard';
import SongModal from './components/SongModal';
import Player from './components/Player';
import SettingsTab from './components/SettingsTab';
import BlogTab from './components/BlogTab';
import PrivacyTab from './components/PrivacyTab';
import ContactTab from './components/ContactTab';

// Import Ad Components & Consent Notice
import SponsorUnit from './components/Promos/SponsorUnit';
import InFeedSponsor from './components/Promos/InFeedSponsor';
import ConsentNotice from './components/ConsentNotice';

// --- PURE FLEX GRID WITH IN-FEED ADS ---
const TrackGrid = ({ items, library, toggleLibrary, setSelectedSong, setCurrentTrack, adsEnabled }) => {
  return (
    <div className="track-grid">
      {items.map((song, idx) => {
        // Inject an In-Feed Ad every 6 items
        const showAdAfter = (idx + 1) % 6 === 0;

        return (
          <React.Fragment key={`${song.trackId}-${idx}`}>
            <div className="track-grid-item">
              <SongCard 
                song={song} 
                isSaved={library.some((s) => s.trackId === song.trackId)}
                toggleLibrary={toggleLibrary}
                setSelectedSong={setSelectedSong}
                setCurrentTrack={setCurrentTrack}
              />
            </div>
            
            {/* INJECT IN-FEED AD IF ENABLED */}
            {adsEnabled && showAdAfter && <InFeedSponsor testMode={true} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Parse routing variables from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] === 'blog' ? 'blog' : 
                    pathParts[0] === 'settings' ? 'settings' : 
                    pathParts[0] === 'privacy' ? 'privacy' : 
                    pathParts[0] === 'contact' ? 'contact' : 'main';
                    
  const urlTrackId = pathParts[0] === 'song' ? pathParts[1] : null;

  // Extract ?q= search parameter from URL for bookmarking
  const queryParams = new URLSearchParams(location.search);
  const urlSearchQuery = queryParams.get('q') || '';

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
      if (parsed.adsEnabled === undefined) parsed.adsEnabled = true; // Inject ad toggle default
      
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
      deezerArl: '',
      adsEnabled: true // Default on
    };
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    return urlSearchQuery || localStorage.getItem('searchQuery') || '';
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
  
  const [isSampleVaultActive, setIsSampleVaultActive] = useState(() => {
    return localStorage.getItem('isSampleVaultActive') === 'true';
  });

  // Helper to permanently dismiss sample vault mode when user modifies data
  const dismissSampleMode = () => {
    if (isSampleVaultActive) {
      setIsSampleVaultActive(false);
      localStorage.setItem('isSampleVaultActive', 'false');
      localStorage.setItem('hasVisitedBefore', 'true');
    }
  };

  // Wrap setSettings to ensure modifying visual/audio settings dismisses sample vault banner
  const handleSetSettings = (newSettingsAction) => {
    dismissSampleMode();
    setSettings(newSettingsAction);
  };

  // Synchronize input if user navigates through browser history
  useEffect(() => {
    if (urlSearchQuery !== searchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchQuery]);

  // --- AUTOMATIC SAMPLE VAULT INITIALIZATION FOR FIRST-TIME VISITORS ---
  useEffect(() => {
    const autoLoadSampleOnMount = async () => {
      const hasVisitedBefore = localStorage.getItem('hasVisitedBefore');
      if (library.length === 0 && !hasVisitedBefore) {
        setIsLoadingSample(true);
        try {
          const res = await fetch('/PlanetMusic_Backup.json');
          if (res.ok) {
            const data = await res.json();
            applyParsedData(data, false);
            localStorage.setItem('hasVisitedBefore', 'true');
            localStorage.setItem('isSampleVaultActive', 'true');
            setIsSampleVaultActive(true);
          }
        } catch (err) {
          console.warn("Could not auto-load sample vault on mount:", err);
        } finally {
          setIsLoadingSample(false);
        }
      }
    };
    autoLoadSampleOnMount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearSampleVault = () => {
    setLibrary([]);
    localStorage.removeItem('songLibrary');
    localStorage.setItem('isSampleVaultActive', 'false');
    localStorage.setItem('hasVisitedBefore', 'true');
    setIsSampleVaultActive(false);
  };

  const handleKeepSampleVault = () => {
    dismissSampleMode();
  };

  // Deep Linking Engine: Loads song if visited directly via URL
  useEffect(() => {
    if (urlTrackId) {
      if (selectedSong && String(selectedSong.trackId) === String(urlTrackId)) return;

      let found = library.find(s => String(s.trackId) === String(urlTrackId)) || 
                  searchResults.find(s => String(s.trackId) === String(urlTrackId));
      
      if (found) {
        setSelectedSong(found);
      } else {
        if (!urlTrackId.startsWith('dz_')) {
          fetch(`https://itunes.apple.com/lookup?id=${urlTrackId}&entity=song`)
            .then(res => res.json())
            .then(data => {
              if (data.results && data.results.length > 0) {
                setSelectedSong({
                  ...data.results[0],
                  sourceNames: ['iTunes']
                });
              }
            })
            .catch(e => console.error("Deep link fetch failed", e));
        }
      }
    } else {
      setSelectedSong(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTrackId]);

  const handleSetSelectedSong = (song) => {
    if (song) {
      const qParam = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      navigate(`/song/${song.trackId}/live${qParam}`);
    } else {
      const qParam = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const tabPath = activeTab === 'main' ? `/${qParam}` : `/${activeTab}${qParam}`;
      navigate(tabPath);
    }
    setSelectedSong(song);
  };

  useEffect(() => {
    if (settings.persistentMemory) {
      localStorage.setItem('appSettings', JSON.stringify(settings));
      localStorage.setItem('songLibrary', JSON.stringify(library));
      localStorage.setItem('searchQuery', searchQuery);
      localStorage.setItem('searchResults', JSON.stringify(searchResults));
      localStorage.setItem('isSampleVaultActive', isSampleVaultActive ? 'true' : 'false');
    } else {
      localStorage.removeItem('appSettings');
      localStorage.removeItem('songLibrary');
      localStorage.removeItem('searchQuery');
      localStorage.removeItem('searchResults');
      localStorage.removeItem('isSampleVaultActive');
    }
  }, [settings, library, searchQuery, searchResults, isSampleVaultActive]);

  const handleHomeClick = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsExplicitSearch(false);
    navigate('/');
  };

  // Helper string normalizer
  const norm = (str) => 
    (str || '')
      .replace(/[\(\[].*?[\)\]]/g, '')
      .replace(/[’']/g, "'")
      .toLowerCase()
      .trim();

  // --- STRICT SONG-TITLE FILTER & RELEVANCE ENGINE ---
  const filterAndSortByTitleMatch = (results, query) => {
    if (!results || results.length === 0) return [];
    if (!query || !query.trim()) return results;
    
    const cleanQuery = query.toLowerCase().trim();
    const queryWords = cleanQuery.split(/\s+/).filter(Boolean);

    const strictFiltered = results.filter(song => {
      const titleClean = norm(song.trackName);
      const rawTitle = (song.trackName || '').toLowerCase().trim();

      return queryWords.some(word => titleClean.includes(word) || rawTitle.includes(word));
    });

    const getScore = (song) => {
      const titleClean = norm(song.trackName);
      const rawTitle = (song.trackName || '').toLowerCase().trim();

      let score = 0;

      if (titleClean === cleanQuery || rawTitle === cleanQuery) score += 1000;
      if (titleClean.startsWith(cleanQuery) || rawTitle.startsWith(cleanQuery)) score += 500;
      if (titleClean.includes(cleanQuery) || rawTitle.includes(cleanQuery)) score += 300;

      queryWords.forEach(word => {
        if (titleClean.includes(word)) score += 50;
      });

      return score;
    };

    return [...strictFiltered].sort((a, b) => getScore(b) - getScore(a));
  };

  const filteredLibrary = filterAndSortByTitleMatch(
    library.filter(song => {
      if (activeTab !== 'main' || !searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        song.trackName?.toLowerCase().includes(query) ||
        song.artistName?.toLowerCase().includes(query) ||
        song.collectionName?.toLowerCase().includes(query)
      );
    }),
    searchQuery
  );

  // --- PROGRESSIVE HYBRID SEARCH ENGINE WITH EXACT FUSION ---
  const performOnlineSearch = async (query) => {
    if (!query.trim()) return;
    setIsSearching(true);
    
    let currentResults = [];

    const processITunes = (items) => {
      return items.map(song => ({
        ...song,
        sourceNames: ['iTunes']
      }));
    };

    const fuseDeezerAndDeduplicate = (existing, dzItems) => {
      const deezerResults = dzItems.map(dz => ({
        trackId: `dz_${dz.id}`,
        trackName: dz.title,
        artistName: dz.artist,
        collectionName: dz.album,
        artworkUrl100: dz.cover,
        trackTimeMillis: (dz.duration || 0) * 1000,
        previewUrl: '',
        trackExplicitness: 'explicit',
        sourceNames: ['Deezer'],
        customLinks: { deezer: dz.link }
      }));

      const finalResults = [];
      const matchedDeezerIds = new Set();

      existing.forEach(song => {
        const normTitle = norm(song.trackName);
        const normArtist = norm(song.artistName);

        const dzMatch = deezerResults.find(dz => 
          !matchedDeezerIds.has(dz.trackId) &&
          norm(dz.trackName) === normTitle &&
          norm(dz.artistName) === normArtist
        );

        const formattedSong = { ...song };

        if (dzMatch) {
          formattedSong.sourceNames = Array.from(new Set([...(formattedSong.sourceNames || []), 'Deezer']));
          formattedSong.customLinks = { ...formattedSong.customLinks, deezer: dzMatch.customLinks.deezer };
          if (dzMatch.trackExplicitness === 'explicit') formattedSong.trackExplicitness = 'explicit';
          matchedDeezerIds.add(dzMatch.trackId);
        }

        finalResults.push(formattedSong);
      });

      deezerResults.forEach(dz => {
        if (!matchedDeezerIds.has(dz.trackId)) {
          finalResults.push(dz);
        }
      });

      return finalResults;
    };

    try {
      const iTunesPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25&explicit=Yes&country=US`)
        .then(res => res.json())
        .then(data => {
          const formatted = processITunes(data.results || []);
          currentResults = formatted;
          setSearchResults(filterAndSortByTitleMatch(formatted, query));
          setIsSearching(false); 
          return data;
        })
        .catch(err => {
          console.error("iTunes Search Error:", err);
          return { results: [] };
        });

      const deezerPromise = fetch(`https://ytdownloader-jnt0.onrender.com/search-deezer?q=${encodeURIComponent(query)}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.results && data.results.length > 0) {
            const fused = fuseDeezerAndDeduplicate(currentResults, data.results);
            setSearchResults(filterAndSortByTitleMatch(fused, query));
          }
          return data;
        })
        .catch(err => {
          console.error("Deezer Search Error:", err);
          return { results: [] };
        });

      await Promise.allSettled([iTunesPromise, deezerPromise]);

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
      if (urlSearchQuery) navigate('/', { replace: true });
      return;
    }
    setIsExplicitSearch(false);
    
    if (searchQuery.trim() !== urlSearchQuery) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true });
    }

    if (filteredLibrary.length > 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      performOnlineSearch(searchQuery);
    }, 400);

    return () => clearTimeout(debounceTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeTab, filteredLibrary.length]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsExplicitSearch(true);
    navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    performOnlineSearch(searchQuery);
  };

  const toggleLibrary = (e, song) => {
    if (e) e.stopPropagation();
    dismissSampleMode();
    const isSaved = library.some((s) => s.trackId === song.trackId);
    
    if (isSaved) {
      setSongToRemove(song);
    } else {
      setLibrary([...library, song]);
    }
  };

  const confirmRemove = () => {
    if (songToRemove) {
      dismissSampleMode();
      setLibrary(library.filter((s) => s.trackId !== songToRemove.trackId));
      if (selectedSong?.trackId === songToRemove.trackId) handleSetSelectedSong(null);
      setSongToRemove(null);
    }
  };

  const cancelRemove = () => {
    setSongToRemove(null);
  };

  const updateSongInLibrary = (updatedSong) => {
    dismissSampleMode();
    setLibrary(prevLibrary => {
      const exists = prevLibrary.some(s => s.trackId === updatedSong.trackId);
      if (exists) {
        return prevLibrary.map(s => s.trackId === updatedSong.trackId ? updatedSong : s);
      } else {
        return [...prevLibrary, updatedSong];
      }
    });

    handleSetSelectedSong(updatedSong);

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
    delete exportData.settings.deezerArl;

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
        dismissSampleMode();
        applyParsedData(parsedData);
      } catch (err) {
        alert('Could not read the JSON file.');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = null;
  };

  const applyParsedData = (parsedData, shouldRedirect = true) => {
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
      if (shouldRedirect) handleHomeClick();
    } else if (Array.isArray(parsedData)) {
      mergeSongs(parsedData);
      setLibrary(newLibrary);
      if (shouldRedirect) handleHomeClick();
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
      applyParsedData(data, true);
      localStorage.setItem('isSampleVaultActive', 'true');
      localStorage.setItem('hasVisitedBefore', 'true');
      setIsSampleVaultActive(true);
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
      String(localSong.trackId) === String(onlineSong.trackId) ||
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
      />

      <main className="main-content">
        {activeTab === 'main' && (
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
              {/* --- PERSISTENT SAMPLE VAULT BANNER --- */}
              {isSampleVaultActive && library.length > 0 && !searchQuery.trim() && (
                <div className="sample-vault-banner glass-panel">
                  <div className="sample-banner-text">
                    <strong>💡 Sample Vault Mode:</strong> You are currently viewing pre-loaded demo tracks. You can keep them or clear them to start fresh.
                  </div>
                  <div className="sample-banner-actions">
                    <button 
                      className="keep-sample-btn" 
                      onClick={handleKeepSampleVault}
                    >
                      Keep Vault
                    </button>
                    <button 
                      className="clear-sample-btn" 
                      onClick={handleClearSampleVault}
                    >
                      Clear Sample Vault
                    </button>
                  </div>
                </div>
              )}

              {isLoadingSample ? (
                <div className="empty-message glass-panel">
                  <h2>Loading PlanetMusic Vault...</h2>
                  <p>Populating your initial library experience.</p>
                </div>
              ) : !searchQuery.trim() ? (
                library.length > 0 ? (
                  <TrackGrid 
                    items={library} 
                    library={library} 
                    toggleLibrary={toggleLibrary} 
                    setSelectedSong={handleSetSelectedSong} 
                    setCurrentTrack={setCurrentTrack} 
                    adsEnabled={settings.adsEnabled !== false}
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
                      {isLoadingSample ? 'Loading Sample Vault...' : 'Load Sample Vault'}
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
                          setSelectedSong={handleSetSelectedSong} 
                          setCurrentTrack={setCurrentTrack} 
                          adsEnabled={settings.adsEnabled !== false}
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
                      {isSearching && uniqueOnlineResults.length === 0 ? (
                        <div className="column-empty-box">Searching the Cosmos...</div>
                      ) : uniqueOnlineResults.length > 0 ? (
                        <TrackGrid 
                          items={uniqueOnlineResults} 
                          library={library} 
                          toggleLibrary={toggleLibrary} 
                          setSelectedSong={handleSetSelectedSong} 
                          setCurrentTrack={setCurrentTrack} 
                          adsEnabled={settings.adsEnabled !== false}
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
                    setSelectedSong={handleSetSelectedSong} 
                    setCurrentTrack={setCurrentTrack} 
                    adsEnabled={settings.adsEnabled !== false}
                  />
                ) : searchResults.length > 0 ? (
                  <TrackGrid 
                    items={searchResults} 
                    library={library} 
                    toggleLibrary={toggleLibrary} 
                    setSelectedSong={handleSetSelectedSong} 
                    setCurrentTrack={setCurrentTrack} 
                    adsEnabled={settings.adsEnabled !== false}
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

              {/* BOTTOM SPONSOR AD (Main Dashboard) */}
              {settings.adsEnabled !== false && (
                <SponsorUnit 
                  testMode={true} 
                  className="glass-panel settings-promo-box" 
                  style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
                  adTitle="Discover More"
                  adSub="Thank you for supporting PlanetMusic"
                />
              )}
            </section>
          )}

          {activeTab === 'blog' && (
            <BlogTab adsEnabled={settings.adsEnabled !== false} />
          )}

          {activeTab === 'settings' && (
            <SettingsTab 
              settings={settings} 
              setSettings={handleSetSettings} 
              dismissSampleMode={dismissSampleMode}
              adsEnabled={settings.adsEnabled !== false}
            />
          )}

          {activeTab === 'privacy' && (
            <PrivacyTab adsEnabled={settings.adsEnabled !== false} />
          )}

          {activeTab === 'contact' && (
            <ContactTab adsEnabled={settings.adsEnabled !== false} />
          )}

          {/* GLOBAL FOOTER: Copyright & Ad Toggle */}
          <div className="global-footer">
            <p>&copy; {new Date().getFullYear()} PlanetMusic. All rights reserved.</p>
            <button 
              className="ad-toggle-btn"
              onClick={() => handleSetSettings({ ...settings, adsEnabled: settings.adsEnabled === false ? true : false })}
              title="Toggle to hide or show non-obtrusive sponsor placements"
            >
              {settings.adsEnabled === false ? 'Enable Ads' : 'Disable Ads'}
            </button>
          </div>

        </div>
      </main>

      <ConsentNotice />

      <SongModal 
        key={selectedSong ? selectedSong.trackId : 'modal-empty'}
        selectedSong={selectedSong}
        setSelectedSong={handleSetSelectedSong}
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
        setSelectedSong={handleSetSelectedSong}
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