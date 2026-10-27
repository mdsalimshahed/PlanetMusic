/* --- src/pages/PrivacyTab.jsx --- */
import React from 'react';
import './PrivacyTab.css';
import LegalDocumentLayout from './LegalDocumentLayout.jsx';
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
    <LegalDocumentLayout adsEnabled={adsEnabled}>
          {/* HERO SECTION */}
          <div className="privacy-hero glass-panel">
            <h1 className="privacy-hero-title" style={{ backgroundImage: getProceduralGradient('privacy:hero-heading') }}>Privacy Policy</h1>
            <p className="privacy-hero-sub">
              How PlanetMusic and the third-party services used by the app handle information.
            </p>
            <span className="privacy-last-updated">Last Updated: October 27, 2026</span>
          </div>

          {/* MAIN CONTENT BODY */}
          <div className="privacy-card-body glass-panel">
            <PrivacyContentColors>
              <>
             
            {/* SECTION 1 */}
            <div className="privacy-section">
              <h2>1. Data stored by the app</h2>
              <p>
                PlanetMusic does not require an account. Your music library, lyrics, and settings are generally saved in your browser on your device. PlanetMusic does not operate a user-library database. Clearing your browser storage or using the app's purge feature removes locally saved app data; export a backup first if you want to keep it.
              </p>
              <div className="privacy-highlight-box">
                <strong>Local storage:</strong> Library data and preferences are stored using browser storage such as IndexedDB and local storage. This does not prevent information from being sent to a third party when you use a feature that contacts that provider, submit the contact form, or allow third-party advertising.
              </div>
            </div>

            <hr className="privacy-divider" />

            {/* SECTION 2 */}
            <div className="privacy-section">
              <h2>2. Third-party services and information</h2>
              <p>
                When you use search, lyrics, translation, media, or contact features, your browser may connect to the relevant provider. Those providers may receive your IP address, browser and device information, and the information needed to fulfill your request. Their own privacy policies and terms apply to their services.
              </p>
              <ul>
                <li><strong>Search and lyrics:</strong> Queries may be sent to third-party music, lyrics, or metadata services.</li>
                <li><strong>Translation:</strong> Text you submit for translation is sent to PlanetMusic's translation service and forwarded to Google Translate to provide the requested result. The translation service does not intentionally retain request text.</li>
                <li><strong>Contact form:</strong> Information you submit is sent to the service that processes the feedback form so we can receive and respond to your message.</li>
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
              <h3>Third-Party Advertising</h3>
              <p>
                When you allow advertising, PlanetMusic may load Google AdSense and other configured advertising providers. Google and its partners may use cookies or similar technologies to collect or receive information from this site and other sites, and use that information to provide, measure, and personalize ads. This may include your IP address, browser or device information, and activity related to ad delivery. Google's information about its advertising technologies is available in its <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">Advertising policy</a>.
              </p>
              <p>
                Advertising is off until you choose “Allow ads.” Choose “Continue without ads” to keep third-party ad scripts from loading. You can change or withdraw this choice at any time using “Privacy choices” in the site footer. You can also manage Google's personalized advertising settings at <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google Ads Settings</a>. Blocking ads in PlanetMusic does not change settings or cookies controlled by other websites or services.
              </p>
              <p>
                The site choice controls whether this browser loads third-party ads; it is not a Google-certified consent management platform. Where laws or Google policies require a certified consent management platform or additional consent signals, the publisher must configure an appropriate Google-certified CMP in the AdSense account before serving ads in those regions.
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
    </LegalDocumentLayout>
  );
};

export default PrivacyTab;