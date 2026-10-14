/* --- src/components/Core/DynamicBackground.jsx --- */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { preloadArtistImage } from '../../utils/artistImageCache.js';
import './DynamicBackground.css';

const BackgroundLayer = React.memo(({ layer, className }) => {
  if (!layer.isMulti) {
    const image = layer.images[0];
    if (!image?.url) return null;

    return (
      <div className={`background-slot ${className}`}>
        <img
          src={image.url}
          loading="eager"
          decoding="async"
          alt=""
          className="singer-watermark full-screen-watermark active-watermark"
        />
      </div>
    );
  }

  return (
    <div
      className={`matrix-watermark-container background-slot ${className}`}
      style={{ gridTemplateColumns: `repeat(${layer.cols}, 1fr)` }}
    >
      {layer.images.map((image, cellIdx) => (
        <div key={`cell-${cellIdx}`} className="matrix-cell">
          {image.url && (
            <img
              src={image.url}
              loading="eager"
              decoding="async"
              alt=""
              className="singer-watermark matrix-cell-img active-watermark"
            />
          )}
        </div>
      ))}
    </div>
  );
});

const DynamicBackground = ({
  customData, singerImages,
  currentSingerBg, masterPalette, isSingerVisible, settings, globalArtistData,
  liveParsedLyrics
}) => {
  const opacityVal = settings?.bgImageOpacity ?? 0.25;

  const activeNames = useMemo(() => currentSingerBg?.name
    ?.split(/\s*(?:&|,|\band\b)\s*/i)
    .filter(Boolean)
    .map(s => s.trim()) || [], [currentSingerBg?.name]);
       
  const activeComboKey = activeNames.join('|');
  const currentSingerName = currentSingerBg?.name;
  const isMulti = activeNames.length > 1;
  const uniqueSingerCombos = useMemo(() => {
    const combos = Array.from(new Set(liveParsedLyrics?.map(line => line.singer).filter(Boolean) || []));
    if (currentSingerName && !combos.includes(currentSingerName)) combos.push(currentSingerName);
    return combos;
  }, [liveParsedLyrics, currentSingerName]);

  const [layers, setLayers] = useState([]);
  const displayedLayerKeyRef = useRef(null);
  const transitionGenerationRef = useRef(0);
  const transitionTimerRef = useRef(null);
  const transitionFrameIdsRef = useRef([]);

  useEffect(() => {
    const prioritizedNames = activeNames;
    const candidateNames = new Set();
    uniqueSingerCombos.forEach(combo => {
      String(combo).split(/\s*(?:&|,|\band\b)\s*/i)
        .filter(Boolean)
        .forEach(name => candidateNames.add(name.trim()));
    });
    const namesToPreload = new Set([...candidateNames, ...prioritizedNames]);
    const imageByName = {
      ...(singerImages || {}),
      ...(globalArtistData?.images || {}),
      ...(customData?.artistImages || {})
    };
    [...namesToPreload].forEach(name => {
      const url = imageByName[name];
      if (url) preloadArtistImage(url, prioritizedNames.includes(name) ? 'high' : 'low');
    });
  }, [
    activeNames,
    customData?.artistImages,
    globalArtistData?.images,
    singerImages,
    uniqueSingerCombos
  ]);

  const layer = useMemo(() => {
    if (!activeNames.length) return null;
    const cols = Math.max(2, activeNames.length);
    const images = isMulti
      ? Array.from({ length: cols * 2 }, (_, cellIdx) => {
        const row = Math.floor(cellIdx / cols);
        const col = cellIdx % cols;
        const name = activeNames[(col + row) % activeNames.length];
        return {
          name,
          url: customData?.artistImages?.[name] ?? globalArtistData?.images?.[name] ?? singerImages?.[name] ?? null
        };
      })
      : [{
        name: activeNames[0],
        url: customData?.artistImages?.[activeNames[0]] ??
          globalArtistData?.images?.[activeNames[0]] ??
          singerImages?.[activeNames[0]] ??
          null
      }];
    const urls = [...new Set(images.map(image => image.url).filter(Boolean))];

    return {
      key: `${activeComboKey}::${urls.join('|')}`,
      names: activeNames,
      isMulti,
      cols,
      images,
      urls
    };
  }, [
    activeNames,
    activeComboKey,
    isMulti,
    customData?.artistImages,
    globalArtistData?.images,
    singerImages
  ]);

  useEffect(() => {
    const generation = ++transitionGenerationRef.current;
    let isCancelled = false;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionFrameIdsRef.current.forEach(cancelAnimationFrame);
    transitionFrameIdsRef.current = [];

    if (!layer?.urls.length) {
      if (displayedLayerKeyRef.current) {
        setLayers(current => current.map(slot => ({ ...slot, status: 'fading' })));
        transitionTimerRef.current = setTimeout(() => {
          if (generation !== transitionGenerationRef.current) return;
          displayedLayerKeyRef.current = null;
          setLayers([]);
        }, 850);
      }
      return () => {
        isCancelled = true;
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      };
    }

    Promise.all(layer.urls.map(url => preloadArtistImage(url, 'high'))).then(ready => {
      if (isCancelled || generation !== transitionGenerationRef.current || ready.some(result => !result)) {
        if (!isCancelled && ready.some(result => !result)) {
          console.warn('Artist background image could not be decoded; retaining the current background.');
        }
        return;
      }

      const displayedKey = displayedLayerKeyRef.current;
      const hasDisplayedLayer = Boolean(displayedKey && displayedKey !== layer.key);
      setLayers(current => {
        const outgoing = hasDisplayedLayer
          ? current.find(slot => slot.layer.key === displayedKey)
          : null;
        const next = [];
        if (outgoing) next.push({ ...outgoing, status: 'visible' });
        next.push({ layer, status: 'ready' });
        return next;
      });

      const startTransition = () => {
        if (isCancelled || generation !== transitionGenerationRef.current) return;
        displayedLayerKeyRef.current = layer.key;
        setLayers(current => current.map(slot => ({
          ...slot,
          status: slot.layer.key === layer.key ? 'visible' : 'fading'
        })));
        transitionTimerRef.current = setTimeout(() => {
          if (generation !== transitionGenerationRef.current) return;
          setLayers(current => current
            .filter(slot => slot.layer.key === layer.key)
            .map(slot => ({ ...slot, status: 'visible' })));
          transitionTimerRef.current = null;
        }, 850);
      };

      if (!hasDisplayedLayer) {
        displayedLayerKeyRef.current = layer.key;
      }

      transitionFrameIdsRef.current.push(requestAnimationFrame(() => {
        transitionFrameIdsRef.current.push(requestAnimationFrame(startTransition));
      }));
    });

    return () => {
      isCancelled = true;
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionFrameIdsRef.current.forEach(cancelAnimationFrame);
    };
  }, [
    layer
  ]);

  return (
    <div className="dynamic-background-contained" style={{ '--bg-opacity': opacityVal }}>
      
      {/* Keep at most the visible and transitioning artist layers mounted. */}
      {layers.map(slot => {
        const className = !isSingerVisible
          ? 'ready'
          : slot.status === 'visible'
            ? 'visible'
            : slot.status === 'fading'
              ? 'fading'
              : 'ready';
        return <BackgroundLayer key={slot.layer.key} layer={slot.layer} className={className} />;
      })}

      {/* SINGER NAME CORNER */}
      {uniqueSingerCombos.map(comboName => {
        const isActive = isSingerVisible && currentSingerBg?.name === comboName;
        
        return (
          <div key={`name-corner-${comboName}`} className={`singer-name-corner ${isActive ? 'visible' : 'hidden'}`}>
            {comboName.split(/(\s*(?:&|,|\band\b)\s*)/i).map((part, index) => {
              const trimmedPart = part.trim();
              if (!trimmedPart) return null;
              
              if (/^(?:&|,|and)$/i.test(trimmedPart)) {
                const isComma = trimmedPart === ',';
                return (
                  <span key={index} className="singer-name-separator">
                    {isComma ? `${trimmedPart} ` : ` ${trimmedPart} `}
                  </span>
                );
              }
              
              const individualColor = masterPalette[trimmedPart] || '#fff';
              return <span key={index} style={{ color: individualColor }}>{trimmedPart}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
};

export default DynamicBackground;
