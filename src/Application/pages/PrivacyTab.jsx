/* --- src/pages/PrivacyTab.jsx --- */
import React from 'react';
import './PrivacyTab.css';
import SponsorUnit from '../components/Promos/SponsorUnit.jsx';

const PrivacyTab = ({ adsEnabled }) => {
  return (
    <section className="view-section privacy-tab-container">
      <div className="privacy-layout-wrapper">
         
        {/* --- MAIN CONTENT AREA --- */}
        <div className="privacy-main-content">
          {/* HERO SECTION */}
          <div className="privacy-hero glass-panel">
            <h1 className="privacy-hero-title">Omnilateral Privacy Policy & Master Exculpation Agreement</h1>
            <p className="privacy-hero-sub">
              A comprehensive legal framework detailing our stateless client-side architecture, absolute data sovereignty, DRM compliance, and total limitation of liability.
            </p>
            <span className="privacy-last-updated">Last Updated: September 2026</span>
          </div>

          {/* MAIN CONTENT BODY */}
          <div className="privacy-card-body glass-panel">
             
            {/* SECTION 1 */}
            <div className="privacy-section">
              <h2>1. Architectural Statelessness & Absolute Data Sovereignty</h2>
              <p>
                PlanetMusic operates fundamentally and exclusively as a stateless, non-custodial client-side graphical user interface (GUI). We do not own, operate, or lease any centralized database infrastructure for the purpose of harvesting, aggregating, or retaining user data.
              </p>
              <div className="privacy-highlight-box">
                <strong>Zero-Knowledge Guarantee:</strong> All metadata permutations, synchronous timing coordinates, and binary audio blobs (`IndexedDB`) inputted into this application reside strictly within the localized, sandboxed DOM environment of the end-user's proprietary hardware. We have zero infrastructural capacity to audit, intercept, or exfiltrate this localized payload.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 2 */}
            <div className="privacy-section">
              <h2>2. Omnijurisdictional Privacy Compliance Framework</h2>
              <p>
                By virtue of our strictly decentralized, client-side execution model, PlanetMusic inherently satisfies and exceeds the compliance mandates of the General Data Protection Regulation (EU) 2016/679 (GDPR), the California Consumer Privacy Act (CCPA), the Virginia Consumer Data Protection Act (VCDPA), the Children's Online Privacy Protection Act (COPPA), and analogous global data protection frameworks.
              </p>
              <ul>
                <li>
                  <strong>Right to be Forgotten:</strong> As no data is ever transmitted to our non-existent central servers, the "Right to Erasure" is executed unilaterally by the user simply by clearing their browser's cache, thereby permanently annihilating their Vault's localized existence.
                </li>
                <li>
                  <strong>No Account Telemetry:</strong> We process zero Personally Identifiable Information (PII). There are no user accounts, no authentication tokens (OAuth), no IP address logging, and no cross-site tracking pixels natively embedded within our source code.
                </li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 3 */}
            <div className="privacy-section">
              <h2>3. Anti-Piracy, DRM Non-Circumvention & Zero-Download Protocol</h2>
              <p>
                PlanetMusic is engineered strictly as an educational and metadata-formatting utility. The application executes a strict, unyielding <strong>Zero-Download Protocol</strong>.
              </p>
              <ul>
                <li>
                  <strong>Absolute Ban on Piracy:</strong> PlanetMusic does not host, upload, distribute, or facilitate the peer-to-peer (P2P) sharing of copyrighted audio signals. The interface possesses zero mechanical capability to let users pirate, rip, or illegally acquire media.
                </li>
                <li>
                  <strong>No Local Audio Extraction:</strong> When interfacing with third-party audio streams, the data is ephemerally piped through the browser's native `AudioContext` solely for real-time visualization (via Fast Fourier Transform) and playback. It is immediately discarded from RAM. The software never downloads, caches externally, or saves any copyrighted audio file to the user's local filesystem.
                </li>
                <li>
                  <strong>DRM Compliance:</strong> The user is expressly prohibited from utilizing this localized interface to circumvent Digital Rights Management (DRM) technologies or regional licensing restrictions. Any proprietary session cookies (e.g., ARL tokens) injected into the DOM are done so at the user's unilateral discretion and risk.
                </li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 4 */}
            <div className="privacy-section">
              <h2>4. Third-Party Ephemeral API Interfacing & Advertising</h2>
              <p>
                To manifest metadata structures, the application performs asynchronous XMLHttpRequests to disparate third-party RESTful APIs (e.g., iTunes Search API, LRCLIB, Wikipedia Action API). 
              </p>
              <p>
                These queries originate directly from the client's IP address. Consequently, any network-level metadata transmitted during these cross-origin requests is governed by the privacy jurisdictions of those respective third-party entities. Furthermore, PlanetMusic utilizes Google AdSense, which deploys localized browser cookies and web beacons to serve contextually relevant advertisements in accordance with their proprietary data processing agreements.
              </p>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 5 */}
            <div className="privacy-section">
              <h2>5. Total Exculpation & Absolute Limitation of Liability</h2>
              <p>
                By accessing, rendering, or otherwise interacting with the PlanetMusic DOM, the end-user irrevocably agrees to the maximum indemnification permissible under applicable law.
              </p>
              <div className="privacy-highlight-box">
                Under no circumstances, encompassing but not limited to tort, negligence, breach of contract, or strict liability, shall the developers, contributors, or host providers of PlanetMusic be held liable for any direct, indirect, incidental, special, punitive, or consequential damages. We are never liable for any damage at all—be it digital, hardware-related, legal, or metaphysical—arising from the localized use of this software, the ingestion of user-provided audio blobs, or the misinterpretation of translated lyrics.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 6 */}
            <div className="privacy-section">
              <h2>6. DMCA & Copyright Inquiries</h2>
              <p>
                Because PlanetMusic operates as an empty, stateless shell, we lack the infrastructural, physical, and technological capacity to delete, obfuscate, or modify localized data residing on an individual client's proprietary hardware. Any and all Digital Millennium Copyright Act (DMCA) takedown notices must be directed exclusively at the original hosting origins of the media streams utilized by the end-user.
              </p>
            </div>
          </div>
        </div>

        {/* --- DEDICATED SIDEBAR AREA --- */}
        <aside className="privacy-sidebar">
          {adsEnabled && (
            <>
              <SponsorUnit 
                placement="privacySidebar"
                className="glass-panel dynamic-radius-override"
                style={{ minHeight: '600px' }}
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit 
                placement="privacyStickySidebar"
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
          placement="privacyBottom"
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