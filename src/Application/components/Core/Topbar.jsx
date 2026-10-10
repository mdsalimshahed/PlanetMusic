/* --- src/components/Topbar.jsx --- */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Topbar.css';

const Topbar = ({ 
  activeTab, 
  isMusicPlaying,
  albumAccentColor,
  handleHomeClick, 
  handleExport, 
  handleImport,
  isZenMode,
  toggleZenMode
}) => {
  const fileInputRef = useRef(null);
  const backupMenuRef = useRef(null);
  const navRef = useRef(null);
  const selectionRef = useRef(null);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);

  useEffect(() => {
    if (!isBackupMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!backupMenuRef.current?.contains(event.target)) setIsBackupMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsBackupMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isBackupMenuOpen]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const selection = selectionRef.current;
    if (!nav || !selection) return undefined;

    const updateSelection = () => {
      const activeLink = nav.querySelector('.nav-btn.active');
      if (!activeLink) {
        selection.style.opacity = '0';
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      selection.style.width = `${linkRect.width}px`;
      selection.style.transform = `translateX(${linkRect.left - navRect.left - nav.clientLeft}px)`;
      selection.style.opacity = '1';
      selection.classList.add('is-positioned');
    };

    updateSelection();

    const resizeObserver = new ResizeObserver(updateSelection);
    resizeObserver.observe(nav);
    nav.querySelectorAll('.nav-btn').forEach(link => resizeObserver.observe(link));

    return () => resizeObserver.disconnect();
  }, [activeTab]);

  return (
    <header className="topbar">
      {/* Left: Logo Text Only */}
      <div className="topbar-left" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <div className="logo-area" title="PlanetMusic">
          <h2
            className={`logo-text ${isMusicPlaying && albumAccentColor ? 'is-playing' : ''}`}
            data-logo-text="PlanetMusic"
            style={isMusicPlaying && albumAccentColor ? { '--logo-art-accent': albumAccentColor } : undefined}
          >
            PlanetMusic
          </h2>
        </div>
      </div>

      {/* Right: Navigation & Tools */}
      <div className="topbar-right">
        <nav className="nav-menu" ref={navRef}>
          <span className="nav-selection" ref={selectionRef} aria-hidden="true" />
          <Link 
            to="/" 
            className={`nav-btn ${activeTab === 'main' ? 'active' : ''}`}
            onClick={handleHomeClick}
            aria-current={activeTab === 'main' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Home
          </Link>

          <button
            type="button"
            className={`nav-btn ${isZenMode ? 'active' : ''}`}
            onClick={toggleZenMode}
            aria-pressed={isZenMode}
            title={isZenMode ? 'Exit Zen mode' : 'Start Zen mode'}
          >
            Zen
          </button>
          
          <Link
            to="/blog" 
            className={`nav-btn ${activeTab === 'blog' ? 'active' : ''}`}
            aria-current={activeTab === 'blog' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Blog
          </Link>

          <Link 
            to="/privacy" 
            className={`nav-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            aria-current={activeTab === 'privacy' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Privacy
          </Link>
          
          <Link 
            to="/contact" 
            className={`nav-btn ${activeTab === 'contact' ? 'active' : ''}`}
            aria-current={activeTab === 'contact' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Contact
          </Link>

          <Link 
            to="/settings" 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Settings
          </Link>
        </nav>

        <div className="topbar-divider"></div>

        {/* Database Quick Actions */}
        <div className="topbar-tools">
          <div className="backup-menu" ref={backupMenuRef}>
            <button
              type="button"
              className="tool-btn backup-menu-trigger"
              onClick={() => setIsBackupMenuOpen(open => !open)}
              aria-expanded={isBackupMenuOpen}
              aria-haspopup="menu"
              aria-label="Backup options"
            >
              <span className="tool-btn-label">Backup</span>
              <span className="tool-btn-format">JSON</span>
              <span className={`backup-menu-chevron ${isBackupMenuOpen ? 'open' : ''}`} aria-hidden="true">⌄</span>
            </button>
            {isBackupMenuOpen && (
              <div className="backup-menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="backup-menu-item"
                  onClick={() => {
                    setIsBackupMenuOpen(false);
                    handleExport();
                  }}
                >
                  <span>Export backup</span>
                  <span className="backup-menu-item-detail">Save as JSON</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="backup-menu-item"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>Import backup</span>
                  <span className="backup-menu-item-detail">Restore from JSON</span>
                </button>
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(event) => {
              setIsBackupMenuOpen(false);
              handleImport(event);
            }}
            accept=".json" 
            style={{ display: 'none' }} 
          />
        </div>
      </div>
    </header>
  );
};

export default Topbar;