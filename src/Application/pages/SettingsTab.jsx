/* --- src/components/SettingsTab.jsx --- */
import React from 'react';
import './SettingsTab.css';
import { useSettingsLogic } from '../hooks/core/useSettingsLogic.js';

import DeezerAuthCard from '../components/Settings/DeezerAuthCard.jsx';
import LayoutSettings from '../components/Settings/LayoutSettings.jsx';
import TypographySettings from '../components/Settings/TypographySettings.jsx';
import TranslationSettings from '../components/Settings/TranslationSettings.jsx';
import PurgeCard from '../components/Settings/PurgeCard.jsx';
import SponsorUnit from '../components/Promos/SponsorUnit.jsx';

const SettingsTab = ({ settings, setSettings, dismissSampleMode, adsEnabled, isAmbientMode, toggleAmbientMode }) => {
  const {
    showArl, setShowArl,
    isVerifying,
    verifyResult, setVerifyResult,
    showPurgeConfirm, setShowPurgeConfirm,
    authGradient,
    handleChange,
    handleVerifyArl,
    handlePurgeAllData,
    getSliderStyle
  } = useSettingsLogic(settings, setSettings, dismissSampleMode);

  return (
    <section className="view-section settings-tab-container">
      <div className="settings-grid">
        
        {/* DEEZER AUTHENTICATION BLOCK */}
        <DeezerAuthCard 
          settings={settings}
          handleChange={handleChange}
          handleVerifyArl={handleVerifyArl}
          showArl={showArl}
          setShowArl={setShowArl}
          isVerifying={isVerifying}
          verifyResult={verifyResult}
          setVerifyResult={setVerifyResult}
          authGradient={authGradient}
        />

        {/* CANVAS & CARD LAYOUT */}
        <LayoutSettings 
          settings={settings} 
          handleChange={handleChange} 
          getSliderStyle={getSliderStyle} 
        />

        {/* IN-FEED SPONSOR AD 1 */}
        {adsEnabled !== false && (
          <div style={{ breakInside: 'avoid', marginBottom: '24px' }}>
            <SponsorUnit 
              testMode={true} 
              className="glass-panel dynamic-radius-override" 
              style={{ minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              adTitle="Partner Content" 
              adSub="Advertisement space" 
            />
          </div>
        )}

        {/* LYRICS VIEW & TYPOGRAPHY */}
        <TypographySettings 
          settings={settings} 
          handleChange={handleChange} 
          getSliderStyle={getSliderStyle} 
        />

        {/* IN-FEED SPONSOR AD 2 */}
        {adsEnabled !== false && (
          <div style={{ breakInside: 'avoid', marginBottom: '24px' }}>
            <SponsorUnit 
              testMode={true} 
              className="glass-panel dynamic-radius-override" 
              style={{ minHeight: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              adTitle="Discover More" 
              adSub="Sponsored Content" 
            />
          </div>
        )}

        {/* TRANSLATION & TRANSLITERATION */}
        <TranslationSettings 
          settings={settings} 
          handleChange={handleChange} 
          getSliderStyle={getSliderStyle} 
        />

        <div className="settings-card glass-panel experience-card">
          <h3>Viewing Experience</h3>
          <div className="experience-setting">
            <div>
              <strong>Ambient View</strong>
              <p className="setting-desc">Hide the song grid and watch floating lyrics.</p>
            </div>
            <button
              className={`experience-toggle ${isAmbientMode ? 'active' : ''}`}
              onClick={toggleAmbientMode}
              aria-pressed={isAmbientMode}
            >
              {isAmbientMode ? 'Exit Ambient View' : 'Enter Ambient View'}
            </button>
          </div>
          <div className="experience-setting">
            <div>
              <strong>Sponsor placements</strong>
              <p className="setting-desc">Show or hide sponsor placements around the app.</p>
            </div>
            <button
              className={`experience-toggle ${settings.adsEnabled !== false ? 'active' : ''}`}
              onClick={() => setSettings({ ...settings, adsEnabled: settings.adsEnabled === false })}
              aria-pressed={settings.adsEnabled !== false}
            >
              {settings.adsEnabled === false ? 'Enable' : 'Disable'}
            </button>
          </div>
        </div>

        {/* PURGE DATA BLOCK */}
        <PurgeCard 
          showPurgeConfirm={showPurgeConfirm}
          setShowPurgeConfirm={setShowPurgeConfirm}
          handlePurgeAllData={handlePurgeAllData}
        />

      </div>

      {/* BOTTOM SPONSOR AD */}
      {adsEnabled !== false && (
        <SponsorUnit 
          testMode={true} 
          className="glass-panel settings-promo-box dynamic-radius-override" 
          style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
          adTitle="Sponsor Message"
          adSub="Thank you for supporting PlanetMusic"
        />
      )}
    </section>
  );
};

export default SettingsTab;