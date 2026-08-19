/* --- src/components/Core/DynamicBackground.jsx --- */
import React, { useState, useEffect, useRef } from 'react';
import './DynamicBackground.css';

// A standalone component for each artist layer. 
// This ensures that when React mounts a new artist, it correctly starts at opacity 0, 
// waits one frame, and then triggers the CSS crossfade without "popping in".
const BackgroundLayer = ({ layer, isActive, customData, globalArtistData, singerImages }) => {
  const [renderedActive, setRenderedActive] = useState(false);

  useEffect(() => {
    let frameId;
    if (isActive) {
      // Double rAF ensures the browser paints the 'opacity: 0' state first before 
      // transitioning to the target opacity, creating a flawless crossfade.
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => {
          setRenderedActive(true);
        });
      });
    } else {
      setRenderedActive(false);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isActive]);

  const imgClass = renderedActive ? 'active-watermark' : 'inactive-watermark';
  const matrixClass = renderedActive ? 'active-matrix' : 'inactive-matrix';

  if (!layer.isMulti) {
    const singerName = layer.names[0];
    const finalImgUrl = customData.artistImages?.[singerName] ?? globalArtistData?.images?.[singerName] ?? singerImages[singerName];

    if (!finalImgUrl) return null;

    return (
      <img
          src={finalImgUrl}
          loading="lazy"
          decoding="async"
          alt=""
          className={`singer-watermark full-screen-watermark ${imgClass}`}
        />
    );
  } else {
    return (
      <div
          className={`matrix-watermark-container ${matrixClass}`}
        style={{ gridTemplateColumns: `repeat(${layer.cols}, 1fr)` }}
      >
        {Array.from({ length: layer.cols * 2 }).map((_, cellIdx) => {
          const row = Math.floor(cellIdx / layer.cols);
          const col = cellIdx % layer.cols;
          const targetArtist = layer.names[(col + row) % layer.names.length];
          const finalImgUrl = targetArtist ? (customData.artistImages?.[targetArtist] ?? globalArtistData?.images?.[targetArtist] ?? singerImages[targetArtist]) : null;

          return (
            <div key={`cell-${cellIdx}`} className="matrix-cell">
              {finalImgUrl && (
                <img
                    src={finalImgUrl}
                    loading="lazy"
                    decoding="async"
                    alt=""
                    className={`singer-watermark matrix-cell-img ${imgClass}`}
                  />
              )}
            </div>
          );
        })}
      </div>
    );
  }
};

const DynamicBackground = ({
  allPotentialSingers, selectedSong, customData, singerImages, highResArt, 
  currentSingerBg, masterPalette, isSingerVisible, settings, globalArtistData,
  liveParsedLyrics
}) => {
  const opacityVal = settings?.bgImageOpacity ?? 0.25;

  const activeNames = currentSingerBg?.name?.split(/\s*(?:&|,|\band\b)\s*/i)
    .filter(Boolean)
    .map(s => s.trim()) || [];
       
  const activeComboKey = activeNames.join('|');
  const isMulti = activeNames.length > 1;

  // --- PRELOADER ENGINE (Fixes Artist Image Pop-In) ---
  useEffect(() => {
    if (!allPotentialSingers) return;
    
    allPotentialSingers.forEach(singer => {
      const finalImgUrl = customData.artistImages?.[singer] ?? globalArtistData?.images?.[singer] ?? singerImages[singer];
      if (finalImgUrl) {
        // Creates a silent background request to force the browser to cache the image into memory
        const preloader = new Image();
        preloader.src = finalImgUrl;
      }
    });
  }, [allPotentialSingers, customData.artistImages, globalArtistData.images, singerImages]);

  // --- LAYER STACK GARBAGE COLLECTION ENGINE ---
  const [layers, setLayers] = useState([]);
  const prevKeyRef = useRef(null);
  const activeKeyRef = useRef(null);

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    activeKeyRef.current = activeComboKey;
    prevKeyRef.current = activeComboKey;

    if (!activeComboKey) return;

    setLayers(prev => {
      // If returning to a layer that's already mounted, push it to the top
      if (prev.some(l => l.key === activeComboKey)) {
         const filtered = prev.filter(l => l.key !== activeComboKey);
         const existing = prev.find(l => l.key === activeComboKey);
         return [...filtered, existing];
      }
      
      const newLayer = {
          key: activeComboKey,
          names: activeNames,
          isMulti,
          cols: Math.max(2, activeNames.length)
       };
      return [...prev, newLayer];
    });

    // CRITICAL VRAM FIX: Instead of a global timeout that gets repeatedly cancelled, 
    // we schedule an independent cleanup specifically for the layer that just deactivated.
    if (prevKey && prevKey !== activeComboKey) {
      setTimeout(() => {
        setLayers(curr => {
          // Only physically remove the old image node from the DOM if it hasn't 
          // become the active singer again during the 850ms transition window.
          if (activeKeyRef.current !== prevKey) {
            return curr.filter(l => l.key !== prevKey);
          }
          return curr;
        });
      }, 850);
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeComboKey]);

  const uniqueSingerCombos = Array.from(new Set(liveParsedLyrics?.map(l => l.singer).filter(Boolean) || []));
  if (currentSingerBg?.name && !uniqueSingerCombos.includes(currentSingerBg.name)) {
    uniqueSingerCombos.push(currentSingerBg.name);
  }

  return (
    <div className="dynamic-background-contained" style={{ '--bg-opacity': opacityVal }}>
      
      {/* RENDER ALL ACTIVE AND FADING LAYERS */}
      {layers.map(layer => (
        <BackgroundLayer
            key={layer.key}
            layer={layer}
            isActive={isSingerVisible && layer.key === activeComboKey}
          customData={customData}
          globalArtistData={globalArtistData}
          singerImages={singerImages}
        />
      ))}

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