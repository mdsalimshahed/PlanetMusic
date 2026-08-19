/* --- src/Application/components/Core/Background.jsx --- */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchSingerImage } from '../../utils/apiUtils.js';
import './Background.css';

// Helper to resolve the correct artist image across all storage scopes, now with Wikipedia API fallback
const getArtistPhoto = async (artistName, track = null, profilesMap = new Map(), fetchedCache = new Map()) => {
  const lowerName = artistName.toLowerCase().trim();
  
  // 1. Check current track custom images
  if (track?.artistImages && track.artistImages[artistName]) {
    return track.artistImages[artistName];
  }
  
  // 2. Check global artist data (saved via ImageManager)
  try {
    const globalArtistStr = localStorage.getItem('globalArtistData');
    if (globalArtistStr) {
      const globalArtistData = JSON.parse(globalArtistStr);
      if (globalArtistData.images && globalArtistData.images[artistName]) {
        return globalArtistData.images[artistName];
      }
      // Case insensitive fallback
      const foundKey = Object.keys(globalArtistData.images || {}).find(k => k.toLowerCase().trim() === lowerName);
      if (foundKey && globalArtistData.images[foundKey]) {
        return globalArtistData.images[foundKey];
      }
    }
  } catch (e) {}
  
  // 3. Profiles Map (accumulated from all songs in the library)
  if (profilesMap.has(lowerName)) {
    return profilesMap.get(lowerName);
  }

  // 4. Memory cache for fetched images during this session
  if (fetchedCache.has(lowerName)) {
    const cached = fetchedCache.get(lowerName);
    if (cached) return cached;
  } else {
    // 5. Wikipedia Fetch!
    try {
      // Set a temporary pending/failed state so we don't fire multiple requests for the same artist at once
      fetchedCache.set(lowerName, null); 
      const band = track?.artistName || '';
      const fetchedUrl = await fetchSingerImage(band, artistName, track?.trackName, track?.collectionName);
      if (fetchedUrl) {
          fetchedCache.set(lowerName, fetchedUrl);
          return fetchedUrl;
      }
    } catch (e) {
      console.error("Wiki fetch error:", e);
    }
  }
  
  // 6. Track cover fallback
  if (track) {
    return track.artworkUrl100?.replace('100x100', '300x300') || track.artworkUrl || track.coverUrl;
  }
  
  return '';
};

