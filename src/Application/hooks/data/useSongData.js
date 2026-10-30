/* --- src/hooks/data/useSongData.js --- */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { saveAudioFile, deleteAudioFile } from '../../services/db.js';
import { fetchDeezerApi } from '../../services/deezerBackend.js';
import { getVaultArtistData } from '../../services/vaultCodec.js';
import { getDistinctArtistColors, cleanUrl, cleanImageUrl, fetchSingerImage, mergeSyncWithGenius, parseTrackName } from '../../../Studio/utils/songHelpers.js';
import { toSmartPunctuation } from '../../../utils/smartPunctuation.js';
import { getPlatformLinkErrors } from '../../utils/platformLinkValidation.js';

const EMPTY_ARTIST_DATA = Object.freeze({});

const createCustomDataForSong = song => ({
  spotify: song?.customLinks?.spotify || '',
  yt: song?.customLinks?.yt || '',
  deezer: song?.customLinks?.deezer || '',
  hasLocal: song?.customLinks?.hasLocal || false,
  localName: song?.customLinks?.localName || '',
  lyrics: toSmartPunctuation(
    song?.lyrics || (song?.syncData ? song.syncData.map(line => line.text).join('\n') : '')
  ),
  artistImages: song?.artistImages || EMPTY_ARTIST_DATA,
  artistColors: song?.artistColors || EMPTY_ARTIST_DATA
});

