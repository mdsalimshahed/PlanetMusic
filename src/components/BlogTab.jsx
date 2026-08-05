/* --- src/components/BlogTab.jsx --- */
import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './BlogTab.css';

const BLOG_POSTS = [
  {
    id: 'dual-search-engine',
    title: 'Mastering the Dual Search Engine: Vault vs. Cosmos',
    category: 'Core Features',
    date: 'August 2026',
    readTime: '4 min read',
    summary: 'Learn how PlanetMusic seamlessly fuses your offline local Vault with live online music databases across iTunes and Deezer.',
    tags: ['Search', 'Vault', 'Cosmos', 'Deezer', 'iTunes'],
    content: (
      <div className="blog-article-content">
        <h2>Unifying Local Library & Online Music Discovery</h2>
        <p>
          PlanetMusic features a hybrid search engine designed to ensure you never lose track of saved songs while keeping the entire world of online music at your fingertips.
        </p>

        <h3>1. Instant Vault Search</h3>
        <p>
          As you type into the search bar, PlanetMusic instantly searches your personal saved <strong>Vault</strong> in real time. Matching tracks, artist names, and album titles filter smoothly without making external network calls.
        </p>

        <h3>2. Full Cosmos Dual-Column Search</h3>
        <p>
          Pressing <strong>Enter</strong> or clicking the search icon triggers a comprehensive <strong>Cosmos Search</strong>. This queries both iTunes and Deezer simultaneously, fusing identical track metadata into a unified results view:
        </p>
        <ul>
          <li><strong>Exact-Match Fusion:</strong> Tracks found across both iTunes and Deezer are merged into a single card displaying both source tags.</li>
          <li><strong>Underground & Explicit Support:</strong> Underground tracks, rare remixes, and explicit releases present on Deezer are seamlessly displayed alongside iTunes records.</li>
        </ul>

        <div className="blog-tip-box">
          <strong>💡 Pro Tip:</strong> Saved songs in your Vault always take priority in instant search. To explore new online tracks, simply hit <strong>Enter</strong> to open the split Dual-Column view!
        </div>
      </div>
    )
  },
  {
    id: 'audio-streaming-engine',
    title: 'Multi-Source Audio Engine: Local MP3s, Deezer HQ & YouTube',
    category: 'Audio Engine',
    date: 'August 2026',
    readTime: '5 min read',
    summary: 'Explore how PlanetMusic routes high-fidelity audio streams from IndexedDB storage, Deezer HQ servers, YouTube, and iTunes previews.',
    tags: ['Audio', 'Streaming', 'Deezer ARL', 'IndexedDB', 'YouTube'],
    content: (
      <div className="blog-article-content">
        <h2>Uncompromised Audio Quality & Intelligent Source Switching</h2>
        <p>
          Every track in PlanetMusic can pull audio from up to four different sources, automatically prioritizing the highest quality stream available.
        </p>

        <h3>Playback Hierarchy</h3>
        <p>
          When you click play on a track, PlanetMusic evaluates available audio sources in this exact order:
        </p>
        <ol>
          <li><strong>Local Audio Files (IndexedDB):</strong> If you attach a local MP3/FLAC file in the song editor, it is cached directly inside your browser’s IndexedDB for instant offline, lossless playback.</li>
          <li><strong>Deezer HQ Streams:</strong> If a Deezer track link is present and you have entered a valid Deezer ARL token in <em>Settings</em>, full high-quality audio streams directly through our secure proxy.</li>
          <li><strong>YouTube Audio Streams:</strong> If a YouTube link or ID is present, PlanetMusic connects directly to the YouTube iframe player API.</li>
          <li><strong>iTunes Previews:</strong> Serves as a reliable 30-second fallback when no full-length audio link is connected.</li>
        </ol>

        <h3>Configuring Your Deezer ARL Token</h3>
        <p>
          To unlock full-length Deezer streaming, navigate to <strong>Settings → Deezer ARL Token</strong>. Enter your personal cookie token from Deezer.com. Your token is stored 100% locally on your device and is never shared or exported in backup JSON files.
        </p>
      </div>
    )
  },
  {
    id: 'lyric-sync-workspace',
    title: 'Interactive Lyric Sync Workspace & Floating Ad-Libs',
    category: 'Lyrics & Syncing',
    date: 'August 2026',
    readTime: '6 min read',
    summary: 'A complete step-by-step guide to timestamping lyrics using keyboard shortcuts, splitting ad-libs, and mapping auto-sync database timings.',
    tags: ['Sync Engine', 'Keybindings', 'Ad-Libs', 'LRCLIB', 'YouLyrics'],
    content: (
      <div className="blog-article-content">
        <h2>Frame-Accurate Precision Lyric Synchronization</h2>
        <p>
          The Sync Workspace allows you to build broadcast-quality, synchronized lyrics with millisecond precision, custom playback speeds, and floating background ad-libs.
        </p>

        <h3>Keyboard Sync Controls</h3>
        <table className="blog-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>Spacebar</code></td>
              <td>Play / Pause audio playback</td>
            </tr>
            <tr>
              <td><code>Down Arrow</code></td>
              <td>1st Tap: Set line <strong>Start Time</strong><br/>2nd Tap: Set line <strong>End Time</strong> and advance to next line</td>
            </tr>
            <tr>
              <td><code>Up Arrow</code></td>
              <td>Undo last set timing & step back one line</td>
            </tr>
            <tr>
              <td><code>Left / Right Arrow</code></td>
              <td>Seek backward or forward by 1 second</td>
            </tr>
          </tbody>
        </table>

        <h3>Ad-Lib Splitting Engine</h3>
        <p>
          Background vocal ad-libs enclosed in parentheses <code>(like this)</code> can be isolated into independent floating nodes. Click <strong>Split Adlibs</strong> on any line in the workspace to detach the ad-lib. In <em>Focused View</em>, split ad-libs dynamically position themselves around the main lyrics based on available screen space!
        </p>

        <h3>Database Auto-Sync Mapping</h3>
        <p>
          Don't want to sync manually from scratch? Click <strong>Auto-Sync Lyrics</strong> on any song modal. PlanetMusic fetches word-by-word and line-by-line LRC timestamps from LRCLIB and YouLyrics databases. If you have custom Genius-formatted text, click <strong>Map Timings from Auto</strong> to map fetched timings onto your manual lyric lines!
        </p>
      </div>
    )
  },
  {
    id: 'translation-workspace',
    title: 'Global Translation & Phonetic Transliteration Workspace',
    category: 'Translation Engine',
    date: 'August 2026',
    readTime: '5 min read',
    summary: 'Break down language barriers with automated Google Translate integration, phonetic pronunciations (Romaji, Pinyin, Devanagari), and bulk batching.',
    tags: ['Translation', 'Transliteration', 'Romaji', 'Pinyin', 'Phonetics'],
    content: (
      <div className="blog-article-content">
        <h2>Understand Any Song in Any Language</h2>
        <p>
          PlanetMusic includes a dedicated Translation & Transliteration Workspace, enabling you to translate foreign lyrics into English while generating phonetic pronunciation guides above and below every line.
        </p>

        <h3>Key Features</h3>
        <ul>
          <li><strong>Context Batch Translation:</strong> Groups lyrics by language and translates entire songs simultaneously while preserving poetic context and line alignment.</li>
          <li><strong>Phonetic Pronunciation Guides:</strong> Converts non-Latin scripts (Japanese Kanji/Kana, Korean Hangul, Mandarin, Hindi Devanagari, Arabic, Russian Cyrillic) into clear Romanized phonetic text.</li>
          <li><strong>Line-by-Line Refetch:</strong> Edit individual translations or click the refresh icon on any single line to re-translate specific phrases.</li>
          <li><strong>Export & Import Text Files:</strong> Export formatted translation documents to <code>.txt</code> files for offline reading or re-import custom translations.</li>
        </ul>

        <div className="blog-tip-box">
          <strong>💡 Rule for English Lines:</strong> Setting a line's language tag to <code>en</code> automatically clears translation overlays to keep the canvas clean!
        </div>
      </div>
    )
  },
  {
    id: 'visualizer-and-display-modes',
    title: 'Dynamic Visualizer, Focused View & Multi-Artist Gradients',
    category: 'UI & Design',
    date: 'August 2026',
    readTime: '4 min read',
    summary: 'Discover how Live Sync View, Focused View, Web Audio visualizer bars, and multi-artist tag gradients elevate your listening experience.',
    tags: ['Focused View', 'Gradients', 'Equalizer', 'Watermark', 'Canvas'],
    content: (
      <div className="blog-article-content">
        <h2>An Immersive Visual Experience for Every Track</h2>
        <p>
          PlanetMusic goes beyond standard music players by turning lyric reading into a dynamic, beautiful canvas.
        </p>

        <h3>1. Live View vs. Focused View</h3>
        <ul>
          <li><strong>Live View:</strong> Displays a vertical, auto-scrolling feed of all upcoming and past lyric lines with smooth active line scaling.</li>
          <li><strong>Focused View:</strong> Centers the currently active lyric line on screen, hiding clutter and positioning background ad-libs around the main text in 3D space.</li>
        </ul>

        <h3>2. Multi-Artist Tagging & Dual Gradients</h3>
        <p>
          Using Genius-style header tags like <code>[Verse 1: Artist A & Artist B]</code> or formatting symbols (<code>*Bold*</code>, <code>_Italics_</code>), PlanetMusic automatically calculates color palettes for each singer. When artists perform together, their text renders with vibrant dual-color linear gradients!
        </p>

        <h3>3. Real-Time Web Audio Equalizer</h3>
        <p>
          Playing local audio or Deezer streams connects to a 60-band Web Audio API frequency analyzer, driving a smooth audio visualizer equalizer along the bottom of the lyrics display.
        </p>
      </div>
    )
  },
  {
    id: 'backup-settings-customization',
    title: 'Data Privacy, JSON Vault Backups & UI Customization',
    category: 'Settings & Storage',
    date: 'August 2026',
    readTime: '3 min read',
    summary: 'Learn how to export and import your full Vault backups, scale card sizes, adjust font ratios, and manage persistent local memory.',
    tags: ['Backup', 'JSON Export', 'Customization', 'Settings', 'Privacy'],
    content: (
      <div className="blog-article-content">
        <h2>Your Music Vault, Completely Under Your Control</h2>
        <p>
          PlanetMusic operates with a privacy-first philosophy. All your saved tracks, custom links, synced timings, and translations are stored locally inside your browser.
        </p>

        <h3>Exporting & Importing Backups</h3>
        <p>
          In the top bar, click the <strong>Export</strong> button to save your entire library and settings as a clean <code>PlanetMusic_Backup.json</code> file. To restore your library on another device or browser, simply click <strong>Import</strong> and select your backup file.
        </p>

        <h3>Extensive UI Customization</h3>
        <p>
          Head over to the <strong>Settings Tab</strong> to fine-tune every visual metric in the app:
        </p>
        <ul>
          <li><strong>Canvas & Card Layout:</strong> Adjust track card width (vw), grid gaps, padding, and search split ratios.</li>
          <li><strong>Lyrics Typography:</strong> Independently scale font sizes for Live View, Focused View, ad-libs, artist names, and translations.</li>
          <li><strong>Artist Transition Timing:</strong> Set custom fade-in millisecond delays when singers switch during duet tracks.</li>
        </ul>
      </div>
    )
  }
];

