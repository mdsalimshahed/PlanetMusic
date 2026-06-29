/* --- src/components/DynamicBackground.jsx --- */
import React from 'react';

const DynamicBackground = ({
  allPotentialSingers, selectedSong, customData, singerImages, highResArt, 
  currentSingerBg, masterPalette, isSingerVisible, settings, globalArtistData,
  liveParsedLyrics
}) => {
  const opacityVal = settings?.bgImageOpacity ?? 0.25;
  
  const allArtists = Object.keys(masterPalette);

  // CRITICAL FIX: Sort active names globally so Left/Right sides NEVER flip mid-song
  const activeNames = currentSingerBg?.name?.split(/\s*(?:&|,|\band\b)\s*/i)
    .filter(Boolean)
    .map(s => s.trim())
    .sort((a, b) => allArtists.indexOf(a) - allArtists.indexOf(b)) || [];
    
  const isMulti = activeNames.length > 1;

  // CRITICAL FIX: Map Artist 0 to Left (Cell 0, 2) and Artist 1 to Right (Cell 1, 3)
  const getArtistForCell = (cellIndex) => {
    if (!isMulti) return null;
    if (activeNames.length === 2) {
      return (cellIndex % 2 === 0) ? activeNames[0] : activeNames[1];
    }
    return activeNames[cellIndex % activeNames.length];
  };

  const uniqueSingerCombos = Array.from(new Set(liveParsedLyrics?.map(l => l.singer).filter(Boolean) || []));
  
  if (currentSingerBg?.name && !uniqueSingerCombos.includes(currentSingerBg.name)) {
    uniqueSingerCombos.push(currentSingerBg.name);
  }

  return (
    <div className="dynamic-background-contained">
      
      {/* FULL SCREEN LAYER (Single Artist) */}
      {allPotentialSingers.map(singerName => {
        const finalImgUrl = customData.artistImages?.[singerName] || globalArtistData?.images?.[singerName] || singerImages[singerName];
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
                const finalImgUrl = customData.artistImages?.[singerName] || globalArtistData?.images?.[singerName] || singerImages[singerName];
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
      
      {/* SINGER NAME CORNER (Mapped out as separate elements for perfect crossfading) */}
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