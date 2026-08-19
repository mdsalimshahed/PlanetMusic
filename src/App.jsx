/* --- src/App.jsx --- */
import React, { useState } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
import './App.css'; // Core root styles
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
  const [isExplicitSearch, setIsExplicitSearch] = useState(false);

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

  return (
    <div className={`app-layout ${settings.disableAnimations ? 'disable-animations' : ''}`} style={dynamicStyles}>
      {/* UPDATE THIS LINE: Pass !!selectedSong to track the modal state */}
      <Background songs={library} isModalOpen={!!selectedSong} />
      
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
          
          <Routes>
            <Route path="/" element={
              <section className="view-section">
                {/* --- PERSISTENT SAMPLE VAULT BANNER --- */}
                {isSampleVaultActive && library.length > 0 && !searchQuery.trim() && (
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
                    className="glass-panel settings-promo-box dynamic-radius-override" 
                    style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
                    adTitle="Discover More"
                    adSub="Thank you for supporting PlanetMusic"
                  />
                )}
              </section>
            } />

            <Route path="/song/*" element={null} />

            {/* WILDCARD ROUTE FOR BLOG TAB SUB-ROUTES (/blog/dev, /blog/custom, /blog/post/:id, /blog/write, etc.) */}
            <Route path="/blog/*" element={<BlogTab adsEnabled={settings.adsEnabled !== false} />} />

            <Route path="/settings" element={
              <SettingsTab 
                settings={settings} 
                setSettings={handleSetSettings} 
                dismissSampleMode={dismissSampleMode}
                adsEnabled={settings.adsEnabled !== false}
              />
            } />

            <Route path="/privacy" element={
              <PrivacyTab adsEnabled={settings.adsEnabled !== false} />
            } />

            <Route path="/contact" element={
              <ContactTab adsEnabled={settings.adsEnabled !== false} />
            } />
          </Routes>

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