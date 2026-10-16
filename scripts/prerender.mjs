// Runs after `vite build`. Writes real, readable HTML for every public page into dist/, so crawlers
// (including Google AdSense's reviewer) see content without running JavaScript.
// When a visitor's browser loads the page, React replaces this HTML with the live app, exactly as before.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { SITE, ABOUT, STEPS, FEATURES, FEATURED_GUIDES, FAQ } = await import(
  pathToFileURL(join(root, 'src/Application/content/homeContent.js')).href
);
const posts = JSON.parse(readFileSync(join(root, 'public/blog_posts.json'), 'utf8'));
const changelogMonths = JSON.parse(readFileSync(join(root, 'public/changelog.json'), 'utf8'));
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const prerenderedPaths = [];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- shared shell
const css = `<style>
#root>.static{max-width:860px;margin:0 auto;padding:24px 20px 60px;color:#e9e4f5;font:16px/1.75 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.static{background:#0b0a14;min-height:100vh}.static a{color:#c9a8ff}.static h1,.static h2,.static h3{line-height:1.25;color:#fff}
.static nav{display:flex;flex-wrap:wrap;gap:16px;padding-bottom:18px;border-bottom:1px solid #2b2540;margin-bottom:28px}
.static blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid #a77bff;background:#171229}
.static code{background:#171229;padding:1px 6px;border-radius:5px}.static pre{overflow:auto;background:#171229;padding:14px;border-radius:8px}
.static .hero-title-gradient{background:linear-gradient(100deg,#e2d2ff,#f09bff 45%,#5fd4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.static .hero-title-logo{background:linear-gradient(120deg,#f06bff,#5fd4ff,#b6ff72);-webkit-background-clip:text;background-clip:text;color:transparent}
.static .meta{color:#9d93b8;font-size:14px}.static footer{margin-top:40px;padding-top:18px;border-top:1px solid #2b2540;color:#9d93b8;font-size:14px}
</style>`;
const nav = `<nav aria-label="Main"><strong>PlanetMusic</strong><a href="/">Home</a><a href="/vault">Vault</a><a href="/blog/dev">Guides</a><a href="/blog/changelog">Changelog</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a></nav>`;
const footer = `<footer><p>PlanetMusic is a music editing and organization workspace, not a licensed music catalog. Some features use third-party services.</p><p><a href="/privacy">Privacy</a> · <a href="/contact">Contact</a> · <a href="/blog/dev">All guides</a></p></footer>`;

const page = ({ path, title, description, body, jsonld, useAppStyles = false }) => {
  prerenderedPaths.push(path);
  const url = `${SITE.url}${path}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[\s\S]*?("\s*\/>)/, `$1${esc(description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[\s\S]*?("\s*\/>)/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[\s\S]*?("\s*\/>)/, `$1${esc(description)}$2`)
    .replace('</head>', `${useAppStyles ? '' : css}${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${useAppStyles ? body : `<div class="static">${nav}${body}${footer}</div>`}</div>`);
  const file = path === '/' ? join(dist, 'index.html') : join(dist, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
};

const vite = await createServer({
  root,
  configFile: join(root, 'vite.config.js'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error'
});
let BlogTab;
let ContactTab;
try {
  [{ default: BlogTab }, { default: ContactTab }] = await Promise.all([
    vite.ssrLoadModule('/src/Application/pages/BlogTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/ContactTab.jsx')
  ]);
} finally {
  await vite.close();
}

const renderAppPage = (path, routePath, Component, props = {}) => renderToString(
  React.createElement(
    MemoryRouter,
    { initialEntries: [path] },
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: routePath,
        element: React.createElement(Component, props)
      })
    )
  )
);

// ---- home
const homeBody = `
<main>
<h1>Listen to <span class="hero-title-logo">MUSIC</span> of the <span class="hero-title-logo">PLANET</span></h1>
<p>${esc(SITE.description)}</p>
<p>Automatic translations and pronunciation readings can be reviewed and edited beside the original lyrics. Sync lyric lines to playback, then follow along using Live, Focused, Group Chat, or Plain Text views.</p>
<p><a href="/vault">Open your Vault</a> · <a href="/blog/dev">Read the guides</a></p>
<h2>What PlanetMusic is</h2>
<p>PlanetMusic is not a streaming service. It is a set of tools for people who want to do more with the songs they already listen to: organize them, follow along with the words, and learn what the words mean.</p>
${ABOUT.map((a) => `<h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>`).join('\n')}
<h2>How it works</h2>
<ol>${STEPS.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.text)}</li>`).join('')}</ol>
<h2>Features</h2>
<ul>${FEATURES.map((f) => `<li><a href="${f.to}"><strong>${esc(f.title)}</strong></a>: ${esc(f.text)}</li>`).join('')}</ul>
<h2>Guides</h2>
<ul>${FEATURED_GUIDES.map((g) => `<li><a href="/blog/post/${g.id}">${esc(g.title)}</a> (${esc(g.readTime)}): ${esc(g.summary)}</li>`).join('')}</ul>
<p><a href="/blog/dev">See all ${posts.length} guides</a></p>
<h2>Frequently asked questions</h2>
${FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}
</main>`;
page({
  path: '/',
  title: 'PlanetMusic | Lyrics Sync and Translations App',
  description: SITE.description,
  body: homeBody,
  jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
});

// ---- privacy policy
page({
  path: '/privacy',
  title: 'Privacy Policy | PlanetMusic',
  description: 'How PlanetMusic stores Vault data in your browser, connects to third-party services, and handles advertising choices.',
  body: `<main>
