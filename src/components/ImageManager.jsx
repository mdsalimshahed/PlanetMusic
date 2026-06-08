/* --- src/components/ImageManager.jsx --- */
import React from 'react';

const ImageManager = ({
  allPotentialSingers, selectedSong, customData, singerImages, handleImageChange, masterPalette
}) => {
  return (
    <div className="image-manager-container">
      <h3 className="image-manager-title">Artist Image Override</h3>
      <p className="image-manager-sub">
        <strong>⚠️ IMPORTANT:</strong> Do not copy image links directly from the search grid (they are tiny thumbnails). 
        Click the image first to open the large preview, let it load, and then right-click to <strong>Copy Image Address</strong>.
      </p>
      
      <div className="image-manager-list">
        {allPotentialSingers.map(singer => {
          if (singer === selectedSong.artistName) return null;
          
          // EXACT QUERY MATCH: "SingerName" BandName singer
          const searchTarget = encodeURIComponent(`"${singer}" ${selectedSong.artistName} singer`);
          
          // DuckDuckGo Image Search parameters:
          // iax=images & ia=images forces the Image tab
          // iaf=layout:Square forces the 1:1 aspect ratio filter
          const duckDuckGoUrl = `https://duckduckgo.com/?q=${searchTarget}&iax=images&ia=images&iaf=layout:Square`;
          
          return (
            <div key={singer} className="image-manager-row glass-panel-light">
              <div className="img-manager-top-row">
                <a href={duckDuckGoUrl} target="_blank" rel="noreferrer" className="img-manager-name" style={{ color: masterPalette[singer] }}>
                  🦆 {singer}
                </a>
                {(customData.artistImages?.[singer] || singerImages[singer]) && (
                    <img src={customData.artistImages?.[singer] || singerImages[singer]} alt="Preview" className="img-manager-preview" />
                )}
              </div>
              <input 
                type="text" 
                className="img-manager-input" 
                placeholder="Paste HD Image URL here..." 
                value={customData.artistImages?.[singer] || ''} 
                onChange={(e) => handleImageChange(singer, e.target.value)} 
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageManager;