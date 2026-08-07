/* --- src/components/Settings/DeezerAuthCard.jsx --- */
import React from 'react';

const DeezerAuthCard = ({ 
  settings, handleChange, handleVerifyArl, 
  showArl, setShowArl, isVerifying, verifyResult, setVerifyResult, authGradient 
}) => {
  return (
    <div className="settings-card glass-panel deezer-auth-card" style={{ '--auth-gradient': authGradient }}>
      <h3>Deezer ARL Token (Optional)</h3>
      <div className="deezer-auth-instructions">
        <p>This token unlocks high-quality audio streams directly from Deezer. <strong>The Cosmos search works perfectly fine without it</strong>, but you need a valid ARL to actually play the Deezer audio sources.</p>
        <p><strong>How to easily get an ARL:</strong><br/>1. Create a free account at Deezer.com in your web browser.<br/>2. Open your Browser's Developer Tools (F12) and go to the <strong>Application</strong> tab (or Storage tab).<br/>3. Expand <strong>Cookies</strong> on the sidebar, select the Deezer domain, and copy the value of the cookie named <code>arl</code>.</p>
        <p className="security-warning">  <strong>Privacy & Security:</strong> Your token is stored entirely locally on your device. It is only sent to our secure backend proxy to fetch audio streams and is <strong>NEVER</strong> exported or shared when you backup your database to JSON.</p>
      </div>
      <div className="setting-item" style={{ marginBottom: 0, width: '100%' }}>
        <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
          <input
            type={showArl ? 'text' : 'password'}
            name="deezerArl"
            value={settings.deezerArl || ''}
            onChange={(e) => { 
              handleChange(e); 
              if (e.target.name === 'deezerArl') setVerifyResult(null); 
            }}
            placeholder="Paste Deezer ARL token here..."
            style={{ 
              flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '8px', height: '44px',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white', outline: 'none', fontSize: '14px' 
            }}
          />
          <button
            type="button"
            onClick={() => setShowArl(!showArl)}
            style={{ 
              padding: '0 16px', height: '44px', background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 
            }}
            title={showArl ? "Hide Token" : "Show Token"}
          >
            {showArl ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            )}
          </button>
        </div>
        <button 
          className="verify-arl-btn" 
          onClick={handleVerifyArl}
          disabled={isVerifying || !settings.deezerArl}
        >
          {isVerifying ? 'Verifying Token...' : 'Verify Token Status'}
        </button>
        {verifyResult === 'success' && (
          <span style={{ color: '#4ade80', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>  Valid ARL. High-Quality Streams Unlocked!</span>
        )}
        {verifyResult === 'error' && (
          <span style={{ color: '#FA243C', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>  Invalid or Expired ARL. Please replace it.</span>
        )}
      </div>
    </div>
  );
};

export default DeezerAuthCard;