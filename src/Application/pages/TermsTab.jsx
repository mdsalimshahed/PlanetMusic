import { renderMarkdown } from '../utils/markdownUtils.jsx';
import LegalDocumentLayout from './LegalDocumentLayout.jsx';
import './BlogTab.css';
import { getProceduralGradient } from '../../utils/proceduralColors.js';

const termsContent = `## 1. Using PlanetMusic

By using PlanetMusic, you agree to use the application lawfully and in accordance with these terms. If you do not agree, do not use the application.

---

## 2. The application and local data

PlanetMusic provides browser-based tools for organizing music references and working with lyrics, timing, translations, and related material. Vault content and settings are generally stored in your browser on your device, not in a PlanetMusic account. You are responsible for keeping your device and browser data safe and making backups of anything you cannot replace.

---

## 3. Your content and acceptable use

You remain responsible for content, links, and credentials that you enter into the application. Only add material you have the right to use. Do not use PlanetMusic to infringe copyright, bypass DRM or access controls, distribute unlawful material, or interfere with the application or other services.

---

## 4. Third-party services and content

Some features connect to external music, lyrics, translation, media, or advertising providers. Those services are operated independently and may have their own terms, privacy practices, availability limits, and content restrictions. Your use of them is subject to their applicable terms. PlanetMusic does not control or guarantee third-party content or services.

---

## 5. Availability and changes

Features may change, become unavailable, or be discontinued. We may update these terms when the application or applicable requirements change. The current version will be posted on this page with its updated date.

---

## 6. Disclaimers and liability

To the extent permitted by law, PlanetMusic is provided **“as is” and “as available,”** without a guarantee that it will be uninterrupted, error-free, or suitable for every purpose. Nothing in these terms excludes rights or liability that applicable law does not allow to be excluded.

---

## 7. Contact

Questions about these terms can be sent through the [Contact page](/contact). See the [Privacy Policy](/privacy) for information about data and third-party services.`;

const TermsTab = ({ adsEnabled }) => (
  <LegalDocumentLayout adsEnabled={adsEnabled}>
    <header className="privacy-hero glass-panel">
      <h1
        className="privacy-hero-title"
        style={{ backgroundImage: getProceduralGradient('terms:hero-heading') }}
      >
        Terms of Service
      </h1>
      <p className="privacy-hero-sub">Rules and responsibilities for using PlanetMusic.</p>
      <span className="privacy-last-updated">Last updated: October 16, 2026</span>
    </header>

    <article className="privacy-card-body glass-panel blog-article-body legal-article-body">
      {renderMarkdown(termsContent, 'terms:article')}
    </article>
  </LegalDocumentLayout>
);

export default TermsTab;
