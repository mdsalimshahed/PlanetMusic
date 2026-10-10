/* --- src/components/Topbar.jsx --- */
import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Topbar.css';

const Topbar = ({ 
  activeTab, 
  isMusicPlaying,
  albumAccentColor,
  handleHomeClick, 
  handleExport, 
  handleImport
}) => {
  const fileInputRef = useRef(null);
  const navRef = useRef(null);
  const selectionRef = useRef(null);

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
          <button 
            className="tool-btn"
            onClick={handleExport}
            title="Export Backup JSON"
            aria-label="Export backup JSON"
          >
            <span className="tool-btn-label">Export</span>
            <span className="tool-btn-format">JSON</span>
          </button>

          <button 
            className="tool-btn"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Import Backup JSON"
            aria-label="Import backup JSON"
          >
            <span className="tool-btn-label">Import</span>
            <span className="tool-btn-format">JSON</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            style={{ display: 'none' }} 
          />
        </div>
      </div>
    </header>
  );
};

export default Topbar;