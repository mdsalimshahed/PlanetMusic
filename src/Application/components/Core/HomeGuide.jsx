import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ABOUT, FAQ, FEATURED_GUIDES, FEATURES, SECTIONS, STEPS } from '../../content/homeContent.js';
import BlogPostArtwork from '../../pages/BlogPostArtwork.jsx';
import './HomeGuide.css';

const DEMO_LINES = [
  'Find the words that stay',
  'Let the moment find its way',
  'Every note becomes a place',
  'And the chorus takes us home'
];

const ABOUT_ART = [
  <svg key="library" viewBox="0 0 320 112" fill="none" aria-hidden="true">
    <rect x="68" y="17" width="78" height="78" rx="15" fill="#7548E8" />
    <rect x="77" y="26" width="60" height="60" rx="11" fill="url(#library-art)" />
    <path d="M105 43v24m0-24 17-4v22" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="99" cy="69" r="6" fill="white" />
    <circle cx="117" cy="64" r="6" fill="white" />
    <rect x="157" y="29" width="94" height="10" rx="5" fill="#E6D9FF" />
    <rect x="157" y="48" width="70" height="7" rx="3.5" fill="#9782BB" />
    <rect x="157" y="66" width="86" height="7" rx="3.5" fill="#554B68" />
    <circle cx="263" cy="34" r="16" fill="#27203B" />
    <path d="M256 34h14m-7-7v14" stroke="#C9A8FF" strokeWidth="2" strokeLinecap="round" />
    <defs>
      <linearGradient id="library-art" x1="77" y1="26" x2="137" y2="86" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F09BFF" />
        <stop offset="1" stopColor="#3478E5" />
      </linearGradient>
    </defs>
  </svg>,
  <svg key="lyrics" viewBox="0 0 320 112" fill="none" aria-hidden="true">
    <rect x="64" y="16" width="192" height="80" rx="15" fill="#100D1B" stroke="#49366B" />
    <path d="M82 37h57m-57 18h40m-40 18h61" stroke="#766A8C" strokeWidth="6" strokeLinecap="round" />
    <path d="M156 37h80m-68 18h68m-80 18h80" stroke="#D7C2FF" strokeWidth="6" strokeLinecap="round" />
    <path d="M160 30v50" stroke="#5FD4FF" strokeWidth="2" strokeDasharray="3 4" />
    <circle cx="160" cy="24" r="5" fill="#5FD4FF" />
    <path d="M91 85h11m8-5v5m8-11v11m8-16v16m8-8v8m8-13v13" stroke="#A77BFF" strokeWidth="3" strokeLinecap="round" />
  </svg>,
  <svg key="languages" viewBox="0 0 320 112" fill="none" aria-hidden="true">
    <rect x="64" y="19" width="88" height="74" rx="14" fill="#171326" stroke="#49366B" />
    <rect x="168" y="19" width="88" height="74" rx="14" fill="#171326" stroke="#28566A" />
    <text x="108" y="60" fill="#F3EFFF" fontSize="28" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">言</text>
    <text x="212" y="60" fill="#F3EFFF" fontSize="27" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">A</text>
    <path d="M84 75h48m104 0h-48" stroke="#9D93B8" strokeWidth="4" strokeLinecap="round" />
    <circle cx="160" cy="56" r="16" fill="#7548E8" />
    <path d="M153 56h14m-5-5 5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
];

