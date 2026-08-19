/* --- src/components/Settings/LayoutSettings.jsx --- */
import React from 'react';
import SettingSlider from './SettingSlider.jsx';
import SettingToggle from './SettingToggle.jsx';

const LayoutSettings = ({ settings, handleChange, getSliderStyle }) => (
  <div className="settings-card glass-panel">
    <h3>Canvas & Card Layout</h3>
    <SettingSlider 
      label="Card Width" 
      description="Sets the base width of each song card relative to the screen width."
      name="cardWidth" value={settings.cardWidth} min={8} max={25} unit="vw" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Card Padding" 
      description="Adjusts the internal spacing inside the song cards."
      name="cardPadding" value={settings.cardPadding} min={8} max={32} unit="vw" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Card Grid Gap" 
      description="Controls the spacing between song cards in the grid."
      name="cardGap" value={settings.cardGap} min={10} max={60} unit="vw" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Card Font Scale" 
      description="Scales the text size inside the song cards."
      name="cardFontSize" value={settings.cardFontSize} min={1} max={3} step={0.1} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingToggle 
      label="Rounded Card Corners" 
      description="Toggle whether cards use rounded or sharp edges."
      name="isRounded" checked={settings.isRounded} 
      handleChange={handleChange} 
    />
    {settings.isRounded && (
      <SettingSlider 
        label="Border Radius" 
        description="Adjusts the roundness of the card corners."
        name="borderRadius" value={settings.borderRadius} min={4} max={40} unit="vw" 
        handleChange={handleChange} getSliderStyle={getSliderStyle} 
      />
    )}
    
    <div className="group-divider" />
    <h4 className="sub-group-title">Modal Settings</h4>
    <SettingSlider 
      label="Modal Split Ratio" 
      description="Adjusts the width split between the album art column and the lyrics column." 
      name="modalSplitRatio" value={settings.modalSplitRatio} min={20} max={80} unit="%" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Modal Inner Padding" 
      description="Controls the vertical spacing inside the playback modal."
      name="modalPaddingY" value={settings.modalPaddingY} min={1} max={15} step={0.5} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    <SettingSlider 
      label="Header Font Scale" 
      description="Scales the size of the song title in the modal header."
      name="modalFontSize" value={settings.modalFontSize} min={3} max={10} step={0.5} unit="vh" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />
    
    <div className="group-divider" />
    <h4 className="sub-group-title">Search Layout</h4>
    <SettingSlider 
      label="Cosmos vs Vault Split" 
      description="Adjusts the dual-column width priority when searching online." 
      name="cosmosSplitRatio" value={settings.cosmosSplitRatio} min={20} max={80} unit="%" 
      handleChange={handleChange} getSliderStyle={getSliderStyle} 
    />

    <div className="group-divider" />
    <h4 className="sub-group-title">Performance</h4>
    <SettingToggle 
      label="Disable Animations" 
      description="Globally kills all CSS animations, transitions, and background motion to reduce battery drain."
      name="disableAnimations" checked={settings.disableAnimations} 
      handleChange={handleChange} 
    />
  </div>
);

export default LayoutSettings;