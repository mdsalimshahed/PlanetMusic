/* --- src/components/Promos/SponsorUnit.jsx --- */
import React, { useEffect, useRef } from 'react';
import './SponsorPlaceholders.css';

const SponsorUnit = ({ 
  client, 
  slot, 
  format = 'auto', 
  responsive = 'true', 
  style,
  className = 'glass-panel',
  testMode = true,
  adTitle = "Advertisement",
  adSub = "Your ad will appear here"
}) => {
  const adRef = useRef(null);

  useEffect(() => {
    if (!testMode && window && window.adsbygoogle) {
      try {
        setTimeout(() => {
          if (adRef.current && !adRef.current.hasAttribute('data-adsbygoogle-status')) {
            window.adsbygoogle.push({});
          }
        }, 100);
      } catch (e) {
        console.error('Sponsor injection error:', e);
      }
    }
  }, [testMode]);

  if (testMode) {
    return (
      <div className={`promo-box-container ${className}`} style={style}>
        <span className="promo-label">Sponsored</span>
        <div className="promo-shimmer"></div>
        <div className="promo-content">
          <h4>{adTitle}</h4>
          <p>{adSub}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'hidden', ...style }}>
      <span className="promo-label" style={{ top: '4px', left: '8px', fontSize: '8px' }}>Sponsored</span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%' }}
        data-ad-client={client || "ca-pub-XXXXXXXXXXXXXXXX"}
        data-ad-slot={slot || "XXXXXXXXXX"}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};

export default SponsorUnit;