const STEP_ART = [
  <svg key="search" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <circle cx="140" cy="45" r="27" stroke="#9D7BFF" strokeWidth="8" />
    <path d="m160 65 25 22" stroke="#5FD4FF" strokeWidth="9" strokeLinecap="round" />
    <path d="M129 45h22m-11-11v22" stroke="#F3EFFF" strokeWidth="4" strokeLinecap="round" />
    <circle cx="140" cy="45" r="39" stroke="#49366B" strokeWidth="2" strokeDasharray="4 7" />
  </svg>,
  <svg key="save" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <rect x="112" y="15" width="70" height="70" rx="15" fill="url(#step-save)" />
    <path d="M128 31h38v37h-38z" stroke="white" strokeWidth="3" strokeLinejoin="round" />
    <path d="M136 31v15l11-6 11 6V31" stroke="white" strokeWidth="3" strokeLinejoin="round" />
    <path d="m190 51 9 9 19-21" stroke="#5FD4FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <defs>
      <linearGradient id="step-save" x1="112" y1="15" x2="182" y2="85" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A77BFF" />
        <stop offset="1" stopColor="#3478E5" />
      </linearGradient>
    </defs>
  </svg>,
  <svg key="sync" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <path d="M64 51h31l10-19 14 39 14-51 16 62 13-42 11 11h83" stroke="#9D7BFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M64 83h192" stroke="#49366B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="150" cy="51" r="7" fill="#5FD4FF" stroke="#151222" strokeWidth="4" />
  </svg>,
  <svg key="translate" viewBox="0 0 320 100" fill="none" aria-hidden="true">
    <rect x="87" y="17" width="64" height="66" rx="12" fill="#171326" stroke="#7548E8" strokeWidth="2" />
    <rect x="169" y="17" width="64" height="66" rx="12" fill="#171326" stroke="#3478E5" strokeWidth="2" />
    <text x="119" y="58" fill="#F3EFFF" fontSize="26" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">言</text>
    <text x="201" y="58" fill="#F3EFFF" fontSize="25" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">A</text>
    <path d="M145 50h30m-8-8 8 8-8 8" stroke="#5FD4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
];

const FEATURE_ART = [
  <svg key="search" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="148" cy="55" r="30" stroke="#A77BFF" strokeWidth="8" />
    <path d="m170 77 25 23" stroke="#5FD4FF" strokeWidth="9" strokeLinecap="round" />
    <path d="M135 55h26m-13-13v26" stroke="white" strokeWidth="4" strokeLinecap="round" />
    <path d="M91 27h30m-30 14h16m99 0h25m-25 12h16" stroke="#554B68" strokeWidth="5" strokeLinecap="round" />
  </svg>,
  <svg key="sync" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <path d="M52 63h38l13-22 18 46 18-61 20 75 17-51 15 13h77" stroke="#A77BFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M52 99h230" stroke="#49366B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="157" cy="63" r="7" fill="#5FD4FF" stroke="#100D1B" strokeWidth="4" />
  </svg>,
  <svg key="translation" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="58" y="20" width="91" height="80" rx="13" fill="#171326" stroke="#7548E8" strokeWidth="2" />
    <rect x="171" y="20" width="91" height="80" rx="13" fill="#171326" stroke="#3478E5" strokeWidth="2" />
    <text x="103" y="65" fill="#F3EFFF" fontSize="30" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">文</text>
    <text x="216" y="65" fill="#F3EFFF" fontSize="29" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">A</text>
    <path d="M92 82h23m97 0h9" stroke="#9D93B8" strokeWidth="4" strokeLinecap="round" />
  </svg>,
  <svg key="views" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="56" y="20" width="94" height="80" rx="12" fill="#171326" stroke="#49366B" />
    <rect x="170" y="20" width="94" height="80" rx="12" fill="#171326" stroke="#49366B" />
    <path d="M72 43h62m-62 14h46m-46 14h58" stroke="#B89DFF" strokeWidth="5" strokeLinecap="round" />
    <circle cx="194" cy="48" r="9" fill="#7548E8" />
    <circle cx="222" cy="48" r="9" fill="#3478E5" />
    <path d="M188 75h53" stroke="#5FD4FF" strokeWidth="5" strokeLinecap="round" />
  </svg>,
  <svg key="group" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="113" cy="44" r="17" fill="#A77BFF" />
    <circle cx="207" cy="44" r="17" fill="#5FD4FF" />
    <path d="M78 95c2-21 14-32 35-32s33 11 35 32m24 0c2-21 14-32 35-32s33 11 35 32" stroke="#D7C2FF" strokeWidth="7" strokeLinecap="round" />
    <path d="M141 40h38m-10-10 10 10-10 10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="ambient" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="158" cy="61" r="44" fill="#21123D" />
    <circle cx="158" cy="61" r="33" fill="#31204D" />
    <path d="M84 44c18-16 31 16 49 0s31 16 49 0 31 16 49 0" stroke="#F09BFF" strokeWidth="4" strokeLinecap="round" />
    <path d="M72 72c18-16 31 16 49 0s31 16 49 0 31 16 49 0 31 16 49 0" stroke="#5FD4FF" strokeWidth="3" strokeLinecap="round" />
  </svg>,
  <svg key="artist" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <circle cx="144" cy="46" r="23" fill="#7548E8" />
    <path d="M98 101c4-24 20-37 46-37s42 13 46 37" fill="#3478E5" />
    <circle cx="144" cy="46" r="31" stroke="#F09BFF" strokeWidth="2" />
    <path d="m201 29 4 10 11 1-8 7 2 11-9-6-10 6 3-11-8-7 11-1 4-10Z" fill="#5FD4FF" />
  </svg>,
  <svg key="delay" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <path d="M59 66V54c0-29 22-48 48-48s48 19 48 48v12" stroke="#A77BFF" strokeWidth="8" strokeLinecap="round" />
    <rect x="51" y="58" width="19" height="37" rx="9" fill="#7548E8" stroke="#D7C2FF" strokeWidth="2" />
    <rect x="144" y="58" width="19" height="37" rx="9" fill="#3478E5" stroke="#5FD4FF" strokeWidth="2" />
    <path d="M185 42h79m-79 35h79" stroke="#554B68" strokeWidth="2" strokeLinecap="round" />
    <path d="M185 42h15l8-10 10 20 11-18 10 8h25" stroke="#D7C2FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M185 77h26l10-13 10 24 11-20 8 9h14" stroke="#5FD4FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M207 101h24m-6-6 6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="settings" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <rect x="64" y="21" width="192" height="78" rx="14" fill="#171326" stroke="#49366B" strokeWidth="2" />
    <path d="M91 43h137M91 60h137M91 77h137" stroke="#554B68" strokeWidth="5" strokeLinecap="round" />
    <path d="M91 43h41m54 17h42M91 77h72" stroke="#A77BFF" strokeWidth="5" strokeLinecap="round" />
    <circle cx="139" cy="43" r="8" fill="#F09BFF" stroke="#171326" strokeWidth="3" />
    <circle cx="178" cy="60" r="8" fill="#5FD4FF" stroke="#171326" strokeWidth="3" />
    <circle cx="171" cy="77" r="8" fill="#F09BFF" stroke="#171326" strokeWidth="3" />
  </svg>
];

