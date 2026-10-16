/* --- src/components/Topbar.jsx --- */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PlanetMusicLogo from './PlanetMusicLogo.jsx';
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
  const zenNavItemRef = useRef(null);
  const zenDropdownRef = useRef(null);
  const zenNavWidthMeasureRef = useRef(null);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [isZenMenuOpen, setIsZenMenuOpen] = useState(false);

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

  useEffect(() => {
    if (!isZenMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!event.target.closest('.zen-nav-item')) setIsZenMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsZenMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isZenMenuOpen]);

  useLayoutEffect(() => {
    if (!isZenMenuOpen || !window.matchMedia('(max-width: 600px)').matches) return undefined;
    const navItem = zenNavItemRef.current;
    const dropdown = zenDropdownRef.current;
    const nav = navRef.current;
    if (!navItem || !dropdown || !nav) return undefined;

    const positionDropdown = () => {
      const bounds = navItem.getBoundingClientRect();
      dropdown.style.setProperty('--zen-dropdown-top', `${bounds.bottom}px`);
      dropdown.style.setProperty('--zen-dropdown-left', `${bounds.left}px`);
      dropdown.style.setProperty('--zen-dropdown-width', `${bounds.width}px`);
    };

    positionDropdown();
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown, true);
    nav.addEventListener('scroll', positionDropdown, { passive: true });
    return () => {
      window.removeEventListener('resize', positionDropdown);
      window.removeEventListener('scroll', positionDropdown, true);
      nav.removeEventListener('scroll', positionDropdown);
    };
  }, [isZenMenuOpen]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const selection = selectionRef.current;
    const zenNavItem = zenNavItemRef.current;
    const zenNavWidthMeasure = zenNavWidthMeasureRef.current;
    if (!nav || !selection || !zenNavItem || !zenNavWidthMeasure) return undefined;

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

    const updateZenNavWidth = () => {
      const width = zenNavWidthMeasure.getBoundingClientRect().width;
      if (width > 0) zenNavItem.style.width = `${width}px`;
    };

    updateZenNavWidth();
    updateSelection();
    const resizeObserver = new ResizeObserver(() => {
      updateZenNavWidth();
      updateSelection();
    });
    resizeObserver.observe(nav);
    resizeObserver.observe(zenNavWidthMeasure);
    nav.querySelectorAll('.nav-btn').forEach(link => resizeObserver.observe(link));

    return () => resizeObserver.disconnect();
  }, [activeTab]);

  return (
    <header className="topbar">
      {/* Left: Brand wordmark */}
      <div className="topbar-left" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <div className="logo-area">
          <h2 className="logo-text" title="PlanetMusic">
            <PlanetMusicLogo
              isPlaying={isMusicPlaying && Boolean(albumAccentColor)}
              albumAccentColor={albumAccentColor}
            />
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

          <Link
            to="/vault"
            className={`nav-btn ${activeTab === 'vault' ? 'active' : ''}`}
            aria-current={activeTab === 'vault' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Vault
          </Link>

          <div
            ref={zenNavItemRef}
            className={`zen-nav-item${isZenMenuOpen ? ' is-open' : ''}`}
          >
            <span
              ref={zenNavWidthMeasureRef}
              className="nav-btn zen-nav-width-measure"
              aria-hidden="true"
            >
              Ambient
            </span>
            {activeTab !== 'zen' ? (
              <Link
                to="/ambient"
                className={`nav-btn ${activeTab === 'ambient' ? 'active' : ''}`}
                aria-current={activeTab === 'ambient' ? 'page' : undefined}
                aria-haspopup="true"
                aria-expanded={isZenMenuOpen}
                style={{ textDecoration: 'none' }}
                onClick={event => {
                  if (window.matchMedia('(hover: none)').matches && !isZenMenuOpen) {
                    event.preventDefault();
                    setIsZenMenuOpen(true);
                    return;
                  }
                  setIsZenMenuOpen(false);
                }}
              >
                Ambient
              </Link>
            ) : (
              <button
                type="button"
                className={`nav-btn ${isZenMode ? 'active' : ''}`}
                onClick={() => {
                  if (window.matchMedia('(hover: none)').matches && !isZenMenuOpen) {
                    setIsZenMenuOpen(true);
                    return;
                  }
                  setIsZenMenuOpen(false);
                  toggleZenMode();
                }}
                aria-pressed={isZenMode}
                aria-haspopup="true"
                aria-expanded={isZenMenuOpen}
                title={isZenMode ? 'Exit Zen mode' : 'Start Zen mode'}
              >
                Zen
              </button>
            )}
            <div className="zen-nav-dropdown" ref={zenDropdownRef} aria-label="Zen modes">
              {activeTab === 'zen' ? (
                <Link
                  to="/ambient"
                  className="nav-btn zen-nav-dropdown-item"
                  style={{ textDecoration: 'none' }}
                  onClick={() => setIsZenMenuOpen(false)}
                >
                  Ambient
                </Link>
              ) : (
                <button
                  type="button"
                  className="nav-btn zen-nav-dropdown-item"
                  onClick={() => {
                    setIsZenMenuOpen(false);
                    toggleZenMode();
                  }}
                  title="Start Zen mode"
                >
                  Zen
                </button>
              )}
            </div>
          </div>
          
          <Link
            to="/docs/dev-blogs"
            className={`nav-btn ${activeTab === 'blog' ? 'active' : ''}`}
            aria-current={activeTab === 'blog' ? 'page' : undefined}
            style={{ textDecoration: 'none' }}
          >
            Docs
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