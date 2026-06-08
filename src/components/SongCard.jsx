/* --- src/components/SongCard.jsx --- */
import React, { useState, useEffect } from 'react';
import './SongCard.css';

const SongCard = ({ song, isSaved, toggleLibrary, setSelectedSong, setCurrentTrack }) => {
  const [bgColor, setBgColor] = useState('');
  const highResArt = song.artworkUrl100?.replace('100x100', '300x300');

  useEffect(() => {
    if (!highResArt) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = highResArt;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.width = 50; 
      canvas.height = 50;
      context.drawImage(img, 0, 0, 50, 50);
      
      try {
        const data = context.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        
        r = Math.floor(r / pixelCount);
        g = Math.floor(g / pixelCount);
        b = Math.floor(b / pixelCount);
        
        setBgColor(`linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 0.6), rgba(5, 5, 16, 0.95))`);
      } catch (e) {
        console.warn('Could not extract color due to CORS restrictions');
      }
    };
  }, [highResArt]);

  return (
    <div 
      className="song-card glass-panel" 
      onClick={() => setSelectedSong(song)}
      style={{ background: bgColor || undefined }}
    >
      <div className="artwork-wrapper">
        <img
          src={highResArt}
          alt={song.trackName}
          className="artwork"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=No+Cover' }}
        />
        <div className="artwork-overlay">
          {/* Now safely checks the hasLocal flag so the button appears even without iTunes preview */}
          {(song.previewUrl || song.customLinks?.hasLocal) && (
            <button 
              className="play-btn glass-button" 
              onClick={(e) => {
                e.stopPropagation();
                setCurrentTrack(song);
              }}
              title={song.customLinks?.hasLocal ? "Play Local File" : "Play Preview"}
            >
              ▶
            </button>
          )}
        </div>
      </div>

      <div className="card-info">
        <div className="text-info">
          <h4 title={song.trackName}>{song.trackName}</h4>
          <p title={song.artistName}>{song.artistName}</p>
        </div>
        <button 
          className={`save-btn ${isSaved ? 'saved' : ''}`}
          onClick={(e) => toggleLibrary(e, song)}
          title={isSaved ? "Remove from Orbit" : "Add to Orbit"}
        >
          {isSaved ? (
            <><span>★</span> In Orbit</>
          ) : (
            <><span>+</span> Add to Orbit</>
          )}
        </button>
      </div>
    </div>
  );
};

export default SongCard;