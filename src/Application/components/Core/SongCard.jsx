/* --- src/components/Core/SongCard.jsx --- */
import React, { useState, useEffect } from 'react';
import { extractYouTubeId } from '../../../Studio/utils/songHelpers.js';
import { toSmartPunctuation } from '../../../utils/smartPunctuation.js';
import './SongCard.css';

const ACCENT_CACHE_LIMIT = 500;
const accentRGBCache = new Map();

const getArtworkAccentRGB = (artworkUrl) => {
  const cachedResult = accentRGBCache.get(artworkUrl);
  if (cachedResult) {
    accentRGBCache.delete(artworkUrl);
    accentRGBCache.set(artworkUrl, cachedResult);
    return cachedResult;
  }

  const result = new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      image.src = '';
    };

    image.onload = () => {
      const processColors = () => {
        try {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = 3;
          canvas.height = 3;
          context.drawImage(image, 0, 0, 3, 3);

          const data = context.getImageData(0, 0, 3, 3).data;
          let red = 0;
          let green = 0;
          let blue = 0;
          const pixelCount = data.length / 4;

          for (let index = 0; index < data.length; index += 4) {
            red += data[index];
            green += data[index + 1];
            blue += data[index + 2];
          }

          resolve(`${Math.floor(red / pixelCount)}, ${Math.floor(green / pixelCount)}, ${Math.floor(blue / pixelCount)}`);
        } catch {
          resolve('20, 20, 30');
        } finally {
          cleanup();
        }
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(processColors, { timeout: 3000 });
      } else {
        setTimeout(processColors, 200);
      }
    };

    image.onerror = () => {
      cleanup();
      resolve('20, 20, 30');
    };

    image.src = artworkUrl;
  });

  accentRGBCache.set(artworkUrl, result);
  if (accentRGBCache.size > ACCENT_CACHE_LIMIT) {
    const oldestArtworkUrl = accentRGBCache.keys().next().value;
    accentRGBCache.delete(oldestArtworkUrl);
  }
  return result;
};

const SongCard = React.memo(({ song, isSaved, setSelectedSong, setCurrentTrack }) => {
  const [accentRGB, setAccentRGB] = useState('0, 0, 0');
  const highResArt = song.artworkUrl100?.replace('100x100', '300x300');
  const ytUrl = song.customLinks?.yt || song.yt || '';
  const hasYtStream = Boolean(extractYouTubeId(ytUrl));
  const hasPlayableSource = Boolean(song.previewUrl || song.customLinks?.hasLocal || song.customLinks?.deezer || hasYtStream);

  const sources = song.sourceNames || (song.sourceName ? [song.sourceName] : []);

  useEffect(() => {
    if (!highResArt) return;

    let isMounted = true;
    if (window.innerWidth <= 600) {
      setAccentRGB('20, 20, 30');
      return undefined;
    }

    getArtworkAccentRGB(highResArt).then(accent => {
      if (isMounted) setAccentRGB(accent);
    });

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
          alt={toSmartPunctuation(song.trackName)}
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
          <h4 title={toSmartPunctuation(song.trackName)}>
            <span className="text-fill-span">{toSmartPunctuation(song.trackName)}</span>
          </h4>
          
          <p title={toSmartPunctuation(song.artistName)}>
            <span className="text-fill-span artist-span">{toSmartPunctuation(song.artistName)}</span>
          </p>
        </div>
      </div>
    </div>
  );
});

export default SongCard;