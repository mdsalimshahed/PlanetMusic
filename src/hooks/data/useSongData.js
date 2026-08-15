/* --- src/hooks/data/useSongData.js --- */
import { useState, useEffect, useRef, useMemo } from 'react';
import { saveAudioFile, deleteAudioFile } from '../../services/db';
import { getDistinctArtistColors, cleanUrl, cleanImageUrl, fetchSingerImage, mergeSyncWithGenius, parseTrackName } from '../../utils/songHelpers';

export const useSongData = (selectedSong, isSaved, updateSongInLibrary) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [isTranslationManagerOpen, setIsTranslationManagerOpen] = useState(false);
  
  const [globalArtistData, setGlobalArtistData] = useState(() => {
    const stored = localStorage.getItem('globalArtistData');
    const parsed = stored ? JSON.parse(stored) : { images: {}, colors: {} };
    
    // HYDRATE FROM VAULT: Scan the entire library for manually set images/colors.
    // This ensures that if an artist was customized in any other song, 
    // we reuse those assets globally instead of auto-fetching new ones.
    try {
      const libraryStr = localStorage.getItem('songLibrary');
      if (libraryStr) {
        const lib = JSON.parse(libraryStr);
        if (Array.isArray(lib)) {
          lib.forEach(song => {
            if (song.artistImages) {
              Object.entries(song.artistImages).forEach(([artist, url]) => {
                if (url && !parsed.images[artist]) parsed.images[artist] = url;
              });
            }
            if (song.artistColors) {
              Object.entries(song.artistColors).forEach(([artist, color]) => {
                if (color && !parsed.colors[artist]) parsed.colors[artist] = color;
              });
            }
          });
        }
      }
    } catch (e) {
      console.error("Vault artist data hydration failed", e);
    }
    
    return parsed;
  });

  const [customData, setCustomData] = useState({ spotify: '', yt: '', deezer: '', hasLocal: false, localName: '', lyrics: '', artistImages: {}, artistColors: {} });
  const [singerImages, setSingerImages] = useState({});
  
  const previousTrackId = useRef(null);
  // Track to prevent infinite fetch loops within the same active session
  const hasFetchedDeezerMetaRef = useRef(new Set());

  const trackNameStr = selectedSong?.trackName || '';
  const trackNameData = useMemo(() => parseTrackName(trackNameStr), [trackNameStr]);
  const featuredArtists = trackNameData.featuredArtists;
  
  const rawLyricsStr = customData.lyrics || (selectedSong?.syncData ? selectedSong.syncData.map(l => l.text).join('\n') : '');
  
  const basePalette = useMemo(() => {
      return selectedSong ? getDistinctArtistColors(rawLyricsStr, selectedSong.artistName, trackNameData.featuredArtists) : {};
  }, [rawLyricsStr, selectedSong?.artistName, trackNameData]);

  const masterPalette = useMemo(() => {
      return { ...basePalette, ...globalArtistData.colors, ...customData.artistColors };
  }, [basePalette, globalArtistData.colors, customData.artistColors]);

  const allPotentialSingers = useMemo(() => {
      return Object.keys(basePalette).filter(Boolean);
  }, [basePalette]);

  useEffect(() => {
    if (selectedSong) {
      const isNewTrack = selectedSong.trackId !== previousTrackId.current;
      if (isNewTrack) {
        previousTrackId.current = selectedSong.trackId;
        setIsEditing(false);
        setIsImageManagerOpen(false);
        setIsTranslationManagerOpen(false);
        setSingerImages({});
      }

      const initialLyricsStr = selectedSong.lyrics || (selectedSong.syncData ? selectedSong.syncData.map(l => l.text).join('\n') : '');
      
      setCustomData({
        spotify: selectedSong.customLinks?.spotify || '',
        yt: selectedSong.customLinks?.yt || '',
        deezer: selectedSong.customLinks?.deezer || '',
        hasLocal: selectedSong.customLinks?.hasLocal || false,
        localName: selectedSong.customLinks?.localName || '',
        lyrics: initialLyricsStr,
        artistImages: selectedSong.artistImages || {},
        artistColors: selectedSong.artistColors || {}
      });
    }
  }, [selectedSong]);

  // DEEZER METADATA FETCH: Run instantly when a Deezer-only song is saved OR a custom Deezer link is added
  useEffect(() => {
    if (isSaved && selectedSong) {
      // --- PERMANENT EFFICIENCY FIX ---
      // If we have already fetched and bound the Deezer metadata to this song in the vault, 
      // skip the network request entirely.
      if (selectedSong.hasDeezerMetaBound) return;

      const isDeezerOnly = (selectedSong.sourceNames?.length === 1 && selectedSong.sourceNames[0] === 'Deezer') || 
                            (!selectedSong.sourceNames && selectedSong.sourceName === 'Deezer');
                            
      const customDzUrl = selectedSong.customLinks?.deezer;
      let targetId = null;

      if (isDeezerOnly) {
        targetId = String(selectedSong.trackId).replace('dz_', '');
      } else if (customDzUrl) {
        const match = customDzUrl.match(/track\/(\d+)/i);
        if (match) targetId = match[1];
      }

      // Read settings directly to check if an ARL exists
      const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      const hasArl = Boolean(appSettings.deezerArl?.trim());

      if (targetId && hasArl) {
        if (!hasFetchedDeezerMetaRef.current.has(targetId)) {
          hasFetchedDeezerMetaRef.current.add(targetId);
          
          const fetchDeezerMeta = async () => {
            try {
              const res = await fetch(`https://ytdownloader-jnt0.onrender.com/track-info-deezer/${targetId}`);
              const json = await res.json();
              
              if (json.success && json.data) {
                // Permanently flag the song so we never fetch this again
                const updatedSong = { ...selectedSong, hasDeezerMetaBound: true }; 
                let modified = true;
                
                if (json.data.release_date && !updatedSong.releaseDate) {
                  updatedSong.releaseDate = json.data.release_date;
                }
                
                if (json.data.extracted_genres && json.data.extracted_genres.length > 0) {
                  const validGenres = json.data.extracted_genres.filter(g => g !== "Not Specified");
                  if (validGenres.length > 0 && !updatedSong.primaryGenreName) {
                    updatedSong.primaryGenreName = validGenres.join(', ');
                  }
                }

                // BIND EXPLICITNESS TO SONG
                // Deezer uses explicit_lyrics (boolean) and explicit_content_lyrics (int status code)
                const isExplicit = json.data.explicit_lyrics === true || 
                                   json.data.explicit_content_lyrics === 1 || 
                                   json.data.explicit_content_lyrics === 2 || 
                                   json.data.explicit_content_lyrics === 4;

                if (isExplicit && updatedSong.trackExplicitness !== 'explicit') {
                  updatedSong.trackExplicitness = 'explicit';
                } else if (!isExplicit && updatedSong.trackExplicitness === 'explicit') {
                  updatedSong.trackExplicitness = 'notExplicit';
                }
                
                if (modified) {
                  updateSongInLibrary(updatedSong);
                }
              }
            } catch (e) {
              console.error("Failed to fetch Deezer metadata:", e);
            }
          };

          fetchDeezerMeta();
        }
      }
    }
  }, [isSaved, selectedSong, updateSongInLibrary]);

  useEffect(() => {
    if (!selectedSong) return;
    
    allPotentialSingers.forEach(async (singerName) => {
      const cleanName = singerName.trim();
      if (cleanName && singerImages[cleanName] === undefined && !customData.artistImages?.[cleanName] && !globalArtistData.images?.[cleanName]) {
        setSingerImages(prev => ({ ...prev, [cleanName]: null }));
        const imgUrl = await fetchSingerImage(selectedSong.artistName, cleanName, selectedSong.trackName, selectedSong.collectionName);
        if (imgUrl) setSingerImages(prev => ({ ...prev, [cleanName]: imgUrl }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPotentialSingers.join('|'), selectedSong?.artistName, selectedSong?.trackName, selectedSong?.collectionName]);

  const handleDataChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === 'lyrics' ? value : cleanUrl(value);
    setCustomData({ ...customData, [name]: finalValue });
  };

  const handleImageChange = (singerName, url) => {
    const cleanUrl = cleanImageUrl(url);
    setCustomData(prev => ({ ...prev, artistImages: { ...prev.artistImages, [singerName]: cleanUrl } }));
  };

  const handleColorChange = (singerName, colorHex) => {
    setCustomData(prev => ({ ...prev, artistColors: { ...prev.artistColors, [singerName]: colorHex } }));
  };

  const handleLocalFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await saveAudioFile(selectedSong.trackId, file);
      setCustomData(prev => ({ ...prev, hasLocal: true, localName: file.name }));
      if (isSaved) updateSongInLibrary({ ...selectedSong, customLinks: { ...selectedSong.customLinks, hasLocal: true, localName: file.name }});
    }
  };

  const handleClearLocal = async () => {
    await deleteAudioFile(selectedSong.trackId);
    setCustomData(prev => ({ ...prev, hasLocal: false, localName: '' }));
    if (isSaved) updateSongInLibrary({ ...selectedSong, customLinks: { ...selectedSong.customLinks, hasLocal: false, localName: '' }});
  };

  const saveData = () => {
    let updatedSyncData = selectedSong.syncData;
    
    // Enforce strict merging regardless of whether timestamps exist yet to prevent index displacement
    if (updatedSyncData && customData.lyrics) {
      updatedSyncData = mergeSyncWithGenius(updatedSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
    }
    
    let updatedAutoSyncData = selectedSong.autoSyncData;
    if (updatedAutoSyncData && customData.lyrics) {
      updatedAutoSyncData = mergeSyncWithGenius(updatedAutoSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
    }

    const updatedSongPayload = {
      ...selectedSong,
      customLinks: { spotify: customData.spotify, yt: customData.yt, deezer: customData.deezer, hasLocal: customData.hasLocal, localName: customData.localName },
      lyrics: customData.lyrics,
      artistImages: customData.artistImages,
      artistColors: customData.artistColors,
      syncData: updatedSyncData,
      autoSyncData: updatedAutoSyncData
    };
    
    // Close editor view first to unmount editing UI elements
    setIsEditing(false);

    // Commit updated song payload to vault and active player state simultaneously
    updateSongInLibrary(updatedSongPayload);
  };

  const saveImageManager = () => {
    const newGlobal = {
      images: { ...globalArtistData.images, ...customData.artistImages },
      colors: { ...globalArtistData.colors, ...customData.artistColors }
    };
    
    localStorage.setItem('globalArtistData', JSON.stringify(newGlobal));
    setGlobalArtistData(newGlobal);
    
    const newMasterPalette = { ...basePalette, ...newGlobal.colors, ...customData.artistColors };

    let updatedSyncData = selectedSong.syncData;
    if (updatedSyncData && customData.lyrics) {
        updatedSyncData = mergeSyncWithGenius(updatedSyncData, customData.lyrics, selectedSong.artistName, newMasterPalette);
    }
    
    let updatedAutoSyncData = selectedSong.autoSyncData;
    if (updatedAutoSyncData && customData.lyrics) {
       updatedAutoSyncData = mergeSyncWithGenius(updatedAutoSyncData, customData.lyrics, selectedSong.artistName, newMasterPalette);
    }

    setIsImageManagerOpen(false);
    updateSongInLibrary({
      ...selectedSong,
      artistImages: customData.artistImages,
      artistColors: customData.artistColors,
      syncData: updatedSyncData,
      autoSyncData: updatedAutoSyncData
    });
  };

  const isSingle = selectedSong?.trackCount === 1 || selectedSong?.collectionName === selectedSong?.trackName;
  const releaseType = isSingle ? 'Single' : selectedSong?.collectionName || 'Single';
  const highResArt = selectedSong?.artworkUrl100?.replace(/100x100bb/g, '1000x1000bb').replace(/100x100/g, '1000x1000');
  const minutes = selectedSong ? Math.floor(selectedSong.trackTimeMillis / 60000) : 0;
  const seconds = selectedSong ? ((selectedSong.trackTimeMillis % 60000) / 1000).toFixed(0) : 0;
  const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const searchQuery = selectedSong ? encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName}`) : '';
  const ytSearchQuery = selectedSong ? encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} ${timeString}`) : '';
  
  const finalLinks = {
    spotify: customData.spotify || `https://open.spotify.com/search/${searchQuery}`,
    yt: customData.yt || `https://music.youtube.com/search?q=${ytSearchQuery}`,
    deezer: customData.deezer || `https://www.deezer.com/search/${searchQuery}`
  };

  return {
    isEditing, setIsEditing, isImageManagerOpen, setIsImageManagerOpen, isTranslationManagerOpen, setIsTranslationManagerOpen,
    customData, setCustomData, singerImages, masterPalette, allPotentialSingers,
    trackNameData, releaseType, highResArt, finalLinks, globalArtistData,
    handleDataChange, handleImageChange, handleColorChange, handleLocalFileChange, handleClearLocal,
    saveData, saveImageManager
  };
};