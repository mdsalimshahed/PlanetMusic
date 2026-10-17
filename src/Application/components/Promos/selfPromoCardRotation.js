import selfPromoItems from './selfPromoItems.js';

const ROTATION_INTERVAL_MS = 10000;
const ROTATION_STAGGER_MS = 700;
const promoFormats = ['square', 'feed', 'sidebar', 'inline', 'banner'];
const sessionOffsets = Object.fromEntries(
  promoFormats.map((format) => [format, getRandomIndex(6)])
);
const promoProductOffset = getRandomIndex(selfPromoItems.length);
export const activeCreatives = new Map();
let promoRotationPhase = 0;
let promoRotationTimer;
let promoRotationQueueTimer;
let promoRotationQueue = [];
let promoRotationQueueRunning = false;
const promoRotationSubscribers = new Set();

function getRandomIndex(length) {
  return Math.floor(Math.random() * length);
}

export const getPromoAspectRatio = (format, placement, className, width = 0) => {
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

export const subscribeToPromoRotation = (subscriber) => {
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

export const getPromoRotationPhase = () => promoRotationPhase;

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

export const getInitialCreative = (placement, format, instanceId) => {
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

export const getSlotPromoIndex = (cardElement, rotationPhase = promoRotationPhase) => {
  const visibleCards = [...document.querySelectorAll('.self-promo-card')]
    .filter((card) => {
      const style = window.getComputedStyle(card);
      return style.display !== 'none' && style.visibility !== 'hidden' && card.getClientRects().length > 0;
    });
  const slotIndex = visibleCards.indexOf(cardElement);
  if (slotIndex < 0) return promoProductOffset;
  return (slotIndex + promoProductOffset + rotationPhase) % selfPromoItems.length;
};

export const chooseCreative = (promoIndex, instanceId) => {
  const options = getCreativeOptions();
  const occupied = new Set(
    [...activeCreatives.entries()]
      .filter(([id]) => id !== instanceId)
      .map(([, creative]) => `${creative.promoIndex}:${creative.messageIndex}`)
  );
  const productOptions = options.filter((option) => option.promoIndex === promoIndex);
  if (productOptions.length === 0) {
    throw new Error(`No promo campaigns found for product index ${promoIndex}.`);
  }
  const available = productOptions.filter((option) => (
    !occupied.has(`${option.promoIndex}:${option.messageIndex}`)
  ));
  const candidates = available.length > 0 ? available : productOptions;
  const next = candidates[getRandomIndex(candidates.length)];

  activeCreatives.set(instanceId, next);
  return next;
};
