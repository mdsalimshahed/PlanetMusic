import { Link } from 'react-router-dom';
import './HomeGuide.css';

const HomeGuide = () => (
  <section className="home-guide" aria-labelledby="home-guide-title">
    <div className="home-guide-hero">
      <div className="home-guide-copy">
        <p className="home-guide-eyebrow">
          <span className="home-guide-eyebrow-dot" aria-hidden="true" />
          Your music, in a new dimension
        </p>
        <h1 id="home-guide-title">
          Hear the song.
          <br />
          <span>Shape the experience.</span>
        </h1>
        <p className="home-guide-lead">
          A personal space to collect tracks, bring lyrics into sync, and explore every line in
          another language.
        </p>
        <div className="home-guide-actions">
          <Link className="home-guide-primary" to="/vault">
            Open your Vault
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h12m-5-5 5 5-5 5" />
            </svg>
          </Link>
          <Link className="home-guide-secondary" to="/blog/dev">
            Explore the guides
          </Link>
        </div>
        <div className="home-guide-note">
          <span aria-hidden="true">✳</span>
          No account needed. Your Vault stays in this browser.
        </div>
      </div>

      <div className="home-guide-visual" aria-label="Illustration of synchronized lyrics in the PlanetMusic workspace">
        <div className="home-guide-orbit home-guide-orbit-outer" aria-hidden="true" />
        <div className="home-guide-orbit home-guide-orbit-inner" aria-hidden="true" />
        <div className="home-guide-orb home-guide-orb-one" aria-hidden="true" />
        <div className="home-guide-orb home-guide-orb-two" aria-hidden="true" />
        <div className="home-guide-player">
          <div className="home-guide-player-top">
            <span><i /> WORKSPACE PREVIEW</span>
            <span className="home-guide-player-menu" aria-hidden="true">···</span>
          </div>
          <div className="home-guide-track">
            <div className="home-guide-cover" aria-hidden="true">
              <span />
            </div>
            <div className="home-guide-track-info">
              <strong>A song of your own</strong>
              <span>Your personal Vault</span>
            </div>
            <span className="home-guide-track-more" aria-hidden="true">♫</span>
          </div>
          <div className="home-guide-lyrics">
            <p>Find the words that stay</p>
            <p className="home-guide-lyric-active"><span>♪</span> Let the moment find its way</p>
            <p>Every note becomes a place</p>
          </div>
          <div className="home-guide-timeline" aria-hidden="true">
            <span><i /></span>
            <div><b>01:24</b><b>03:48</b></div>
          </div>
          <div className="home-guide-player-bottom" aria-hidden="true">
            <span>↶</span><span className="home-guide-play">▶</span><span>↷</span>
            <span className="home-guide-language">A 文 &nbsp; Translation</span>
          </div>
        </div>
        <div className="home-guide-float home-guide-float-sync">
          <span className="home-guide-float-icon" aria-hidden="true">〰</span>
          <span><b>Line by line</b><small>Lyrics in sync</small></span>
        </div>
        <div className="home-guide-float home-guide-float-translate">
          <span className="home-guide-translate-icon" aria-hidden="true">文</span>
          <span><b>More than words</b><small>Explore translations</small></span>
        </div>
      </div>
    </div>

    <div className="home-guide-section-heading">
      <div>
        <p className="home-guide-section-kicker">A better way to listen in</p>
        <h2>More than a music library.</h2>
      </div>
      <p>One track can become a listening room, a lyric project, and a window into another language.</p>
    </div>

    <div className="home-guide-features">
      <Link className="home-guide-feature home-guide-feature-lyrics" to="/blog/post/how-to-sync-songs-with-music">
        <span className="home-guide-feature-art home-guide-art-lyrics" aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
        <span className="home-guide-feature-label">01 / Find your rhythm</span>
        <strong>Lyrics that move with the music.</strong>
        <span className="home-guide-feature-description">
          Write, arrange, and time each line in the Sync Workspace, then follow along in your preferred view.
        </span>
        <span className="home-guide-feature-link">See how syncing works <b aria-hidden="true">↗</b></span>
      </Link>

      <Link className="home-guide-feature home-guide-feature-language" to="/blog/post/complete-guide-to-the-translation-workspace">
        <span className="home-guide-feature-art home-guide-art-language" aria-hidden="true">
          <span>言</span><span>あ</span><span>A</span>
        </span>
        <span className="home-guide-feature-label">02 / Hear another meaning</span>
        <strong>Let every language have a voice.</strong>
        <span className="home-guide-feature-description">
          Keep original lyrics beside translations and phonetic readings. Review machine-generated text against its source.
        </span>
        <span className="home-guide-feature-link">Explore translation tools <b aria-hidden="true">↗</b></span>
      </Link>

      <Link className="home-guide-feature home-guide-feature-vault" to="/blog/post/data-storage-backups-purge-button">
        <span className="home-guide-feature-art home-guide-art-vault" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="home-guide-feature-label">03 / Keep it yours</span>
        <strong>A little corner of the cosmos.</strong>
        <span className="home-guide-feature-description">
          Your library and settings stay in this browser. Export a JSON backup to carry your Vault with you.
        </span>
        <span className="home-guide-feature-link">How storage works <b aria-hidden="true">↗</b></span>
      </Link>
    </div>

    <div className="home-guide-bottom">
      <div>
        <span className="home-guide-bottom-mark" aria-hidden="true">✳</span>
        <p><strong>Your next listening ritual starts here.</strong><span>Bring a track. Make it yours.</span></p>
      </div>
      <Link to="/vault">Step into the Vault <span aria-hidden="true">→</span></Link>
    </div>

    <footer className="home-guide-footer">
      <p>PlanetMusic is a music editing and organization workspace, not a licensed music catalog. Some features use third-party services.</p>
      <nav aria-label="More about PlanetMusic">
        <Link to="/blog/changelog">Changelog</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/contact">Contact</Link>
      </nav>
    </footer>
  </section>
);

export default HomeGuide;
