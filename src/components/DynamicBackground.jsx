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

        const isCurrentSingerActive = isSingerVisible && currentSingerBg?.name.includes(singerName);
        const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';
        
        // Connect the settings slider directly to the active watermark's opacity
        const style = isCurrentSingerActive ? { opacity: opacityVal } : {};

        return <img key={singerName} src={finalImgUrl} alt="" className={`singer-watermark ${imgClass}`} style={style} />;
      })}
      
      <div className={`singer-name-corner ${isSingerVisible && currentSingerBg ? 'visible' : 'hidden'}`}>
        {currentSingerBg?.name.split(/(\s&\s|\s,\s|\sand\s)/).map((part, index) => {
          const trimmedPart = part.trim();
          if (trimmedPart === '&' || trimmedPart === ',' || trimmedPart === 'and') {
            return <span key={index} className="singer-name-separator">{part}</span>;
          }
          const individualColor = masterPalette[trimmedPart] || '#fff';
          return <span key={index} style={{ color: individualColor }}>{part}</span>;
        })}
      </div>
    </div>
  );
};

export default DynamicBackground;