const BlogTab = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract Post ID directly from the URL route
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlPostId = pathParts[0] === 'blog' && pathParts[1] ? pathParts[1] : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set(BLOG_POSTS.map(p => p.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter(post => {
      const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        post.title.toLowerCase().includes(q) ||
        post.summary.toLowerCase().includes(q) ||
        post.tags.some(t => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const activePost = useMemo(() => {
    return BLOG_POSTS.find(p => p.id === urlPostId) || null;
  }, [urlPostId]);

  return (
    <section className="view-section blog-tab-container">
      {activePost ? (
        /* --- FULL ARTICLE READER VIEW --- */
        <div className="blog-reader-view glass-panel">
          <Link 
            to="/blog"
            className="blog-back-btn glass-button"
            style={{ textDecoration: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Articles
          </Link>

          <header className="blog-article-header">
            <div className="blog-meta-badge-row">
              <span className="blog-category-badge">{activePost.category}</span>
              <span className="blog-meta-dot">•</span>
              <span className="blog-read-time">{activePost.readTime}</span>
              <span className="blog-meta-dot">•</span>
              <span className="blog-date">{activePost.date}</span>
            </div>
            <h1 className="blog-article-title">{activePost.title}</h1>
            <p className="blog-article-summary">{activePost.summary}</p>
            <div className="blog-tags-row">
              {activePost.tags.map(tag => (
                <span key={tag} className="blog-tag">#{tag}</span>
              ))}
            </div>
          </header>

          <hr className="blog-divider" />

          <main className="blog-article-body">
            {activePost.content}
          </main>

          <footer className="blog-article-footer">
            <Link 
              to="/blog"
              className="blog-back-btn bottom-back glass-button"
              style={{ textDecoration: 'none' }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              ← Back to All Guides
            </Link>
          </footer>
        </div>
      ) : (
        /* --- BLOG GRID VIEW --- */
        <div className="blog-grid-view">
          <div className="blog-hero glass-panel">
            <h1 className="blog-hero-title">Features, Guides & Documentation</h1>
            <p className="blog-hero-sub">
              Everything you need to master PlanetMusic — from dual search engine discovery to precision lyric syncing and multi-source audio streaming.
            </p>

            <div className="blog-controls-row">
              <div className="blog-search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search guides, keybindings, features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="blog-clear-search" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              <div className="blog-categories-pills">
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredPosts.length > 0 ? (
            <div className="blog-cards-grid">
              {filteredPosts.map(post => (
                <Link 
                  key={post.id} 
                  to={`/blog/${post.id}`}
                  className="blog-card glass-panel-light"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="blog-card-top">
                    <span className="blog-category-badge">{post.category}</span>
                    <span className="blog-read-time">{post.readTime}</span>
                  </div>
                  <h3 className="blog-card-title">{post.title}</h3>
                  <p className="blog-card-summary">{post.summary}</p>
                  <div className="blog-card-bottom">
                    <div className="blog-card-tags">
                      {post.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="blog-mini-tag">#{tag}</span>
                      ))}
                    </div>
                    <span className="blog-read-more">Read Guide →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="blog-empty-box glass-panel">
              <h3>No guides match your search</h3>
              <p>Try clearing filters or searching for terms like "sync", "audio", "translation", or "deezer".</p>
              <button className="sample-vault-btn" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default BlogTab;