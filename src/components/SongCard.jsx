/* --- src/components/SongCard.jsx --- */
import React, { useState, useEffect } from 'react';
import './SongCard.css';

// Helper function to hard-truncate text and inject ellipses directly into the string
const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength).trim() + '...' : text;
};

const SongCard = ({ song, isSaved, toggleLibrary, setSelectedSong, setCurrentTrack }) => {
  const [accentRGB, setAccentRGB] = useState('0, 0, 0');
  const highResArt = song.artworkUrl100?.replace('100x100', '300x300');

  // Hard limit strings to ~45 characters (approx 2 wrapped lines)
  const displayTitle = truncateText(song.trackName, 45);
  const displayArtist = truncateText(song.artistName, 45);

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
          {/* Tooltip trigger attached directly to the h4 header, holding the full untruncated name */}
          <h4 title={song.trackName}>
            <span className="text-fill-span">{displayTitle}</span>
            {song.trackExplicitness === 'explicit' && <span className="explicit-tag" title="Explicit">E</span>}
          </h4>
          
          {/* Tooltip trigger attached directly to the paragraph */}
          <p title={song.artistName}>
            <span className="text-fill-span artist-span">{displayArtist}</span>
          </p>
          
          {song.sourceName && (
            <p className="source-info" title={`Source: ${song.sourceName}`}>
              <span className="text-fill-span source-span">{song.sourceName}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SongCard;