const PromoFeatureGraphic = ({ type }) => (
  <svg className={`self-promo-feature-graphic is-${type}`} viewBox="0 0 24 24" aria-hidden="true">
    {type === 'captions' && (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M7 10h10M7 14h7" />
      </>
    )}
    {type === 'youtube' && (
      <>
        <rect x="3" y="5" width="18" height="14" rx="4" />
        <path d="m10 9 5 3-5 3V9Z" />
      </>
    )}
    {type === 'chapters' && (
      <>
        <path d="M5 5h14M5 12h14M5 19h14" />
        <circle className="self-promo-feature-fill" cx="3" cy="5" r="1" />
        <circle className="self-promo-feature-fill" cx="3" cy="12" r="1" />
        <circle className="self-promo-feature-fill" cx="3" cy="19" r="1" />
      </>
    )}
    {type === 'bookmark' && <path d="M7 4h10v17l-5-3-5 3V4Zm3 5h4" />}
    {type === 'edit' && (
      <>
        <path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z" />
        <path d="m13.5 6.5 4 4" />
      </>
    )}
    {type === 'games' && (
      <>
        <path d="M7 8h10a4 4 0 0 1 3.8 5l-1 3a2 2 0 0 1-3.2 1l-2.1-1.6h-5L7.4 17a2 2 0 0 1-3.2-1l-1-3A4 4 0 0 1 7 8Z" />
        <path d="M7 11v4m-2-2h4m7-1h.01M18 14h.01" />
      </>
    )}
    {type === 'hours' && (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    )}
    {type === 'timecode' && (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 8v8m4-5v5m4-8v8m4-5v5" />
      </>
    )}
    {type === 'timeline' && (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="7" cy="7" r="2" />
        <circle cx="16" cy="17" r="2" />
      </>
    )}
    {type === 'stats' && (
      <>
        <path d="M4 20V5m0 15h17" />
        <path d="M7 16v-4m5 4V8m5 8V5" />
        <path d="m6 10 5-4 4 1 5-4" />
      </>
    )}
    {type === 'progress' && (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    )}
    {type === 'completion' && (
      <>
        <path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    )}
    {type === 'library' && (
      <>
        <path d="M4 5h6l2 2h8v12H4V5Z" />
        <path d="M7 11h10m-10 4h7" />
      </>
    )}
    {type === 'activity' && (
      <>
        <rect x="4" y="4" width="5" height="5" rx="1" />
        <rect x="11" y="4" width="5" height="5" rx="1" />
        <rect x="4" y="11" width="5" height="5" rx="1" />
        <rect x="11" y="11" width="5" height="5" rx="1" />
        <rect className="self-promo-feature-fill" x="18" y="11" width="3" height="5" rx="1" />
      </>
    )}
    {type === 'keyboard' && (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h.01m4 0h6" />
      </>
    )}
    {type === 'export' && (
      <>
        <path d="M12 15V3m-4 4 4-4 4 4" />
        <path d="M5 12v8h14v-8" />
      </>
    )}
    {type === 'spark' && (
      <>
        <path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z" />
        <circle cx="19" cy="5" r="1" />
      </>
    )}
  </svg>
);

export default PromoFeatureGraphic;
