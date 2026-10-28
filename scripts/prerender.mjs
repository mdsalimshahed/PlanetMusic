// Runs after `vite build`. Writes readable HTML into dist/ so pages remain useful without JavaScript.
// When JavaScript runs, React replaces the static content with the live app.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { SITE } = await import(
  pathToFileURL(join(root, 'src/Application/content/homeContent.js')).href
);
const posts = JSON.parse(readFileSync(join(root, 'public/blog_posts.json'), 'utf8'));
const changelogMonths = JSON.parse(readFileSync(join(root, 'public/changelog.json'), 'utf8'));
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const appFallbackRootPattern = /<div id="root"><!--app-fallback-->[\s\S]*?<!--app-fallback-end-->\s*<\/div>/;
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
.static nav:not(.global-footer-links){display:flex;flex-wrap:wrap;gap:16px;padding-bottom:18px;border-bottom:1px solid #2b2540;margin-bottom:28px}
.static blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid #a77bff;background:#171229}
.static code{background:#171229;padding:1px 6px;border-radius:5px}.static pre{overflow:auto;background:#171229;padding:14px;border-radius:8px}
.static .hero-title-gradient{background:linear-gradient(100deg,#e2d2ff,#f09bff 45%,#5fd4ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.static .hero-title-logo{background:linear-gradient(120deg,#f06bff,#5fd4ff,#b6ff72);-webkit-background-clip:text;background-clip:text;color:transparent}
.static .meta{color:#9d93b8;font-size:14px}.static footer{margin-top:40px;padding-top:18px;border-top:1px solid #2b2540;color:#9d93b8;font-size:14px}
</style>`;
const staticHeader = (path) => {
  const links = [
    ['Home', '/'],
    ['Vault', '/vault'],
    ['Ambient', '/ambient'],
    ['Zen', '/zen'],
    ['Docs', '/docs/dev-blogs'],
    ['Contact', '/contact'],
    ['Settings', '/settings']
  ];
  const isActive = (href) => path === href
    || (href === '/vault' && path.startsWith('/song'))
    || (href === '/ambient' && path === '/zen')
    || (href === '/docs/dev-blogs' && path.startsWith('/docs'));
  return `<header class="topbar static-topbar">
    <div class="topbar-left"><a class="logo-area" href="/" aria-label="PlanetMusic home"><h2 class="logo-text"><span class="pm-logo"><span class="pm-planet">PLANET</span><span class="pm-music">MUSIC</span></span></h2></a></div>
    <div class="topbar-right"><nav class="nav-menu" aria-label="Main navigation">
      ${links.map(([label, href]) => `<a href="${href}" class="nav-btn${isActive(href) ? ' active' : ''}"${isActive(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav></div>
  </header>`;
};
const staticFooter = `<div class="global-footer">
  <p>© ${new Date().getFullYear()} PlanetMusic. All rights reserved.</p>
  <nav class="global-footer-links" aria-label="Legal and privacy">
    <a href="/privacy">Privacy Policy</a><a href="/docs/terms-of-service">Terms</a>
    <a href="/docs/about-me">About</a><a href="/contact">Contact</a>
  </nav>
</div>`;

const page = ({
  path,
  title,
  description,
  body,
  jsonld,
  useAppStyles = false,
  includeInSitemap = true,
  openGraphType = 'website',
  publishedDate,
  lastModified
}) => {
  if (includeInSitemap) prerenderedPaths.push(path);
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
    .replace(
      appFallbackRootPattern,
      `<div id="root">${staticHeader(path)}${useAppStyles ? body : `<div class="static">${body}</div>`}${staticFooter}</div>`
    );
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
let HomeGuide;
let SiteMessagePage;
try {
  [{ default: BlogTab }, { default: ContactTab }, { default: PrivacyTab }, { default: TermsTab }, { default: AboutTab }, { default: HomeGuide }, { default: SiteMessagePage }] = await Promise.all([
    vite.ssrLoadModule('/src/Application/pages/BlogTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/ContactTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/PrivacyTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/TermsTab.jsx'),
    vite.ssrLoadModule('/src/Application/pages/AboutTab.jsx'),
    vite.ssrLoadModule('/src/Application/components/Core/HomeGuide.jsx'),
    vite.ssrLoadModule('/src/Application/pages/SiteMessagePage.jsx')
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
const homeBody = renderAppPage('/', '/', HomeGuide, { isPlayerVisible: false });
page({
  path: '/',
  title: 'PlanetMusic | Lyrics Sync and Translations App',
  description: SITE.description,
  body: homeBody,
  useAppStyles: true,
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

page({
  path: '/404',
  title: 'Page not found | PlanetMusic',
  description: 'The requested PlanetMusic page could not be found.',
  body: renderAppPage('/404', '*', SiteMessagePage),
  useAppStyles: true,
  includeInSitemap: false
});
const notFoundPath = join(dist, '404.html');
const notFoundPage = readFileSync(notFoundPath, 'utf8')
  .replace(/<link rel="canonical" href="[^"]*" \/>/, '')
  .replace(/<meta\s+name="description"/, '<meta name="robots" content="noindex" />\n    <meta name="description"');
writeFileSync(notFoundPath, notFoundPage);

console.log(`Prerendered ${prerenderedPaths.length} public pages, RSS feed, sitemap, and 404 page.`);
