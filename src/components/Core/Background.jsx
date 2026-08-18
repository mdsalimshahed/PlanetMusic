/* --- src/components/Core/Background.jsx --- */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import './Background.css';

const Background = () => {
  // 1. Hyper-targeted Vault JSON Scanner
  const lyricPool = useMemo(() => {
    const profiles = new Map();
    const pool = [];
    const seenLines = new Set();

    const getHighRes = (url) => url ? url.replace('100x100', '300x300') : null;

    // Scan localStorage for the Vault JSON
    for (let i = 0; i < localStorage.length; i++) {
      try {
        const item = localStorage.getItem(localStorage.key(i));
        if (!item || (!item.startsWith('{') && !item.startsWith('['))) continue;

        const data = JSON.parse(item);
        
        let tracks = [];
        if (data.library && Array.isArray(data.library)) tracks = data.library;
        else if (Array.isArray(data)) tracks = data;
        else if (data.wrapperType === 'track') tracks = [data];

        tracks.forEach(track => {
          if (track.wrapperType !== 'track') return;

          const trackArtist = track.artistName || 'Unknown Artist';
          
          const trackArt = getHighRes(track.artworkUrl100 || track.artworkUrl || track.coverUrl);
          if (trackArt) profiles.set(trackArtist.toLowerCase().trim(), trackArt);

          if (track.artistImages && typeof track.artistImages === 'object') {
            Object.entries(track.artistImages).forEach(([aName, aPic]) => {
              if (aPic) profiles.set(aName.toLowerCase().trim(), aPic);
            });
          }

          const sourceData = track.syncData || track.autoSyncData;

          if (sourceData && Array.isArray(sourceData) && sourceData.length > 0) {
            sourceData.forEach(lineObj => {
              const text = lineObj.text?.trim();
              if (text && text.length > 3 && text.length < 120 && !text.startsWith('http')) {
                const lineArtist = (lineObj.singer || trackArtist).split(',')[0].trim();
                const photo = profiles.get(lineArtist.toLowerCase()) || profiles.get(trackArtist.toLowerCase().trim());
                
                if (photo && !seenLines.has(text)) {
                  seenLines.add(text);
                  pool.push({ line: text, artist: lineArtist, photo });
                }
              }

              if (Array.isArray(lineObj.adlibs)) {
                lineObj.adlibs.forEach(adlib => {
                  const adText = adlib.text?.replace(/[()]/g, '').trim();
                  if (adText && adText.length > 2) {
                    const adArtist = (adlib.singer || lineObj.singer || trackArtist).split(',')[0].trim();
                    const adPhoto = profiles.get(adArtist.toLowerCase()) || profiles.get(trackArtist.toLowerCase().trim());
                    
                    if (adPhoto && !seenLines.has(adText)) {
                      seenLines.add(adText);
                      pool.push({ line: adText, artist: adArtist, photo: adPhoto });
                    }
                  }
                });
              }
            });
          } else if (typeof track.lyrics === 'string') {
            const rawLines = track.lyrics.split('\n').map(l => l.replace(/\[.*?\]/g, '').trim()).filter(l => l.length > 3);
            rawLines.forEach(text => {
              const photo = profiles.get(trackArtist.toLowerCase().trim());
              if (photo && !seenLines.has(text)) {
                seenLines.add(text);
                pool.push({ line: text, artist: trackArtist, photo });
              }
            });
          }
        });
      } catch (e) {}
    }

    return pool;
  }, []);

  const [bubbles, setBubbles] = useState([]);
  const poolRef = useRef(lyricPool);
  poolRef.current = lyricPool;

  // 2. Vertical Waterfall Spawn Engine
  useEffect(() => {
    let timerId = null;

    const scheduleNextSpawn = () => {
      // Rapid spawn pacing: every 0.6s to 1.4s
      const delay = Math.floor(Math.random() * 800) + 600;
      
      timerId = setTimeout(() => {
        const currentPool = poolRef.current;
        if (currentPool.length > 0) {
          const randomItem = currentPool[Math.floor(Math.random() * currentPool.length)];

          const newBubble = {
            id: Date.now() + Math.random(),
            line: randomItem.line,
            artist: randomItem.artist,
            photo: randomItem.photo,
            // Randomize X from 0 to 100 (The CSS clamp will enforce the safe boundaries)
            x: Math.floor(Math.random() * 100), 
            duration: Math.floor(Math.random() * 10) + 12 // Random travel speed (12s to 22s)
          };

          setBubbles((prev) => {
            // Keep up to 24 bubbles on screen since they take a long time to travel up
            if (prev.length >= 24) {
              return [...prev.slice(1), newBubble];
            }
            return [...prev, newBubble];
          });
        }
        scheduleNextSpawn();
      }, delay);
    };

    scheduleNextSpawn();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const handleAnimationEnd = (id) => {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="dynamic-circle-bg">
      <div className="ambient-vignette" />

      {/* Floating Lyric Chat Bubbles Canvas */}
      <div className="lyric-bubbles-container">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="lyric-chat-bubble"
            style={{
              // CSS Clamp: Keeps it >= 20px from the left, and leaves exactly 360px of breathing room on the right
              left: `clamp(20px, ${b.x}%, calc(100% - 360px))`,
              animationDuration: `${b.duration}s`
            }}
            onAnimationEnd={() => handleAnimationEnd(b.id)}
          >
            <img src={b.photo} alt={b.artist} className="bubble-artist-photo" />
            <div className="bubble-content">
              <span className="bubble-artist">{b.artist}</span>
              <span className="bubble-lyric">"{b.line}"</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(Background);