/* --- src/components/ImageManager.jsx --- */
import React from 'react';

const ImageManager = ({
  allPotentialSingers, selectedSong, customData, singerImages, handleImageChange, handleColorChange, masterPalette, globalArtistData
}) => {
  return (
    <div className="image-manager-container">
      <h3 className="image-manager-title">Manage Artists</h3>
      <p className="image-manager-sub">
        Set custom HD images and tag colors for each artist appearing in the lyrics. Values saved here will persist across all songs.
      </p>
      
      <div className="image-manager-list">
        {allPotentialSingers.map(singer => {
          const searchTarget = encodeURIComponent(`"${singer}" ${selectedSong.artistName} singer`);
          const duckDuckGoUrl = `https://duckduckgo.com/?q=${searchTarget}&iax=images&ia=images&iaf=layout:Square`;
          const colorValue = masterPalette[singer] || '#ffffff';
          
          // Determine the image currently intended to be shown
          const currentImage = customData.artistImages?.[singer] ?? globalArtistData?.images?.[singer] ?? singerImages[singer];

          return (
            <div key={singer} className="image-manager-row glass-panel-light">
              <div className="img-manager-top-row">
                <a href={duckDuckGoUrl} target="_blank" rel="noreferrer" className="img-manager-name" style={{ color: colorValue }}>
                  🦆 {singer}
                </a>
                <div className="img-manager-controls">
                  <input 
                    type="color" 
                    className="img-manager-color-picker" 
                    value={colorValue}
                    onChange={(e) => handleColorChange(singer, e.target.value)} 
                    title="Choose Artist Color"
                  />
                  {currentImage && (
                      <img src={currentImage} alt="Preview" className="img-manager-preview" />
                  )}
                </div>
              </div>
              <input 
                type="text" 
                className="img-manager-input" 
                placeholder="Paste HD Image URL here..." 
                value={customData.artistImages?.[singer] ?? globalArtistData?.images?.[singer] ?? ''} 
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