/* --- src/components/ImageManager.jsx --- */
import React from 'react';
import './ImageManager.css';

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
                    {singer}
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
              <div className="img-manager-input-row">
                <input 
                  type="text" 
                  className="img-manager-input" 
                  placeholder="Paste HD Image URL here..." 
                  value={customData.artistImages?.[singer] ?? globalArtistData?.images?.[singer] ?? ''} 
                  onChange={(e) => handleImageChange(singer, e.target.value)} 
                />
                {currentImage && (
                  <button 
                    className="img-manager-clear-btn" 
                    onClick={() => handleImageChange(singer, '')} 
                    title="Clear Image"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageManager;