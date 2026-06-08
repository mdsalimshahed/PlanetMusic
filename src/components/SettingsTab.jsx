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
            <input type="range" name="cardWidth" min="120" max="400" value={settings.cardWidth} onChange={handleChange} />
          </div>
          <div className="setting-item">
            <label>Horizontal Card Padding ({settings.cardPadding}px)</label>
            <input type="range" name="cardPadding" min="8" max="40" value={settings.cardPadding} onChange={handleChange} />
          </div>
          <div className="setting-item">
            <label>Grid Gap ({settings.cardGap}px)</label>
            <input type="range" name="cardGap" min="8" max="64" value={settings.cardGap} onChange={handleChange} />
          </div>
        </div>

        <div className="settings-card glass-panel">
          <h3>Visuals & Styling</h3>
          <div className="setting-item">
            <label>Background Image Opacity ({Math.round((settings.bgImageOpacity ?? 0.25) * 100)}%)</label>
            <input type="range" name="bgImageOpacity" min="0" max="1" step="0.05" value={settings.bgImageOpacity ?? 0.25} onChange={handleChange} />
          </div>
          <div className="setting-item">
            <label>Card Title Font Size ({settings.cardFontSize}px)</label>
            <input type="range" name="cardFontSize" min="10" max="32" value={settings.cardFontSize} onChange={handleChange} />
          </div>
          <div className="setting-item">
            <label>Modal Title Font Size ({settings.modalFontSize}px)</label>
            <input type="range" name="modalFontSize" min="24" max="80" value={settings.modalFontSize} onChange={handleChange} />
          </div>
          <div className="setting-item">
            <label>Live Sync Active Line Size ({settings.liveSyncFontSize}px)</label>
            <input type="range" name="liveSyncFontSize" min="16" max="64" value={settings.liveSyncFontSize} onChange={handleChange} />
          </div>
          <div className="setting-item">
            <label>Focused View Line Size ({settings.focusedSyncFontSize}px)</label>
            <input type="range" name="focusedSyncFontSize" min="24" max="80" value={settings.focusedSyncFontSize} onChange={handleChange} />
          </div>
          <div className="setting-item toggle-item">
            <label>Enable Rounded Corners</label>
            <input type="checkbox" name="isRounded" checked={settings.isRounded} onChange={handleChange} />
          </div>
          {settings.isRounded && (
            <div className="setting-item">
              <label>Border Radius Intensity ({settings.borderRadius}px)</label>
              <input type="range" name="borderRadius" min="4" max="50" value={settings.borderRadius} onChange={handleChange} />
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