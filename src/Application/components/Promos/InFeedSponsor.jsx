/* --- src/components/Promos/InFeedSponsor.jsx --- */
import React from 'react';
import SponsorUnit from './SponsorUnit.jsx';

const InFeedSponsor = ({ testMode = true, wrapperClass = "track-grid-item", adClass = "in-feed-promo-box" }) => {
  return (
    <div className={wrapperClass} style={{ minWidth: 0, display: 'flex', padding: 0, overflow: 'hidden' }}>
      <SponsorUnit 
        testMode={testMode}
        className={adClass}
        format="fluid"
        adTitle="Discover More"
        adSub="Sponsored Content"
        style={{ width: '100%', height: '100%', borderRadius: 'inherit', border: 'none', background: 'transparent' }}
      />
    </div>
  );
};

export default InFeedSponsor;