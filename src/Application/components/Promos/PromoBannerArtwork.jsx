import { PromoArtwork } from './PromoArtwork.jsx';

export const PromoBannerArtwork = ({ visual }) => (
  <span className={`self-promo-banner-art self-promo-banner-art-${visual}`} aria-hidden="true">
    {visual === 'captions' ? (
      <svg viewBox="0 0 360 190" role="presentation">
        <rect className="banner-art-frame" x="5" y="5" width="350" height="180" rx="20" />
        <rect className="banner-art-panel" x="17" y="17" width="198" height="109" rx="13" />
        <circle className="banner-art-control" cx="30" cy="30" r="3" />
        <circle className="banner-art-control" cx="41" cy="30" r="3" />
        <circle className="banner-art-control" cx="52" cy="30" r="3" />
        <circle className="banner-art-play" cx="116" cy="72" r="21" />
        <path className="banner-art-play-triangle" d="M111 61v22l18-11-18-11Z" />
        <rect className="banner-art-caption" x="66" y="100" width="101" height="7" rx="3.5" />
        <rect className="banner-art-panel" x="225" y="17" width="123" height="109" rx="13" />
        <rect className="banner-art-chapter-active" x="236" y="31" width="101" height="24" rx="7" />
        <rect className="banner-art-line" x="244" y="40" width="70" height="6" rx="3" />
        <rect className="banner-art-chapter" x="236" y="62" width="101" height="24" rx="7" />
        <rect className="banner-art-line" x="244" y="71" width="82" height="6" rx="3" />
        <rect className="banner-art-chapter" x="236" y="93" width="101" height="22" rx="7" />
        <rect className="banner-art-line" x="244" y="101" width="61" height="6" rx="3" />
        <rect className="banner-art-timeline" x="17" y="137" width="331" height="36" rx="11" />
        <rect className="banner-art-segment banner-art-segment-one" x="29" y="148" width="92" height="14" rx="5" />
        <rect className="banner-art-segment banner-art-segment-two" x="127" y="148" width="80" height="14" rx="5" />
        <rect className="banner-art-segment banner-art-segment-three" x="213" y="148" width="123" height="14" rx="5" />
        <circle className="banner-art-marker" cx="124" cy="155" r="5" />
        <circle className="banner-art-marker" cx="210" cy="155" r="5" />
      </svg>
    ) : (
      <svg viewBox="0 0 360 190" role="presentation">
        <rect className="banner-art-frame" x="5" y="5" width="350" height="180" rx="20" />
        <rect className="banner-art-panel" x="17" y="17" width="326" height="40" rx="11" />
        <circle className="banner-art-dot" cx="36" cy="37" r="5" />
        <rect className="banner-art-stat-strong" x="51" y="29" width="82" height="15" rx="6" />
        <rect className="banner-art-stat" x="239" y="29" width="39" height="6" rx="3" />
        <rect className="banner-art-stat-strong" x="284" y="26" width="43" height="17" rx="6" />
        <rect className="banner-art-panel" x="17" y="68" width="214" height="105" rx="13" />
        <circle cx="72" cy="120" r="34" fill="none" stroke="currentColor" strokeWidth="11" opacity=".2" />
        <circle cx="72" cy="120" r="34" fill="none" stroke="currentColor" strokeWidth="11" strokeDasharray="151 214" strokeLinecap="round" transform="rotate(-90 72 120)" />
        <circle cx="72" cy="120" r="22" fill="color-mix(in srgb, var(--self-promo-accent) 13%, #131c30)" />
        <rect className="banner-art-stat-strong" x="124" y="96" width="78" height="11" rx="5" />
        <rect className="banner-art-stat" x="124" y="116" width="61" height="6" rx="3" />
        <rect className="banner-art-row" x="124" y="135" width="88" height="23" rx="7" />
        <path className="banner-art-gridline" d="M135 147h13m7 0h14m7 0h14" />
        <rect className="banner-art-panel" x="243" y="68" width="100" height="105" rx="13" />
        <rect className="banner-art-chapter-active" x="256" y="81" width="74" height="23" rx="7" />
        <circle className="banner-art-dot" cx="267" cy="92" r="4" />
        <rect className="banner-art-line" x="278" y="89" width="40" height="6" rx="3" />
        <rect className="banner-art-row" x="256" y="110" width="74" height="23" rx="7" />
        <circle className="banner-art-dot" cx="267" cy="121" r="4" />
        <rect className="banner-art-line" x="278" y="118" width="34" height="6" rx="3" />
        <rect className="banner-art-row" x="256" y="139" width="74" height="23" rx="7" />
        <circle className="banner-art-dot" cx="267" cy="150" r="4" />
        <rect className="banner-art-line" x="278" y="147" width="42" height="6" rx="3" />
      </svg>
    )}
  </span>
);

export const PromoBannerArtworkGallery = ({ visual, supportingVisuals, rotates }) => {
  if (!rotates) {
    return (
      <span className="self-promo-banner-gallery" aria-hidden="true">
        <PromoBannerArtwork visual={visual} />
        <span className="self-promo-banner-supporting-art">
          {supportingVisuals.map((supportingVisual) => (
            <PromoArtwork key={supportingVisual} visual={supportingVisual} />
          ))}
        </span>
      </span>
    );
  }

  const artwork = [
    <PromoBannerArtwork visual={visual} />,
    ...supportingVisuals.map((supportingVisual) => (
      <PromoArtwork visual={supportingVisual} />
    ))
  ];

  return (
    <span className="self-promo-banner-gallery" aria-hidden="true">
      {artwork.map((graphic, index) => (
        <span
          className="self-promo-banner-item"
          data-artwork-index={index}
          data-rotates={rotates || undefined}
          key={index}
        >
          {graphic}
        </span>
      ))}
    </span>
  );
};


export default PromoBannerArtworkGallery;
