import SponsorUnit from '../components/Promos/SponsorUnit.jsx';
import './PrivacyTab.css';

const LegalDocumentLayout = ({ adsEnabled, children }) => (
  <section className="view-section privacy-tab-container">
    <div className="privacy-layout-wrapper">
      <div className="privacy-main-content">{children}</div>
      <aside className="privacy-sidebar">
        {adsEnabled && (
          <>
            <SponsorUnit
              placement="privacySidebar"
              className="glass-panel dynamic-radius-override page-sidebar-ad-large"
              adTitle="Sponsor"
              adSub="Sidebar Advertisement Space"
            />
            <SponsorUnit
              placement="privacyStickySidebar"
              className="glass-panel dynamic-radius-override page-sidebar-ad-small"
              adTitle="Discover More"
              adSub="Sticky Sidebar Ad"
            />
          </>
        )}
      </aside>
    </div>
    {adsEnabled && (
      <SponsorUnit
        placement="privacyBottom"
        className="glass-panel settings-promo-box dynamic-radius-override"
        style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
        adTitle="Sponsor / Partner"
        adSub="Thank you for supporting PlanetMusic"
      />
    )}
  </section>
);

export default LegalDocumentLayout;
