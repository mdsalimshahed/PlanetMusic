/* --- src/components/Settings/TranslationSettings.jsx --- */
import React from 'react';
import SettingSlider from './SettingSlider';

const TranslationSettings = ({ settings, handleChange, getSliderStyle }) => (
  <div className="settings-card glass-panel">
    <h3>Translation & Transliteration</h3>
    
    <h4 className="sub-group-title">Native Translation</h4>
    <div className="setting-item color-picker-row" style={{ flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <label style={{ margin: 0 }}>Translation Text Color</label>
        <span className="setting-desc" style={{ marginTop: '2px', textAlign: 'left' }}>Sets the exact color overlay for translated text.</span>
      </div>
      <span className="color-preview-value">{settings.translationColor}</span>
      <input type="color" name="translationColor" value={settings.translationColor} onChange={handleChange} className="color-picker-input" />
    </div>
    <SettingSlider 
      label="Translation Opacity" 
      description="Controls the transparency of the translated text."
      name="translationOpacity" value={settings.translationOpacity} min={0} max={1} step={0.05} 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Translation Font Size" 
      description="Scales the translated text relative to the size of the main lyrics."
      name="translationFontSize" value={settings.translationFontSize} min={0.3} max={1.5} step={0.05} unit="em" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Translation Spacing (Top)" 
      description="Adjusts the vertical distance pushing the translation above the main lyric."
      name="translationTopPadding" value={settings.translationTopPadding ?? 8} min={0} max={40} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    
    <div className="group-divider" />
    
    <h4 className="sub-group-title">Phonetic Transliteration</h4>
    <div className="setting-item color-picker-row" style={{ flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <label style={{ margin: 0 }}>Transliteration Text Color</label>
        <span className="setting-desc" style={{ marginTop: '2px', textAlign: 'left' }}>Sets the color overlay for Romaji, Pinyin, and other phonetics.</span>
      </div>
      <span className="color-preview-value">{settings.transliterationColor}</span>
      <input type="color" name="transliterationColor" value={settings.transliterationColor} onChange={handleChange} className="color-picker-input" />
    </div>
    <SettingSlider 
      label="Transliteration Opacity" 
      description="Controls the transparency of the phonetic pronunciation text."
      name="transliterationOpacity" value={settings.transliterationOpacity} min={0} max={1} step={0.05} 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Transliteration Font Size" 
      description="Scales the phonetic text relative to the size of the main lyrics."
      name="transliterationFontSize" value={settings.transliterationFontSize} min={0.3} max={1.5} step={0.05} unit="em" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Transliteration Spacing (Bottom)" 
      description="Adjusts the vertical distance pushing the phonetics below the main lyric."
      name="transliterationBottomPadding" value={settings.transliterationBottomPadding ?? 4} min={0} max={40} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
  </div>
);

export default TranslationSettings;