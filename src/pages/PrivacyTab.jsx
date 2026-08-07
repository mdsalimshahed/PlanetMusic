/* --- src/components/PrivacyTab.jsx --- */
import React from 'react';
import './PrivacyTab.css';
import SponsorUnit from '../components/Promos/SponsorUnit';

const PrivacyTab = ({ adsEnabled }) => {
  return (
    <section className="view-section privacy-tab-container">
      <div className="privacy-layout-wrapper">
        
        {/* --- MAIN CONTENT AREA --- */}
        <div className="privacy-main-content">
          {/* HERO SECTION */}
          <div className="privacy-hero glass-panel">
            <h1 className="privacy-hero-title">Privacy Policy & Copyright Stance</h1>
            <p className="privacy-hero-sub">
              Learn how PlanetMusic operates as a privacy-first, client-side canvas interface for personal library management, lyrics comprehension, and language learning.
            </p>
            <span className="privacy-last-updated">Last Updated: August 2026</span>
          </div>

          {/* MAIN CONTENT BODY */}
          <div className="privacy-card-body glass-panel">
            
            {/* SECTION 1 */}
            <div className="privacy-section">
              <h2>1. Overview & Core Philosophy</h2>
              <p>
                Welcome to <strong>PlanetMusic</strong>. PlanetMusic is an open, client-side web application interface engineered strictly as an educational platform and personal utility tool. Our platform empowers users to organize their private music metadata, analyze and comprehend lyrics in foreign languages, and study phonetic pronunciations through Romanized transliterations (such as Romaji, Pinyin, and Devanagari).
              </p>
              <div className="privacy-highlight-box">
                <strong>Key Guarantee:</strong> PlanetMusic operates on a 100% privacy-first model. We do not require account registration, do not collect personal identifiers, and do not maintain central databases of user libraries or media.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 2 */}
            <div className="privacy-section">
              <h2>2. Intellectual Property & Non-Infringement Policy</h2>
              <p>
                PlanetMusic is committed to full compliance with intellectual property standards and legal copyright frameworks. We operate with a strict legal boundary as a client-side interface tool:
              </p>
              <ul>
                <li>
                  <strong>Zero Central Hosting:</strong> PlanetMusic does <em>not</em> host, upload, store, or distribute copyrighted media, full audio recordings, official master tracks, or proprietary media files on central servers.
                </li>
                <li>
                  <strong>Client-Side Storage Sovereignty:</strong> All song cards, metadata entries, attached audio samples, custom lyrics, and synced timestamp data are created by the user and stored 100% locally inside the user's personal browser storage (IndexedDB and LocalStorage).
                </li>
                <li>
                  <strong>Educational & Accessibility Use:</strong> The interactive lyric canvases, side-by-side translations, phonetic transliteration guides, and alignment tools provided by PlanetMusic are intended purely for private, non-commercial, educational, research, and language-learning purposes.
                </li>
                <li>
                  <strong>Public Search Integrations:</strong> Metadata searches, cover artwork, and public information retrieved through third-party services (such as iTunes or public database endpoints) are fetched directly by the user's browser client for identification purposes only.
                </li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 3 */}
            <div className="privacy-section">
              <h2>3. Data Collection & Local Storage Mechanics</h2>
              <p>
                Because PlanetMusic does not run user accounts or remote database servers, all data handling is restricted to your local browser environment:
              </p>
              
              <h3>A. LocalStorage</h3>
              <p>
                Your browser's <code>localStorage</code> is used to persist your personal application preferences, custom visual card scales, lyric font ratios, color palettes, and saved track metadata locally on your device.
              </p>

              <h3>B. IndexedDB (`PlanetMusicDB`)</h3>
              <p>
                When you attach local audio files to tracks in your vault, they are saved directly into your browser's private <code>IndexedDB</code> binary storage. These files remain entirely on your device and are never transmitted to external servers.
              </p>

              <h3>C. No Account Tracking</h3>
              <p>
                We do not collect names, email addresses, passwords, IP logs, or personal identity profiles. Your saved vault data belongs exclusively to you.
              </p>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 4 */}
            <div className="privacy-section">
              <h2>4. Third-Party Integrations & Analytics</h2>
              <p>
                To provide language transliteration, lyrics search, and metadata matching, PlanetMusic interacts directly with client-side public APIs:
              </p>
              <ul>
                <li>
                  <strong>Public Metadata APIs:</strong> Queries issued via the search bar connect directly to public endpoints (such as iTunes, LRCLIB, and Wikipedia) to return cover art and album track details.
                </li>
                <li>
                  <strong>Translation Endpoints:</strong> When utilizing the Translation Workspace, text strings are sent to Google Translate endpoints strictly to generate localized English text and phonetic pronunciations.
                </li>
                <li>
                  <strong>Advertising (Google AdSense):</strong> PlanetMusic uses Google AdSense to serve advertisements. AdSense may use cookies or web beacons to serve ads based on non-personally identifiable visits to this and other websites on the Internet.
                </li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 5 */}
            <div className="privacy-section">
              <h2>5. User Data Rights & Total Data Control</h2>
              <p>
                You retain absolute sovereignty over your library and data:
              </p>
              <ul>
                <li>
                  <strong>Export Backup:</strong> You can export your entire saved song library, lyrics, custom sync timings, and preferences to a standard <code>PlanetMusic_Backup.json</code> file at any time via the Topbar.
                </li>
                <li>
                  <strong>Instant Purge:</strong> You can permanently wipe all locally saved tracks, custom settings, and IndexedDB audio files by navigating to <strong>Settings &gt; Data Storage & Memory &gt; Purge All Data</strong>.
                </li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 6 */}
            <div className="privacy-section">
              <h2>6. Contact & DMCA Inquiries</h2>
              <p>
                PlanetMusic respects the intellectual property rights of creators and copyright holders. If you are a copyright owner or an agent thereof and believe that any content rendered within this client application infringes upon your copyright, please contact us. Because PlanetMusic stores no user media on remote servers, any infringing local data can be cleared directly by the user on their client device.
              </p>
            </div>

          </div>
        </div>

        {/* --- DEDICATED SIDEBAR AREA --- */}
        <aside className="privacy-sidebar">
          {adsEnabled && (
            <>
              <SponsorUnit 
                testMode={true} 
                className="glass-panel dynamic-radius-override"
                style={{ minHeight: '600px' }}
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit 
                testMode={true} 
                className="glass-panel dynamic-radius-override"
                style={{ minHeight: '300px' }}
                adTitle="Discover More"
                adSub="Sticky Sidebar Ad"
              />
            </>
          )}
        </aside>
      </div>

      {/* BOTTOM SPONSOR AD (Same format as Settings page) */}
      {adsEnabled && (
        <SponsorUnit 
          testMode={true} 
          className="glass-panel settings-promo-box dynamic-radius-override" 
          style={{ maxWidth: '1400px', margin: '0 auto' }}
          adTitle="Sponsor / Partner"
          adSub="Thank you for supporting PlanetMusic"
        />
      )}
    </section>
  );
};

export default PrivacyTab;