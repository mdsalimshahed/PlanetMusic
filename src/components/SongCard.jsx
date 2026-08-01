/* --- src/components/SongCard.jsx --- */
import React, { useState, useEffect } from 'react';
import './SongCard.css';

const SongCard = ({ song, isSaved, toggleLibrary, setSelectedSong, setCurrentTrack }) => {
  const [accentRGB, setAccentRGB] = useState('0, 0, 0');
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
      className="song-card" 
      onClick={() => setSelectedSong(song)}
      style={{ 
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
        
        {/* Center Hover Play Overlay */}
        <div className="artwork-overlay">
          {(song.previewUrl || song.customLinks?.hasLocal) && (
            <button 
              className="play-btn" 
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

        {/* Top-Right Quick Play Button */}
        {(song.previewUrl || song.customLinks?.hasLocal) && (
          <button 
            className="play-card-btn"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentTrack(song);
            }}
            title={song.customLinks?.hasLocal ? "Play Local File" : "Play Preview"}
          >
            ▶
          </button>
        )}

        {/* Text Overlay */}
        <div className="card-info-text-only">
          <h4 title={song.trackName}>
            <span className="text-fill-span">{song.trackName}</span>
            {song.trackExplicitness === 'explicit' && <span className="explicit-tag">E</span>}
          </h4>
          <p title={song.artistName}>
            <span className="text-fill-span artist-span">{song.artistName}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SongCard;