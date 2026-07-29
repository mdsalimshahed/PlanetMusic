/* --- src/components/SettingsTab.jsx --- */
import React from 'react';
import './SettingsTab.css';

const SettingsTab = ({ settings, setSettings }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value)
    }));
  };

  return (
    <section className="view-section settings-tab-container">
      <h3 className="section-title text-glow">System Preferences</h3>
      
      <div className="settings-grid">
        <div className="settings-card glass-panel">
          <h3>Layout & Sizing</h3>
          <div className="setting-item">
            <label>Horizontal Card Width ({settings.cardWidth}px)</label>
            <input type="range" name="cardWidth" min="120" max="400" value={settings.cardWidth} onChange={handleChange} style={{'--progress': `${((settings.cardWidth - 120) / 280) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Horizontal Card Padding ({settings.cardPadding}px)</label>
            <input type="range" name="cardPadding" min="8" max="40" value={settings.cardPadding} onChange={handleChange} style={{'--progress': `${((settings.cardPadding - 8) / 32) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Grid Gap ({settings.cardGap}px)</label>
            <input type="range" name="cardGap" min="8" max="64" value={settings.cardGap} onChange={handleChange} style={{'--progress': `${((settings.cardGap - 8) / 56) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Modal Layout Split ({settings.modalSplitRatio}% Left)</label>
            <input type="range" name="modalSplitRatio" min="20" max="80" value={settings.modalSplitRatio} onChange={handleChange} style={{'--progress': `${((settings.modalSplitRatio - 20) / 60) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Modal Vertical Padding ({settings.modalPaddingY}vh)</label>
            <input type="range" name="modalPaddingY" min="0" max="25" value={settings.modalPaddingY} onChange={handleChange} style={{'--progress': `${(settings.modalPaddingY / 25) * 100}%`}} />
          </div>
        </div>

        <div className="settings-card glass-panel">
          <h3>Visuals & Styling</h3>
          <div className="setting-item">
            <label>Image Anticipation Time ({settings.bgPreemptionTime}ms)</label>
            <input type="range" name="bgPreemptionTime" min="0" max="2000" step="50" value={settings.bgPreemptionTime} onChange={handleChange} style={{'--progress': `${(settings.bgPreemptionTime / 2000) * 100}%`}} />
            <span className="setting-desc" style={{ marginTop: '8px' }}>
              How early the artist image begins appearing before their line begins.
            </span>
          </div>
          <div className="setting-item">
            <label>Equalizer Fade-Out Time ({settings.eqFadeOutTime}ms)</label>
            <input type="range" name="eqFadeOutTime" min="100" max="2000" step="100" value={settings.eqFadeOutTime} onChange={handleChange} style={{'--progress': `${((settings.eqFadeOutTime - 100) / 1900) * 100}%`}} />
            <span className="setting-desc" style={{ marginTop: '8px' }}>
              How smoothly the equalizer bars fall down when playback is paused.
            </span>
          </div>
          <div className="setting-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label htmlFor="transitionSlider" style={{ marginBottom: 0 }}>Artist Transition Timing</label>
              <span id="transitionValueDisplay" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--accent)' }}>
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
                
                // Update display and progress
                document.getElementById('transitionValueDisplay').innerText = `${val}ms`;
                e.target.style.setProperty('--progress', `${(val / 1000) * 100}%`);
                
                // Dispatch global event for live updates
                window.dispatchEvent(new CustomEvent('updateTransitionTime', { detail: val }));
              }}
              style={{
                '--progress': `${(parseInt(localStorage.getItem('artistTransitionTime') || 0) / 1000) * 100}%`
              }}
            />
            <span className="setting-desc" style={{ marginTop: '8px' }}>
              Lower is snappier (0ms = instant). Adjusts the fade gap between singer changes.
            </span>
          </div>
          <div className="setting-item">
            <label>Background Image Opacity ({Math.round((settings.bgImageOpacity ?? 0.25) * 100)}%)</label>
            <input type="range" name="bgImageOpacity" min="0" max="1" step="0.05" value={settings.bgImageOpacity ?? 0.25} onChange={handleChange} style={{'--progress': `${(settings.bgImageOpacity ?? 0.25) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Card Title Font Size ({settings.cardFontSize}px)</label>
            <input type="range" name="cardFontSize" min="10" max="32" value={settings.cardFontSize} onChange={handleChange} style={{'--progress': `${((settings.cardFontSize - 10) / 22) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Modal Title Font Size ({settings.modalFontSize}px)</label>
            <input type="range" name="modalFontSize" min="24" max="80" value={settings.modalFontSize} onChange={handleChange} style={{'--progress': `${((settings.modalFontSize - 24) / 56) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Live Sync Active Line Size ({settings.liveSyncFontSize}px)</label>
            <input type="range" name="liveSyncFontSize" min="16" max="64" value={settings.liveSyncFontSize} onChange={handleChange} style={{'--progress': `${((settings.liveSyncFontSize - 16) / 48) * 100}%`}} />
          </div>
          <div className="setting-item">
            <label>Focused View Line Size ({settings.focusedSyncFontSize}px)</label>
            <input type="range" name="focusedSyncFontSize" min="24" max="80" value={settings.focusedSyncFontSize} onChange={handleChange} style={{'--progress': `${((settings.focusedSyncFontSize - 24) / 56) * 100}%`}} />
          </div>
          
          <div className="setting-item toggle-item">
            <label>Enable Rounded Corners</label>
            <input type="checkbox" name="isRounded" checked={settings.isRounded} onChange={handleChange} />
          </div>
          {settings.isRounded && (
            <div className="setting-item">
              <label>Border Radius Intensity ({settings.borderRadius}px)</label>
              <input type="range" name="borderRadius" min="4" max="50" value={settings.borderRadius} onChange={handleChange} style={{'--progress': `${((settings.borderRadius - 4) / 46) * 100}%`}} />
            </div>
          )}
        </div>

        {/* NEW CARD: Lyrics Styling & Padding */}
        <div className="settings-card glass-panel">
          <h3>Lyrics Styling & Padding</h3>
          <div className="setting-item">
            <label>Live Sync Line Gap ({settings.liveSyncLineGap ?? 16}px)</label>
            <input 
               type="range" 
               name="liveSyncLineGap" 
               min="4" 
               max="100" 
               step="1" 
               value={settings.liveSyncLineGap ?? 16} 
               onChange={handleChange} 
               style={{'--progress': `${(((settings.liveSyncLineGap ?? 16) - 4) / 96) * 100}%`}} 
             />
            <span className="setting-desc" style={{ marginTop: '8px' }}>
              Adjusts vertical spacing between lines in the Live Sync view.
            </span>
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
               style={{'--progress': `${((settings.translationTopPadding ?? 8) / 30) * 100}%`}} 
             />
            <span className="setting-desc" style={{ marginTop: '8px' }}>
              Distance floating translation text sits above the main lyrics line.
            </span>
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
               style={{'--progress': `${((settings.transliterationBottomPadding ?? 4) / 30) * 100}%`}} 
             />
            <span className="setting-desc" style={{ marginTop: '8px' }}>
              Distance transliteration text sits below the main lyrics line.
            </span>
          </div>
          <div className="setting-item">
            <label>Translation Font Size ({settings.translationFontSize ?? 0.55}em)</label>
            <input 
               type="range" 
               name="translationFontSize" 
               min="0.3" 
               max="1.0" 
               step="0.05" 
               value={settings.translationFontSize ?? 0.55} 
               onChange={handleChange} 
               style={{'--progress': `${(((settings.translationFontSize ?? 0.55) - 0.3) / 0.7) * 100}%`}} 
             />
          </div>
          <div className="setting-item">
            <label>Transliteration Font Size ({settings.transliterationFontSize ?? 0.55}em)</label>
            <input 
               type="range" 
               name="transliterationFontSize" 
               min="0.3" 
               max="1.0" 
               step="0.05" 
               value={settings.transliterationFontSize ?? 0.55} 
               onChange={handleChange} 
               style={{'--progress': `${(((settings.transliterationFontSize ?? 0.55) - 0.3) / 0.7) * 100}%`}} 
             />
          </div>
        </div>

        <div className="settings-card glass-panel">
          <h3>System Behavior</h3>
          <div className="setting-item toggle-item">
            <label>
              Persistent Memory 
              <span className="setting-desc">Automatically save library and settings to local storage</span>
            </label>
            <input type="checkbox" name="persistentMemory" checked={settings.persistentMemory} onChange={handleChange} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SettingsTab;