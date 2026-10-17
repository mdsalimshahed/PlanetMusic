import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import selfPromoItems from './selfPromoItems.js';
import selfPromoFeatures from './selfPromoFeatures.js';
import './SelfPromoCard.css';

const ROTATION_INTERVAL_MS = 10000;
const ROTATION_STAGGER_MS = 700;
const promoFormats = ['square', 'feed', 'sidebar', 'inline', 'banner'];
const sessionOffsets = Object.fromEntries(
  promoFormats.map((format) => [format, getRandomIndex(6)])
);
const promoProductOffset = getRandomIndex(selfPromoItems.length);
const activeCreatives = new Map();
let promoRotationPhase = 0;
let promoRotationTimer;
let promoRotationQueueTimer;
let promoRotationQueue = [];
let promoRotationQueueRunning = false;
const promoRotationSubscribers = new Set();

function getRandomIndex(length) {
  return Math.floor(Math.random() * length);
}

const getPromoAspectRatio = (format, placement, className, width = 0) => {
  if (format === 'square') return 1;
  if (format === 'feed') return 1.14;
  if (format === 'sidebar') {
    if (className.includes('page-sidebar-ad-large')) return 320 / 600;
    if (className.includes('page-sidebar-ad-small')) return 320 / 300;
    return 1;
  }
  if (format === 'inline') {
    return {
      settingsFeedOne: 435 / 310,
      settingsFeedTwo: 435 / 350,
      settingsFeedThree: 435 / 293,
      settingsFeedFour: 435 / 293
    }[placement] ?? 1.4;
  }
  if (format === 'banner') {
    if (className.includes('settings-promo-box') && width > 0 && width < 600) return 0.82;
    return 5.4;
  }
  return 1;
};

const subscribeToPromoRotation = (subscriber) => {
  promoRotationSubscribers.add(subscriber);
  if (!promoRotationTimer) {
    promoRotationTimer = window.setInterval(() => {
      if (promoRotationQueueTimer || promoRotationQueue.length > 0) return;

      promoRotationPhase = (promoRotationPhase + 1) % selfPromoItems.length;
      const nextPhase = promoRotationPhase;
      promoRotationQueue = [...promoRotationSubscribers];
      promoRotationQueueRunning = true;
      const rotateNextCard = () => {
        promoRotationQueueTimer = undefined;
        while (promoRotationQueue.length > 0) {
          const notify = promoRotationQueue.shift();
          if (!promoRotationSubscribers.has(notify)) continue;

          notify(nextPhase);
          promoRotationQueueTimer = window.setTimeout(rotateNextCard, ROTATION_STAGGER_MS);
          return;
        }
        promoRotationQueueRunning = false;
        if (promoRotationSubscribers.size === 0) {
          window.clearInterval(promoRotationTimer);
          promoRotationTimer = undefined;
          promoRotationQueue = [];
        }
      };

      rotateNextCard();
    }, ROTATION_INTERVAL_MS);
  }

  return () => {
    promoRotationSubscribers.delete(subscriber);
    promoRotationQueue = promoRotationQueue.filter((queuedSubscriber) => queuedSubscriber !== subscriber);
    if (promoRotationSubscribers.size === 0 && !promoRotationQueueRunning) {
      window.clearInterval(promoRotationTimer);
      window.clearTimeout(promoRotationQueueTimer);
      promoRotationTimer = undefined;
      promoRotationQueueTimer = undefined;
      promoRotationQueue = [];
    }
  };
};

const getPromoRotationPhase = () => promoRotationPhase;

const placementOrder = {
  square: { trackGrid: 0 },
  feed: { blogFeed: 0 },
  sidebar: {
    blogSidebar: 0,
    blogStickySidebar: 1,
    contactSidebar: 2,
    contactStickySidebar: 3,
    privacySidebar: 4,
    privacyStickySidebar: 5
  },
  inline: {
    settingsFeedOne: 0,
    settingsFeedTwo: 1,
    settingsFeedThree: 2,
    settingsFeedFour: 3
  },
  banner: {
    dashboardBottom: 0,
    settingsBottom: 1,
    blogFeedBottom: 2,
    blogPostBottom: 3,
    contactBottom: 4,
    privacyBottom: 5
  }
};

