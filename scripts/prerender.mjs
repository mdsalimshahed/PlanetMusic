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
const sitemapLastModified = new Map();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlEsc = (s) => esc(s).replace(/'/g, '&apos;');
const toIsoDate = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid publication date: ${date}`);
  return parsed.toISOString().slice(0, 10);
};

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
const nav = `<nav aria-label="Main"><strong>PlanetMusic</strong><a href="/">Home</a><a href="/vault">Vault</a><a href="/docs/dev-blogs">Docs</a><a href="/docs/changelog">Changelog</a><a href="/contact">Contact</a></nav>`;
const footer = `<footer><p>PlanetMusic is a music editing and organization workspace, not a licensed music catalog. Some features use third-party services.</p><p><a href="/privacy">Privacy Policy</a> · <a href="/docs/terms-of-service">Terms of Service</a> · <a href="/contact">Contact</a> · <a href="/docs/dev-blogs">Docs</a> · <a href="/docs/about-me">About Me</a></p></footer>`;

const page = ({
  path,
  title,
  description,
  body,
  jsonld,
  useAppStyles = false,
  openGraphType = 'website',
  publishedDate,
  lastModified
}) => {
  prerenderedPaths.push(path);
  if (lastModified) sitemapLastModified.set(path, lastModified);
  const url = `${SITE.url}${path}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[\s\S]*?("\s*\/>)/, `$1${esc(description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[\s\S]*?("\s*\/>)/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${openGraphType}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[\s\S]*?("\s*\/>)/, `$1${esc(description)}$2`)
    .replace('</head>', `${publishedDate ? `<meta property="article:published_time" content="${toIsoDate(publishedDate)}" />` : ''}${useAppStyles ? '' : css}${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${useAppStyles ? body : `<div class="static">${nav}${body}${footer}</div>`}</div>`);
  const file = path === '/'
    ? join(dist, 'index.html')
    : join(dist, `${path.replace(/^\//, '')}.html`);
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
let PrivacyTab;
let TermsTab;
let AboutTab;
try {
  [{ default: BlogTab }, { default: ContactTab }, { default: PrivacyTab }, { default: TermsTab }, { default: AboutTab }] = await Promise.all([
    vite.ssrLoadModule('/src/Application/pages/BlogTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/ContactTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/PrivacyTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/TermsTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/AboutTab.jsx')
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
<p><a href="/vault">Open your Vault</a> · <a href="/docs/dev-blogs">Read the guides</a></p>
<p>Learn more: <a href="/docs/terms-of-service">Terms of Service</a> · <a href="/docs/about-me">About Me</a></p>
<h2>What PlanetMusic is</h2>
<p>PlanetMusic is not a streaming service. It is a set of tools for people who want to do more with the songs they already listen to: organize them, follow along with the words, and learn what the words mean.</p>
${ABOUT.map((a) => `<h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>`).join('\n')}
<h2>How it works</h2>
<ol>${STEPS.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.text)}</li>`).join('')}</ol>
<h2>Features</h2>
<ul>${FEATURES.map((f) => `<li><a href="${f.to}"><strong>${esc(f.title)}</strong></a>: ${esc(f.text)}</li>`).join('')}</ul>
<h2>Guides</h2>
<ul>${FEATURED_GUIDES.map((g) => `<li><a href="/docs/dev-blog/post/${g.id}">${esc(g.title)}</a> (${esc(g.readTime)}): ${esc(g.summary)}</li>`).join('')}</ul>
<p><a href="/docs/dev-blogs">See all ${posts.length} guides</a></p>
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
  title: 'Privacy Policy',
  description: 'How PlanetMusic stores Vault data in your browser, connects to third-party services, and handles advertising choices.',
  body: renderAppPage('/privacy', '/privacy', PrivacyTab, { adsEnabled: true }),
  useAppStyles: true,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Privacy Policy', description: 'How PlanetMusic stores browser data and uses third-party services and advertising.' }
});

page({
  path: '/docs/terms-of-service',
  title: 'Terms of Service | PlanetMusic',
  description: 'Terms and responsibilities for using the PlanetMusic browser-based music and lyrics workspace.',
  body: renderAppPage('/docs/terms-of-service', '/docs/terms-of-service', TermsTab, { adsEnabled: true }),
  useAppStyles: true,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Terms of Service | PlanetMusic', description: 'Terms and responsibilities for using PlanetMusic.' }
});

page({
  path: '/docs/about-me',
  title: 'About Me | PlanetMusic',
  description: 'Why PlanetMusic was built and an overview of the project.',
  body: renderAppPage('/docs/about-me', '/docs/about-me', AboutTab, { adsEnabled: true }),
  useAppStyles: true,
  jsonld: { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Me | PlanetMusic', description: 'Why PlanetMusic was built and an overview of the project.' }
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
  path: '/docs/changelog',
  title: 'PlanetMusic Changelog | Product and Development Updates',
  description: 'Browse dated PlanetMusic product updates and development notes by month.',
  body: renderAppPage('/docs/changelog', '/docs/*', BlogTab, blogProps),
  useAppStyles: true,
  jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'PlanetMusic Changelog', description: 'Monthly PlanetMusic product and development updates.' }
});

for (const month of orderedChangelogMonths) {
  const path = `/docs/changelog/${month.slug}`;
  page({
    path,
    title: `${month.label} Changelog | PlanetMusic`,
    description: `PlanetMusic product updates and development notes from ${month.label}, with ${month.entries.length} timeline entries.`,
    body: renderAppPage(path, '/docs/*', BlogTab, blogProps),
    useAppStyles: true,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${month.label} Changelog | PlanetMusic`, description: `PlanetMusic product updates from ${month.label}.` }
  });
}

