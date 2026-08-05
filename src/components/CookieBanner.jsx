/* --- src/components/CookieBanner.jsx --- */
import React, { useState, useEffect } from 'react';

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('planetmusic_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('planetmusic_cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(15, 15, 25, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      padding: '16px 24px',
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      zIndex: 100000,
      boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
      width: 'max-content',
      maxWidth: '90vw',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }}>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5, textAlign: 'center' }}>
        We use cookies to personalize content, serve targeted advertisements (via Google AdSense), and analyze our traffic. By using PlanetMusic, you consent to our use of cookies.
      </p>
      <button 
        onClick={handleAccept}
        style={{
          background: '#fbbf24',
          color: 'black',
          border: 'none',
          padding: '8px 20px',
          borderRadius: '500px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Got it
      </button>
    </div>
  );
};

export default CookieBanner;