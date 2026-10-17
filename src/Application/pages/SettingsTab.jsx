/* --- src/components/SettingsTab.jsx --- */
import './SettingsTab.css';
import { useSettingsLogic } from '../hooks/core/useSettingsLogic.js';

import DeezerAuthCard from '../components/Settings/DeezerAuthCard.jsx';
import LayoutSettings from '../components/Settings/LayoutSettings.jsx';
import TypographySettings from '../components/Settings/TypographySettings.jsx';
import GroupChatSettings from '../components/Settings/GroupChatSettings.jsx';
import TranslationSettings from '../components/Settings/TranslationSettings.jsx';
import PurgeCard from '../components/Settings/PurgeCard.jsx';
import AudioDelayTester from '../components/Settings/AudioDelayTester.jsx';
import SelfPromoCard from '../components/Promos/SelfPromoCard.jsx';

const SettingsTab = ({ settings, setSettings, dismissSampleMode, adsEnabled, returnPath }) => {
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
        <AudioDelayTester settings={settings} setSettings={setSettings} returnPath={returnPath} />
        
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
          <div data-settings-motion-key="sponsor-feed-one" style={{ breakInside: 'avoid', marginBottom: '24px' }}>
            <SelfPromoCard
              placement="settingsFeedOne"
              format="inline"
              className="glass-panel dynamic-radius-override" 
              style={{ minHeight: '280px' }}
            />
          </div>
        )}

        {/* LYRICS VIEW & TYPOGRAPHY */}
        <TypographySettings 
          settings={settings} 
          handleChange={handleChange} 
          getSliderStyle={getSliderStyle} 
        />

        <GroupChatSettings
          settings={settings}
          handleChange={handleChange}
          getSliderStyle={getSliderStyle}
        />

        {/* IN-FEED SPONSOR AD 2 */}
        {adsEnabled !== false && (
          <div data-settings-motion-key="sponsor-feed-two" style={{ breakInside: 'avoid', marginBottom: '24px' }}>
            <SelfPromoCard
              placement="settingsFeedTwo"
              format="inline"
              className="glass-panel dynamic-radius-override" 
              style={{ minHeight: '350px' }}
            />
          </div>
        )}

        {adsEnabled !== false && (
          <div data-settings-motion-key="sponsor-feed-four" className="settings-sponsor-placement">
            <SelfPromoCard
              placement="settingsFeedFour"
              format="inline"
              className="glass-panel dynamic-radius-override settings-infeed-ad"
            />
          </div>
        )}

        {/* TRANSLATION & TRANSLITERATION */}
        <TranslationSettings
          settings={settings}
          handleChange={handleChange}
          getSliderStyle={getSliderStyle}
        />

        {adsEnabled !== false && (
          <div data-settings-motion-key="sponsor-feed-three" className="settings-sponsor-placement">
            <SelfPromoCard
              placement="settingsFeedThree"
              format="inline"
              className="glass-panel dynamic-radius-override settings-infeed-ad"
            />
          </div>
        )}

        {/* PURGE DATA BLOCK */}
        <PurgeCard 
          showPurgeConfirm={showPurgeConfirm}
          setShowPurgeConfirm={setShowPurgeConfirm}
          handlePurgeAllData={handlePurgeAllData}
        />

      </div>

      {/* BOTTOM SPONSOR AD */}
      {adsEnabled !== false && (
        <SelfPromoCard
          placement="settingsBottom"
          format="banner"
          className="glass-panel settings-promo-box dynamic-radius-override"
          style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
        />
      )}
    </section>
  );
};

export default SettingsTab;