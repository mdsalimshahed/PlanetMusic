/* --- src/components/DynamicBackground.jsx --- */
import React from 'react';

const DynamicBackground = ({
  allPotentialSingers, selectedSong, customData, singerImages, highResArt, 
  currentSingerBg, masterPalette, isSingerVisible, settings
}) => {
  const opacityVal = settings?.bgImageOpacity ?? 0.25;

  return (
    <div className="dynamic-background-contained">
      {allPotentialSingers.map(singerName => {
        const isDefault = singerName === selectedSong.artistName;
        const finalImgUrl = customData.artistImages?.[singerName] || singerImages[singerName] || (isDefault ? highResArt : null);
        if (!finalImgUrl) return null;

        const activeNames = currentSingerBg?.name.split(/\s*(?:&|,|\band\b)\s*/i).filter(Boolean).map(s => s.trim()) || [];
        const isActive = currentSingerBg?.name.trim() === singerName || activeNames.includes(singerName);

        const isCurrentSingerActive = isSingerVisible && isActive;
        const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';
        
        const style = isCurrentSingerActive ? { opacity: opacityVal } : {};

        return <img key={singerName} src={finalImgUrl} alt="" className={`singer-watermark ${imgClass}`} style={style} />;
      })}
      
      <div className={`singer-name-corner ${isSingerVisible && currentSingerBg ? 'visible' : 'hidden'}`}>
        {currentSingerBg?.name.split(/(\s*(?:&|,|\band\b)\s*)/i).map((part, index) => {
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