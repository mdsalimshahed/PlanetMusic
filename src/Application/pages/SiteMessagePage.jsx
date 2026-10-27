import { Link } from 'react-router-dom';
import './SiteMessagePage.css';

const SiteMessagePage = () => {
  return (
    <section className="view-section site-message-page">
      <article className="site-message-card glass-panel" aria-labelledby="site-message-title">
        <p className="site-message-eyebrow">404 · PlanetMusic</p>
        <h1 id="site-message-title">We couldn’t find that page.</h1>
        <p>
          The address may be outdated, or the page may have moved. Check the URL or use one of these links to continue.
        </p>
        <nav className="site-message-links" aria-label="Helpful pages">
          <Link className="site-message-primary" to="/">Go to PlanetMusic</Link>
          <Link to="/docs/dev-blogs">Browse guides</Link>
          <Link to="/docs/changelog">View changelog</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </article>
    </section>
  );
};

export default SiteMessagePage;
