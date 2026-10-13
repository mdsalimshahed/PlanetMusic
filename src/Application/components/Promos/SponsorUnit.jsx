/* --- src/components/Promos/SponsorUnit.jsx --- */
import React, { useEffect, useRef } from 'react';
import { getAdSenseConfig, loadAdSenseScript } from './adsenseConfig.js';
import { getAdsterraUnit } from './adsterraConfig.js';
import './SponsorPlaceholders.css';

const SponsorUnit = ({ 
  client, 
  slot, 
  format = 'auto', 
  responsive = 'true', 
  style,
  className = 'glass-panel',
  placement,
  testMode = false,
  adTitle = "Advertisement",
  adSub = "Your ad will appear here"
}) => {
  const adRef = useRef(null);
  const { client: resolvedClient, slot: resolvedSlot, isValid } = getAdSenseConfig({ client, slot, placement });
  const adsterraUnit = getAdsterraUnit(placement);
  const [hasConsent, setHasConsent] = React.useState(() => (
    typeof window !== 'undefined' && localStorage.getItem('planetmusic_advertising_consent') === 'true'
  ));
  const previewMode = testMode || import.meta.env.DEV || (!adsterraUnit && !isValid) || !hasConsent;
  const shouldServeAd = !previewMode;

  useEffect(() => {
    const syncConsent = () => setHasConsent(localStorage.getItem('planetmusic_advertising_consent') === 'true');
    window.addEventListener('planetmusic-site-consent-changed', syncConsent);
    return () => window.removeEventListener('planetmusic-site-consent-changed', syncConsent);
  }, []);

  useEffect(() => {
    if (!shouldServeAd) return;

    if (adsterraUnit) {
      if (!adRef.current) return;

      if (adsterraUnit.key) {
        window.atOptions = {
          key: adsterraUnit.key,
          format: adsterraUnit.format,
          height: adsterraUnit.height,
          width: adsterraUnit.width,
          params: {}
        };
      }

      const container = document.createElement('div');
      if (adsterraUnit.containerId) container.id = adsterraUnit.containerId;
      container.style.width = adsterraUnit.width ? `${adsterraUnit.width}px` : '100%';
      if (adsterraUnit.height) container.style.height = `${adsterraUnit.height}px`;
      const script = document.createElement('script');
      script.async = true;
      script.dataset.cfasync = 'false';
      script.src = adsterraUnit.scriptUrl;

      adRef.current.append(script, container);
      return () => {
        script.remove();
        container.remove();
        if (adsterraUnit.key && window.atOptions?.key === adsterraUnit.key) {
          delete window.atOptions;
        }
      };
    }

    loadAdSenseScript(resolvedClient);
    const timer = setTimeout(() => {
      if (!adRef.current || adRef.current.hasAttribute('data-adsbygoogle-status')) return;
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch (error) {
        console.error('AdSense unit failed to initialize:', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [shouldServeAd, resolvedClient, resolvedSlot, adsterraUnit]);

  if (previewMode) {
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

  if (adsterraUnit) {
    return (
      <div
        ref={adRef}
        className={`${className}${adsterraUnit.width === 160 && adsterraUnit.height === 600 ? ' adsterra-sidebar-160x600' : ''}`}
        style={{ display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'hidden', ...style }}
      />
    );
  }

  return (
    <div className={className} style={{ display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'hidden', ...style }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%' }}
        data-ad-client={resolvedClient}
        data-ad-slot={resolvedSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};

export default SponsorUnit;