<h1>Omnilateral Privacy Policy, Master Exculpation &amp; Ephemeral Data Agreement</h1>
<p>A comprehensive overview of PlanetMusic’s client-side architecture, local data storage, third-party services, advertising, and limitations of liability.</p>
<p class="meta">Last updated: September 2026</p>
<h2>1. Local data and browser storage</h2>
<p>PlanetMusic does not require an account. Your Vault, lyrics, timing coordinates, settings, and other saved workspace data are stored in browser storage on your device, including IndexedDB. PlanetMusic does not operate a central account database for this saved library. You can export a JSON backup using the app’s Backup control. Locally added audio files are not included in that backup.</p>
<p>Clearing browser data or using the app’s Purge function can permanently remove locally stored information. Export a backup before clearing data if you want to keep your Vault.</p>
<h2>2. Third-party services and network requests</h2>
<p>Features such as music metadata search, lyrics lookup, translation, and playback may connect directly from your browser to third-party services, including iTunes Search, LRCLIB, Wikipedia, and Google Translate. Those providers may receive technical request information such as your IP address and browser details. Their own privacy policies govern information they receive.</p>
<h2>3. Advertising and cookies</h2>
<p>PlanetMusic may load advertising scripts from providers such as Adsterra or Google AdSense when an ad placement is configured and advertising is enabled. Advertising providers may receive technical information and may use cookies or similar technologies under their own privacy policies. You can manage whether third-party ads may load in this browser using the advertising choice in the app.</p>
<h2>4. Copyright and external media</h2>
<p>PlanetMusic is a music editing and metadata workspace, not a licensed music catalog. It does not host or distribute a catalog of copyrighted recordings. Search and playback features can rely on external providers; their availability and terms apply. Do not use the app to bypass DRM, access restrictions, or copyright rules.</p>
<h2>5. Accuracy and availability</h2>
<p>The software and information are provided on an “as is” and “as available” basis to the extent permitted by law. Lyrics, translations, transliterations, metadata, playback, and locally stored data may be incomplete, inaccurate, or unavailable. Review your work and keep backups of information you cannot replace.</p>
<h2>6. Limitation of liability</h2>
<p>To the maximum extent permitted by applicable law, PlanetMusic’s developers and contributors are not responsible for indirect or consequential loss arising from use of the software, third-party services, or locally stored data. Nothing in this policy limits rights that cannot legally be excluded.</p>
<h2>7. Copyright notices and questions</h2>
<p>PlanetMusic does not host user-submitted media on a central server. For questions, corrections, or a legal inquiry, use the <a href="/contact">Contact page</a>. For help protecting a local Vault, see the <a href="/blog/post/data-storage-backups-purge-button">data storage and backup guide</a>.</p>
</main>`,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Privacy Policy | PlanetMusic', description: 'How PlanetMusic stores browser data and uses third-party services and advertising.' }
});

// ---- contact and support
page({
  path: '/contact',
  title: 'Contact PlanetMusic | Feedback and Support',
  description: 'Send PlanetMusic a question, feedback, bug report, correction, or legal inquiry using the contact form.',
  body: renderAppPage('/contact', '/contact', ContactTab, { adsEnabled: true }),
  useAppStyles: true,
  jsonld: { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact PlanetMusic', description: 'Contact PlanetMusic with questions, feedback, bug reports, or legal inquiries.' }
});

// ---- changelog index and month pages
const orderedChangelogMonths = changelogMonths.slice().reverse().map((month) => ({
  ...month,
  entries: month.entries.slice().reverse(),
  slug: month.label.toLowerCase().replace(' ', '-')
}));
const blogProps = {
  adsEnabled: true,
  initialPosts: posts,
  initialChangelogMonths: orderedChangelogMonths
};
page({
  path: '/blog/changelog',
  title: 'PlanetMusic Changelog | Product and Development Updates',
  description: 'Browse dated PlanetMusic product updates and development notes by month.',
  body: renderAppPage('/blog/changelog', '/blog/*', BlogTab, blogProps),
  useAppStyles: true,
  jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'PlanetMusic Changelog', description: 'Monthly PlanetMusic product and development updates.' }
});

for (const month of orderedChangelogMonths) {
  const path = `/blog/changelog/${month.slug}`;
  page({
    path,
    title: `${month.label} Changelog | PlanetMusic`,
    description: `PlanetMusic product updates and development notes from ${month.label}, with ${month.entries.length} timeline entries.`,
    body: renderAppPage(path, '/blog/*', BlogTab, blogProps),
    useAppStyles: true,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${month.label} Changelog | PlanetMusic`, description: `PlanetMusic product updates from ${month.label}.` }
  });
}

// ---- guide index
page({
  path: '/blog/dev',
  title: 'PlanetMusic Guides | How-to articles for the lyrics workspace',
  description: `${posts.length} plain-language guides covering syncing lyrics, translations, the Vault, backups and troubleshooting in PlanetMusic.`,
  body: renderAppPage('/blog/dev', '/blog/*', BlogTab, blogProps),
  useAppStyles: true
});

// ---- every guide
for (const p of posts) {
  const path = `/blog/post/${p.id}`;
  page({
    path,
    title: `${p.title} | PlanetMusic`,
    description: p.summary,
    body: renderAppPage(path, '/blog/*', BlogTab, blogProps),
    useAppStyles: true,
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.summary, datePublished: new Date(p.date).toISOString().slice(0, 10), author: { '@type': 'Person', name: p.author || 'PlanetMusic' }, mainEntityOfPage: `${SITE.url}/blog/post/${p.id}` }
  });
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${prerenderedPaths
  .map((path) => `  <url><loc>${esc(`${SITE.url}${path}`)}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

console.log(`Prerendered ${prerenderedPaths.length} public pages and generated dist/sitemap.xml.`);
