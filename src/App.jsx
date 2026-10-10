/* --- src/App.jsx --- */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { toSmartPunctuation } from './utils/smartPunctuation.js';
import './App.css';

// Core root styles
import './Application/components/Core/AppLayout.css';
import './Application/components/Core/SearchArea.css';
import './Application/components/Core/SampleVault.css';

import Background from './Application/components/Core/Background.jsx';
import Topbar from './Application/components/Core/Topbar.jsx';
import SongModal from './Application/components/Modals/SongModal.jsx';
import Player from './Studio/components/Player/Player.jsx';

import SettingsTab from './Application/pages/SettingsTab.jsx';
import BlogTab from './Application/pages/BlogTab.jsx';
import PrivacyTab from './Application/pages/PrivacyTab.jsx';
import ContactTab from './Application/pages/ContactTab.jsx';

import SponsorUnit from './Application/components/Promos/SponsorUnit.jsx';
import ConsentNotice from './Application/components/Core/ConsentNotice.jsx';
import TrackGrid from './Application/components/Core/TrackGrid.jsx';

// Custom Hooks for Modular Logic
import { useAppStorage } from './Application/hooks/data/useAppStorage.js';
import { useVaultOperations } from './Application/hooks/data/useVaultOperations.js';
import { useCosmosSearch } from './Application/hooks/core/useCosmosSearch.js';
import { useDeepLink } from './Application/hooks/core/useDeepLink.js';

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const contentScrollAreaRef = useRef(null);
  const searchBoxRef = useRef(null);
  const [searchOrbitSize, setSearchOrbitSize] = useState({ width: 602, height: 52 });
  const [searchOrbitGradients, setSearchOrbitGradients] = useState([
    ['#ff4d6d', '#ffd166', '#50c7ff'],
    ['#8aff80', '#b388ff', '#ff8c42']
  ]);

  useEffect(() => {
    const searchBox = searchBoxRef.current;
    if (!searchBox) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const bounds = entry.target.getBoundingClientRect();
      const width = Math.round(bounds.width + 2);
      const height = Math.round(bounds.height + 2);
      setSearchOrbitSize((currentSize) => (
        currentSize.width === width && currentSize.height === height
          ? currentSize
          : { width, height }
      ));
    });

    observer.observe(searchBox);
    return () => observer.disconnect();
  }, []);

  const assignSearchOrbitColors = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;

    const palettes = [
      ['#ff4d6d', '#ffd166', '#50c7ff'],
      ['#8aff80', '#b388ff', '#ff8c42'],
      ['#00f5d4', '#00bbf9', '#f15bb5'],
      ['#fee440', '#f15bb5', '#9b5de5'],
      ['#fb5607', '#ffbe0b', '#8338ec'],
      ['#06d6a0', '#118ab2', '#ef476f']
    ];
    const pickPalette = () => palettes[Math.floor(Math.random() * palettes.length)];
    setSearchOrbitGradients([pickPalette(), pickPalette()]);
  };

  useEffect(() => {
    contentScrollAreaRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  // Parse routing variables from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[0] === 'blog' ? 'blog' : 
                    pathParts[0] === 'settings' ? 'settings' : 
                    pathParts[0] === 'privacy' ? 'privacy' : 
                    pathParts[0] === 'contact' ? 'contact' : 
                    pathParts[0] === 'ambient' ? 'ambient' : 'main';
                    
  const urlTrackId = pathParts[0] === 'song' ? pathParts[1] : null;

  // Extract ?q= search parameter from URL for bookmarking
  const queryParams = new URLSearchParams(location.search);
  const urlSearchQuery = queryParams.get('q') || '';

  // 1. Initialize Base Storage & Memory
  const {
    settings, setSettings,
    library, setLibrary,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    isSampleVaultActive, setIsSampleVaultActive
  } = useAppStorage(urlSearchQuery);

  const [selectedSong, setSelectedSong] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [logoPlaybackVisuals, setLogoPlaybackVisuals] = useState({ isPlaying: false, albumAccentColor: null });
  const [isExplicitSearch, setIsExplicitSearch] = useState(false);

  const backgroundTrack = useMemo(() => {
    if (!currentTrack) return null;
    const savedTrack = library.find(song => String(song.trackId) === String(currentTrack.trackId));
    if (!savedTrack) return currentTrack;

    return {
      ...currentTrack,
      artistName: savedTrack.artistName ?? currentTrack.artistName,
      lyrics: savedTrack.lyrics ?? currentTrack.lyrics,
      syncData: savedTrack.syncData ?? currentTrack.syncData,
      autoSyncData: savedTrack.autoSyncData ?? currentTrack.autoSyncData,
      artistImages: savedTrack.artistImages ?? currentTrack.artistImages,
      artistColors: savedTrack.artistColors ?? currentTrack.artistColors
    };
  }, [currentTrack, library]);
  
  // Ambient View State synced with URL route
  const isAmbientMode = activeTab === 'ambient';

  // Toggle handler for Ambient View button
  const toggleAmbientMode = () => {
    if (isAmbientMode) {
      const qParam = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      navigate(`/${qParam}`);
    } else {
      navigate('/ambient');
    }
  };

  // Auto-exit Ambient Mode if the user starts searching
  useEffect(() => {
    if (searchQuery.trim() !== '' && isAmbientMode) {
      const qParam = `?q=${encodeURIComponent(searchQuery.trim())}`;
      navigate(`/${qParam}`);
    }
  }, [searchQuery, isAmbientMode, navigate]);

  // Routing Handlers
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

  // Direct State Update Handler (No Navigation / Route Interruption)
  const updateSelectedSongDirect = (song) => {
    setSelectedSong(song);
  };

  const handleHomeClick = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsExplicitSearch(false);
    navigate('/');
  };

  // 2. Deep Linking Engine
  useDeepLink({ urlTrackId, library, searchResults, selectedSong, setSelectedSong });

  // 3. Vault & Data Logic
  const {
    songToRemove,
    isLoadingSample,
    dismissSampleMode,
    handleSetSettings,
    handleClearSampleVault,
    handleKeepSampleVault,
    toggleLibrary,
    confirmRemove,
    cancelRemove,
    updateSongInLibrary,
    handleExport,
    handleImport,
    handleLoadSample
  } = useVaultOperations({
    library, setLibrary, settings, setSettings,
    isSampleVaultActive, setIsSampleVaultActive,
    selectedSong, handleSetSelectedSong, updateSelectedSongDirect, setCurrentTrack, handleHomeClick
  });

  // 4. Cosmos Search Engine
  const {
    isSearching,
    filteredLibrary,
    uniqueOnlineResults,
    handleSearchSubmit
  } = useCosmosSearch({
    searchQuery, searchResults, setSearchResults,
    activeTab, urlSearchQuery, navigate, library, setIsExplicitSearch
  });

  const isSyncWorkspaceActive = Boolean(
    selectedSong &&
    pathParts[0] === 'song' &&
    pathParts.includes('sync-workspace') &&
    String(selectedSong.trackId) === String(urlTrackId)
  );
  const playerTrack = isSyncWorkspaceActive &&
    String(currentTrack?.trackId) !== String(selectedSong?.trackId)
    ? null
    : currentTrack;

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
    '--dyn-focused-adlib-width-font-size': `${settings.focusedAdlibFontSize ?? 3.5}cqw`,
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

  const renderDashboardView = () => (
    <section className="view-section">
      {/* --- PERSISTENT SAMPLE VAULT BANNER --- */}
      {!isAmbientMode && isSampleVaultActive && library.length > 0 && !searchQuery.trim() && (
        <div className="sample-vault-banner glass-panel">
          <div className="sample-banner-text">
            <strong>Sample Vault Mode:</strong> You are currently viewing pre-loaded demo tracks. You can keep them or clear them to start fresh.
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

      {isAmbientMode ? (
        <div style={{ minHeight: '60vh' }} /> // Empty spacer for ambient mode
      ) : isLoadingSample ? (
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
            <p>Looking for “{toSmartPunctuation(searchQuery)}”</p>
          </div>
        ) : (
          <div className="empty-message glass-panel">
            <h2>No matches found</h2>
            <p>No songs match “{toSmartPunctuation(searchQuery)}” in your Vault or Cosmos.</p>
          </div>
        )
      )}

      {/* BOTTOM SPONSOR AD (Main Dashboard) */}
      {!isAmbientMode && settings.adsEnabled !== false && (
        <SponsorUnit 
          placement="dashboardBottom"
          className="glass-panel settings-promo-box dynamic-radius-override" 
          style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
          adTitle="Discover More"
          adSub="Thank you for supporting PlanetMusic"
        />
      )}
    </section>
  );

  return (
    <div className={`app-layout ${settings.disableAnimations ? 'disable-animations' : ''}`} style={dynamicStyles}>
      <Background isModalOpen={!!selectedSong} currentTrack={backgroundTrack} />
      
      <Topbar 
        activeTab={activeTab} 
        isMusicPlaying={logoPlaybackVisuals.isPlaying}
        albumAccentColor={logoPlaybackVisuals.albumAccentColor}
        handleHomeClick={handleHomeClick}
        handleExport={handleExport}
        handleImport={handleImport}
        handleLoadSample={handleLoadSample}
      />

      <main className="main-content">
        {(activeTab === 'main' || activeTab === 'ambient') && (
          <div className={`search-container ${activeTab === 'ambient' ? 'ambient-search-entry' : ''}`}>
            <form ref={searchBoxRef} onSubmit={handleSearchSubmit} onFocusCapture={assignSearchOrbitColors} className="search-box">
              <span className="search-box-shine" aria-hidden="true" />
              <svg className="search-box-orbit" viewBox={`0 0 ${searchOrbitSize.width} ${searchOrbitSize.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                {searchOrbitGradients.map((colors, index) => (
                  <linearGradient key={index} id={`search-box-orbit-gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                    {colors.map((color, colorIndex) => (
                      <stop key={colorIndex} offset={`${(colorIndex / (colors.length - 1)) * 100}%`} stopColor={color} />
                    ))}
                  </linearGradient>
                ))}
              </defs>
              <rect className="search-box-orbit-track search-box-orbit-static" stroke="url(#search-box-orbit-gradient-0)" x="1" y="1" width={searchOrbitSize.width - 2} height={searchOrbitSize.height - 2} rx={(searchOrbitSize.height - 2) / 2} pathLength="1000" />
              <rect className="search-box-orbit-track search-box-orbit-static search-box-orbit-static-opposite" stroke="url(#search-box-orbit-gradient-1)" x="1" y="1" width={searchOrbitSize.width - 2} height={searchOrbitSize.height - 2} rx={(searchOrbitSize.height - 2) / 2} pathLength="1000" />
              <rect className="search-box-orbit-track search-box-orbit-runner" stroke="url(#search-box-orbit-gradient-0)" x="1" y="1" width={searchOrbitSize.width - 2} height={searchOrbitSize.height - 2} rx={(searchOrbitSize.height - 2) / 2} pathLength="1000" />
              <rect className="search-box-orbit-track search-box-orbit-runner search-box-orbit-runner-opposite" stroke="url(#search-box-orbit-gradient-1)" x="1" y="1" width={searchOrbitSize.width - 2} height={searchOrbitSize.height - 2} rx={(searchOrbitSize.height - 2) / 2} pathLength="1000" />
              </svg>
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

        <div ref={contentScrollAreaRef} className={`content-scroll-area ${isExplicitSearch && (activeTab === 'main' || activeTab === 'ambient') && searchQuery.trim() ? 'no-scroll' : ''}`}>
          
          <Routes>
            <Route path="/" element={renderDashboardView()} />
            <Route path="/ambient" element={renderDashboardView()} />
            
            <Route path="/song/*" element={null} />
            
            {/* WILDCARD ROUTE FOR BLOG TAB SUB-ROUTES (/blog/dev, /blog/custom, /blog/post/:id, /blog/write, etc.) */}
            <Route path="/blog/*" element={<BlogTab adsEnabled={settings.adsEnabled !== false} />} />
            
            <Route path="/settings" element={
              <SettingsTab 
                settings={settings} 
                setSettings={handleSetSettings} 
                dismissSampleMode={dismissSampleMode}
                adsEnabled={settings.adsEnabled !== false}
                isAmbientMode={isAmbientMode}
                toggleAmbientMode={toggleAmbientMode}
                returnPath={location.state?.returnPath}
              />
            } />
            
            <Route path="/privacy" element={
              <PrivacyTab adsEnabled={settings.adsEnabled !== false} />
            } />

            <Route path="/contact" element={
              <ContactTab adsEnabled={settings.adsEnabled !== false} />
            } />

            <Route path="/deezer/*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* GLOBAL FOOTER: Copyright, Ambient Toggle & Ad Toggle */}
          <div className="global-footer">
            <p>&copy; {new Date().getFullYear()} PlanetMusic. All rights reserved.</p>
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
        key={isSyncWorkspaceActive ? `sync-player-${urlTrackId}` : 'global-player'}
        currentTrack={playerTrack}
        onPlaybackVisualChange={setLogoPlaybackVisuals}
        setCurrentTrack={setCurrentTrack}
        selectedSong={selectedSong}
        setSelectedSong={handleSetSelectedSong}
        isSyncWorkspaceActive={isSyncWorkspaceActive}
        settings={settings}
      />

      {songToRemove && (
        <div className="confirm-overlay" onClick={cancelRemove}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Remove Song?</h3>
            <p>Are you sure you want to delete <strong>{toSmartPunctuation(songToRemove.trackName)}</strong> from your Vault? This action cannot be undone.</p>
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