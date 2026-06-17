/* --- src/hooks/useSongData.js --- */
import { useState, useEffect, useRef } from 'react';
import { saveAudioFile, deleteAudioFile } from '../db';
import { getDistinctArtistColors, cleanUrl, cleanImageUrl, fetchSingerImage, mergeSyncWithGenius, parseTrackName } from '../utils/songHelpers';

export const useSongData = (selectedSong, isSaved, updateSongInLibrary) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false);
  const [customData, setCustomData] = useState({ spotify: '', yt: '', deezer: '', hasLocal: false, localName: '', lyrics: '', artistImages: {}, artistColors: {} });
  const [singerImages, setSingerImages] = useState({});
  const previousTrackId = useRef(null);

  const trackNameData = selectedSong ? parseTrackName(selectedSong.trackName) : { mainTitle: '', extras: [], featuredArtists: [] };
  const featuredArtists = trackNameData.featuredArtists;

  const rawLyricsStr = customData.lyrics || (selectedSong?.syncData ? selectedSong.syncData.map(l => l.text).join('\n') : '');
  const basePalette = selectedSong ? getDistinctArtistColors(rawLyricsStr, selectedSong.artistName, featuredArtists) : {};
  const masterPalette = { ...basePalette, ...customData.artistColors };
  const allPotentialSingers = Object.keys(masterPalette).filter(Boolean);

  useEffect(() => {
    if (selectedSong) {
      const isNewTrack = selectedSong.trackId !== previousTrackId.current;
      if (isNewTrack) {
        previousTrackId.current = selectedSong.trackId;
        setIsEditing(false);
        setIsImageManagerOpen(false);
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

  useEffect(() => {
    if (!selectedSong) return;
    allPotentialSingers.forEach(async (singerName) => {
      const cleanName = singerName.trim();
      if (cleanName && singerImages[cleanName] === undefined && !customData.artistImages?.[cleanName]) {
        setSingerImages(prev => ({ ...prev, [cleanName]: null }));
        // Pass both track name and album name down to the API utility for article scanning
        const imgUrl = await fetchSingerImage(selectedSong.artistName, cleanName, selectedSong.trackName, selectedSong.collectionName);
        if (imgUrl) setSingerImages(prev => ({ ...prev, [cleanName]: imgUrl }));
      }
    });
  }, [allPotentialSingers.join('|'), selectedSong?.artistName, selectedSong?.trackName, selectedSong?.collectionName]);

  const handleDataChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === 'lyrics' ? value : cleanUrl(value);
    setCustomData({ ...customData, [name]: finalValue });
  };

  const handleImageChange = (singerName, url) => setCustomData(prev => ({ ...prev, artistImages: { ...prev.artistImages, [singerName]: cleanImageUrl(url) } }));
  const handleColorChange = (singerName, colorHex) => setCustomData(prev => ({ ...prev, artistColors: { ...prev.artistColors, [singerName]: colorHex } }));

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
    if (updatedSyncData && updatedSyncData.some(l => l.start !== null) && customData.lyrics) {
      updatedSyncData = mergeSyncWithGenius(updatedSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
    }
    updateSongInLibrary({ 
      ...selectedSong, 
      customLinks: { spotify: customData.spotify, yt: customData.yt, deezer: customData.deezer, hasLocal: customData.hasLocal, localName: customData.localName },
      lyrics: customData.lyrics,
      artistImages: customData.artistImages,
      artistColors: customData.artistColors,
      syncData: updatedSyncData
    });
    setIsEditing(false);
  };

  const saveImageManager = () => {
    updateSongInLibrary({ ...selectedSong, artistImages: customData.artistImages, artistColors: customData.artistColors });
    setIsImageManagerOpen(false);
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
    spotify: customData.spotify || `https://open.spotify.com/search/$${searchQuery}`,
    yt: customData.yt || `https://music.youtube.com/search?q=${ytSearchQuery}`,
    deezer: customData.deezer || `https://www.deezer.com/search/${searchQuery}`,
  };

  return {
    isEditing, setIsEditing, isImageManagerOpen, setIsImageManagerOpen,
    customData, setCustomData, singerImages, masterPalette, allPotentialSingers,
    trackNameData, releaseType, highResArt, finalLinks,
    handleDataChange, handleImageChange, handleColorChange, handleLocalFileChange, handleClearLocal,
    saveData, saveImageManager
  };
};