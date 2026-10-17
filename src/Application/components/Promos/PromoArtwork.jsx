export const PromoArtwork = ({ visual }) => (
  <span className={`self-promo-art self-promo-art-${visual}`} aria-hidden="true">
    <svg viewBox="0 0 180 118" role="presentation">
      <rect className="art-frame" x="8" y="8" width="164" height="102" rx="16" />
      {visual === 'chapters' && (
        <>
          <rect className="art-chapter-track" x="22" y="24" width="136" height="70" rx="10" />
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <rect className={index === 0 ? 'art-chapter art-chapter-one' : 'art-chapter-track'} x="31" y={34 + index * 19} width="23" height="12" rx="4" />
              <rect className="art-chapter" x="62" y={35 + index * 19} width={index === 1 ? 76 : 88} height="5" rx="2.5" />
              <rect className="art-caption" x="62" y={43 + index * 19} width={index === 2 ? 49 : 62} height="3" rx="1.5" />
            </g>
          ))}
          <path className="art-trend" d="M43 99h94" />
          <circle className="art-point" cx="91" cy="99" r="4" />
        </>
      )}
      {visual === 'captions' && (
        <>
          <circle className="art-control" cx="24" cy="23" r="3" />
          <circle className="art-control" cx="35" cy="23" r="3" />
          <circle className="art-control" cx="46" cy="23" r="3" />
          <path className="art-play" d="M77 35v31l26-15.5L77 35Z" />
          <path className="art-wave" d="M29 76v8m9-12v16m9-9v5m9-14v20m9-15v10m9-12v14m9-19v24m9-15v6m9-11v17m9-14v9m9-17v22m9-13v6m9-10v14m9-7v3" />
          <rect className="art-chapter-track" x="29" y="96" width="122" height="5" rx="2.5" />
          <rect className="art-chapter art-chapter-one" x="29" y="96" width="43" height="5" rx="2.5" />
          <rect className="art-chapter art-chapter-two" x="76" y="96" width="31" height="5" rx="2.5" />
          <rect className="art-chapter art-chapter-three" x="111" y="96" width="40" height="5" rx="2.5" />
          <circle className="art-chapter-marker" cx="74" cy="98.5" r="3" />
          <circle className="art-chapter-marker" cx="109" cy="98.5" r="3" />
        </>
      )}
      {visual === 'subtitle' && (
        <>
          <circle className="art-play" cx="39" cy="39" r="15" />
          <path className="art-play" d="M36 31v16l13-8-13-8Z" />
          <rect className="art-chapter-track" x="65" y="25" width="88" height="27" rx="7" />
          <rect className="art-caption" x="74" y="33" width="66" height="5" rx="2.5" />
          <rect className="art-caption" x="74" y="42" width="47" height="4" rx="2" />
          <path className="art-axis" d="M24 72h132" />
          <path className="art-wave" d="M34 78v8m8-12v12m8-7v7m8-16v16m8-10v10m8-14v14m8-8v8m8-18v18m8-11v11m8-15v15m8-8v8m8-13v13m8-10v10m8-6v6" />
          <rect className="art-chapter art-chapter-one" x="27" y="97" width="58" height="5" rx="2.5" />
          <rect className="art-chapter art-chapter-two" x="89" y="97" width="64" height="5" rx="2.5" />
        </>
      )}
      {visual === 'bookmark' && (
        <>
          <circle className="art-chapter-track" cx="89" cy="58" r="34" />
          <circle className="art-axis" cx="89" cy="58" r="25" />
          <path className="art-trend" d="M89 40v19l14 9" />
          <path className="art-chapter art-chapter-one" d="M130 24h21v35l-10.5-7-10.5 7V24Z" />
          <rect className="art-caption" x="31" y="99" width="116" height="5" rx="2.5" />
          <circle className="art-point" cx="130" cy="24" r="4" />
        </>
      )}
      {visual === 'export' && (
        <>
          <path className="art-chapter-track" d="M48 21h55l27 26v51H48z" />
          <path className="art-axis" d="M103 21v27h27" />
          <rect className="art-chapter art-chapter-one" x="61" y="56" width="55" height="5" rx="2.5" />
          <rect className="art-caption" x="61" y="68" width="75" height="4" rx="2" />
          <rect className="art-caption" x="61" y="78" width="61" height="4" rx="2" />
          <rect className="art-caption" x="61" y="88" width="69" height="4" rx="2" />
          <circle className="art-point" cx="48" cy="55" r="5" />
          <circle className="art-point" cx="48" cy="78" r="5" />
        </>
      )}
      {visual === 'keyboard' && (
        <>
          <rect className="art-chapter-track" x="26" y="29" width="128" height="57" rx="10" />
          <rect className="art-chapter art-chapter-one" x="40" y="39" width="100" height="36" rx="7" />
          <text className="art-key-label" x="90" y="63" textAnchor="middle">INSERT</text>
          <rect className="art-caption" x="50" y="96" width="80" height="5" rx="2.5" />
        </>
      )}
      {visual === 'youtube' && (
        <>
          <rect className="art-chapter-track" x="22" y="25" width="136" height="18" rx="7" />
          <circle className="art-control" cx="34" cy="34" r="3" />
          <rect className="art-caption" x="45" y="31" width="98" height="5" rx="2.5" />
          <rect className="art-chapter-track" x="22" y="52" width="136" height="42" rx="9" />
          <circle className="art-play" cx="90" cy="73" r="13" />
          <path className="art-play" d="M87 66v14l11-7-11-7Z" />
          <rect className="art-chapter art-chapter-one" x="42" y="101" width="96" height="4" rx="2" />
        </>
      )}
      {visual === 'autosave' && (
        <>
          <rect className="art-chapter-track" x="39" y="23" width="83" height="77" rx="10" />
          <path className="art-axis" d="M54 43h51M54 57h37M54 71h43" />
          <circle className="art-play" cx="122" cy="77" r="24" />
          <path className="art-trend" d="m111 77 8 8 15-18" />
          <path className="art-chapter art-chapter-two" d="M133 27c9-10 25-4 25 7 11 1 13 18 1 21h-26c-14-1-13-19 0-20Z" />
        </>
      )}
      {visual === 'edit' && (
        <>
          <rect className="art-chapter-track" x="25" y="27" width="120" height="64" rx="10" />
          <path className="art-axis" d="M39 43h83M39 56h68M39 69h53" />
          <path className="art-chapter art-chapter-one" d="m105 83 34-34 10 10-34 34-14 4z" />
          <path className="art-trend" d="m138 49 10 10" />
          <rect className="art-caption" x="43" y="99" width="78" height="5" rx="2.5" />
        </>
      )}
      {visual === 'timecode' && (
        <>
          <rect className="art-chapter-track" x="24" y="37" width="132" height="41" rx="9" />
          <path className="art-axis" d="M35 59h110M42 45v28m14-18v10m14-10v10m14-18v18m14-10v10m14-10v10m14-18v18m14-10v10" />
          <path className="art-trend" d="M91 27v64" />
          <circle className="art-point" cx="91" cy="59" r="5" />
          <rect className="art-caption" x="63" y="93" width="56" height="6" rx="3" />
        </>
      )}
      {visual === 'streams' && (
        <>
          <path className="art-axis" d="M30 83h122M30 83V31" />
          <rect className="art-bar art-bar-one" x="43" y="61" width="17" height="22" rx="4" />
          <rect className="art-bar art-bar-two" x="69" y="49" width="17" height="34" rx="4" />
          <rect className="art-bar art-bar-three" x="95" y="39" width="17" height="44" rx="4" />
          <rect className="art-bar art-bar-four" x="121" y="27" width="17" height="56" rx="4" />
          <path className="art-trend" d="m41 51 32-11 24 4 37-21" />
          <circle className="art-point" cx="134" cy="23" r="4" />
          <rect className="art-caption" x="50" y="94" width="80" height="5" rx="2.5" />
        </>
      )}
      {visual === 'games' && (
        <>
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <rect className="art-chapter-track" x="26" y={25 + index * 25} width="128" height="19" rx="6" />
              <circle className={`art-game-dot art-game-dot-${index + 1}`} cx="39" cy={34 + index * 25} r="5" />
              <rect className="art-caption" x="51" y={31 + index * 25} width={index === 1 ? 52 : 74} height="5" rx="2.5" />
              <rect className="art-chapter art-chapter-one" x="119" y={31 + index * 25} width="24" height="5" rx="2.5" />
            </g>
          ))}
        </>
      )}
      {visual === 'timeline' && (
        <>
          <path className="art-axis" d="M31 34h118M31 58h118M31 82h118" />
          <circle className="art-point" cx="50" cy="34" r="5" />
          <circle className="art-point" cx="113" cy="58" r="5" />
          <circle className="art-point" cx="79" cy="82" r="5" />
          <rect className="art-caption" x="42" y="23" width="42" height="4" rx="2" />
          <rect className="art-caption" x="101" y="47" width="45" height="4" rx="2" />
          <rect className="art-caption" x="68" y="93" width="48" height="4" rx="2" />
        </>
      )}
      {visual === 'progress' && (
        <>
          <circle className="art-chapter art-chapter-one" cx="48" cy="39" r="13" />
          <path className="art-trend" d="m42 39 5 5 9-11" />
          <circle className="art-chapter-track" cx="48" cy="77" r="13" />
          <path className="art-axis" d="M73 35h72M73 45h54M73 73h72M73 83h46" />
          <rect className="art-caption" x="73" y="96" width="56" height="5" rx="2.5" />
        </>
      )}
      {visual === 'activity' && (
        <>
          {[0, 1, 2, 3, 4].map((column) => [0, 1, 2, 3].map((row) => (
            <rect
              key={`${column}-${row}`}
              className={`art-heat art-heat-${(column * 3 + row) % 4 + 1}`}
              x={40 + column * 20}
              y={25 + row * 18}
              width="14"
              height="12"
              rx="3"
            />
          )))}
          <rect className="art-caption" x="43" y="101" width="93" height="4" rx="2" />
        </>
      )}
      {visual === 'sessions' && (
        <>
          <path className="art-axis" d="M29 88h124M29 88V29" />
          <rect className="art-bar art-bar-one" x="42" y="64" width="18" height="24" rx="4" />
          <rect className="art-bar art-bar-three" x="70" y="48" width="18" height="40" rx="4" />
          <rect className="art-bar art-bar-two" x="98" y="56" width="18" height="32" rx="4" />
          <rect className="art-bar art-bar-four" x="126" y="35" width="18" height="53" rx="4" />
          <path className="art-trend" d="m47 54 32-17 33 5 26-18" />
        </>
      )}
      {visual === 'completion' && (
        <>
          <circle className="art-chapter-track" cx="90" cy="57" r="37" />
          <circle className="art-play" cx="90" cy="57" r="27" />
          <path className="art-trend" d="m77 57 9 9 18-21" />
          <path className="art-chapter art-chapter-one" d="m55 92-4 15 14-6 10 10 4-19m43 0 4 15-14-6-10 10-4-19" />
        </>
      )}
      {visual === 'library' && (
        <>
          {[0, 1, 2, 3].map((index) => (
            <g key={index}>
              <rect className="art-chapter-track" x={34 + (index % 2) * 59} y={23 + Math.floor(index / 2) * 38} width="49" height="30" rx="6" />
              <circle className={`art-game-dot art-game-dot-${index + 1}`} cx={47 + (index % 2) * 59} cy={38 + Math.floor(index / 2) * 38} r="6" />
              <rect className="art-caption" x={57 + (index % 2) * 59} y={36 + Math.floor(index / 2) * 38} width="17" height="4" rx="2" />
            </g>
          ))}
        </>
      )}
      {visual === 'hours' && (
        <>
          <circle className="art-chapter-track" cx="66" cy="58" r="34" />
          <path className="art-trend" d="M66 37v22l17 10" />
          <rect className="art-bar art-bar-one" x="112" y="64" width="12" height="28" rx="3" />
          <rect className="art-bar art-bar-two" x="130" y="47" width="12" height="45" rx="3" />
          <rect className="art-bar art-bar-four" x="148" y="31" width="12" height="61" rx="3" />
          <path className="art-axis" d="M108 94h53" />
        </>
      )}
      {visual === 'stats' && (
        <>
          <path className="art-axis" d="M29 88h124M29 88V30" />
          <path className="art-trend" d="m40 74 27-17 24 9 25-27 26 7" />
          <circle className="art-point" cx="40" cy="74" r="4" />
          <circle className="art-point" cx="91" cy="66" r="4" />
          <circle className="art-point" cx="116" cy="39" r="4" />
          <circle className="art-point" cx="142" cy="46" r="4" />
          <rect className="art-caption" x="57" y="99" width="69" height="5" rx="2.5" />
        </>
      )}
    </svg>
  </span>
);

export const PromoArtworkGallery = ({ visuals }) => (
  <span className="self-promo-gallery" aria-hidden="true">
    {visuals.map((visual) => (
      <PromoArtwork key={visual} visual={visual} />
    ))}
  </span>
);

