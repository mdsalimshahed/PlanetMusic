/* --- src/components/Core/SongCard.jsx --- */
import React, { useState, useEffect } from 'react';
import { extractYouTubeId } from '../../../Studio/utils/songHelpers.js';
import './SongCard.css';

const SongCard = ({ song, isSaved, toggleLibrary, setSelectedSong, setCurrentTrack }) => {
  const [accentRGB, setAccentRGB] = useState('0, 0, 0');
  const highResArt = song.artworkUrl100?.replace('100x100', '300x300');
  const ytUrl = song.customLinks?.yt || song.yt || '';
  const hasYtStream = Boolean(extractYouTubeId(ytUrl));
  const hasPlayableSource = Boolean(song.previewUrl || song.customLinks?.hasLocal || song.customLinks?.deezer || hasYtStream);

  const sources = song.sourceNames || (song.sourceName ? [song.sourceName] : []);

  useEffect(() => {
    if (!highResArt) return;
    
    let isMounted = true;
    let img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      // Skip canvas color math on narrow/mobile viewports to preserve RAM and battery
      if (window.innerWidth <= 600) {
        if (isMounted) setAccentRGB('20, 20, 30');
        return;
      }

      const processColors = () => {
        if (!isMounted) return;
        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { willReadFrequently: true });
          
          canvas.width = 3; 
          canvas.height = 3;
          context.drawImage(img, 0, 0, 3, 3);
          
          const data = context.getImageData(0, 0, 3, 3).data;
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
          // Fallback on CORS error
          setAccentRGB('20, 20, 30');
        } finally {
          img.onload = null;
          img.onerror = null;
          img.src = '';
          img = null;
        }
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(processColors, { timeout: 3000 });
      } else {
        setTimeout(processColors, Math.random() * 400 + 200);
      }
    };

    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img = null;
    };

    img.src = highResArt;
    return () => {
      isMounted = false;
    };
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
          fetchPriority="low"
          crossOrigin="anonymous" 
          onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=No+Cover' }}
        />
        
        <div className="card-top-left-badges">
          {!isSaved && sources.length > 0 && (
            sources.map(source => (
              <div key={source} className={`card-source-tag ${source.toLowerCase()}`}>
                {source}
              </div>
            ))
          )}
          {song.trackExplicitness === 'explicit' && (
            <div className="card-explicit-tag" title="Explicit">
              E
            </div>
          )}
        </div>

        {hasPlayableSource && (
          <button 
            className="play-card-btn"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentTrack({ ...song, playId: Date.now() });
            }}
            title={song.customLinks?.hasLocal ? "Play Local File" : (song.customLinks?.deezer ? "Play Deezer Stream" : (hasYtStream ? "Play YouTube Stream" : "Play Preview"))}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        )}

        <div className="card-info-text-only">
          <h4 title={song.trackName}>
            <span className="text-fill-span">{song.trackName}</span>
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