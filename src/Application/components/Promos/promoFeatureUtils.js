import selfPromoFeatures from './selfPromoFeatures.js';

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

export const getFeatureCount = (format, placement, width, { isCompact, isTiny, isTall, isExpanded, isNarrow }) => {
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

export const getFeatures = (promo, campaignIndex, featureCount) => {
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


