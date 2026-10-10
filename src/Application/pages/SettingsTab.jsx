/* --- src/components/SettingsTab.jsx --- */
import React, { useLayoutEffect, useRef, useState } from 'react';
import './SettingsTab.css';
import { useSettingsLogic } from '../hooks/core/useSettingsLogic.js';

import DeezerAuthCard from '../components/Settings/DeezerAuthCard.jsx';
import LayoutSettings from '../components/Settings/LayoutSettings.jsx';
import TypographySettings from '../components/Settings/TypographySettings.jsx';
import GroupChatSettings from '../components/Settings/GroupChatSettings.jsx';
import TranslationSettings from '../components/Settings/TranslationSettings.jsx';
import PurgeCard from '../components/Settings/PurgeCard.jsx';
import AudioDelayTester from '../components/Settings/AudioDelayTester.jsx';
import SettingsCardHeading from '../components/Settings/SettingsCardHeading.jsx';
import SponsorUnit from '../components/Promos/SponsorUnit.jsx';

const SettingsTab = ({ settings, setSettings, dismissSampleMode, adsEnabled, isAmbientMode, toggleAmbientMode, returnPath }) => {
  const settingsGridRef = useRef(null);
  const previousPositionsRef = useRef(null);
  const ambientExitStartedRef = useRef(false);
  const [isLeavingForAmbient, setIsLeavingForAmbient] = useState(false);
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

  const handleSponsorPlacementsToggle = () => {
    const grid = settingsGridRef.current;
    if (grid) {
      previousPositionsRef.current = new Map(
        Array.from(grid.children).map((item) => {
          const key = item.dataset.settingsMotionKey || item.querySelector('h3, h4')?.textContent.trim();
          return [key, item.getBoundingClientRect()];
        }).filter(([key]) => key)
      );
    }
    setSettings({ ...settings, adsEnabled: settings.adsEnabled === false });
  };

  const handleAmbientModeToggle = () => {
    if (ambientExitStartedRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      toggleAmbientMode();
      return;
    }

    const cards = Array.from(settingsGridRef.current?.querySelectorAll(':scope > .settings-card') || []);
    if (cards.length === 0) {
      toggleAmbientMode();
      return;
    }

    ambientExitStartedRef.current = true;
    setIsLeavingForAmbient(true);
    const animations = cards.map((card, index) => {
      const rect = card.getBoundingClientRect();
      const direction = rect.left + rect.width / 2 < window.innerWidth / 2 ? -1 : 1;
      return card.animate(
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
          { opacity: 0, transform: `translate3d(${direction * (window.innerWidth + rect.width)}px, -32px, 0) scale(0.94)` }
        ],
        { duration: 380, delay: index * 35, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'forwards' }
      );
    });

    Promise.all(animations.map(animation => animation.finished.catch(() => undefined)))
      .then(toggleAmbientMode);
  };

  useLayoutEffect(() => {
    const previousPositions = previousPositionsRef.current;
    const grid = settingsGridRef.current;
    previousPositionsRef.current = null;
    if (!previousPositions || !grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    Array.from(grid.children).forEach((item) => {
      const key = item.dataset.settingsMotionKey || item.querySelector('h3, h4')?.textContent.trim();
      if (!key) return;
      const nextRect = item.getBoundingClientRect();
      const previousRect = previousPositions.get(key);
      if (!previousRect) {
        if (key.startsWith('sponsor-')) {
          item.animate(
            [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 360, easing: 'cubic-bezier(0.2, 0.75, 0.3, 1)' }
          );
        }
        return;
      }

      const offsetX = previousRect.left - nextRect.left;
      const offsetY = previousRect.top - nextRect.top;
      if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) return;
      item.animate(
        [{ transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 420, easing: 'cubic-bezier(0.2, 0.75, 0.3, 1)' }
      );
    });
  }, [settings.adsEnabled]);

  return (
    <section className="view-section settings-tab-container">
      <div className="settings-grid" ref={settingsGridRef}>
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
            <SponsorUnit 
              placement="settingsFeedOne"
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

        <GroupChatSettings
          settings={settings}
          handleChange={handleChange}
          getSliderStyle={getSliderStyle}
        />

        {/* IN-FEED SPONSOR AD 2 */}
        {adsEnabled !== false && (
          <div data-settings-motion-key="sponsor-feed-two" style={{ breakInside: 'avoid', marginBottom: '24px' }}>
            <SponsorUnit 
              placement="settingsFeedTwo"
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

        {adsEnabled !== false && (
          <div data-settings-motion-key="sponsor-feed-three" className="settings-sponsor-placement">
            <SponsorUnit
              placement="settingsFeedThree"
              className="glass-panel dynamic-radius-override settings-infeed-ad"
              adTitle="Discover More"
              adSub="Sponsored Content"
            />
          </div>
        )}

        <div className="settings-card glass-panel experience-card">
          <SettingsCardHeading seed="viewing-experience">Viewing Experience</SettingsCardHeading>
          <div className="experience-setting">
            <div>
              <strong>Ambient View</strong>
              <p className="setting-desc">Hide the song grid and watch floating lyrics.</p>
            </div>
            <button
              className={`experience-toggle ${isAmbientMode ? 'active' : ''}`}
              onClick={handleAmbientModeToggle}
              disabled={isLeavingForAmbient}
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
              className={`experience-toggle sponsor-placements-toggle ${settings.adsEnabled !== false ? 'active' : ''}`}
              onClick={handleSponsorPlacementsToggle}
              aria-pressed={settings.adsEnabled !== false}
            >
              {settings.adsEnabled === false ? 'Enable' : 'Disable'}
            </button>
          </div>
        </div>

        {adsEnabled !== false && (
          <div data-settings-motion-key="sponsor-feed-four" className="settings-sponsor-placement">
            <SponsorUnit
              placement="settingsFeedFour"
              className="glass-panel dynamic-radius-override settings-infeed-ad"
              adTitle="Partner Content"
              adSub="Advertisement space"
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
        <SponsorUnit 
          placement="settingsBottom"
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