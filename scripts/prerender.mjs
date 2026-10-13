// Runs after `vite build`. Writes real, readable HTML for the home page, the guide index and every
// guide into dist/, so crawlers (including Google AdSense's reviewer) see content without running JavaScript.
// When a visitor's browser loads the page, React replaces this HTML with the live app, exactly as before.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { SITE, ABOUT, STEPS, FEATURES, FEATURED_GUIDES, FAQ } = await import(
  pathToFileURL(join(root, 'src/Application/content/homeContent.js')).href
);
const posts = JSON.parse(readFileSync(join(root, 'public/blog_posts.json'), 'utf8'));
const template = readFileSync(join(dist, 'index.html'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- tiny Markdown -> HTML (covers what the guides use: headings, lists, quotes, code, bold, italic, links)
const inline = (t) =>
  esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');

const markdown = (md) => {
  const out = [];
  let list = null, para = [], code = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim().startsWith('```')) {
      if (code) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
      else { flushPara(); flushList(); code = []; }
      continue;
    }
    if (code) { code.push(raw); continue; }
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (/^-{3,}$/.test(line.trim())) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushPara(); flushList(); const l = Math.max(2, m[1].length); out.push(`<h${l}>${inline(m[2])}</h${l}>`); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = line.match(/^\s*[*-]\s+(.*)$/))) { flushPara(); if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) { flushPara(); if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    flushList(); para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join('\n');
};

// ---- shared shell
const css = `<style>
#root>.static{max-width:860px;margin:0 auto;padding:24px 20px 60px;color:#e9e4f5;font:16px/1.75 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.static{background:#0b0a14;min-height:100vh}.static a{color:#c9a8ff}.static h1,.static h2,.static h3{line-height:1.25;color:#fff}
.static nav{display:flex;flex-wrap:wrap;gap:16px;padding-bottom:18px;border-bottom:1px solid #2b2540;margin-bottom:28px}
.static blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid #a77bff;background:#171229}
.static code{background:#171229;padding:1px 6px;border-radius:5px}.static pre{overflow:auto;background:#171229;padding:14px;border-radius:8px}
.static .meta{color:#9d93b8;font-size:14px}.static footer{margin-top:40px;padding-top:18px;border-top:1px solid #2b2540;color:#9d93b8;font-size:14px}
</style>`;
const nav = `<nav aria-label="Main"><strong>PlanetMusic</strong><a href="/">Home</a><a href="/vault">Vault</a><a href="/blog/dev">Guides</a><a href="/blog/changelog">Changelog</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a></nav>`;
const footer = `<footer><p>PlanetMusic is a music editing and organization workspace, not a licensed music catalog. Some features use third-party services.</p><p><a href="/privacy">Privacy</a> · <a href="/contact">Contact</a> · <a href="/blog/dev">All guides</a></p></footer>`;

const page = ({ path, title, description, body, jsonld }) => {
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
    .replace('</head>', `${css}${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}</head>`)
    .replace('<div id="root"></div>', `<div id="root"><div class="static">${nav}${body}${footer}</div></div>`);
  const file = path === '/' ? join(dist, 'index.html') : join(dist, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
};

// ---- home
const homeBody = `
<main>
<h1>PlanetMusic: a music library and lyrics workspace in your browser</h1>
<p>${esc(SITE.description)}</p>
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
  title: 'PlanetMusic | Music Library & Lyrics Workspace',
  description: SITE.description,
  body: homeBody,
  jsonld: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
});

// ---- guide index
const byCat = posts.reduce((m, p) => ((m[p.category] ||= []).push(p), m), {});
page({
  path: '/blog/dev',
  title: 'PlanetMusic Guides | How-to articles for the lyrics workspace',
  description: `${posts.length} plain-language guides covering syncing lyrics, translations, the Vault, backups and troubleshooting in PlanetMusic.`,
  body: `<main><h1>PlanetMusic guides</h1><p>Plain-language how-to articles for every part of the workspace.</p>${Object.entries(byCat)
    .map(([cat, list]) => `<h2>${esc(cat)}</h2><ul>${list.map((p) => `<li><a href="/blog/post/${p.id}">${esc(p.title)}</a>: ${esc(p.summary)}</li>`).join('')}</ul>`).join('')}</main>`
});

// ---- every guide
for (const p of posts) {
  const related = posts.filter((o) => o.id !== p.id && o.category === p.category).slice(0, 4);
  page({
    path: `/blog/post/${p.id}`,
    title: `${p.title} | PlanetMusic`,
    description: p.summary,
    body: `<article><p class="meta"><a href="/blog/dev">Guides</a> / ${esc(p.category)}</p><h1>${esc(p.title)}</h1><p class="meta">${esc(p.date)} · ${esc(p.readTime)}${p.author ? ` · By ${esc(p.author)}` : ''}</p>${markdown(p.content)}${
      related.length ? `<h2>Related guides</h2><ul>${related.map((r) => `<li><a href="/blog/post/${r.id}">${esc(r.title)}</a></li>`).join('')}</ul>` : ''}</article>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.summary, datePublished: new Date(p.date).toISOString().slice(0, 10), author: { '@type': 'Person', name: p.author || 'PlanetMusic' }, mainEntityOfPage: `${SITE.url}/blog/post/${p.id}` }
  });
}
console.log(`Prerendered home, guide index and ${posts.length} guides.`);
