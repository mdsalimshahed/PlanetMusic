/* --- src/pages/PrivacyTab.jsx --- */
import React from 'react';
import './PrivacyTab.css';
import SponsorUnit from '../components/Promos/SponsorUnit.jsx';
import { getProceduralColor, getProceduralGradient } from '../../utils/proceduralColors.js';

const PrivacyContentColors = ({ children }) => {
  let colorIndex = 200;

  const applyColors = (nodes) => React.Children.map(nodes, (child) => {
    if (!React.isValidElement(child)) return child;

    if (child.type === 'h2' || child.type === 'h3') {
      const index = colorIndex++;
      return React.cloneElement(child, {
        style: {
          ...child.props.style,
          color: 'transparent',
          backgroundImage: getProceduralGradient(`privacy:section-heading:${index}`),
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }
      });
    }

    if (child.type === 'strong') {
      return React.cloneElement(child, {
        style: { ...child.props.style, color: getProceduralColor(`privacy:emphasis:${colorIndex++}`) }
      }, applyColors(child.props.children));
    }

    return React.cloneElement(child, undefined, applyColors(child.props.children));
  });

  return applyColors(children);
};

const PrivacyTab = ({ adsEnabled }) => {
  return (
    <section className="view-section privacy-tab-container">
      <div className="privacy-layout-wrapper">
         
        {/* --- MAIN CONTENT AREA --- */}
        <div className="privacy-main-content">
          {/* HERO SECTION */}
          <div className="privacy-hero glass-panel">
            <h1 className="privacy-hero-title" style={{ backgroundImage: getProceduralGradient('privacy:hero-heading') }}>Omnilateral Privacy Policy, Master Exculpation & Ephemeral Data Agreement</h1>
            <p className="privacy-hero-sub">
              A comprehensive legal framework detailing our stateless client-side architecture, absolute data sovereignty, strict DRM compliance, and total limitation of liability across all global jurisdictions.
            </p>
            <span className="privacy-last-updated">Last Updated: September 2026</span>
          </div>

          {/* MAIN CONTENT BODY */}
          <div className="privacy-card-body glass-panel">
            <PrivacyContentColors>
              <>
             
            {/* SECTION 1 */}
            <div className="privacy-section">
              <h2>1. Architectural Statelessness & Ephemeral DOM Sandboxing</h2>
              <p>
                PlanetMusic operates fundamentally and exclusively as a stateless, non-custodial client-side graphical user interface (GUI). The localized state management system have exclusive jurisdiction over all computational logic and memory allocation. We do not own, operate, or lease any centralized database infrastructure for the purpose of harvesting, aggregating, or retaining user telemetry.
              </p>
              <div className="privacy-highlight-box">
                <strong>Zero-Knowledge Guarantee:</strong> All metadata permutations, synchronous timing coordinates, custom lyrics, and binary audio blobs inputted into this application reside strictly within the localized, sandboxed Document Object Model (DOM) and <code>IndexedDB</code> environment of the end-user's proprietary hardware. We possess zero infrastructural or cryptographic capacity to audit, intercept, or exfiltrate this localized payload.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 2 */}
            <div className="privacy-section">
              <h2>2. Omnijurisdictional Statutory Compliance Framework</h2>
              <p>
                By virtue of our strictly decentralized, client-side execution model, PlanetMusic inherently satisfy and seamlessly exceed the compliance mandates of a multitude of global data protection frameworks, including but not limited to:
              </p>
              <ul>
                <li><strong>GDPR & ePrivacy Directive (EU/EEA):</strong> We process zero Personally Identifiable Information (PII) on remote servers. We deploy no cross-site tracking pixels for backend telemetry.</li>
                <li><strong>CCPA & CPRA (California, USA):</strong> We do not sell, share, or aggregate consumer data, as we do not possess the architectural capability to collect it in the first instance.</li>
                <li><strong>LGPD (Brazil), PIPEDA (Canada), & APPI (Japan):</strong> The absolute absence of data ingestion render these extraterritorial data privacy frameworks natively satisfied.</li>
                <li><strong>COPPA & FERPA (USA):</strong> The application acts as a standalone educational utility. No data regarding minors or educational records are transmitted or stored remotely.</li>
                <li><strong>Right to be Forgotten:</strong> As no data is ever transmitted to our non-existent central servers, the "Right to Erasure" is executed unilaterally by the user simply by purging their browser's cache or triggering the application's native Purge function, thereby permanently annihilating their Vault's localized existence.</li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 3 */}
            <div className="privacy-section">
              <h2>3. Strict Anti-Piracy, DRM Non-Circumvention & Zero-Download Protocol</h2>
              <p>
                PlanetMusic is engineered strictly as an educational and metadata-formatting utility. The engine execute a strict, unyielding <strong>Zero-Download Protocol</strong>. The user agree to utilize this application within the boundaries of international copyright law.
              </p>
              <ul>
                <li>
                  <strong>Absolute Ban on Piracy:</strong> PlanetMusic does not host, upload, distribute, or facilitate the peer-to-peer (P2P) sharing of copyrighted audio signals. The interface possess zero mechanical capability to let users pirate, rip, or illegally acquire media. We never download anything ever.
                </li>
                <li>
                  <strong>Ephemeral Audio Pipelines:</strong> When interfacing with third-party audio streams, the data is ephemerally piped through the browser's native <code>AudioContext</code> and <code>MediaElementAudioSourceNode</code> solely for real-time visualization (via Fast Fourier Transform) and playback. It is immediately discarded from volatile RAM. The software never caches externally, transcodes, or saves any copyrighted audio file to the user's local filesystem.
                </li>
                <li>
                  <strong>DRM & Access Token Liability:</strong> The user is expressly prohibited from utilizing this localized interface to circumvent Digital Rights Management (DRM) technologies or regional licensing restrictions. Any proprietary session cookies, authorization headers, or proxy payloads (e.g., Deezer ARL tokens) injected into the DOM are done so at the user's unilateral discretion and sole legal risk.
                </li>
              </ul>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 4 */}
            <div className="privacy-section">
              <h2>4. Third-Party API Interfacing & Algorithmic Advertising</h2>
              <p>
                To manifest metadata structures and phonetic transliterations, the application performs asynchronous XMLHttpRequests to disparate third-party RESTful APIs (e.g., iTunes Search API, LRCLIB, Wikipedia Action API, Google Translate). 
              </p>
              <p>
                These queries originate directly from the client's IP address. Consequently, any network-level metadata (such as User-Agent strings and IP addresses) natively transmitted during these cross-origin requests are governed by the privacy jurisdictions of those respective third-party entities.
              </p>
              <h3>Advertising Telemetry (Google AdSense)</h3>
              <p>
                PlanetMusic utilizes Google AdSense to serve contextually relevant advertisements. AdSense deploys localized browser cookies and web beacons to track non-personally identifiable visit data across the internet to optimize algorithmic ad-bidding. By accepting our cookie banner, the user consent to this specific, isolated telemetry in accordance with the IAB Transparency and Consent Framework (TCF).
              </p>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 5 */}
            <div className="privacy-section">
              <h2>5. Disclaimer of Warranties ("As-Is" Clause)</h2>
              <div className="privacy-highlight-box" style={{ textTransform: 'uppercase', fontSize: '12px', lineHeight: '1.4' }}>
                The PlanetMusic software is provided strictly on an "as-is" and "as-available" basis. To the maximum extent permitted by applicable law, the developers disclaim all warranties, express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, and unhindered uninterrupted execution. We warrant no accuracy regarding algorithmic phonetic transliterations, nor the stability of the local IndexedDB wrapper against browser-initiated garbage collection.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 6 */}
            <div className="privacy-section">
              <h2>6. Total Exculpation & Absolute Limitation of Liability</h2>
              <p>
                By accessing, rendering, or otherwise interacting with the PlanetMusic DOM, the end-user irrevocably agree to the maximum indemnification permissible under applicable law.
              </p>
              <div className="privacy-highlight-box">
                Under no circumstances, encompassing but not limited to tort, negligence, breach of contract, or strict liability, shall the developers, contributors, or host providers of PlanetMusic be held liable for any direct, indirect, incidental, special, punitive, or consequential damages. <strong>We are never liable for any damage at all</strong>—be it digital, hardware-related, legal, auditory (e.g., hearing damage from audio spikes), socio-economic, metaphysical, or cryptographic data corruption—arising from the localized use of this software, the ingestion of user-provided audio blobs, or the misinterpretation of translated lyrics.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 7 */}
            <div className="privacy-section">
              <h2>7. DMCA Safe Harbor Exemption & Takedown Routing</h2>
              <p>
                Because PlanetMusic operates as an empty, stateless shell, we lack the infrastructural, physical, and technological capacity to delete, obfuscate, or modify localized data residing on an individual client's proprietary hardware. 
              </p>
              <p>
                We do not host infringing material. Therefore, any and all Digital Millennium Copyright Act (DMCA) takedown notices or cease-and-desist declarations must be directed exclusively at the original hosting origins (e.g., YouTube, Deezer, Wikipedia, or the user's own hard drive) of the media streams utilized by the end-user.
              </p>
            </div>
              </>
            </PrivacyContentColors>
          </div>
        </div>

        {/* --- DEDICATED SIDEBAR AREA --- */}
        <aside className="privacy-sidebar">
          {adsEnabled && (
            <>
              <SponsorUnit 
                placement="privacySidebar"
                className="glass-panel dynamic-radius-override page-sidebar-ad-large"
                adTitle="Sponsor"
                adSub="Sidebar Advertisement Space"
              />
              <SponsorUnit 
                placement="privacyStickySidebar"
                className="glass-panel dynamic-radius-override page-sidebar-ad-small"
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