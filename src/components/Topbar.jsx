/* --- src/components/Topbar.jsx --- */
import React, { useRef } from 'react';
import './Topbar.css';

const Topbar = ({ 
  activeTab, setActiveTab, 
  handleExport, handleImport, openSettings 
}) => {
  const fileInputRef = useRef(null);

  // Removed 'glass-panel-heavy' to eliminate the full-width top band
  return (
    <header className="topbar">
      {/* Left: Logo Only */}
      <div className="topbar-left">
        <div className="logo-area" title="PlanetMusic">
          <span className="logo-icon">🪐</span>
          <h2 className="logo-text">PlanetMusic</h2>
        </div>
      </div>

      {/* Right: Everything Else */}
      <div className="topbar-right">
        {/* Navigation First */}
        <nav className="nav-menu">
          <button 
            className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`} 
            onClick={() => setActiveTab('search')}
          >
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
              </svg>
            </span>
            <span className="nav-text">Discover</span>
          </button>

          <button 
            className={`nav-btn ${activeTab === 'library' ? 'active' : ''}`} 
            onClick={() => setActiveTab('library')}
          >
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="18" y1="6" x2="18.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
                <line x1="18" y1="18" x2="18.01" y2="18"></line>
              </svg>
            </span>
            <span className="nav-text">Vault</span>
          </button>

          {/* Settings Button */}
          <button className="nav-btn" onClick={openSettings} title="Preferences">
            <span className="nav-icon">⚙️</span>
            <span className="nav-text">Settings</span>
          </button>
        </nav>

        {/* Divider */}
        <div className="topbar-divider"></div>

        {/* Minimalist Database Tools */}
        <div className="topbar-tools">
          <button className="tool-btn glass-button" onClick={handleExport} title="Export Database (JSON)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>
          
          <input 
            type="file" 
            accept=".json,application/json" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleImport} 
          />
          <button className="tool-btn glass-button" onClick={() => fileInputRef.current.click()} title="Import Database (JSON)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;