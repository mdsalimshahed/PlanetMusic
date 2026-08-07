/* --- src/components/SettingsTab.jsx --- */
import React, { useMemo, useState } from 'react';
import './SettingsTab.css';
import SponsorUnit from './Promos/SponsorUnit';

const DUAL_GRADIENT_PALETTE = [
  ['#00f5d4', '#00bbf9'],
  ['#38b000', '#00f5d4'],
  ['#ffc300', '#ff7000'],
  ['#ff7000', '#f15bb5'],
  ['#f15bb5', '#e0aaff'],
  ['#00bbf9', '#e0aaff'],
  ['#e0aaff', '#ff99c8'],
  ['#ff99c8', '#ffc300'],
  ['#00f5d4', '#ffc300'],
  ['#38b000', '#f15bb5'],
  ['#00bbf9', '#ff7000'],
  ['#e0aaff', '#38b000']
];

const SettingsTab = ({ settings, setSettings, dismissSampleMode, adsEnabled }) => {
  const [showArl, setShowArl] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const [authGradient] = useState(() => {
    const palette = DUAL_GRADIENT_PALETTE[Math.floor(Math.random() * DUAL_GRADIENT_PALETTE.length)];
    return `linear-gradient(90deg, ${palette[0]}, ${palette[1]})`;
  });

  const sliderGradients = useMemo(() => {
    const keys = [
      'cardWidth', 'cardPadding', 'cardGap', 'cardFontSize', 'borderRadius',
      'cosmosSplitRatio', 'liveSyncLineGap', 'liveSyncFontSize', 'focusedSyncFontSize', 'focusedAdlibFontSize',
      'artistNameFontSize', 'bgPreemptionTime', 'artistTransitionTime', 'bgImageOpacity',
      'modalSplitRatio', 'modalPaddingY', 'modalFontSize', 'eqFadeOutTime',
      'translationOpacity', 'translationFontSize', 'translationTopPadding',
      'transliterationOpacity', 'transliterationFontSize', 'transliterationBottomPadding'
    ];
    
    const palettePool = [...DUAL_GRADIENT_PALETTE];
    
    for (let i = palettePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.sin(i * 9999) * 10000) % (i + 1);
      const positiveJ = Math.abs(j);
      [palettePool[i], palettePool[positiveJ]] = [palettePool[positiveJ], palettePool[i]];
    }

    const gradMap = {};
    let lastPair = null;

    keys.forEach((key, index) => {
      let candidatePair = palettePool[index % palettePool.length];
      if (lastPair && candidatePair[0] === lastPair[0] && candidatePair[1] === lastPair[1]) {
        const offsetIndex = (index + 1) % palettePool.length;
        candidatePair = palettePool[offsetIndex];
      }
      gradMap[key] = candidatePair;
      lastPair = candidatePair;
    });

    return gradMap;
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (dismissSampleMode) dismissSampleMode(); 
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? checked 
        : (type === 'color' || type === 'text' || type === 'password' ? value : Number(value))
    }));
  };

  const handleVerifyArl = async () => {
    if (!settings.deezerArl) {
      setVerifyResult('error');
      return;
    }
    
    setIsVerifying(true);
    setVerifyResult(null);
    
    try {
      const formData = new FormData();
      formData.append('session_id', `test_${Date.now()}`);
      formData.append('url', 'https://www.deezer.com/track/3135556');
      formData.append('arl_token', settings.deezerArl);
      formData.append('quality', '1');
      formData.append('action', 'stream');

      const response = await fetch('https://ytdownloader-jnt0.onrender.com/download-deezer', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        setVerifyResult('success');
      } else {
        setVerifyResult('error');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setVerifyResult('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePurgeAllData = () => {
    try {
      const rawLibrary = localStorage.getItem('songLibrary');
      const parsedLibrary = rawLibrary ? JSON.parse(rawLibrary) : [];
      const optimizedLibrary = parsedLibrary.map(song => {
        const optimizedSong = { ...song, lyrics: song.lyrics || "", syncData: song.syncData || [] };
        delete optimizedSong.artworkUrl30;
        delete optimizedSong.artworkUrl60;
        delete optimizedSong.trackCensoredName;
        delete optimizedSong.collectionCensoredName;
        delete optimizedSong.artistViewUrl;
        delete optimizedSong.trackViewUrl;
        return optimizedSong;
      });
      
      const exportData = { 
        library: optimizedLibrary, 
        settings: { ...settings } 
      };
      delete exportData.settings.deezerArl;

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `PlanetMusic_Purge_Backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Backup trigger failed before purge:", e);
    }

    localStorage.clear();
    localStorage.setItem('hasVisitedBefore', 'true');
    localStorage.setItem('isSampleVaultActive', 'false');
    
    if (window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('PlanetMusicDB');
      } catch (err) {
        console.error("Failed to delete IndexedDB:", err);
      }
    }

    window.location.href = '/';
  };

  const getSliderStyle = (key, progressPct) => {
    const [c1, c2] = sliderGradients[key] || ['#00f5d4', '#00bbf9'];
    return {
      backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`,
      '--progress': `${progressPct}%`
    };
  };

  return (
    <section className="view-section settings-tab-container">
      
      <div className="settings-grid">
        
        {/* DEEZER AUTHENTICATION BLOCK */}
        <div className="settings-card glass-panel deezer-auth-card" style={{ '--auth-gradient': authGradient }}>
          <h3>Deezer ARL Token (Optional)</h3>
          
          <div className="deezer-auth-instructions">
            <p>This token unlocks high-quality audio streams directly from Deezer. <strong>The Cosmos search works perfectly fine without it</strong>, but you need a valid ARL to actually play the Deezer audio sources. Without it, you can still manually paste YouTube links or load Local MP3s to stream your songs.</p>
            <p><strong>How to easily get an ARL:</strong><br/>1. Create a free account at Deezer.com in your web browser.<br/>2. Open your Browser's Developer Tools (F12) and go to the <strong>Application</strong> tab (or Storage tab).<br/>3. Expand <strong>Cookies</strong> on the sidebar, select the Deezer domain, and copy the value of the cookie named <code>arl</code>.</p>
            <p className="security-warning">🔒 <strong>Privacy & Security:</strong> Your token is stored entirely locally on your device. It is only sent to our secure backend proxy to fetch audio streams and is <strong>NEVER</strong> exported or shared when you backup your database to JSON.</p>
          </div>

          <div className="setting-item" style={{ marginBottom: 0, width: '100%' }}>
            <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
              <input
                type={showArl ? 'text' : 'password'}
                name="deezerArl"
                value={settings.deezerArl || ''}
                onChange={(e) => { 
                  handleChange(e); 
                  if (e.target.name === 'deezerArl') setVerifyResult(null); 
                }}
                placeholder="Paste Deezer ARL token here..."
                style={{ 
                  flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '8px', height: '44px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white', outline: 'none', fontSize: '14px' 
                }}
              />
              <button
                type="button"
                onClick={() => setShowArl(!showArl)}
                style={{ 
                  padding: '0 16px', height: '44px', background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
                  color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 
                }}
                title={showArl ? "Hide Token" : "Show Token"}
              >
                {showArl ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            
            <button 
              type="button" 
              className="verify-arl-btn" 
              onClick={handleVerifyArl}
              disabled={isVerifying || !settings.deezerArl}
            >
              {isVerifying ? 'Testing Connection...' : 'Test Connection'}
            </button>
            
            {verifyResult === 'success' && <div style={{color: '#4ade80', fontSize: '13px', marginTop: '8px', textAlign: 'left'}}>✓ Token is valid and streaming works!</div>}
            {verifyResult === 'error' && <div style={{color: '#FA243C', fontSize: '13px', marginTop: '8px', textAlign: 'left'}}>✕ Invalid token or streaming proxy failed</div>}
          </div>
        </div>

        {/* DECOUPLED GROUP: DATA STORAGE & MEMORY */}
        <div className="settings-card glass-panel purge-card">
          <h3>Data Storage & Memory</h3>
          
          <div className="setting-item toggle-item">
            <label>
              Persistent Memory 
              <span className="setting-desc">Automatically save song library, lyrics, synced timings, and visual settings to browser local storage.</span>
            </label>
            <input 
              type="checkbox" 
              name="persistentMemory" 
              checked={settings.persistentMemory} 
              onChange={handleChange} 
            />
          </div>

          <div className="group-divider"></div>

          <div className="purge-warning-box">
            <h4>Clear Vault Data</h4>
            <p>Completely purges all saved tracks, sample songs, cached audio files, custom lyrics, and user preferences from this browser.</p>
            <p className="auto-backup-note">💾 <strong>Automatic Backup:</strong> Clicking purge will automatically download a backup file before erasing data.</p>
            
            <button 
              className="purge-action-btn"
              onClick={() => setShowPurgeConfirm(true)}
            >
              Purge All Data
            </button>
          </div>
        </div>

        {/* GROUP 1: CARD & DASHBOARD CANVAS */}
        <div className="settings-card glass-panel">
          <h3>Canvas & Card Layout</h3>
          
          <div className="setting-item">
            <label>Cosmos Search Split ({settings.cosmosSplitRatio ?? 60}% Cosmos)</label>
            <input 
              type="range" 
              name="cosmosSplitRatio" 
              min="20" 
              max="80" 
              value={settings.cosmosSplitRatio ?? 60} 
              onChange={handleChange}
              style={getSliderStyle('cosmosSplitRatio', (((settings.cosmosSplitRatio ?? 60) - 20) / 60) * 100)}
            />
            <span className="setting-desc">Percentage of horizontal screen width occupied by the Cosmos search column.</span>
          </div>

          <div className="setting-item">
            <label>Card Width ({settings.cardWidth}vw)</label>
            <input 
              type="range" 
              name="cardWidth" 
              min="5" 
              max="40" 
              step="0.5"
              value={settings.cardWidth} 
              onChange={handleChange}
              style={getSliderStyle('cardWidth', ((settings.cardWidth - 5) / 35) * 100)}
            />
            <span className="setting-desc">Sets the exact horizontal width of track cards in viewport width (vw).</span>
          </div>

          <div className="setting-item">
            <label>Horizontal Card Padding ({settings.cardPadding}px)</label>
            <input 
              type="range" 
              name="cardPadding" 
              min="8" 
              max="40" 
              value={settings.cardPadding} 
              onChange={handleChange}
              style={getSliderStyle('cardPadding', ((settings.cardPadding - 8) / 32) * 100)}
            />
            <span className="setting-desc">Controls inner padding inside each song card.</span>
          </div>

          <div className="setting-item">
            <label>Grid Gap ({settings.cardGap}px)</label>
            <input 
              type="range" 
              name="cardGap" 
              min="8" 
              max="64" 
              value={settings.cardGap} 
              onChange={handleChange}
              style={getSliderStyle('cardGap', ((settings.cardGap - 8) / 56) * 100)}
            />
            <span className="setting-desc">Adjusts spacing between cards across the dashboard layout.</span>
          </div>

          <div className="setting-item">
            <label>Card Title Scale ({settings.cardFontSize}vh)</label>
            <input 
              type="range" 
              name="cardFontSize" 
              min="0.5" 
              max="5.0" 
              step="0.1"
              value={settings.cardFontSize} 
              onChange={handleChange}
              style={getSliderStyle('cardFontSize', ((settings.cardFontSize - 0.5) / 4.5) * 100)}
            />
            <span className="setting-desc">Scales song title text sizing relative to viewport height.</span>
          </div>

        </div>

        {/* GROUP 2: LYRICS CANVAS */}
        <div className="settings-card glass-panel">
          <h3>Lyrics Canvas</h3>

          <div className="sub-group-title">Live View</div>
          <div className="setting-item">
            <label>Line Gap ({settings.liveSyncLineGap ?? 16}px)</label>
            <input 
              type="range" 
              name="liveSyncLineGap" 
              min="4" 
              max="100" 
              step="1"
              value={settings.liveSyncLineGap ?? 16} 
              onChange={handleChange}
              style={getSliderStyle('liveSyncLineGap', (((settings.liveSyncLineGap ?? 16) - 4) / 96) * 100)}
            />
            <span className="setting-desc">Vertical spacing separating consecutive lyric lines in Live View.</span>
          </div>

          <div className="setting-item">
            <label>Line Size ({settings.liveSyncFontSize}vh)</label>
            <input 
              type="range" 
              name="liveSyncFontSize" 
              min="1.0" 
              max="12.0" 
              step="0.1"
              value={settings.liveSyncFontSize} 
              onChange={handleChange}
              style={getSliderStyle('liveSyncFontSize', ((settings.liveSyncFontSize - 1.0) / 11.0) * 100)}
            />
            <span className="setting-desc">Overall font scale for active and upcoming lyric lines in Live View.</span>
          </div>

          <div className="group-divider"></div>

          <div className="sub-group-title">Focus View</div>
          <div className="setting-item">
            <label>Line Size ({settings.focusedSyncFontSize}vh)</label>
            <input 
              type="range" 
              name="focusedSyncFontSize" 
              min="2.0" 
              max="15.0" 
              step="0.1"
              value={settings.focusedSyncFontSize} 
              onChange={handleChange}
              style={getSliderStyle('focusedSyncFontSize', ((settings.focusedSyncFontSize - 2.0) / 13.0) * 100)}
            />
            <span className="setting-desc">Font scale for the centered main lyric line in Focused View.</span>
          </div>

          <div className="setting-item">
            <label>Ad-Lib Size ({settings.focusedAdlibFontSize ?? 3.5}vh)</label>
            <input 
              type="range" 
              name="focusedAdlibFontSize" 
              min="1.0" 
              max="10.0" 
              step="0.1"
              value={settings.focusedAdlibFontSize ?? 3.5} 
              onChange={handleChange}
              style={getSliderStyle('focusedAdlibFontSize', (((settings.focusedAdlibFontSize ?? 3.5) - 1.0) / 9.0) * 100)}
            />
            <span className="setting-desc">Controls canvas proportion of floating ad-libs in Focused View.</span>
          </div>
        </div>

        {/* GROUP 3: GENERAL ARTIST DISPLAY */}
        <div className="settings-card glass-panel">
          <h3>Artist Display</h3>
          
          <div className="setting-item">
            <label>Artist Name Size ({settings.artistNameFontSize ?? 3.5}vh)</label>
            <input 
              type="range" 
              name="artistNameFontSize" 
              min="1.0" 
              max="10.0" 
              step="0.1"
              value={settings.artistNameFontSize ?? 3.5} 
              onChange={handleChange}
              style={getSliderStyle('artistNameFontSize', (((settings.artistNameFontSize ?? 3.5) - 1.0) / 9.0) * 100)}
            />
            <span className="setting-desc">Controls text size of floating artist names at the bottom right corner.</span>
          </div>

          <div className="setting-item">
            <label>Image Anticipation Time ({settings.bgPreemptionTime}ms)</label>
            <input 
              type="range" 
              name="bgPreemptionTime" 
              min="0" 
              max="2000" 
              step="50"
              value={settings.bgPreemptionTime} 
              onChange={handleChange}
              style={getSliderStyle('bgPreemptionTime', (settings.bgPreemptionTime / 2000) * 100)}
            />
            <span className="setting-desc">How early the artist image begins appearing before their line plays.</span>
          </div>

          <div className="setting-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="transitionSlider" style={{ marginBottom: 0 }}>Artist Transition Timing</label>
              <span id="transitionValueDisplay" className="value-badge" style={{ color: (sliderGradients['artistTransitionTime'] || ['#ffc300'])[0] }}>
                {localStorage.getItem('artistTransitionTime') || 0}ms
              </span>
            </div>
            
            <input 
              id="transitionSlider"
              type="range" 
              min="0" 
              max="1000" 
              step="10"
              defaultValue={localStorage.getItem('artistTransitionTime') || 0}
              onChange={(e) => {
                if (dismissSampleMode) dismissSampleMode();
                const val = parseInt(e.target.value, 10);
                localStorage.setItem('artistTransitionTime', val);
                document.getElementById('transitionValueDisplay').innerText = `${val}ms`;
                e.target.style.setProperty('--progress', `${(val / 1000) * 100}%`);
                window.dispatchEvent(new CustomEvent('updateTransitionTime', { detail: val }));
              }}
              style={getSliderStyle('artistTransitionTime', (parseInt(localStorage.getItem('artistTransitionTime') || 0) / 1000) * 100)}
            />
            <span className="setting-desc">Adjusts fade duration gap between singer changes (0ms = instant).</span>
          </div>

          <div className="setting-item">
            <label>Background Image Opacity ({Math.round((settings.bgImageOpacity ?? 0.25) * 100)}%)</label>
            <input 
              type="range" 
              name="bgImageOpacity" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.bgImageOpacity ?? 0.25} 
              onChange={handleChange}
              style={getSliderStyle('bgImageOpacity', (settings.bgImageOpacity ?? 0.25) * 100)}
            />
            <span className="setting-desc">Transparency level of artist background photos behind lyrics.</span>
          </div>
        </div>

        {/* GROUP 4: MODAL & SYSTEM BEHAVIOR */}
        <div className="settings-card glass-panel">
          <h3>Modal & System Dynamics</h3>

          <div className="setting-item">
            <label>Modal Layout Split ({settings.modalSplitRatio}% Left)</label>
            <input 
              type="range" 
              name="modalSplitRatio" 
              min="20" 
              max="80" 
              value={settings.modalSplitRatio} 
              onChange={handleChange}
              style={getSliderStyle('modalSplitRatio', ((settings.modalSplitRatio - 20) / 60) * 100)}
            />
            <span className="setting-desc">Proportional width split between metadata column and lyrics area.</span>
          </div>

          <div className="setting-item">
            <label>Modal Vertical Padding ({settings.modalPaddingY}vh)</label>
            <input 
              type="range" 
              name="modalPaddingY" 
              min="0" 
              max="25" 
              value={settings.modalPaddingY} 
              onChange={handleChange}
              style={getSliderStyle('modalPaddingY', (settings.modalPaddingY / 25) * 100)}
            />
            <span className="setting-desc">Top and bottom margin spacing surrounding song overlay window.</span>
          </div>

          <div className="setting-item">
            <label>Modal Title Scale ({settings.modalFontSize}vh)</label>
            <input 
              type="range" 
              name="modalFontSize" 
              min="2.0" 
              max="10.0" 
              step="0.1"
              value={settings.modalFontSize} 
              onChange={handleChange}
              style={getSliderStyle('modalFontSize', ((settings.modalFontSize - 2.0) / 8.0) * 100)}
            />
            <span className="setting-desc">Font size scaling for main song title in left metadata panel.</span>
          </div>

          <div className="setting-item">
            <label>Equalizer Fade-Out Time ({settings.eqFadeOutTime}ms)</label>
            <input 
              type="range" 
              name="eqFadeOutTime" 
              min="100" 
              max="2000" 
              step="100"
              value={settings.eqFadeOutTime} 
              onChange={handleChange}
              style={getSliderStyle('eqFadeOutTime', ((settings.eqFadeOutTime - 100) / 1900) * 100)}
            />
            <span className="setting-desc">How smoothly equalizer visualizer bars fall when music pauses.</span>
          </div>
        </div>

        {/* GROUP 5: TRANSLATION & TRANSLITERATION */}
        <div className="settings-card glass-panel">
          <h3>Translation & Transliteration</h3>

          <div className="sub-group-title">Translation</div>
          <div className="setting-item">
            <label>Translation Color</label>
            <div className="color-picker-row">
              <input 
                type="color" 
                name="translationColor" 
                value={settings.translationColor || '#ffffff'} 
                onChange={handleChange} 
                className="color-picker-input"
              />
              <span className="color-preview-value">{settings.translationColor || '#ffffff'}</span>
            </div>
            <span className="setting-desc">Default color for translated text lines above lyrics.</span>
          </div>

          <div className="setting-item">
            <label>Translation Opacity ({Math.round((settings.translationOpacity ?? 0.9) * 100)}%)</label>
            <input 
              type="range" 
              name="translationOpacity" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.translationOpacity ?? 0.9} 
              onChange={handleChange}
              style={getSliderStyle('translationOpacity', (settings.translationOpacity ?? 0.9) * 100)}
            />
            <span className="setting-desc">Opacity level applied to translated text lines.</span>
          </div>

          <div className="setting-item">
            <label>Translation Font Scale ({settings.translationFontSize ?? 0.55}em)</label>
            <input 
              type="range" 
              name="translationFontSize" 
              min="0.3" 
              max="1.0" 
              step="0.05"
              value={settings.translationFontSize ?? 0.55} 
              onChange={handleChange}
              style={getSliderStyle('translationFontSize', (((settings.translationFontSize ?? 0.55) - 0.3) / 0.7) * 100)}
            />
            <span className="setting-desc">Font size ratio of translated text relative to main lyrics.</span>
          </div>

          <div className="setting-item">
            <label>Translation Top Padding ({settings.translationTopPadding ?? 8}px)</label>
            <input 
              type="range" 
              name="translationTopPadding" 
              min="0" 
              max="30" 
              step="1"
              value={settings.translationTopPadding ?? 8} 
              onChange={handleChange}
              style={getSliderStyle('translationTopPadding', ((settings.translationTopPadding ?? 8) / 30) * 100)}
            />
            <span className="setting-desc">Distance floating translation text sits above main lyric line.</span>
          </div>

          <div className="group-divider"></div>

          <div className="sub-group-title">Transliteration</div>
          <div className="setting-item">
            <label>Transliteration Color</label>
            <div className="color-picker-row">
              <input 
                type="color" 
                name="transliterationColor" 
                value={settings.transliterationColor || '#ffffff'} 
                onChange={handleChange} 
                className="color-picker-input"
              />
              <span className="color-preview-value">{settings.transliterationColor || '#ffffff'}</span>
            </div>
            <span className="setting-desc">Default color for Romanized phonetic pronunciation guide text.</span>
          </div>

          <div className="setting-item">
            <label>Transliteration Opacity ({Math.round((settings.transliterationOpacity ?? 0.8) * 100)}%)</label>
            <input 
              type="range" 
              name="transliterationOpacity" 
              min="0" 
              max="1" 
              step="0.05"
              value={settings.transliterationOpacity ?? 0.8} 
              onChange={handleChange}
              style={getSliderStyle('transliterationOpacity', (settings.transliterationOpacity ?? 0.8) * 100)}
            />
            <span className="setting-desc">Opacity level applied to transliteration text lines.</span>
          </div>

          <div className="setting-item">
            <label>Transliteration Font Scale ({settings.transliterationFontSize ?? 0.55}em)</label>
            <input 
              type="range" 
              name="transliterationFontSize" 
              min="0.3" 
              max="1.0" 
              step="0.05"
              value={settings.transliterationFontSize ?? 0.55} 
              onChange={handleChange}
              style={getSliderStyle('transliterationFontSize', (((settings.transliterationFontSize ?? 0.55) - 0.3) / 0.7) * 100)}
            />
            <span className="setting-desc">Font size ratio of pronunciation guide relative to main lyrics.</span>
          </div>

          <div className="setting-item">
            <label>Transliteration Bottom Padding ({settings.transliterationBottomPadding ?? 4}px)</label>
            <input 
              type="range" 
              name="transliterationBottomPadding" 
              min="0" 
              max="30" 
              step="1"
              value={settings.transliterationBottomPadding ?? 4} 
              onChange={handleChange}
              style={getSliderStyle('transliterationBottomPadding', ((settings.transliterationBottomPadding ?? 4) / 30) * 100)}
            />
            <span className="setting-desc">Distance transliteration text sits below main lyric line.</span>
          </div>

        </div>

      </div>

      {/* --- SETTINGS TAB NATIVE AD --- */}
      {adsEnabled && (
        <SponsorUnit 
          testMode={true} 
          className="glass-panel settings-promo-box" 
          style={{ maxWidth: '1400px', margin: '0 auto' }}
          adTitle="Sponsor / Partner"
          adSub="Thank you for supporting PlanetMusic"
        />
      )}

      {/* CONFIRMATION PURGE MODAL OVERLAY */}
      {showPurgeConfirm && (
        <div className="confirm-overlay" onClick={() => setShowPurgeConfirm(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Purge Vault Data?</h3>
            <p>
              Are you sure you want to clear your local Vault? This will permanently erase all saved tracks, custom lyrics, and audio cache from this browser.
              <br/><br/>
              An <strong>automatic backup JSON file</strong> will download immediately before purging so you never lose your work.
            </p>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={() => setShowPurgeConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-btn delete" onClick={handlePurgeAllData}>
                Backup & Purge
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default SettingsTab;