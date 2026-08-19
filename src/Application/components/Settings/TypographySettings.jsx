/* --- src/components/Settings/TypographySettings.jsx --- */
import React from 'react';
import SettingSlider from './SettingSlider.jsx';

const TypographySettings = ({ settings, handleChange, getSliderStyle }) => (
  <div className="settings-card glass-panel">
    <h3>Lyrics View & Typography</h3>
    
    <h4 className="sub-group-title">Live Scrolling View</h4>
    <SettingSlider 
      label="Live Line Gap" 
      description="Adjusts the vertical space between lyric lines in Live View."
      name="liveSyncLineGap" value={settings.liveSyncLineGap ?? 16} min={0} max={60} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Live Font Size" 
      description="Sets the text size for lyrics in the scrolling Live View."
      name="liveSyncFontSize" value={settings.liveSyncFontSize} min={2} max={10} step={0.5} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    
    <div className="group-divider" />
    <h4 className="sub-group-title">Focused Space View</h4>
    <SettingSlider 
      label="Focused Main Font Size" 
      description="Sets the text size for the primary active lyric in Focused View."
      name="focusedSyncFontSize" value={settings.focusedSyncFontSize} min={3} max={12} step={0.5} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Floating Adlib Font Size" 
      description="Scales the size of background ad-lib text orbiting the main lyric."
      name="focusedAdlibFontSize" value={settings.focusedAdlibFontSize} min={1} max={8} step={0.5} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    
    <div className="group-divider" />
    <h4 className="sub-group-title">Watermarks & Visuals</h4>
    <SettingSlider 
      label="Background Watermark Opacity" 
      description="Controls the transparency of the artist images behind the lyrics."
      name="bgImageOpacity" value={settings.bgImageOpacity} min={0} max={1} step={0.05} 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Singer Tag Font Size" 
      description="Sets the size of the artist name watermark in the bottom corner."
      name="artistNameFontSize" value={settings.artistNameFontSize} min={2} max={10} step={0.5} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Preemption Time" 
      description="How many milliseconds before a line starts should the background switch?" 
      name="bgPreemptionTime" value={settings.bgPreemptionTime} min={0} max={2000} step={50} unit="ms" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Artist Transition Timing" 
      description="How long a singer's name delays before fading in (useful for fast duets)." 
      name="artistTransitionTime" value={settings.artistTransitionTime ?? 0} min={0} max={3000} step={100} unit="ms" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    
    <div className="group-divider" />
    <h4 className="sub-group-title">Audio Elements</h4>
    <SettingSlider 
      label="Equalizer Fade Out Time" 
      description="How long the Web Audio EQ takes to drop upon pausing." 
      name="eqFadeOutTime" value={settings.eqFadeOutTime} min={100} max={2000} step={50} unit="ms" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
  </div>
);

export default TypographySettings;