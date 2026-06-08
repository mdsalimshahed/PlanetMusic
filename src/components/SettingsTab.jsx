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
        {/* Layout & Sizing */}
        <div className="settings-card glass-panel">
          <h3>Layout & Sizing</h3>
          
          <div className="setting-item">
            <label>Horizontal Card Width ({settings.cardWidth}px)</label>
            <input type="range" name="cardWidth" min="120" max="400" value={settings.cardWidth} onChange={handleChange} />
          </div>

          <div className="setting-item">
            <label>Vertical Card Height ({settings.cardHeight}px)</label>
            <input type="range" name="cardHeight" min="200" max="600" value={settings.cardHeight} onChange={handleChange} />
          </div>

          <div className="setting-item">
            <label>Horizontal Card Padding ({settings.cardPaddingX}px)</label>
            <input type="range" name="cardPaddingX" min="8" max="40" value={settings.cardPaddingX} onChange={handleChange} />
          </div>

          <div className="setting-item">
            <label>Vertical Card Padding ({settings.cardPaddingY}px)</label>
            <input type="range" name="cardPaddingY" min="8" max="40" value={settings.cardPaddingY} onChange={handleChange} />
          </div>

          <div className="setting-item">
            <label>Horizontal Grid Gap ({settings.cardGapX}px)</label>
            <input type="range" name="cardGapX" min="8" max="64" value={settings.cardGapX} onChange={handleChange} />
          </div>

          <div className="setting-item">
            <label>Vertical Grid Gap ({settings.cardGapY}px)</label>
            <input type="range" name="cardGapY" min="8" max="64" value={settings.cardGapY} onChange={handleChange} />
          </div>
        </div>

        {/* Typography & Aesthetics */}
        <div className="settings-card glass-panel">
          <h3>Typography & Styling</h3>
          
          <div className="setting-item">
            <label>Card Title Font Size ({settings.cardFontSize}px)</label>
            <input type="range" name="cardFontSize" min="10" max="32" value={settings.cardFontSize} onChange={handleChange} />
          </div>

          <div className="setting-item">
            <label>Modal Title Font Size ({settings.modalFontSize}px)</label>
            <input type="range" name="modalFontSize" min="24" max="80" value={settings.modalFontSize} onChange={handleChange} />
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

        {/* System */}
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