/* --- src/components/SongModal.jsx --- */
import React, { useState, useEffect, useRef } from 'react';
import { saveAudioFile, deleteAudioFile, getAudioFile } from '../db';
import { getBulkPronunciations } from '../transliterator'; 
import { getDistinctArtistColors, parseLyrics, fetchSingerImage, cleanUrl, cleanImageUrl, fetchLRCLIB, fetchYouLyrics, parseLRC, mergeSyncWithGenius, parseTrackName } from '../utils/songHelpers';
import ModalLeft from './ModalLeft';
import ModalRight from './ModalRight';
import './SongModal.css';

const SongModal = ({ selectedSong, setSelectedSong, isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack, currentTrack, settings }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [customData, setCustomData] = useState({ spotify: '', yt: '', deezer: '', hasLocal: false, localName: '', lyrics: '', artistImages: {}, artistColors: {} });
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isLrcFetching, setIsLrcFetching] = useState(false);
  const [isImageManagerOpen, setIsImageManagerOpen] = useState(false); 
  const [syncData, setSyncData] = useState([]);
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [isSyncPlaying, setIsSyncPlaying] = useState(false);
  const [syncAudioSrc, setSyncAudioSrc] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const [singerImages, setSingerImages] = useState({});
  const [currentSingerBg, setCurrentSingerBg] = useState(null); 
  const [isSingerVisible, setIsSingerVisible] = useState(false);
  
  const [debugInfo, setDebugInfo] = useState({ source: 'None', rawData: null });
  
  const singerTimeoutRef = useRef(null);
  const activeSingerRef = useRef(null); 

  const [lyricsViewMode, setLyricsViewMode] = useState('live'); 
  const [globalProgress, setGlobalProgress] = useState(0);
  const [liveParsedLyrics, setLiveParsedLyrics] = useState([]);

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);

  const syncAudioRef = useRef(null);
  const activeLineRef = useRef(null);
  const activePreviewRef = useRef(null);
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);
  const previousTrackId = useRef(null);

  const trackNameData = selectedSong ? parseTrackName(selectedSong.trackName) : { mainTitle: '', extras: [], featuredArtists: [] };
  const featuredArtists = trackNameData.featuredArtists;

  useEffect(() => { activeIdxRef.current = activeSyncIndex; syncDataRef.current = syncData; }, [activeSyncIndex, syncData]);

  useEffect(() => {
    const handleGlobalTime = (e) => setGlobalProgress(e.detail);
    window.addEventListener('globalTimeUpdate', handleGlobalTime);
    return () => window.removeEventListener('globalTimeUpdate', handleGlobalTime);
  }, []);

  useEffect(() => {
    if (selectedSong) {
      const isNewTrack = selectedSong.trackId !== previousTrackId.current;
      if (isNewTrack) {
        previousTrackId.current = selectedSong.trackId;
        setIsEditing(false);
        setIsSyncMode(false);
        setIsImageManagerOpen(false); 
        setLyricsViewMode('live');
        
        setCurrentSingerBg(null);
        setIsSingerVisible(false);
        activeSingerRef.current = null; 
        
        setPlaybackRate(1.0); 
        setDebugInfo({ source: 'Local Vault / Cache', rawData: null }); 
      }

      const rawLyricsStr = selectedSong.lyrics || (selectedSong.syncData ? selectedSong.syncData.map(l => l.text).join('\n') : '');
      const basePalette = getDistinctArtistColors(rawLyricsStr, selectedSong.artistName, featuredArtists);
      const masterColors = { ...basePalette, ...selectedSong.artistColors };
      const cleanedLiveLines = parseLyrics(rawLyricsStr, selectedSong.artistName, masterColors);
      
      setLiveParsedLyrics(cleanedLiveLines);

      setCustomData({
        spotify: selectedSong.customLinks?.spotify || '',
        yt: selectedSong.customLinks?.yt || '',
        deezer: selectedSong.customLinks?.deezer || '',
        hasLocal: selectedSong.customLinks?.hasLocal || false,
        localName: selectedSong.customLinks?.localName || '',
        lyrics: rawLyricsStr,
        artistImages: selectedSong.artistImages || {},
        artistColors: selectedSong.artistColors || {}
      });

      if (isNewTrack) {
        const uniqueSingers = [...new Set(cleanedLiveLines.map(line => line.singer).filter(Boolean))];
        uniqueSingers.forEach(async (singer) => {
          const individualNames = singer.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean);
          individualNames.forEach(async (name) => {
            const cleanName = name.trim();
            if (cleanName !== selectedSong.artistName && !singerImages[cleanName] && !(selectedSong.artistImages && selectedSong.artistImages[cleanName])) {
              const imgUrl = await fetchSingerImage(selectedSong.artistName, cleanName);
              if (imgUrl) setSingerImages(prev => ({ ...prev, [cleanName]: imgUrl }));
            }
          });
        });
      }
    }
  }, [selectedSong]);

  useEffect(() => {
    const loadSyncAudio = async () => {
      if (isSyncMode && selectedSong) {
        if (customData.hasLocal) {
          const file = await getAudioFile(selectedSong.trackId);
          if (file) setSyncAudioSrc(URL.createObjectURL(file));
          else setSyncAudioSrc(selectedSong.previewUrl);
        } else setSyncAudioSrc(selectedSong.previewUrl);
      }
    };
    loadSyncAudio();
  }, [isSyncMode, customData.hasLocal, selectedSong]);

  useEffect(() => {
    if (isSyncMode && syncAudioRef.current) {
      const savedVolume = localStorage.getItem('playerVolume');
      syncAudioRef.current.volume = savedVolume !== null ? parseFloat(savedVolume) : 1;
      syncAudioRef.current.playbackRate = playbackRate;
    }
  }, [isSyncMode, syncAudioSrc, playbackRate]);

  useEffect(() => {
    if (isSyncMode && activeLineRef.current) {
      const container = activeLineRef.current.parentElement;
      const offsetTop = activeLineRef.current.offsetTop;
      const scrollPos = offsetTop - (container.clientHeight / 2) + (activeLineRef.current.clientHeight / 2);
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activeSyncIndex, isSyncMode]);

  useEffect(() => {
    if (!isSyncMode) return;
    const handleKeyDown = (e) => {
      const currentIdx = activeIdxRef.current;
      const data = [...syncDataRef.current];
      const currentLine = data[currentIdx];

      if (e.key === 'ArrowDown') {
        e.preventDefault(); 
        if (currentLine.start === null) currentLine.start = syncAudioRef.current?.currentTime || 0;
        else if (currentLine.end === null) {
          currentLine.end = syncAudioRef.current?.currentTime || 0;
          if (currentIdx < data.length - 1) setActiveSyncIndex(currentIdx + 1);
        } else if (currentIdx < data.length - 1) setActiveSyncIndex(currentIdx + 1);
        setSyncData(data);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentLine.end !== null) {
          currentLine.end = null;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = currentLine.start;
        } else if (currentLine.start !== null) {
          currentLine.start = null;
          const prevEnd = currentIdx > 0 ? data[currentIdx - 1].end : 0;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = prevEnd || 0;
        } else if (currentIdx > 0) {
          setActiveSyncIndex(currentIdx - 1);
          if (syncAudioRef.current) syncAudioRef.current.currentTime = data[currentIdx - 1].start || 0;
        }
        setSyncData(data);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSyncMode]);

  const handleLineClick = (startTime) => {
    if (startTime === null || isSyncMode || isEditing || isImageManagerOpen) return;
    window.dispatchEvent(new CustomEvent('globalSeekRequest', { detail: { time: startTime, track: selectedSong } }));
  };

  const handleDataChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === 'lyrics' ? value : cleanUrl(value);
    setCustomData({ ...customData, [name]: finalValue });
  };

  const handleImageChange = (singerName, url) => {
    setCustomData(prev => ({ ...prev, artistImages: { ...prev.artistImages, [singerName]: cleanImageUrl(url) } }));
  };

  const handleColorChange = (singerName, colorHex) => {
    setCustomData(prev => ({ ...prev, artistColors: { ...prev.artistColors, [singerName]: colorHex } }));
  };

  const handleLocalFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await saveAudioFile(selectedSong.trackId, file);
      const newCustomData = { ...customData, hasLocal: true, localName: file.name };
      setCustomData(newCustomData);
      if (isSaved) updateSongInLibrary({ ...selectedSong, customLinks: { ...selectedSong.customLinks, hasLocal: true, localName: file.name }});
    }
  };

  const handleClearLocal = async () => {
    await deleteAudioFile(selectedSong.trackId);
    const newCustomData = { ...customData, hasLocal: false, localName: '' };
    setCustomData(newCustomData);
    if (isSaved) updateSongInLibrary({ ...selectedSong, customLinks: { ...selectedSong.customLinks, hasLocal: false, localName: '' }});
  };

  const saveData = () => {
    const basePalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName, featuredArtists);
    const masterPalette = { ...basePalette, ...customData.artistColors };
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);

    let updatedSyncData = selectedSong.syncData;

    if (updatedSyncData && updatedSyncData.some(l => l.start !== null)) {
      if (customData.lyrics) {
        updatedSyncData = mergeSyncWithGenius(updatedSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
      }
    }

    const updatedSong = { 
      ...selectedSong, 
      customLinks: { spotify: customData.spotify, yt: customData.yt, deezer: customData.deezer, hasLocal: customData.hasLocal, localName: customData.localName },
      lyrics: customData.lyrics,
      artistImages: customData.artistImages,
      artistColors: customData.artistColors,
      syncData: updatedSyncData
    };

    updateSongInLibrary(updatedSong);
    setIsEditing(false);
  };

  const saveImageManager = () => {
    updateSongInLibrary({ 
      ...selectedSong, 
      artistImages: customData.artistImages,
      artistColors: customData.artistColors
    });
    setIsImageManagerOpen(false);
  };

  const startSyncMode = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before syncing!");
    setCurrentTrack(null); 
    setIsSyncLoading(true);
    
    const basePalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName, featuredArtists);
    const masterPalette = { ...basePalette, ...customData.artistColors };
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
    
    let initialData = [];
    const linesText = parsedLines.map(l => l.text);
    const pronunciations = await getBulkPronunciations(linesText);

    if (selectedSong.syncData && selectedSong.syncData.length === parsedLines.length) {
      initialData = parsedLines.map((line, i) => ({ ...line, pronunciation: selectedSong.syncData[i].pronunciation || pronunciations[i], start: selectedSong.syncData[i].start, end: selectedSong.syncData[i].end })); 
    } else if (selectedSong.syncData && selectedSong.syncData.some(l => l.start !== null)) {
      const salvagedData = mergeSyncWithGenius(selectedSong.syncData, customData.lyrics, selectedSong.artistName, masterPalette);
      initialData = salvagedData.map((line, i) => ({ ...line, pronunciation: line.pronunciation || pronunciations[i] }));
    } else {
      initialData = parsedLines.map((line, i) => ({ ...line, pronunciation: pronunciations[i], start: null, end: null }));
    }
    
    setSyncData(initialData);
    setActiveSyncIndex(0);
    setIsSyncMode(true);
    setIsSyncLoading(false);
  };

  const saveSyncData = () => {
    updateSongInLibrary({ ...selectedSong, syncData: syncData, lyrics: customData.lyrics });
    setIsSyncMode(false);
  };

  const handleAutoSyncDatabases = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before auto-syncing!");
    setIsLrcFetching(true);
    
    try {
      let finalSyncData = null;
      let finalPlainText = "";
      let hasWordSync = false;
      let finalSource = 'None';
      let finalRawData = null;
      
      const youData = await fetchYouLyrics(selectedSong.trackName, selectedSong.artistName, selectedSong.trackTimeMillis);
      let youParsed = null;
      let youHasWordSync = false;
      
      if (youData && youData.syncedLyrics) {
        const masterPalette = getDistinctArtistColors(youData.syncedLyrics, selectedSong.artistName, featuredArtists);
        youParsed = parseLRC(youData.syncedLyrics, selectedSong.artistName, masterPalette);
        youHasWordSync = youParsed.syncData.some(line => line.wordSync && line.wordSync.length > 0);
      }

      if (youHasWordSync) {
        finalSyncData = youParsed.syncData;
        finalPlainText = youParsed.plainTextLyrics;
        hasWordSync = true;
        finalSource = 'YouLyrics API';
        finalRawData = youData;
      } else {
        const lrcData = await fetchLRCLIB(selectedSong.trackName, selectedSong.artistName, selectedSong.trackTimeMillis);
        
        if (lrcData && lrcData.syncedLyrics) {
          const masterPalette = getDistinctArtistColors(lrcData.syncedLyrics, selectedSong.artistName, featuredArtists);
          const lrcParsed = parseLRC(lrcData.syncedLyrics, selectedSong.artistName, masterPalette);
          const lrcHasWordSync = lrcParsed.syncData.some(line => line.wordSync && line.wordSync.length > 0);
          
          if (lrcHasWordSync || !youParsed) {
            finalSyncData = lrcParsed.syncData;
            finalPlainText = lrcParsed.plainTextLyrics;
            hasWordSync = lrcHasWordSync;
            finalSource = 'LRCLIB API';
            finalRawData = lrcData;
          } else {
            finalSyncData = youParsed.syncData;
            finalPlainText = youParsed.plainTextLyrics;
            finalSource = 'YouLyrics API (Fallback)';
            finalRawData = youData;
          }
        } else if (youParsed) {
          finalSyncData = youParsed.syncData;
          finalPlainText = youParsed.plainTextLyrics;
          finalSource = 'YouLyrics API (Fallback)';
          finalRawData = youData;
        } else {
          if (youData && youData.plainLyrics) {
            finalPlainText = youData.plainLyrics;
            finalSource = 'YouLyrics API (Plain Text)';
            finalRawData = youData;
          } else if (lrcData && lrcData.plainLyrics) {
            finalPlainText = lrcData.plainLyrics;
            finalSource = 'LRCLIB API (Plain Text)';
            finalRawData = lrcData;
          }
        }
      }

      setDebugInfo({ source: finalSource, rawData: finalRawData });

      if (!finalSyncData && !finalPlainText) {
        alert("No lyrics found in YouLyrics or LRCLIB for this track.");
        setIsLrcFetching(false);
        return;
      }

      if (finalSyncData) {
        if (customData.lyrics) {
          const basePalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName, featuredArtists);
          const masterPalette = { ...basePalette, ...customData.artistColors };
          finalSyncData = mergeSyncWithGenius(finalSyncData, customData.lyrics, selectedSong.artistName, masterPalette);
          finalPlainText = customData.lyrics; 
        }

        const linesText = finalSyncData.map(l => l.text);
        const pronunciations = await getBulkPronunciations(linesText);
        
        finalSyncData = finalSyncData.map((line, i) => ({
          ...line,
          pronunciation: pronunciations[i]
        }));

        const updatedSong = { ...selectedSong, syncData: finalSyncData, lyrics: finalPlainText };
        updateSongInLibrary(updatedSong);
        setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        setSyncData(finalSyncData);
        
        if (hasWordSync) {
          alert("Successfully auto-synced! (✨ Word-by-word Karaoke sync found!)");
        } else {
          alert("Successfully auto-synced! (Note: Only Line-by-Line sync was available in the database for this track)");
        }
      } else {
        const updatedSong = { ...selectedSong, lyrics: finalPlainText };
        updateSongInLibrary(updatedSong);
        setCustomData(prev => ({ ...prev, lyrics: finalPlainText }));
        alert("Imported plain lyrics (Synced lyrics were not available in either database).");
      }
    } catch (error) {
      console.error(error);
      alert("Error fetching lyrics from databases.");
    } finally {
      setIsLrcFetching(false);
    }
  };

  const toggleSyncPlay = () => {
    if (!syncAudioRef.current) return;
    if (syncAudioRef.current.paused) syncAudioRef.current.play().catch(err => console.log("Playback prevented:", err));
    else syncAudioRef.current.pause();
  };

  const autoTrackSyncPlayback = (time) => {
    const isRecording = syncDataRef.current[activeIdxRef.current]?.start !== null && syncDataRef.current[activeIdxRef.current]?.end === null;
    if (isRecording) return; 

    const newIdx = syncDataRef.current.findIndex((line, i) => {
      const nextLine = syncDataRef.current[i + 1];
      if (line.start === null) return false;
      const isStarted = time >= line.start;
      const isBeforeEnd = line.end !== null ? time <= line.end : true;
      const isBeforeNext = nextLine && nextLine.start !== null ? time < nextLine.start : true;
      return isStarted && isBeforeEnd && isBeforeNext;
    });

    if (newIdx !== -1 && newIdx !== activeIdxRef.current) setActiveSyncIndex(newIdx);
  };

  const handleSyncTimeUpdate = () => {
    const time = syncAudioRef.current?.currentTime || 0;
    setSyncProgress(time);
    if (isSyncPlaying) autoTrackSyncPlayback(time);
  };

  const handleSyncSeek = (e) => {
    const time = Number(e.target.value);
    if (syncAudioRef.current) syncAudioRef.current.currentTime = time;
    setSyncProgress(time);
    autoTrackSyncPlayback(time);
  };

  const handleSpeedChange = (e) => setPlaybackRate(parseFloat(e.target.value));
  
  const cycleViewMode = () => setLyricsViewMode(prev => 
    prev === 'live' ? 'focused' : 
    prev === 'focused' ? 'karaoke' : 
    prev === 'karaoke' ? 'debug' :
    prev === 'debug' ? 'plain' : 'live'
  );

  const isPlayingCurrentSong = currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId;
  let activePreviewIndex = -1;

  if (hasValidSyncData && !isSyncMode && !isEditing && !isImageManagerOpen && isPlayingCurrentSong) {
    activePreviewIndex = selectedSong.syncData.findIndex((savedNode, i) => {
      if (!savedNode || savedNode.start === null) return false;
      const nextNode = selectedSong.syncData[i + 1];
      const isStarted = globalProgress >= savedNode.start;
      const isBeforeEnd = savedNode.end !== null ? globalProgress <= savedNode.end : true;
      const isBeforeNext = nextNode && nextNode.start !== null ? globalProgress < nextNode.start : true;
      return isStarted && isBeforeEnd && isBeforeNext;
    });
  }

  useEffect(() => {
    if (!isSyncMode && !isEditing && !isImageManagerOpen && (lyricsViewMode === 'live' || lyricsViewMode === 'focused' || lyricsViewMode === 'karaoke') && activePreviewRef.current) {
      const container = activePreviewRef.current.parentElement;
      const offsetTop = activePreviewRef.current.offsetTop;
      const scrollPos = offsetTop - (container.clientHeight / 2) + (activePreviewRef.current.clientHeight / 2);
      
      if (lyricsViewMode === 'live' || lyricsViewMode === 'karaoke') container.scrollTop = scrollPos;
      else container.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  }, [activePreviewIndex, isSyncMode, isEditing, isImageManagerOpen, lyricsViewMode]);

  // NEW SNAPPY ENGINE: Safely fading in/out exactly when artist changes
  useEffect(() => {
    if (!selectedSong) return;

    if (!hasValidSyncData) {
      setCurrentSingerBg({ name: selectedSong.artistName, color: '#fff' });
      setIsSingerVisible(true);
      return;
    }

    const activeLineObj = liveParsedLyrics[activePreviewIndex];

    if (activeLineObj && activeLineObj.singer) {
      if (singerTimeoutRef.current) clearTimeout(singerTimeoutRef.current);

      if (activeSingerRef.current && activeSingerRef.current !== activeLineObj.singer) {
        // Singer changed! Trigger CSS fade out first
        setIsSingerVisible(false); 
        
        // Wait 200ms for it to disappear, swap data, then fade back in
        singerTimeoutRef.current = setTimeout(() => {
          activeSingerRef.current = activeLineObj.singer;
          setCurrentSingerBg({ 
            name: activeLineObj.singer, 
            color: activeLineObj.isGradient ? '#fff' : activeLineObj.color 
          });
          setIsSingerVisible(true);
        }, 200); 
      } else {
        // Same singer, or first time showing up
        activeSingerRef.current = activeLineObj.singer;
        setCurrentSingerBg({ 
          name: activeLineObj.singer, 
          color: activeLineObj.isGradient ? '#fff' : activeLineObj.color 
        });
        setIsSingerVisible(true);
      }
    } else {
      if (singerTimeoutRef.current) clearTimeout(singerTimeoutRef.current);
      setIsSingerVisible(false);
      activeSingerRef.current = null;
    }

    return () => {
      if (singerTimeoutRef.current) clearTimeout(singerTimeoutRef.current);
    };
  }, [activePreviewIndex, liveParsedLyrics, selectedSong?.artistName, hasValidSyncData]);

  if (!selectedSong) return null;

  const isSingle = selectedSong.trackCount === 1 || selectedSong.collectionName === selectedSong.trackName;
  const releaseType = isSingle ? 'Single' : selectedSong.collectionName || 'Single';
  const highResArt = selectedSong.artworkUrl100?.replace(/100x100bb/g, '1000x1000bb').replace(/100x100/g, '1000x1000');
  
  const minutes = Math.floor(selectedSong.trackTimeMillis / 60000);
  const seconds = ((selectedSong.trackTimeMillis % 60000) / 1000).toFixed(0);
  const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const searchQuery = encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName}`);
  const ytSearchQuery = encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} ${timeString}`);

  const finalLinks = {
    spotify: customData.spotify || `https://open.spotify.com/search/${searchQuery}`,
    yt: customData.yt || `https://music.youtube.com/search?q=${ytSearchQuery}`,
    deezer: customData.deezer || `https://www.deezer.com/search/${searchQuery}`,
  };

  const basePalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName, featuredArtists);
  const masterPalette = { ...basePalette, ...customData.artistColors };
  const allPotentialSingers = Object.keys(masterPalette).filter(Boolean); 

  const sharedProps = {
    selectedSong, isSaved, customData, isEditing, setIsEditing, isSyncMode, setIsSyncMode,
    isSyncLoading, isLrcFetching, handleAutoSyncDatabases, isImageManagerOpen, setIsImageManagerOpen, syncData, activeSyncIndex,
    syncProgress, syncDuration, setSyncDuration, isSyncPlaying, syncAudioSrc, playbackRate, singerImages,
    currentSingerBg, isSingerVisible, settings, lyricsViewMode, liveParsedLyrics, activePreviewIndex, hasValidSyncData,
    highResArt, releaseType, finalLinks, masterPalette, allPotentialSingers, globalProgress, debugInfo,
    handleDataChange, handleImageChange, handleColorChange, handleLocalFileChange, handleClearLocal,
    saveData, saveImageManager, startSyncMode, saveSyncData, toggleSyncPlay,
    handleSyncSeek, handleSpeedChange, handleLineClick, cycleViewMode, toggleLibrary,
    setCurrentTrack, setSyncData, setActiveSyncIndex, setIsSyncPlaying, handleSyncTimeUpdate
  };

  return (
    <div className="modal-backdrop" onClick={() => setSelectedSong(null)}>
      <div className="modal-window glass-panel" onClick={(e) => e.stopPropagation()}>
        <img src={highResArt} alt="" className="modal-dynamic-bg" aria-hidden="true" />
        
        <div className="modal-content-wrapper">
          <button className="close-btn glass-button" onClick={() => setSelectedSong(null)}>✕</button>
          <div className="modal-two-column-layout">
            <ModalLeft {...sharedProps} />
            <ModalRight 
              {...sharedProps} 
              syncAudioRef={syncAudioRef} 
              activeLineRef={activeLineRef} 
              activePreviewRef={activePreviewRef} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongModal;