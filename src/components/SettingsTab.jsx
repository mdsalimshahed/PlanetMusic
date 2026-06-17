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
        </div>

        <div className="settings-card glass-panel">
          <h3>Visuals & Styling</h3>

          {/* --- ARTIST TRANSITION TIMING SLIDER --- */}
          <div className="setting-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label htmlFor="transitionSlider" style={{ marginBottom: 0 }}>Artist Transition Timing</label>
              <span id="transitionValueDisplay" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--accent)' }}>
                {localStorage.getItem('artistTransitionTime') || 150}ms
              </span>
            </div>
            <input 
              id="transitionSlider"
              type="range" 
              min="0" 
              max="1000" 
              step="10" 
              defaultValue={localStorage.getItem('artistTransitionTime') || 150}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                localStorage.setItem('artistTransitionTime', val);
                
                document.getElementById('transitionValueDisplay').innerText = `${val}ms`;
                e.target.style.setProperty('--progress', `${(val / 1000) * 100}%`);
                
                window.dispatchEvent(new CustomEvent('updateTransitionTime', { detail: val }));
              }}
              style={{
                '--progress': `${(parseInt(localStorage.getItem('artistTransitionTime') || 150) / 1000) * 100}%`
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