export const useSongData = (selectedSong, isSaved, updateSongInLibrary, updateSelectedSongDirect, library = []) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [isTranslationManagerOpen, setIsTranslationManagerOpen] = useState(false);
  
  const [storedGlobalArtistData, setStoredGlobalArtistData] = useState(() => {
    const stored = localStorage.getItem('globalArtistData');
    const parsed = stored ? JSON.parse(stored) : {};
    const globalData = {
      images: parsed?.images && typeof parsed.images === 'object' ? parsed.images : {},
      colors: parsed?.colors && typeof parsed.colors === 'object' ? parsed.colors : {}
    };
    
    // HYDRATE FROM VAULT: Scan the entire library for manually set images/colors.
    // This ensures that if an artist was customized in any other song, 
    // we reuse those assets globally instead of auto-fetching new ones.
    try {
      const libraryStr = localStorage.getItem('songLibrary');
      if (libraryStr) {
        getVaultArtistData(JSON.parse(libraryStr)).forEach(({ artistImages, artistColors }) => {
          if (artistImages) {
            Object.entries(artistImages).forEach(([artist, url]) => {
              if (url && !globalData.images[artist]) globalData.images[artist] = url;
            });
          }
          if (artistColors) {
            Object.entries(artistColors).forEach(([artist, color]) => {
              if (color && !globalData.colors[artist]) globalData.colors[artist] = color;
            });
          }
        });
      }
    } catch (e) {
      console.error("Vault artist data hydration failed", e);
    }
    
    return globalData;
  });
  const globalArtistData = useMemo(() => {
    const libraryImages = {};
    const libraryColors = {};
    getVaultArtistData(library).forEach(({ artistImages, artistColors }) => {
      Object.entries(artistImages || {}).forEach(([artist, image]) => {
        if (typeof image === 'string' && image.trim() && !libraryImages[artist]) {
          libraryImages[artist] = image;
        }
      });
      Object.entries(artistColors || {}).forEach(([artist, color]) => {
        if (typeof color === 'string' && color.trim() && !libraryColors[artist]) {
          libraryColors[artist] = color;
        }
      });
    });
    return {
      images: { ...libraryImages, ...storedGlobalArtistData.images },
      colors: { ...libraryColors, ...storedGlobalArtistData.colors }
    };
  }, [library, storedGlobalArtistData]);

  const [customDataState, setCustomDataState] = useState(() => ({
    trackId: selectedSong?.trackId ?? null,
    data: createCustomDataForSong(selectedSong)
  }));
  const [singerImages, setSingerImages] = useState({});
  const songDefaultCustomData = useMemo(
    () => createCustomDataForSong(selectedSong),
    [selectedSong]
  );
  const customData = selectedSong &&
    String(customDataState.trackId) !== String(selectedSong.trackId)
    ? songDefaultCustomData
    : customDataState.data;
  const setCustomData = useCallback(update => {
    setCustomDataState(previous => {
      const song = selectedSong;
      const trackId = song?.trackId ?? null;
      const currentData = song &&
        String(previous.trackId) !== String(trackId)
        ? createCustomDataForSong(song)
        : previous.data;
      return {
        trackId,
        data: typeof update === 'function' ? update(currentData) : update
      };
    });
  }, [selectedSong]);
  
  const previousTrackId = useRef(null);
  const isSavedRef = useRef(isSaved);
  // Track to prevent infinite fetch loops within the same active session
  const hasFetchedDeezerMetaRef = useRef(new Set());

  const trackNameStr = selectedSong?.trackName || '';
  const trackNameData = useMemo(() => parseTrackName(trackNameStr), [trackNameStr]);
  
  const rawLyricsStr = customData.lyrics || (selectedSong?.syncData ? selectedSong.syncData.map(l => l.text).join('\n') : '');
  const selectedArtistName = selectedSong?.artistName;
  const hasSelectedSong = Boolean(selectedSong);
  
  const basePalette = useMemo(() => {
      return hasSelectedSong
        ? getDistinctArtistColors(rawLyricsStr, selectedArtistName, trackNameData.featuredArtists)
        : {};
  }, [rawLyricsStr, selectedArtistName, hasSelectedSong, trackNameData]);

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

      // Keep the track-specific draft aligned with the selected-song prop.
      // The render-time fallback above prevents a worker parse of the previous track.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomData(createCustomDataForSong(selectedSong));
    }
  }, [selectedSong, setCustomData]);

  useEffect(() => {
    isSavedRef.current = isSaved;
  }, [isSaved]);

  // DEEZER METADATA FETCH: Hydrate selected Deezer songs and persist metadata for saved songs.
  useEffect(() => {
    if (selectedSong) {
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

      if (targetId) {
        if (!hasFetchedDeezerMetaRef.current.has(targetId)) {
          hasFetchedDeezerMetaRef.current.add(targetId);
          
          const fetchDeezerMeta = async () => {
            try {
              const res = await fetchDeezerApi(`/track-info-deezer/${encodeURIComponent(targetId)}`);
              if (!res.ok) return;
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
                  if (isSavedRef.current) {
                    updateSongInLibrary(updatedSong);
                  } else {
                    updateSelectedSongDirect(updatedSong);
                  }
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
  }, [selectedSong, updateSongInLibrary, updateSelectedSongDirect]);

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
    const finalValue = name === 'lyrics' ? toSmartPunctuation(value) : cleanUrl(value);
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

  const saveData = ({ clearLyricsRelatedData = false } = {}) => {
    const hasInvalidPlatformLink = Object.values(getPlatformLinkErrors(customData)).some(Boolean);
    if (hasInvalidPlatformLink) return false;

    const hasLyrics = Boolean(customData.lyrics?.trim());
    let updatedSyncData = hasLyrics ? selectedSong.syncData : [];
    
    // Enforce strict merging regardless of whether timestamps exist yet to prevent index displacement
    if (updatedSyncData && hasLyrics) {
      updatedSyncData = mergeSyncWithGenius(updatedSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
    }
    
    let updatedAutoSyncData = hasLyrics ? selectedSong.autoSyncData : [];
    if (updatedAutoSyncData && hasLyrics) {
      updatedAutoSyncData = mergeSyncWithGenius(updatedAutoSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
    }

    const updatedSongPayload = {
      ...selectedSong,
      customLinks: { spotify: customData.spotify, yt: customData.yt, deezer: customData.deezer, hasLocal: customData.hasLocal, localName: customData.localName },
      lyrics: customData.lyrics,
      artistImages: clearLyricsRelatedData ? {} : customData.artistImages,
      artistColors: customData.artistColors,
      syncData: updatedSyncData,
      autoSyncData: updatedAutoSyncData
    };
    
    // Close editor view first to unmount editing UI elements
    setIsEditing(false);

    // Commit updated song payload to vault and active player state simultaneously
    updateSongInLibrary(updatedSongPayload);
    return updatedSongPayload;
  };

  const saveImageManager = () => {
    const newGlobal = {
      images: { ...globalArtistData.images },
      colors: { ...globalArtistData.colors }
    };
    Object.entries(customData.artistImages || {}).forEach(([artist, image]) => {
      if (typeof image === 'string' && image.trim()) newGlobal.images[artist] = image;
    });
    Object.entries(customData.artistColors || {}).forEach(([artist, color]) => {
      if (typeof color === 'string' && color.trim()) newGlobal.colors[artist] = color;
    });
    
    localStorage.setItem('globalArtistData', JSON.stringify(newGlobal));
    setStoredGlobalArtistData(newGlobal);
    
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
    linkValidationErrors: getPlatformLinkErrors(customData),
    saveData, saveImageManager
  };
};