const Background = ({ isModalOpen = false, currentTrack = null }) => {
  
  // 1. Hyper-targeted Vault JSON Scanner (Extracts cleanly separated main lines & ad-libs)
  const { pool, profiles } = useMemo(() => {
    const profilesMap = new Map();
    const poolArray = [];
    const seenLines = new Set();

    const getHighRes = (url) => url ? url.replace('100x100', '300x300') : null;

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
          if (trackArt) profilesMap.set(trackArtist.toLowerCase().trim(), trackArt);

          if (track.artistImages && typeof track.artistImages === 'object') {
            Object.entries(track.artistImages).forEach(([aName, aPic]) => {
              if (aPic) profilesMap.set(aName.toLowerCase().trim(), aPic);
            });
          }

          const sourceData = track.syncData || track.autoSyncData;
          if (sourceData && Array.isArray(sourceData) && sourceData.length > 0) {
            sourceData.forEach(lineObj => {
              let mainText = lineObj.text || '';

              // Strip and isolate ad-libs
              if (lineObj.isSplit && Array.isArray(lineObj.adlibs)) {
                lineObj.adlibs.forEach(adlib => {
                  const adTextRaw = adlib.text || '';
                  const adText = adTextRaw.replace(/[()\[\]]/g, '').trim();
                  
                  if (adText && adText.length > 2 && !seenLines.has(adText)) {
                    const adArtist = (adlib.singer || lineObj.singer || trackArtist).split(',')[0].trim();
                    seenLines.add(adText);
                    poolArray.push({ line: adText, artist: adArtist, track: track, trackId: track.trackId });
                  }
                  // Erase the ad-lib from the main line text entirely
                  mainText = mainText.replace(adTextRaw, '');
                });
              }

              // Process the remaining cleanly separated main line
              const cleanMainText = mainText.replace(/\[.*?\]/g, '').replace(/\s{2,}/g, ' ').trim();
              if (cleanMainText.length > 3 && cleanMainText.length < 120 && !cleanMainText.startsWith('http') && !seenLines.has(cleanMainText)) {
                const lineArtist = (lineObj.singer || trackArtist).split(',')[0].trim();
                seenLines.add(cleanMainText);
                poolArray.push({ line: cleanMainText, artist: lineArtist, track: track, trackId: track.trackId });
              }
            });
          } else if (typeof track.lyrics === 'string') {
            const rawLines = track.lyrics.split('\n').map(l => l.replace(/\[.*?\]/g, '').trim()).filter(l => l.length > 3);
            rawLines.forEach(text => {
              if (!seenLines.has(text)) {
                seenLines.add(text);
                poolArray.push({ line: text, artist: trackArtist, track: track, trackId: track.trackId });
              }
            });
          }
        });
      } catch (e) {}
    }
    return { pool: poolArray, profiles: profilesMap };
  }, []);

  const [bubbles, setBubbles] = useState([]);
  
  // Stash dependencies in refs to prevent timer/listener wipeouts
  const poolRef = useRef(pool);
  const profilesRef = useRef(profiles);
  const currentTrackRef = useRef(currentTrack);
  const isPlayingRef = useRef(false);
  const fetchedImageCacheRef = useRef(new Map());
  
  // Spatial Anti-Collision Engine Memory
  const recentSpawnsRef = useRef([]);

  useEffect(() => {
    poolRef.current = pool;
    profilesRef.current = profiles;
    currentTrackRef.current = currentTrack;
  }, [pool, profiles, currentTrack]);

  // Sync with global player state
  useEffect(() => {
    const handlePlayState = (e) => {
        const playing = e.detail?.isPlaying || false;
        isPlayingRef.current = playing;
    };
    window.addEventListener('globalPlayState', handlePlayState);
    if (typeof window.globalIsAudioPlaying !== 'undefined') {
        isPlayingRef.current = window.globalIsAudioPlaying;
    }
    return () => window.removeEventListener('globalPlayState', handlePlayState);
  }, []);

  const spawnBubble = (line, artist, photo, isSynced) => {
    const now = Date.now();
    // Scrub bubbles older than 2.5s from memory to free up space
    recentSpawnsRef.current = recentSpawnsRef.current.filter(s => now - s.time < 2500);

    // VERTICAL STACKING: Check for bubbles that fired essentially simultaneously (< 500ms) of the SAME type
    const simultaneousSpawns = recentSpawnsRef.current.filter(s => now - s.time < 500 && s.isSynced === isSynced);
    const yOffset = simultaneousSpawns.length * 90; 

    let spawnX;
    // Always assign an independent, fully randomized float duration for dynamic speed variation!
    const duration = isSynced ? Math.floor(Math.random() * 4) + 8 : Math.floor(Math.random() * 10) + 12;

    // If part of a simultaneous stack, strictly inherit the exact X coordinate so it launches
    // cleanly from the same vertical line, but keep its independent randomized speed.
    if (simultaneousSpawns.length > 0) {
        spawnX = simultaneousSpawns[0].x;
    } else {
        // Not a stack: Calculate brand new spawn location
        let attempts = 0;
        let bestX = 50;
        let maxMinDist = -1;

        const getCandidateX = () => {
            if (isSynced) {
                // Widen the synced corridor slightly (30% to 70%) to give multiple separate stacks room
                return Math.floor(Math.random() * 40) + 30;
            } else if (isPlayingRef.current) {
                // Dodging Matrix: avoid the center to leave absolute clearance for player and synced bubbles
                return Math.random() > 0.5
                    ? Math.floor(Math.random() * 20) + 5     // 5% to 25% (Far Left)
                    : Math.floor(Math.random() * 20) + 75;   // 75% to 95% (Far Right)
            } else {
                return Math.floor(Math.random() * 90) + 5;   // 5% to 95%
            }
        };

        bestX = getCandidateX();

        if (recentSpawnsRef.current.length === 0) {
            spawnX = bestX;
        } else {
            // Smart Collision Resolution: Try 15 times to find a perfectly clear X coordinate
            while (attempts < 15) {
                let candidateX = getCandidateX();
                let minDist = Infinity;

                for (let spawn of recentSpawnsRef.current) {
                    const dist = Math.abs(candidateX - spawn.x);
                    if (dist < minDist) minDist = dist;
                }

                // Demand a robust 22% viewport separation for an ideal clean spawn
                if (minDist >= 22) {
                    spawnX = candidateX;
                    break;
                }

                // Keep track of the 'least bad' overlapping coordinate as a fallback
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestX = candidateX;
                }
                attempts++;
            }

            // If a perfect spot wasn't found in a crowded screen, use the mathematically best-spaced option
            if (spawnX === undefined) {
                spawnX = bestX; 
            }
        }
    }

    recentSpawnsRef.current.push({ x: spawnX, time: now, isSynced, duration });

    const newBubble = {
        id: (isSynced ? 'sync-' : 'amb-') + Date.now() + '-' + Math.random(),
        line,
        artist,
        photo,
        x: spawnX,
        yOffset, // Apply vertical stacking offset
        duration,
        isSynced
    };

    setBubbles(prev => {
        if (prev.length >= 24) return [...prev.slice(1), newBubble];
        return [...prev, newBubble];
    });
  };

  // 2. Synced Lyric Engine (Event-driven to support independent ad-lib timings)
  useEffect(() => {
    if (isModalOpen) return;

    const currentTrackIdRef = { current: null };
    const spawnedSyncEventsRef = { current: new Set() };
    const lastTimeRef = { current: null };

    const handleTimeUpdate = (e) => {
        if (!isPlayingRef.current || !currentTrackRef.current) return;
        
        const track = currentTrackRef.current;
        const time = e.detail;

        // Reset tracking if song changes
        if (track.trackId !== currentTrackIdRef.current) {
            currentTrackIdRef.current = track.trackId;
            spawnedSyncEventsRef.current.clear();
            lastTimeRef.current = time;
        }

        // Detect manual scrubbing/seeking (Difference > 1 second)
        const prevTime = lastTimeRef.current !== null ? lastTimeRef.current : time;
        if (Math.abs(time - prevTime) > 1.0) {
            spawnedSyncEventsRef.current.clear(); // Re-arm all events so they can trigger again
        }
        lastTimeRef.current = time;

        const validSyncData = track.syncData?.some(l => l.start !== null) ? track.syncData : track.autoSyncData;
        if (!validSyncData) return;

        validSyncData.forEach((node, i) => {
            // MAIN LINE PROCESSING
            const mainEventId = `main-${i}`;
            if (node.start !== null && !spawnedSyncEventsRef.current.has(mainEventId)) {
                if (time >= node.start) {
                    spawnedSyncEventsRef.current.add(mainEventId);
                    
                    // Only trigger if we naturally crossed this threshold (prevents bombarding after a seek)
                    if (time - node.start < 0.5) {
                        let mainText = node.text || '';
                        
                        // Scrub ad-libs from the main text
                        if (node.isSplit && node.adlibs) {
                            node.adlibs.forEach(a => {
                                mainText = mainText.replace(a.text || '', '');
                            });
                        }
                        
                        const cleanText = mainText.replace(/\[.*?\]/g, '').replace(/\s{2,}/g, ' ').trim();
                        if (cleanText.length > 0) {
                            const artistName = (node.singer || track.artistName || 'Unknown').split(',')[0].trim();
                            getArtistPhoto(artistName, track, profilesRef.current, fetchedImageCacheRef.current).then(photo => {
                                spawnBubble(cleanText, artistName, photo, true);
                            });
                        }
                    }
                }
            }

            // INDEPENDENT AD-LIB PROCESSING
            if (node.isSplit && node.adlibs) {
                node.adlibs.forEach((adlib, j) => {
                    const adlibEventId = `adlib-${i}-${j}`;
                    if (adlib.start !== null && !spawnedSyncEventsRef.current.has(adlibEventId)) {
                        if (time >= adlib.start) {
                            spawnedSyncEventsRef.current.add(adlibEventId);
                            
                            if (time - adlib.start < 0.5) {
                                const cleanAdlibText = (adlib.text || '').replace(/[()\[\]]/g, '').trim();
                                if (cleanAdlibText.length > 0) {
                                    const artistName = (adlib.singer || node.singer || track.artistName || 'Unknown').split(',')[0].trim();
                                    getArtistPhoto(artistName, track, profilesRef.current, fetchedImageCacheRef.current).then(photo => {
                                        spawnBubble(cleanAdlibText, artistName, photo, true);
                                    });
                                }
                            }
                        }
                    }
                });
            }
        });
    };

    window.addEventListener('globalTimeUpdate', handleTimeUpdate);
    return () => window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
  }, [isModalOpen]);

  // 3. Ambient Vertical Waterfall Spawn Engine
  useEffect(() => {
    // If the modal opens, instantly destroy bubbles and stop the timer
    if (isModalOpen) {
      setBubbles([]);
      return; 
    }

    let timerId = null;

    const scheduleNextSpawn = () => {
      // Rapid spawn pacing: every 0.6s to 1.4s
      const delay = Math.floor(Math.random() * 800) + 600;
      
      timerId = setTimeout(() => {
        const currentPool = poolRef.current;
        const activeTrack = currentTrackRef.current;

        // FILTER OUT THE CURRENTLY PLAYING SONG:
        // Exclude all items from poolRef that belong to the active playing song so they don't leak into ambient bubbles.
        const filteredPool = activeTrack 
          ? currentPool.filter(item => String(item.trackId) !== String(activeTrack.trackId))
          : currentPool;

        if (filteredPool.length > 0) {
          const randomItem = filteredPool[Math.floor(Math.random() * filteredPool.length)];
          getArtistPhoto(randomItem.artist, randomItem.track, profilesRef.current, fetchedImageCacheRef.current).then(photo => {
              spawnBubble(randomItem.line, randomItem.artist, photo, false);
          });
        }
        scheduleNextSpawn();
      }, delay);
    };

    scheduleNextSpawn();

    // Clean up timer when unmounting OR when isModalOpen changes
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isModalOpen]); 

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
            className={`lyric-chat-bubble ${b.isSynced ? 'synced' : ''}`}
            style={{
              // Flawless alignment calculation mapping 'b.x' strictly to the center axis of the 340px bubble
              left: `clamp(20px, calc(${b.x}% - 170px), calc(100vw - 360px))`,
              // Apply dynamic vertical stack offset
              top: `calc(100% - 115px - ${b.yOffset || 0}px)`,
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