const HomeGuide = () => {
  const rootRef = useRef(null);
  const [activeSection, setActiveSection] = useState('');
  const [demoIndex, setDemoIndex] = useState(1);
  const [previewWorkspace, setPreviewWorkspace] = useState('sync');

  // Scroll-spy: highlight the nav pill for the section currently on screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    SECTIONS.forEach(({ id }) => {
      const el = root.querySelector(`#${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Scroll-reveal for cards.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const reveal = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));
    return () => reveal.disconnect();
  }, []);

  // Looping lyric highlight in the hero preview.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setDemoIndex((i) => (i + 1) % DEMO_LINES.length), 2200);
    return () => clearInterval(timer);
  }, []);

  const goTo = (id) => (event) => {
    event.preventDefault();
    const target = rootRef.current?.querySelector(`#${id}`);
    if (!target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <div className="home-guide" ref={rootRef}>
      <nav className="home-guide-nav" aria-label="On this page">
        {SECTIONS.map(({ id, label }) => (
          <a key={id} href={`#${id}`} onClick={goTo(id)} className={activeSection === id ? 'is-active' : ''} aria-current={activeSection === id ? 'true' : undefined}>
            {label}
          </a>
        ))}
      </nav>

      <header className="home-guide-hero" id="top">
        <div className="home-guide-stars" aria-hidden="true" />
        <div className="home-guide-copy">
          <h1>Make every song<br /><span>a place you can explore.</span></h1>
          <p className="home-guide-lead">
            PlanetMusic is a browser-based workspace where you save the songs you love, time their lyrics line by line,
            and read them next to a translation. Lyrics can be displayed in any language, with dedicated tools for
            Japanese, Chinese, Korean, Arabic, and Bengali. No account, no install.
          </p>
          <div className="home-guide-actions">
            <Link className="home-guide-primary" to="/vault">Open your Vault <span aria-hidden="true">→</span></Link>
            <a className="home-guide-secondary" href="#how" onClick={goTo('how')}>See how it works</a>
          </div>
          <ul className="home-guide-chips" aria-label="Highlights">
            <li>Private by design</li><li>Works on phone &amp; desktop</li><li>Lyrics in any language</li>
          </ul>
        </div>

        <div className="home-guide-visual" role="group" aria-label="Interactive preview of PlanetMusic workspaces">
          <div className="home-guide-planet" aria-hidden="true">
            <div className="home-guide-ring home-guide-ring-a home-guide-ring-back" />
            <div className="home-guide-ring home-guide-ring-b home-guide-ring-back" />
            <div className="home-guide-ring home-guide-ring-c home-guide-ring-back" />
            <div className="home-guide-ring home-guide-ring-d home-guide-ring-back" />
            <img src="/favicon.svg?v=12" alt="" />
            <div className="home-guide-ring home-guide-ring-a home-guide-ring-front" />
            <div className="home-guide-ring home-guide-ring-b home-guide-ring-front" />
            <div className="home-guide-ring home-guide-ring-c home-guide-ring-front" />
            <div className="home-guide-ring home-guide-ring-d home-guide-ring-front" />
          </div>
          <div className="home-guide-player">
            <div className="home-guide-player-top"><span><i /> WORKSPACE PREVIEW</span><span>A 文</span></div>
            <div className="home-guide-track">
              <div className="home-guide-cover" aria-hidden="true" />
              <div><strong>A song of your own</strong><small>Saved in your Vault</small></div>
              <div className="home-guide-eq" aria-hidden="true"><b /><b /><b /><b /><b /></div>
            </div>
            {previewWorkspace === 'vault' && (
              <div className="home-guide-preview-library">
                <p className="home-guide-preview-label">YOUR LIBRARY <span>3 TRACKS</span></p>
                {['A song of your own', 'Across the stars', 'A quieter place'].map((title, i) => (
                  <div className="home-guide-library-row" key={title}>
                    <span className={`home-guide-library-art art-${i + 1}`} aria-hidden="true" />
                    <span><strong>{title}</strong><small>{['Recently added', 'Lyrics ready', 'Saved in your Vault'][i]}</small></span>
                    <b aria-hidden="true">♫</b>
                  </div>
                ))}
              </div>
            )}
            {previewWorkspace === 'sync' && (
              <div className="home-guide-preview-sync">
                <div className="home-guide-preview-label">SYNC WORKSPACE <span>01:24 / 03:48</span></div>
                <div className="home-guide-lyrics" aria-hidden="true">
                  {DEMO_LINES.map((line, i) => (
                    <p key={line} className={i === demoIndex ? 'is-active' : i < demoIndex ? 'is-past' : ''}>{line}</p>
                  ))}
                </div>
                <div className="home-guide-timeline"><span style={{ width: `${((demoIndex + 1) / DEMO_LINES.length) * 100}%` }} /></div>
                <p className="home-guide-preview-hint">Tap along as each line plays to set its timing.</p>
              </div>
            )}
            {previewWorkspace === 'translation' && (
              <div className="home-guide-preview-translation">
                <div className="home-guide-preview-label">TRANSLATION WORKSPACE <span>ORIGINAL · TRANSLATION</span></div>
                <div><span>ORIGINAL</span><p>Hikari no naka arukidasu</p><small>ひかりのなか 歩き出す</small></div>
                <div><span>TRANSLATION</span><p>Walking into the light</p><small>Review and edit each line side by side</small></div>
              </div>
            )}
            {previewWorkspace === 'ambient' && (
              <div className="home-guide-preview-ambient">
                <span>AMBIENT MODE · NOW PLAYING</span>
                <p>Let the moment<br />find its way</p>
                <small>Lyrics drift with the music</small>
              </div>
            )}
          </div>
          <div className="home-guide-preview-tabs" role="group" aria-label="Choose a workspace preview">
            {[
              ['vault', 'Vault'],
              ['sync', 'Sync'],
              ['translation', 'Translation'],
              ['ambient', 'Ambient']
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={previewWorkspace === id}
                onClick={() => setPreviewWorkspace(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section id="about" className="home-guide-section" aria-labelledby="about-title">
        <p className="home-guide-kicker">What PlanetMusic is</p>
        <h2 id="about-title">A music library that also understands lyrics.</h2>
        <p className="home-guide-section-lead">
          PlanetMusic is not a streaming service. It is a set of tools for people who want to do more with the songs they already
          listen to: organize them, follow along with the words, and learn what the words mean.
        </p>
        <div className="home-guide-about">
          {ABOUT.map((item, i) => (
            <article key={item.title} data-reveal style={{ '--i': i }}>
              <div className="home-guide-about-art">{ABOUT_ART[i]}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="home-guide-section" aria-labelledby="how-title">
        <p className="home-guide-kicker">How it works</p>
        <h2 id="how-title">From search to synced lyrics in four steps.</h2>
        <ol className="home-guide-steps">
          {STEPS.map((s, i) => (
            <li key={s.n} data-reveal style={{ '--i': i }}>
              <div className="home-guide-step-art">{STEP_ART[i]}</div>
              <span className="home-guide-step-number">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="home-guide-inline-cta">
          <Link to="/vault">Try it in the Vault →</Link>
          <Link to="/blog/post/how-to-search-and-save-songs-to-your-vault">Read the step-by-step guide</Link>
        </div>
      </section>

      <section id="features" className="home-guide-section" aria-labelledby="features-title">
        <p className="home-guide-kicker">Features</p>
        <h2 id="features-title">Built for listening closely.</h2>
        <div className="home-guide-grid">
          {FEATURES.map((f, i) => (
            <Link key={f.title} to={f.to} className="home-guide-card" data-reveal style={{ '--i': i }}>
              <span className="home-guide-feature-art">{FEATURE_ART[i]}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <span className="home-guide-more">Read the guide <b aria-hidden="true">↗</b></span>
            </Link>
          ))}
        </div>
      </section>

      <section id="guides" className="home-guide-section" aria-labelledby="guides-title">
        <div className="home-guide-section-row">
          <div>
            <p className="home-guide-kicker">Guides</p>
            <h2 id="guides-title">Learn the workspace.</h2>
          </div>
          <Link className="home-guide-all" to="/blog/dev">All guides →</Link>
        </div>
        <div className="home-guide-guides">
          {FEATURED_GUIDES.map((g, i) => (
            <Link key={g.id} to={`/blog/post/${g.id}`} data-reveal style={{ '--i': i }}>
              <BlogPostArtwork post={g} className="home-guide-guide-artwork" />
              <span className="home-guide-guide-meta">{g.category} · {g.readTime}</span>
              <strong>{g.title}</strong>
              <span>{g.summary}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="faq" className="home-guide-section home-guide-faq" aria-labelledby="faq-title">
        <p className="home-guide-kicker">Questions</p>
        <h2 id="faq-title">Quick answers.</h2>
        <div className="home-guide-faq-list">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="home-guide-final" aria-label="Get started">
        <div>
          <h2>Bring a track. Make it yours.</h2>
          <p>Your Vault is private to this browser and ready in seconds.</p>
        </div>
        <Link to="/vault">Step into the Vault →</Link>
      </section>

      <footer className="home-guide-footer">
        <p>PlanetMusic is a music editing and organization workspace, not a licensed music catalog. Some features use third-party services.</p>
        <nav aria-label="More about PlanetMusic">
          <Link to="/blog/dev">Guides</Link><Link to="/blog/changelog">Changelog</Link><Link to="/privacy">Privacy</Link><Link to="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
};

export default HomeGuide;