const getCreativeOptions = () => selfPromoItems.flatMap((promo, promoIndex) => (
  promo.campaigns.map((_, messageIndex) => ({
    promoIndex,
    messageIndex
  }))
));

const getInitialCreative = (placement, format, instanceId) => {
  const creativeOptions = getCreativeOptions();
  const knownOrder = placementOrder[format]?.[placement];
  const seed = [...`${placement}:${instanceId}`].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7
  );
  const position = knownOrder === undefined
    ? (seed + sessionOffsets[format]) % creativeOptions.length
    : (knownOrder + sessionOffsets[format]) % creativeOptions.length;

  return creativeOptions[position];
};

const getSlotPromoIndex = (cardElement, rotationPhase = promoRotationPhase) => {
  const visibleCards = [...document.querySelectorAll('.self-promo-card')]
    .filter((card) => {
      const style = window.getComputedStyle(card);
      return style.display !== 'none' && style.visibility !== 'hidden' && card.getClientRects().length > 0;
    });
  const slotIndex = visibleCards.indexOf(cardElement);
  if (slotIndex < 0) return promoProductOffset;
  return (slotIndex + promoProductOffset + rotationPhase) % selfPromoItems.length;
};

const chooseCreative = (promoIndex, instanceId, previousPromoIndex) => {
  const options = getCreativeOptions();
  const occupied = new Set(
    [...activeCreatives.entries()]
      .filter(([id]) => id !== instanceId)
      .map(([, creative]) => `${creative.promoIndex}:${creative.messageIndex}`)
  );
  const nextPromoIndex = previousPromoIndex === promoIndex && selfPromoItems.length > 1
    ? (promoIndex + 1) % selfPromoItems.length
    : promoIndex;
  const productOptions = options.filter((option) => option.promoIndex === nextPromoIndex);
  if (productOptions.length === 0) {
    throw new Error(`No promo campaigns found for product index ${nextPromoIndex}.`);
  }
  const available = productOptions.filter((option) => (
    !occupied.has(`${option.promoIndex}:${option.messageIndex}`)
  ));
  const candidates = available.length > 0 ? available : productOptions;
  const next = candidates[getRandomIndex(candidates.length)];

  activeCreatives.set(instanceId, next);
  return next;
};

