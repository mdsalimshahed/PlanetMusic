/* --- src/components/DynamicBackground.jsx --- */
import React from 'react';

const DynamicBackground = ({
  allPotentialSingers, selectedSong, customData, singerImages, highResArt, 
  currentSingerBg, masterPalette, isSingerVisible, settings
}) => {
  const opacityVal = settings?.bgImageOpacity ?? 0.25;

  const activeNames = currentSingerBg?.name?.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
  const isMulti = activeNames.length > 1;

  // Helper to get who belongs in which cell
  // cell 0: Top-Left, 1: Top-Right, 2: Bottom-Left, 3: Bottom-Right
  const getArtistForCell = (cellIndex) => {
    if (!isMulti) return null;
    if (activeNames.length === 2) {
      // Diagonal placement for 2 artists
      return (cellIndex === 0 || cellIndex === 3) ? activeNames[0] : activeNames[1];
    }
    // Expand dynamically if 3 or more artists are singing at once
    return activeNames[cellIndex % activeNames.length];
  };

  return (
    <div className="dynamic-background-contained">
      
      {/* FULL SCREEN LAYER (Single Artist) */}
      {allPotentialSingers.map(singerName => {
        // EXPLICITLY REMOVED highResArt fallback here
        const finalImgUrl = customData.artistImages?.[singerName] || singerImages[singerName];
        if (!finalImgUrl) return null;

        const isActive = activeNames.length === 1 && activeNames[0] === singerName;
        const isCurrentSingerActive = isSingerVisible && isActive;
        const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';
        
        const style = isCurrentSingerActive ? { opacity: opacityVal } : {};

        return <img key={`full-${singerName}`} src={finalImgUrl} alt="" className={`singer-watermark full-screen-watermark ${imgClass}`} style={style} />;
      })}

      {/* MATRIX LAYER (Multi Artist) */}
      <div className={`matrix-watermark-container ${isSingerVisible && isMulti ? 'active-matrix' : 'inactive-matrix'}`}>
        {[0, 1, 2, 3].map(cellIdx => {
          const targetArtist = getArtistForCell(cellIdx);

          return (
            <div key={`cell-${cellIdx}`} className="matrix-cell">
              {allPotentialSingers.map(singerName => {
                // EXPLICITLY REMOVED highResArt fallback here
                const finalImgUrl = customData.artistImages?.[singerName] || singerImages[singerName];
                if (!finalImgUrl) return null;

                const isActive = targetArtist === singerName;
                const isCurrentSingerActive = isSingerVisible && isMulti && isActive;
                const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';
                const style = isCurrentSingerActive ? { opacity: opacityVal } : {};

                return <img key={`matrix-${cellIdx}-${singerName}`} src={finalImgUrl} alt="" className={`singer-watermark matrix-cell-img ${imgClass}`} style={style} />;
              })}
            </div>
          );
        })}
      </div>
      
      {/* SINGER NAME CORNER */}
      <div className={`singer-name-corner ${isSingerVisible && currentSingerBg ? 'visible' : 'hidden'}`}>
        {currentSingerBg?.name?.split(/(\s*(?:&|,|\band\b)\s*)/i).map((part, index) => {
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
    </div>
  );
};

export default DynamicBackground;