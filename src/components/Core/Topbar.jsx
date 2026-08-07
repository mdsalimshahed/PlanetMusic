/* --- src/components/Topbar.jsx --- */
import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import './Topbar.css';

const Topbar = ({ 
  activeTab, 
  handleHomeClick, 
  handleExport, 
  handleImport, 
  handleLoadSample
}) => {
  const fileInputRef = useRef(null);

  return (
    <header className="topbar">
      {/* Left: Logo Text Only */}
      <div className="topbar-left" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <div className="logo-area" title="PlanetMusic">
          <h2 className="logo-text">PlanetMusic</h2>
        </div>
      </div>

      {/* Right: Navigation & Tools */}
      <div className="topbar-right">
        <nav className="nav-menu">
          <Link 
            to="/" 
            className={`nav-btn ${activeTab === 'main' ? 'active' : ''}`}
            onClick={handleHomeClick}
            style={{ textDecoration: 'none' }}
          >
            Home
          </Link>
          
          <Link 
            to="/blog" 
            className={`nav-btn ${activeTab === 'blog' ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            Blog
          </Link>

          <Link 
            to="/privacy" 
            className={`nav-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            Privacy
          </Link>
          
          <Link 
            to="/contact" 
            className={`nav-btn ${activeTab === 'contact' ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            Contact
          </Link>

          <Link 
            to="/settings" 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            Settings
          </Link>
        </nav>

        <div className="topbar-divider"></div>

        {/* Database Quick Actions */}
        <div className="topbar-tools">
          <button 
            className="tool-btn glass-button" 
            onClick={handleExport}
            title="Export Backup JSON"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>

          <button 
            className="tool-btn glass-button" 
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title="Import Backup JSON"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
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