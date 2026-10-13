/* --- src/components/ConsentNotice.jsx --- */
import { useState, useEffect } from 'react';

const ConsentNotice = () => {
  const [isVisible, setIsVisible] = useState(() => {
    const consent = localStorage.getItem('planetmusic_advertising_consent');
    return consent !== 'true' && consent !== 'false';
  });

  useEffect(() => {
    const showAdChoice = () => setIsVisible(true);
    window.addEventListener('planetmusic-open-ad-choice', showAdChoice);
    return () => window.removeEventListener('planetmusic-open-ad-choice', showAdChoice);
  }, []);

  const saveAdChoice = (allowed) => {
    localStorage.setItem('planetmusic_advertising_consent', String(allowed));
    window.dispatchEvent(new Event('planetmusic-site-consent-changed'));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div role="group" aria-label="Advertising choice" style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(15, 15, 25, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      padding: '16px 24px',
      borderRadius: 'var(--dyn-border-radius, 16px)',
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
        Choose whether third-party ads may load in this browser. Read our <a href="/privacy" style={{ color: '#fff' }}>privacy information</a>.
      </p>
      <button 
        onClick={() => saveAdChoice(true)}
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
        Allow ads
      </button>
      <button
        onClick={() => saveAdChoice(false)}
        style={{
          background: 'transparent',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          padding: '8px 20px',
          borderRadius: '500px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Continue without ads
      </button>
    </div>
  );
};

export default ConsentNotice;