// ---- guide index
page({
  path: '/docs/dev-blogs',
  title: 'PlanetMusic Guides | How-to articles for the lyrics workspace',
  description: `${posts.length} plain-language guides covering syncing lyrics, translations, the Vault, backups and troubleshooting in PlanetMusic.`,
  body: renderAppPage('/docs/dev-blogs', '/docs/*', BlogTab, blogProps),
  useAppStyles: true,
  jsonld: {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'PlanetMusic Guides',
    description: 'How-to articles for the PlanetMusic lyrics workspace.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE.url}/docs/dev-blog/post/${post.id}`,
        name: post.title
      }))
    }
  },
  lastModified: toIsoDate(posts.reduce((latest, post) => (
    new Date(post.date) > new Date(latest.date) ? post : latest
  )).date)
});

// ---- every guide
for (const p of posts) {
  const path = `/docs/dev-blog/post/${p.id}`;
  const publishedDate = toIsoDate(p.date);
  page({
    path,
    title: `${p.title} | PlanetMusic`,
    description: p.summary,
    body: renderAppPage(path, '/docs/*', BlogTab, blogProps),
    useAppStyles: true,
    openGraphType: 'article',
    publishedDate,
    lastModified: publishedDate,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.summary,
      datePublished: publishedDate,
      dateModified: publishedDate,
      author: { '@type': 'Organization', name: 'PlanetMusic' },
      publisher: {
        '@type': 'Organization',
        name: 'PlanetMusic',
        logo: { '@type': 'ImageObject', url: `${SITE.url}/icon-512.png` }
      },
      image: `${SITE.url}/icon-512.png`,
      mainEntityOfPage: `${SITE.url}${path}`
    }
  });
}

const latestPost = posts.reduce((latest, post) => (
  new Date(post.date) > new Date(latest.date) ? post : latest
));
const feedItems = posts
  .slice()
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .map((post) => {
    const url = `${SITE.url}/docs/dev-blog/post/${post.id}`;
    return `    <item>
      <title>${xmlEsc(post.title)}</title>
      <link>${xmlEsc(url)}</link>
      <guid isPermaLink="true">${xmlEsc(url)}</guid>
      <description>${xmlEsc(post.summary)}</description>
      <dc:creator>PlanetMusic</dc:creator>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    </item>`;
  })
  .join('\n');
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>PlanetMusic Guides</title>
    <link>${xmlEsc(`${SITE.url}/docs/dev-blogs`)}</link>
    <description>Practical guides for using PlanetMusic.</description>
    <language>en</language>
    <atom:link href="${xmlEsc(`${SITE.url}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date(latestPost.date).toUTCString()}</lastBuildDate>
${feedItems}
  </channel>
</rss>
`;
writeFileSync(join(dist, 'feed.xml'), feed);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${prerenderedPaths
  .map((path) => {
    const lastModified = sitemapLastModified.get(path);
    return `  <url><loc>${xmlEsc(`${SITE.url}${path}`)}</loc>${lastModified ? `<lastmod>${lastModified}</lastmod>` : ''}</url>`;
  })
  .join('\n')}\n</urlset>\n`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

const notFoundPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#000000" />
    <title>Page not found | PlanetMusic</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      *{box-sizing:border-box}
      body{margin:0;min-width:320px;min-height:100vh;display:flex;flex-direction:column;background:#000;color:#fff;font:16px/1.6 Outfit,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
      a{color:inherit;text-decoration:none}
      a:focus-visible{outline:2px solid #fa243c;outline-offset:4px}
      .site-header{width:min(100% - 48px,1200px);height:76px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #222}
      .brand{font-size:18px;font-weight:700;letter-spacing:-.5px}
      .brand-mark{color:#fa243c}
      .site-nav{display:flex;align-items:center;gap:28px;color:#999;font-size:14px}
      .site-nav a:hover,.site-footer a:hover{color:#fff}
      .not-found{position:relative;isolation:isolate;flex:1;min-height:560px;display:grid;place-items:center;overflow:hidden;padding:72px 24px}
      .not-found:before{position:absolute;z-index:-1;top:50%;left:50%;width:min(72vw,760px);aspect-ratio:1;content:"";transform:translate(-50%,-55%);background:radial-gradient(circle,rgba(250,36,60,.09),transparent 68%)}
      .not-found-content{width:min(100%,620px);text-align:center}
      .error-code{margin:0;color:#fa243c;font-size:clamp(100px,23vw,200px);font-weight:800;line-height:.9;letter-spacing:-.1em;padding-right:.1em}
      .eyebrow{margin:30px 0 10px;color:#888;font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase}
      h1{margin:0;font-size:clamp(28px,5vw,44px);font-weight:600;letter-spacing:-.045em;line-height:1.15}
      .description{max-width:440px;margin:16px auto 28px;color:#999;font-size:16px}
      .actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px}
      .button{min-height:46px;display:inline-flex;align-items:center;justify-content:center;padding:0 20px;border:1px solid #333;background:#111;color:#fff;font-size:14px;font-weight:600;transition:background .18s ease,border-color .18s ease,color .18s ease}
      .button:hover{border-color:#fff;background:#fff;color:#000}
      .button-primary{border-color:#fa243c;background:#fa243c;color:#fff}
      .button-primary:hover{border-color:#ff5367;background:#ff5367;color:#fff}
      .site-footer{width:min(100% - 48px,1200px);min-height:64px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;border-top:1px solid #222;color:#777;font-size:12px}
      .footer-links{display:flex;gap:20px}
      @media(max-width:600px){.site-header,.site-footer{width:calc(100% - 36px)}.site-header{height:64px}.site-nav{gap:16px;font-size:12px}.site-nav a:nth-child(2){display:none}.not-found{min-height:calc(100svh - 128px);padding:56px 18px}.description{font-size:15px}.site-footer{padding:18px 0;align-items:flex-start;flex-direction:column;gap:8px}.footer-links{gap:16px}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
    </style>
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="PlanetMusic home"><span class="brand-mark">◉</span> PlanetMusic</a>
      <nav class="site-nav" aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/vault">Your Vault</a>
        <a href="/docs/dev-blogs">Guides</a>
      </nav>
    </header>
    <main class="not-found">
      <div class="not-found-content">
        <p class="error-code" aria-label="Error 404">404</p>
        <p class="eyebrow">Lost in the cosmos</p>
        <h1>We couldn't find that page.</h1>
        <p class="description">This destination isn't here. The link may be outdated, or the page may have drifted into another orbit.</p>
        <nav class="actions" aria-label="Helpful links">
          <a class="button button-primary" href="/">Back to PlanetMusic</a>
          <a class="button" href="/vault">Open your Vault</a>
        </nav>
      </div>
    </main>
    <footer class="site-footer">
      <span>© ${new Date().getFullYear()} PlanetMusic</span>
      <nav class="footer-links" aria-label="More links">
        <a href="/docs/dev-blogs">Guides</a>
        <a href="/docs/changelog">Changelog</a>
        <a href="/contact">Contact</a>
      </nav>
    </footer>
  </body>
</html>
`;
writeFileSync(join(dist, '404.html'), notFoundPage);

console.log(`Prerendered ${prerenderedPaths.length} public pages, RSS feed, sitemap, and 404 page.`);
