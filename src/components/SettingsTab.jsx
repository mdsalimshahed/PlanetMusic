/* --- src/components/SettingsTab.jsx --- */
import React from 'react';
import './SettingsTab.css';
import { useSettingsLogic } from '../hooks/useSettingsLogic';

import DeezerAuthCard from './Settings/DeezerAuthCard';
import LayoutSettings from './Settings/LayoutSettings';
import TypographySettings from './Settings/TypographySettings';
import TranslationSettings from './Settings/TranslationSettings';
import PurgeCard from './Settings/PurgeCard';
import SponsorUnit from './Promos/SponsorUnit';

const SettingsTab = ({ settings, setSettings, dismissSampleMode, adsEnabled }) => {
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