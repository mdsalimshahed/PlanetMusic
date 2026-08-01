/* --- src/components/SongCard.jsx --- */
import React, { useState, useEffect } from 'react';
import './SongCard.css';

const SongCard = ({ song, isSaved, toggleLibrary, setSelectedSong, setCurrentTrack }) => {
  const [bgColor, setBgColor] = useState('');
  const [accentRGB, setAccentRGB] = useState('255, 255, 255');
  const highResArt = song.artworkUrl100?.replace('100x100', '300x300');

  useEffect(() => {
    if (!highResArt) return;
    let img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      
      canvas.width = 5; 
      canvas.height = 5;
      context.drawImage(img, 0, 0, 5, 5);
      
      try {
        const data = context.getImageData(0, 0, 5, 5).data;
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
        
        setAccentRGB(`${r}, ${g}, ${b}`);
        setBgColor(`linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 0.6), rgba(5, 5, 16, 0.95))`);
      } catch (e) {
        console.warn('Could not extract color due to CORS restrictions');
      } finally {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        img = null;
      }
    };
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img = null;
    };
    img.src = highResArt;
  }, [highResArt]);

  return (
    <div 
      className="song-card glass-panel" 
      onClick={() => setSelectedSong(song)}
      style={{ 
        background: bgColor || undefined,
        '--card-accent-rgb': accentRGB
      }}
    >
      <div className="artwork-wrapper">
        <img
          src={highResArt}
          alt={song.trackName}
          className="artwork"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=No+Cover' }}
        />
        
        {/* Top-Right Quick Add Icon Button */}
        <button 
          className={`quick-add-btn ${isSaved ? 'saved' : ''}`}
          onClick={(e) => toggleLibrary(e, song)}
          title={isSaved ? "Remove from Vault" : "Add to Vault"}
        >
          {isSaved ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          )}
        </button>

        <div className="artwork-overlay">
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
          <h4 title={song.trackName}>
            {song.trackName}
            {song.trackExplicitness === 'explicit' && <span className="explicit-tag">E</span>}
          </h4>
          <p title={song.artistName}>{song.artistName}</p>
        </div>
      </div>
    </div>
  );
};

export default SongCard;