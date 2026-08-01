/* --- src/components/SettingsTab.jsx --- */
import React, { useMemo } from 'react';
import './SettingsTab.css';

const DUAL_GRADIENT_PALETTE = [
  ['#00f5d4', '#00bbf9'], // Cyan -> Blue
  ['#38b000', '#00f5d4'], // Green -> Cyan
  ['#ffc300', '#ff7000'], // Gold -> Orange
  ['#ff7000', '#f15bb5'], // Orange -> Pink
  ['#f15bb5', '#e0aaff'], // Pink -> Lavender
  ['#00bbf9', '#e0aaff'], // Blue -> Lavender
  ['#e0aaff', '#ff99c8'], // Lavender -> Rose
  ['#ff99c8', '#ffc300'], // Rose -> Gold
  ['#00f5d4', '#ffc300'], // Cyan -> Gold
  ['#38b000', '#f15bb5'], // Green -> Pink
  ['#00bbf9', '#ff7000'], // Blue -> Orange
  ['#e0aaff', '#38b000']  // Lavender -> Green
];

const SettingsTab = ({ settings, setSettings }) => {
  // Generate distinct dual-color gradient pairs ensuring NO consecutive sliders share the same colors
  const sliderGradients = useMemo(() => {
    const keys = [
      'cardWidth', 'cardPadding', 'cardGap', 'cardFontSize', 'borderRadius',
      'liveSyncLineGap', 'liveSyncFontSize', 'focusedSyncFontSize', 'focusedAdlibFontSize',
      'artistNameFontSize', 'bgPreemptionTime', 'artistTransitionTime', 'bgImageOpacity',
      'modalSplitRatio', 'modalPaddingY', 'modalFontSize', 'eqFadeOutTime',
      'translationOpacity', 'translationFontSize', 'translationTopPadding',
      'transliterationOpacity', 'transliterationFontSize', 'transliterationBottomPadding'
    ];
    
    // Copy palette to avoid mutating constant
    const palettePool = [...DUAL_GRADIENT_PALETTE];
    
    // Simple deterministic shuffle on mount
    for (let i = palettePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.sin(i * 9999) * 10000) % (i + 1);
      const positiveJ = Math.abs(j);
      [palettePool[i], palettePool[positiveJ]] = [palettePool[positiveJ], palettePool[i]];
    }

    const gradMap = {};
    let lastPair = null;

    keys.forEach((key, index) => {
      let candidatePair = palettePool[index % palettePool.length];
      
      // If candidate matches last assigned pair, offset to guarantee difference
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
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'color' || type === 'text' ? value : Number(value))
    }));
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
        
        {/* GROUP 1: CARD & DASHBOARD CANVAS */}
        <div className="settings-card glass-panel">
          <h3>Canvas & Card Layout</h3>
          
          <div className="setting-item">
            <label>Horizontal Card Width ({settings.cardWidth}%)</label>
            <input 
              type="range" 
              name="cardWidth" 
              min="10" 
              max="100" 
              step="5"
              value={settings.cardWidth} 
              onChange={handleChange}
              style={getSliderStyle('cardWidth', ((settings.cardWidth - 10) / 90) * 100)} 
            />
            <span className="setting-desc">Sets the maximum width of track cards in the masonry grid (100% = 1 col, 50% = 2 cols, 20% = 5 cols).</span>
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

          <div className="setting-item toggle-item">
            <label>
              Enable Rounded Corners
              <span className="setting-desc">Applies border radius to dashboard cards and panels</span>
            </label>
            <input 
              type="checkbox" 
              name="isRounded" 
              checked={settings.isRounded} 
              onChange={handleChange}
            />
          </div>

          {settings.isRounded && (
            <div className="setting-item">
              <label>Border Radius ({settings.borderRadius}px)</label>
              <input 
                type="range" 
                name="borderRadius" 
                min="4" 
                max="50" 
                value={settings.borderRadius} 
                onChange={handleChange}
                style={getSliderStyle('borderRadius', ((settings.borderRadius - 4) / 46) * 100)} 
              />
              <span className="setting-desc">Defines corner roundness for cards and container panels.</span>
            </div>
          )}
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

          <div className="setting-item toggle-item" style={{ marginTop: '12px' }}>
            <label>
              Persistent Memory 
              <span className="setting-desc">Automatically save library and settings to local storage</span>
            </label>
            <input 
              type="checkbox" 
              name="persistentMemory" 
              checked={settings.persistentMemory} 
              onChange={handleChange}
            />
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
    </section>
  );
};

export default SettingsTab;