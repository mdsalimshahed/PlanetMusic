/* --- src/Application/components/Promos/InFeedSponsor.jsx --- */
import SelfPromoCard from './SelfPromoCard.jsx';

const InFeedSponsor = ({ placement = 'trackGrid', format = 'square', wrapperClass = "track-grid-item", adClass = "in-feed-promo-box", wrapperStyle = {} }) => {
  return (
    <div
      className={wrapperClass}
      style={{
        minWidth: 0,
        display: 'flex',
        padding: 0,
        overflow: 'visible',
        ...(format === 'square' ? { aspectRatio: '1 / 1' } : {}),
        ...wrapperStyle
      }}
    >
      <SelfPromoCard
        placement={placement}
        format={format}
        className={adClass}
        style={{ width: '100%', borderRadius: 'inherit' }}
      />
    </div>
  );
};

export default InFeedSponsor;