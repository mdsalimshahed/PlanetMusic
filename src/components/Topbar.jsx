/* --- src/components/Topbar.jsx --- */
import React, { useRef } from 'react';
import './Topbar.css';

const Topbar = ({ 
  activeTab, handleHomeClick, 
  handleExport, handleImport, openSettings 
}) => {
  const fileInputRef = useRef(null);

  return (
    <header className="topbar">
      {/* Left: Logo Only (Clicking Logo also resets to Home) */}
      <div className="topbar-left" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <div className="logo-area" title="PlanetMusic">
          <span className="logo-icon">🪐</span>
          <h2 className="logo-text">PlanetMusic</h2>
        </div>
      </div>

      {/* Right: Navigation & Tools */}
      <div className="topbar-right">
        <nav className="nav-menu">
          <button 
            className={`nav-btn ${activeTab === 'main' ? 'active' : ''}`} 
            onClick={handleHomeClick}
          >
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
            <span className="nav-text">Home</span>
          </button>
          
          {/* Settings Button */}
          <button className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={openSettings} title="Preferences">
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
          <button className="tool-btn glass-button" onClick={() => fileInputRef.current?.click()} title="Import Database (JSON)">
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