const PromoArtwork = ({ visual }) => (
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

const PromoArtworkGallery = ({ visuals }) => (
  <span className="self-promo-gallery" aria-hidden="true">
    {visuals.map((visual) => (
      <PromoArtwork key={visual} visual={visual} />
    ))}
  </span>
);

const getFeatureGraphic = (feature) => {
  const text = feature.toLowerCase();
  if (/caption|spoken|subtitle|word/.test(text)) return 'captions';
  if (/chapter|section|topic/.test(text)) return 'chapters';
  if (/jump|find|moment|navigate|revisit/.test(text)) return 'bookmark';
  if (/complete|finish/.test(text)) return 'completion';
  if (/ongoing|status|progress|active/.test(text)) return 'progress';
  if (/activity|frequency|routine/.test(text)) return 'activity';
  if (/compare|graph|trend|stat|pattern|total/.test(text)) return 'stats';
  if (/hour|duration|session|date|time/.test(text)) return 'hours';
  if (/game|play|title/.test(text)) return 'games';
  if (/history|record|library|group|organize/.test(text)) return 'library';
  if (/edit|select|description|refine|update/.test(text)) return 'edit';
  if (/video|player|link|playback/.test(text)) return 'youtube';
  if (/save|store/.test(text)) return 'progress';
  if (/keyboard|shortcut/.test(text)) return 'keyboard';
  if (/export|download/.test(text)) return 'export';
  return 'spark';
};

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

const getFeatureCount = (format, placement, width, { isCompact, isTiny, isTall, isExpanded, isNarrow }) => {
  if (format === 'square') return isTiny || width < 280 ? 1 : width < 360 ? 2 : 3;
  if (format === 'feed') {
    if (placement === 'blogFeed') return 1;
    if (isCompact) return 1;
    return width < 520 ? 3 : 5;
  }
  if (format === 'sidebar') return isTall ? 7 : isCompact ? 1 : 5;
  if (format === 'inline') {
    if (width < 500) return 3;
    if (isNarrow) return 1;
    if (isCompact) return 1;
    if (width < 760) return 5;
    return isExpanded ? 8 : 6;
  }
  if (format === 'banner') return 6;
  return isCompact ? 1 : width < 520 ? 3 : 5;
};

const getFeatures = (promo, campaignIndex, featureCount) => {
  const campaignFeatures = promo.campaigns[campaignIndex].features;
  const startIndex = campaignIndex % campaignFeatures.length;
  const selected = Array.from(campaignFeatures, (_, index) => (
    campaignFeatures[(startIndex + index) % campaignFeatures.length]
  )).slice(0, featureCount).map((text) => ({
    text,
    graphic: getFeatureGraphic(text)
  }));
  const seen = new Set(selected.map(({ text }) => text.toLowerCase()));
  const catalog = selfPromoFeatures[promo.id] ?? [];

  for (let offset = 0; offset < catalog.length && selected.length < featureCount; offset += 1) {
    const feature = catalog[(campaignIndex * 3 + offset) % catalog.length];
    if (seen.has(feature.text.toLowerCase())) continue;
    seen.add(feature.text.toLowerCase());
    selected.push(feature);
  }

  return selected;
};

const PromoBannerArtwork = ({ visual }) => (
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

const PromoBannerArtworkGallery = ({ visual, supportingVisuals, rotates }) => {
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

const SelfPromoCard = ({ placement = 'default', format = 'square', className = '', style }) => {
  const instanceId = useId();
  const cardRef = useRef(null);
  const [rotationPhase, setRotationPhase] = useState(getPromoRotationPhase);
  const [isCompact, setIsCompact] = useState(false);
  const [isTiny, setIsTiny] = useState(false);
  const [isTall, setIsTall] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const [isStackedBanner, setIsStackedBanner] = useState(false);
  const [featureScale, setFeatureScale] = useState(1);
  const [flipStage, setFlipStage] = useState('idle');
  const [creative, setCreative] = useState(() => getInitialCreative(placement, format, instanceId));
  const currentCreative = useRef(creative);
  const flipTimer = useRef();
  const flipFrame = useRef();
  const promo = selfPromoItems[creative.promoIndex];
  const campaign = promo.campaigns[creative.messageIndex];
  const featureCount = getFeatureCount(format, placement, cardWidth, {
    isCompact,
    isTiny,
    isTall,
    isExpanded,
    isNarrow
  });
  const features = getFeatures(promo, creative.messageIndex, featureCount);
  const artworkSet = promo.artworkSets?.[creative.messageIndex] ?? [promo.visual];
  const bannerSupportingVisuals = [...artworkSet.slice(1, 3)];
  while (bannerSupportingVisuals.length < 2) {
    bannerSupportingVisuals.push(artworkSet[0] ?? promo.visual);
  }
  const squareArtworkCount = cardWidth < 280 ? 1 : 2;
  const showBannerArtworkGallery = format === 'banner';
  const rotatesBannerArtwork = showBannerArtworkGallery && className.split(/\s+/).includes('settings-promo-box');
  const compactLayout = format === 'square' ? cardWidth < 220 : isCompact;
  const tinyLayout = format === 'square' ? cardWidth < 155 : isTiny;

  useEffect(() => {
    const unsubscribe = subscribeToPromoRotation(setRotationPhase);
    return () => {
      unsubscribe();
      activeCreatives.delete(instanceId);
    };
  }, [instanceId]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;

    const updateLayoutState = (width, height) => {
      const roundedWidth = Math.round(width);
      const aspectRatio = getPromoAspectRatio(format, placement, className, width);
      const verticalUnit = width / aspectRatio / 100;
      card.style.setProperty('--self-promo-vh-unit', `${verticalUnit}px`);
      card.style.setProperty('--self-promo-h-unit', `${width / 100}px`);
      setCardWidth((current) => (current === roundedWidth ? current : roundedWidth));
      setIsStackedBanner((current) => {
        const stacked = format === 'banner' &&
          className.split(/\s+/).includes('settings-promo-box') &&
          width < 600;
        return current === stacked ? current : stacked;
      });
      setIsTiny((current) => {
        const tiny = format === 'square' && width < 155;
        return current === tiny ? current : tiny;
      });
      const tall = format === 'feed'
        ? placement === 'blogFeed'
          ? width / height < 1.4
          : height >= 360 && height > width * 0.7
        : height >= 420 && height > width * 1.1;
      setIsTall((current) => (current === tall ? current : tall));
      const expanded = (format === 'inline' && width >= 360 && height >= 240) ||
        (format === 'feed' && height >= 500);
      setIsExpanded((current) => (current === expanded ? current : expanded));
      const narrow = format === 'inline' && width < 310 && height >= 240;
      setIsNarrow((current) => (current === narrow ? current : narrow));
      const compact = format === 'sidebar'
        ? width < 380 || height < 440
        : format === 'banner'
          ? width < 760
          : format === 'feed'
            ? width < 440 || height < 320
            : format === 'inline'
              ? width < 420 || height < 260
              : format === 'square' && width < 220;
      setIsCompact((current) => (current === Boolean(compact) ? current : Boolean(compact)));
    };

    const initialRect = card.getBoundingClientRect();
    updateLayoutState(initialRect.width, initialRect.height);
    if (typeof ResizeObserver === 'undefined') return undefined;

    let resizeFrame;
    const observer = new ResizeObserver(([entry]) => {
      const borderBox = Array.isArray(entry.borderBoxSize)
        ? entry.borderBoxSize[0]
        : entry.borderBoxSize;
      const rect = card.getBoundingClientRect();
      const width = borderBox?.inlineSize > 0 ? borderBox.inlineSize : rect.width;
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        updateLayoutState(width, rect.height);
      });
    });

    observer.observe(card);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(resizeFrame);
    };
  }, [className, format, placement]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const featureNodes = card?.querySelectorAll('.self-promo-highlight');
    if (!card || !featureNodes?.length) {
      setFeatureScale(1);
      return;
    }

    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Could not measure promo feature text.');

    const firstFeatureStyle = window.getComputedStyle(featureNodes[0]);
    const baseFontSize = Number.parseFloat(firstFeatureStyle.fontSize);
    context.font = `${firstFeatureStyle.fontStyle} ${firstFeatureStyle.fontWeight} ${baseFontSize}px ${firstFeatureStyle.fontFamily}`;

    const widestGlyphBounds = [...featureNodes].reduce((widest, feature) => {
      const text = [...feature.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .join(' ');
      const metrics = context.measureText(text);
      const glyphWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
      return Math.max(widest, glyphWidth, metrics.width);
    }, 0);

    const copyWidth = card.querySelector('.self-promo-copy')?.getBoundingClientRect().width ?? card.getBoundingClientRect().width;
    const targetGlyphWidth = copyWidth * 0.74;
    const maxScale = format === 'square' ? 1.7 : format === 'banner' ? 1.3 : 1.35;
    const measuredScale = widestGlyphBounds > 0
      ? Math.min(maxScale, targetGlyphWidth / widestGlyphBounds)
      : 1;
    const nextScale = format === 'square'
      ? 1
      : Math.round(Math.max(1, measuredScale) * 100) / 100;

    setFeatureScale((current) => (Math.abs(current - nextScale) < 0.02 ? current : nextScale));
  }, [cardWidth, creative.messageIndex, creative.promoIndex, featureCount, format, isExpanded, isTall]);

  useLayoutEffect(() => {
    const nextCreative = chooseCreative(
      getSlotPromoIndex(cardRef.current, rotationPhase),
      instanceId,
      currentCreative.current.promoIndex
    );
    if (
      nextCreative.promoIndex !== currentCreative.current.promoIndex ||
      nextCreative.messageIndex !== currentCreative.current.messageIndex
    ) {
      const shouldFlip = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (shouldFlip) {
        flipFrame.current = window.requestAnimationFrame(() => {
          setFlipStage('out');
          flipTimer.current = window.setTimeout(() => {
            currentCreative.current = nextCreative;
            setCreative(nextCreative);
            setFlipStage('in');
            flipFrame.current = window.requestAnimationFrame(() => {
              flipFrame.current = window.requestAnimationFrame(() => {
                setFlipStage('idle');
              });
            });
          }, 260);
        });
      } else {
        currentCreative.current = nextCreative;
        setCreative(nextCreative);
      }
    }

    return () => {
      window.clearTimeout(flipTimer.current);
      window.cancelAnimationFrame(flipFrame.current);
    };
  }, [instanceId, rotatesBannerArtwork, rotationPhase]);

  return (
    <a
      ref={cardRef}
      className={`self-promo-card ${className}`.trim()}
      href={promo.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${promo.name}: ${campaign.topic}. ${campaign.headline} ${campaign.detail} ${campaign.features.join('. ')} ${campaign.action}`}
      data-promo-format={format}
      data-placement={placement}
      data-compact={compactLayout || undefined}
      data-tiny={tinyLayout || undefined}
      data-tall={isTall || undefined}
      data-expanded={isExpanded || undefined}
      data-narrow={isNarrow || undefined}
      data-stacked-banner={isStackedBanner || undefined}
      data-flip-stage={flipStage}
      style={{
        '--self-promo-accent': promo.accent,
        '--self-promo-feature-scale': featureScale,
        '--self-promo-aspect-ratio': getPromoAspectRatio(format, placement, className, cardWidth),
        ...style
      }}
    >
      <span key={promo.id} className="self-promo-brand">{promo.name}</span>
      <span className="self-promo-badge">Self-Promo</span>
      {format === 'banner' && (
        showBannerArtworkGallery
          ? <PromoBannerArtworkGallery
              visual={promo.visual}
              supportingVisuals={bannerSupportingVisuals}
              rotates={rotatesBannerArtwork}
            />
          : <PromoBannerArtwork visual={promo.visual} />
      )}
      {format !== 'inline' && format !== 'banner' && (
        <>
          <PromoArtwork visual={format === 'feed' || format === 'square' ? artworkSet[0] : promo.visual} />
          {(format === 'feed' || format === 'square' || (format === 'sidebar' && isTall)) && (
            <PromoArtworkGallery
              visuals={format === 'square' ? artworkSet.slice(0, squareArtworkCount) : artworkSet.slice(0, 3)}
            />
          )}
        </>
      )}
      <span key={`${promo.id}-${creative.messageIndex}`} className="self-promo-copy">
        {format === 'inline' && <PromoArtwork visual={promo.visual} />}
        <span className="self-promo-title">{campaign.headline}</span>
        <span className="self-promo-highlights">
          {features.map(({ text, graphic }) => (
            <span className="self-promo-highlight" key={text}>
              <PromoFeatureGraphic type={graphic} />
              <span className="self-promo-highlight-text">{text}</span>
            </span>
          ))}
        </span>
      </span>
      <span className="self-promo-action">
        {campaign.action}
        <span aria-hidden="true">↗</span>
      </span>
    </a>
  );
};

export default SelfPromoCard;
