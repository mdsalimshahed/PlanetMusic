import SelfPromoCard from '../components/Promos/SelfPromoCard.jsx';
import './PrivacyTab.css';

const LegalDocumentLayout = ({ adsEnabled, children }) => (
  <section className="view-section privacy-tab-container">
    <div className="privacy-layout-wrapper">
      <div className="privacy-main-content">{children}</div>
      <aside className="privacy-sidebar">
        {adsEnabled && (
          <>
            <SelfPromoCard
              placement="privacySidebar"
              format="sidebar"
              className="glass-panel dynamic-radius-override page-sidebar-ad-large"
            />
            <SelfPromoCard
              placement="privacyStickySidebar"
              format="sidebar"
              className="glass-panel dynamic-radius-override page-sidebar-ad-small"
            />
          </>
        )}
      </aside>
    </div>
    {adsEnabled && (
      <SelfPromoCard
        placement="privacyBottom"
        format="banner"
        className="glass-panel settings-promo-box dynamic-radius-override"
        style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
      />
    )}
  </section>
);

export default LegalDocumentLayout;
