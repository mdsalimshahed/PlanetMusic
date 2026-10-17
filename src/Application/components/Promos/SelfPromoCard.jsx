import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import selfPromoItems from './selfPromoItems.js';
import PromoFeatureGraphic from './PromoFeatures.jsx';
import { getFeatureCount, getFeatures } from './promoFeatureUtils.js';
import { PromoArtwork, PromoArtworkGallery } from './PromoArtwork.jsx';
import { PromoBannerArtwork, PromoBannerArtworkGallery } from './PromoBannerArtwork.jsx';
import {
  activeCreatives,
  chooseCreative,
  getInitialCreative,
  getPromoAspectRatio,
  getPromoRotationPhase,
  getSlotPromoIndex,
  subscribeToPromoRotation
} from './selfPromoCardRotation.js';
import './SelfPromoCard.css';

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
      instanceId
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
