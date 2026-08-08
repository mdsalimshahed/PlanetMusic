/* --- src/components/Core/DynamicBackground.jsx --- */
import React from 'react';
import './DynamicBackground.css';

const DynamicBackground = ({
  allPotentialSingers, selectedSong, customData, singerImages, highResArt, 
  currentSingerBg, masterPalette, isSingerVisible, settings, globalArtistData,
  liveParsedLyrics
}) => {
  const opacityVal = settings?.bgImageOpacity ?? 0.25;
  const activeNames = currentSingerBg?.name?.split(/\s*(?:&|,|\band\b)\s*/i)
    .filter(Boolean)
    .map(s => s.trim()) || [];
          
  const isMulti = activeNames.length > 1;
  const cols = Math.max(2, activeNames.length);

  const getArtistForCell = (cellIndex) => {
    if (activeNames.length === 0) return null;
    const row = Math.floor(cellIndex / cols);
    const col = cellIndex % cols;
    return activeNames[(col + row) % activeNames.length];
  };

  const uniqueSingerCombos = Array.from(new Set(liveParsedLyrics?.map(l => l.singer).filter(Boolean) || []));
  
  if (currentSingerBg?.name && !uniqueSingerCombos.includes(currentSingerBg.name)) {
    uniqueSingerCombos.push(currentSingerBg.name);
  }

  return (
    <div className="dynamic-background-contained" style={{ '--bg-opacity': opacityVal }}>
      {/* CRITICAL FIX: Pass the opacity slider value directly to CSS via variable */}
      
      {/* FULL SCREEN LAYER (Single Artist) */}
      {allPotentialSingers.map(singerName => {
        const finalImgUrl = customData.artistImages?.[singerName] ?? globalArtistData?.images?.[singerName] ?? singerImages[singerName];
        if (!finalImgUrl) return null;

        const isActive = activeNames.length === 1 && activeNames[0] === singerName;
        const isCurrentSingerActive = isSingerVisible && isActive;
        const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';
        
        return <img key={`full-${singerName}`} src={finalImgUrl} loading="lazy" decoding="async" alt="" className={`singer-watermark full-screen-watermark ${imgClass}`} />;
      })}

      {/* MATRIX LAYER (Multi Artist dynamically expands based on sequence length) */}
      <div 
        className={`matrix-watermark-container ${isSingerVisible && isMulti ? 'active-matrix' : 'inactive-matrix'}`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols * 2 }).map((_, cellIdx) => {
          const targetArtist = getArtistForCell(cellIdx);
          
          return (
            <div key={`cell-${cellIdx}`} className="matrix-cell">
              {allPotentialSingers.map(singerName => {
                const finalImgUrl = customData.artistImages?.[singerName] ?? globalArtistData?.images?.[singerName] ?? singerImages[singerName];
                if (!finalImgUrl) return null;

                const isActive = targetArtist === singerName;
                const isCurrentSingerActive = isSingerVisible && isMulti && isActive;
                const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';
                
                return <img key={`matrix-${cellIdx}-${singerName}`} src={finalImgUrl} loading="lazy" decoding="async" alt="" className={`singer-watermark matrix-cell-img ${imgClass}`} />;
              })}
            </div>
          );
        })}
      </div>
      
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