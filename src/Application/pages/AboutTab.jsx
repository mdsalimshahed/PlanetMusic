import { FEATURES, SITE } from '../content/homeContent.js';
import { renderMarkdown } from '../utils/markdownUtils.jsx';
import LegalDocumentLayout from './LegalDocumentLayout.jsx';
import './BlogTab.css';
import { getProceduralGradient } from '../../utils/proceduralColors.js';

const aboutContent = `## Why I built PlanetMusic

I built PlanetMusic to bring the tools for organizing music and working with lyrics together in one place. I wanted a workspace where I could keep track of songs I already listen to, sync lyrics with playback, and explore translations and pronunciation without treating the app as another streaming catalog.

The goal is to make it easier to follow the words, understand them, and shape the listening experience around each song.

---

## What I made

PlanetMusic is a browser-based music and lyrics workspace. It lets you organize song references, edit and synchronize lyrics, work with translations and pronunciation, and follow along in different playback views. It is not a streaming service or a licensed music catalog.

---

## A little about the project

PlanetMusic is an ongoing project, and I built it to be useful both as a practical workspace and as a place to keep improving how music and lyrics can be experienced together.

---

## What PlanetMusic includes

${FEATURES.map((feature) => `- **${feature.title}:** ${feature.text}`).join('\n')}`;

const AboutTab = ({ adsEnabled }) => (
  <LegalDocumentLayout adsEnabled={adsEnabled}>
    <header className="privacy-hero glass-panel">
      <h1
        className="privacy-hero-title"
        style={{ backgroundImage: getProceduralGradient('about:hero-heading') }}
      >
        About Me
      </h1>
      <p className="privacy-hero-sub">{SITE.tagline}</p>
    </header>

    <article className="privacy-card-body glass-panel blog-article-body legal-article-body">
      {renderMarkdown(aboutContent, 'about:article')}
    </article>
  </LegalDocumentLayout>
);

export default AboutTab;
