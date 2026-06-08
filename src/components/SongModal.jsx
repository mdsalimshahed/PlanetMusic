/* --- src/components/SongModal.jsx --- */
import React, { useState, useEffect, useRef } from 'react';
import { saveAudioFile, deleteAudioFile, getAudioFile } from '../db';
import { getBulkPronunciations } from '../transliterator'; 
import './SongModal.css';

// --- ULTIMATE GENIUS PARSER & STUDIO IMAGE ENGINE ---

const getDistinctArtistColors = (rawLyrics, defaultArtist) => {
  const artistColors = {};
  if (!rawLyrics) {
    artistColors[defaultArtist] = `hsl(0, 85%, 70%)`;
    return artistColors;
  }

  const headerLines = rawLyrics.split('\n').filter(l => l.startsWith('[') && l.endsWith(']'));
  const discoveredNames = new Set([defaultArtist]);

  headerLines.forEach(line => {
    const content = line.slice(1, -1);
    if (content.includes(':')) {
      const singersPart = content.split(':').slice(1).join(':').trim();
      const nakedNames = singersPart.replace(/<\/?[^>]+(>|$)/g, "");
      const splitNames = nakedNames.split(/,|\s&\s|\sand\s/).map(n => n.trim()).filter(Boolean);
      splitNames.forEach(name => discoveredNames.add(name));
    }
  });

  const artistArray = Array.from(discoveredNames);
  artistArray.forEach((artist, index) => {
    const hue = (index * (360 / artistArray.length) + 45) % 360;
    artistColors[artist] = `hsl(${hue}, 90%, 75%)`;
  });

  return artistColors;
};

// State Machine Parser: Resolves nested formatting and maps individual / duet gradients
const parseLyrics = (raw, defaultArtist, colorPalette) => {
  if (!raw) return [];
  const lines = raw.split('\n').map(l => l.trim());
  const result = [];
  
  let currentDefaultSinger = defaultArtist;
  let tagMap = {};
  let activeHtmlTag = null; 

  lines.forEach(line => {
    if (!line) return; 
    
    // Process Section Headers: [Chorus: Solji, <i>Elly</i>]
    const headerMatch = line.match(/^\[(.*?)\]$/);
    if (headerMatch) {
      const content = headerMatch[1];
      tagMap = {}; 
      activeHtmlTag = null; 
      
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        const singerEntries = singersPart.split(',').map(s => s.trim());
        
        singerEntries.forEach((entry, idx) => {
           const tagRegex = /^((?:<[a-zA-Z0-9]+>)*)(.*?)((?:<\/[a-zA-Z0-9]+>)*)$/;
           const match = entry.match(tagRegex);
           if (match) {
             const openingTags = match[1]; 
             const name = match[2].replace(/<\/?[^>]+(>|$)/g, "").trim(); // Strip formatting inside header names
             
             if (openingTags) {
               tagMap[openingTags] = name;
             } else if (idx === 0) {
               currentDefaultSinger = name || defaultArtist;
             }
           }
        });
      } else {
        currentDefaultSinger = defaultArtist; 
      }
      return; 
    }

    // Resolve Singer Context for this line
    let lineSinger = currentDefaultSinger;
    if (activeHtmlTag && tagMap[activeHtmlTag]) {
      lineSinger = tagMap[activeHtmlTag];
    }

    const openTagMatch = line.match(/((?:<[a-zA-Z0-9]+>)+)/);
    if (openTagMatch) {
      const tags = openTagMatch[1];
      if (tagMap[tags]) {
        lineSinger = tagMap[tags]; 
        activeHtmlTag = tags; 
      }
    }

    if (activeHtmlTag && line.includes('</')) {
      activeHtmlTag = null; 
    }

    // AGGRESSIVE SANITIZATION: Eliminate every single HTML block or stray tag before rendering
    const cleanText = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
    if (!cleanText) return;

    // COMPILE GRADIENT LOGIC
    let finalColor = '#ffffff';
    let isGradient = false;
    let gradientStyle = '';

    // Split the active singer string to see if it is a compound duet (e.g. "Hani & Jeonghwa")
    const subArtists = lineSinger.split(/,|\s&\s|\sand\s/).map(n => n.trim()).filter(Boolean);

    if (subArtists.length > 1) {
      isGradient = true;
      const c1 = colorPalette[subArtists[0]] || 'hsl(0, 100%, 100%)';
      const c2 = colorPalette[subArtists[1]] || 'hsl(180, 100%, 100%)';
      gradientStyle = `linear-gradient(90deg, ${c1}, ${c2})`;
    } else {
      finalColor = colorPalette[lineSinger] || colorPalette[defaultArtist] || '#ffffff';
    }

    result.push({
      text: cleanText,
      singer: lineSinger,
      color: finalColor,
      isGradient: isGradient,
      gradient: gradientStyle
    });
  });
  return result;
};

// Studio Image Scraper: Deezer Promos & TheAudioDB (Bypasses Wikipedia amateur photos)
const fetchSingerImage = async (band, singer) => {
  if (!singer || singer === band || singer.includes('&') || singer.includes(',')) return null;
  
  // Try Deezer Artist API first (highest resolution promo shots)
  try {
    const deezerRes = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(singer)}`);
    const deezerData = await deezerRes.json();
    if (deezerData && deezerData.data && deezerData.data.length > 0) {
      if (deezerData.data[0].picture_xl) return deezerData.data[0].picture_xl;
    }
  } catch (e) {}

  // Fallback to TheAudioDB (Dedicated music metadata api)
  try {
    const adbRes = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(singer)}`);
    const adbData = await adbRes.json();
    if (adbData.artists && adbData.artists[0].strArtistThumb) {
      return adbData.artists[0].strArtistThumb;
    }
  } catch (e) {}
  
  return null;
};

// ----------------------------------------------------

const formatTime = (millis) => {
  if (!millis) return "N/A";
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const formatPreciseTime = (sec) => {
  if (isNaN(sec) || sec === null) return "--:--.---";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms.toString().padStart(3, '0')}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const cleanUrl = (urlStr) => {
  if (!urlStr) return '';
  try {
    const url = new URL(urlStr);
    const trackers = ['host', 'deferredFl', 'universal_link', 'si', 'context', 'nd', 'ls', 'app', 'at', 'ct', 'l', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'feature', 'fbclid', 'igshid'];
    trackers.forEach(param => url.searchParams.delete(param));
    return url.toString();
  } catch (e) {
    return urlStr;
  }
};

const SongModal = ({ selectedSong, setSelectedSong, isSaved, toggleLibrary, updateSongInLibrary, setCurrentTrack }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Stores platform links & manual artist image overrides
  const [customData, setCustomData] = useState({ 
    spotify: '', yt: '', deezer: '', hasLocal: false, localName: '', lyrics: '', artistImages: {} 
  });

  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
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

  const [lyricsViewMode, setLyricsViewMode] = useState('live'); 
  const [globalProgress, setGlobalProgress] = useState(0);

  // Array reference to bind layout updates and avoid structural shifts
  const [liveParsedLyrics, setLiveParsedLyrics] = useState([]);

  const syncAudioRef = useRef(null);
  const activeLineRef = useRef(null);
  const activePreviewRef = useRef(null);
  
  const activeIdxRef = useRef(activeSyncIndex);
  const syncDataRef = useRef(syncData);
  const previousTrackId = useRef(null);

  useEffect(() => {
    activeIdxRef.current = activeSyncIndex;
    syncDataRef.current = syncData;
  }, [activeSyncIndex, syncData]);

  useEffect(() => {
    const handleGlobalTime = (e) => setGlobalProgress(e.detail);
    window.addEventListener('globalTimeUpdate', handleGlobalTime);
    return () => window.removeEventListener('globalTimeUpdate', handleGlobalTime);
  }, []);

  // MASTER SYNC & RE-RENDER TRIGGER LOOP
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
        setPlaybackRate(1.0); 
      }

      const rawLyricsStr = selectedSong.lyrics || (selectedSong.syncData ? selectedSong.syncData.map(l => l.text).join('\n') : '');
      const masterColors = getDistinctArtistColors(rawLyricsStr, selectedSong.artistName);
      const cleanedLiveLines = parseLyrics(rawLyricsStr, selectedSong.artistName, masterColors);
      
      setLiveParsedLyrics(cleanedLiveLines);

      setCustomData({
        spotify: selectedSong.customLinks?.spotify || '',
        yt: selectedSong.customLinks?.yt || '',
        deezer: selectedSong.customLinks?.deezer || '',
        hasLocal: selectedSong.customLinks?.hasLocal || false,
        localName: selectedSong.customLinks?.localName || '',
        lyrics: rawLyricsStr,
        artistImages: selectedSong.artistImages || {} 
      });

      if (isNewTrack) {
        const uniqueSingers = [...new Set(cleanedLiveLines.map(line => line.singer).filter(Boolean))];
        uniqueSingers.forEach(async (singer) => {
          const individualNames = singer.split(/,|\s&\s|\sand\s/).map(n => n.trim()).filter(Boolean);
          individualNames.forEach(async (name) => {
            // ONLY fire the scraper if the user hasn't provided a manual URL for this singer
            if (name !== selectedSong.artistName && !singerImages[name] && !(selectedSong.artistImages && selectedSong.artistImages[name])) {
              const imgUrl = await fetchSingerImage(selectedSong.artistName, name);
              if (imgUrl) setSingerImages(prev => ({ ...prev, [name]: imgUrl }));
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
        } else {
          setSyncAudioSrc(selectedSong.previewUrl);
        }
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
        if (currentLine.start === null) {
          currentLine.start = syncAudioRef.current?.currentTime || 0;
        } else if (currentLine.end === null) {
          currentLine.end = syncAudioRef.current?.currentTime || 0;
          if (currentIdx < data.length - 1) setActiveSyncIndex(currentIdx + 1);
        } else {
          if (currentIdx < data.length - 1) setActiveSyncIndex(currentIdx + 1);
        }
        setSyncData(data);
      } 
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentLine.end !== null) {
          currentLine.end = null;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = currentLine.start;
        } else if (currentLine.start !== null) {
          currentLine.start = null;
          const prevEnd = currentIdx > 0 ? data[currentIdx - 1].end : 0;
          if (syncAudioRef.current) syncAudioRef.current.currentTime = prevEnd || 0;
        } else {
          if (currentIdx > 0) {
            setActiveSyncIndex(currentIdx - 1);
            if (syncAudioRef.current) syncAudioRef.current.currentTime = data[currentIdx - 1].start || 0;
          }
        }
        setSyncData(data);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSyncMode]);

  const handleLineClick = (startTime) => {
    if (startTime === null || isSyncMode || isEditing || isImageManagerOpen) return;
    window.dispatchEvent(new CustomEvent('globalSeekRequest', { 
      detail: { time: startTime, track: selectedSong } 
    }));
  };

  const handleDataChange = (e) => {
    const { name, value } = e.target;
    const finalValue = name === 'lyrics' ? value : cleanUrl(value);
    setCustomData({ ...customData, [name]: finalValue });
  };

  const handleImageChange = (singerName, url) => {
    setCustomData(prev => ({
      ...prev,
      artistImages: { ...prev.artistImages, [singerName]: url }
    }));
  };

  const handleLocalFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await saveAudioFile(selectedSong.trackId, file);
      const newCustomData = { ...customData, hasLocal: true, localName: file.name };
      setCustomData(newCustomData);

      if (isSaved) {
        updateSongInLibrary({ 
          ...selectedSong, 
          customLinks: {
            spotify: newCustomData.spotify, yt: newCustomData.yt, deezer: newCustomData.deezer, 
            hasLocal: true, localName: file.name
          }
        });
      }
    }
  };

  const handleClearLocal = async () => {
    await deleteAudioFile(selectedSong.trackId);
    const newCustomData = { ...customData, hasLocal: false, localName: '' };
    setCustomData(newCustomData);

    if (isSaved) {
      updateSongInLibrary({ 
        ...selectedSong, 
        customLinks: {
          spotify: newCustomData.spotify, yt: newCustomData.yt, deezer: newCustomData.deezer, 
          hasLocal: false, localName: ''
        }
      });
    }
  };

  const saveData = () => {
    const masterPalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName);
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);

    const updatedSong = { 
      ...selectedSong, 
      customLinks: {
        spotify: customData.spotify, yt: customData.yt, deezer: customData.deezer, 
        hasLocal: customData.hasLocal, localName: customData.localName
      },
      lyrics: customData.lyrics,
      artistImages: customData.artistImages 
    };

    if (updatedSong.syncData && updatedSong.syncData.length === parsedLines.length) {
      updatedSong.syncData = updatedSong.syncData.map((line, idx) => ({
        ...line,
        text: parsedLines[idx].text,
        singer: parsedLines[idx].singer,
        color: parsedLines[idx].color,
        isGradient: parsedLines[idx].isGradient,
        gradient: parsedLines[idx].gradient
      }));
    }

    updateSongInLibrary(updatedSong);
    setIsEditing(false);
  };

  const saveImageManager = () => {
    updateSongInLibrary({ ...selectedSong, artistImages: customData.artistImages });
    setIsImageManagerOpen(false);
  };

  const startSyncMode = async () => {
    if (!isSaved) return alert("Please add this song to your Vault first before syncing!");
    setCurrentTrack(null); 
    setIsSyncLoading(true);
    
    const masterPalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName);
    const parsedLines = parseLyrics(customData.lyrics, selectedSong.artistName, masterPalette);
    let initialData = [];

    const linesText = parsedLines.map(l => l.text);
    const pronunciations = await getBulkPronunciations(linesText);

    if (selectedSong.syncData && selectedSong.syncData.length === parsedLines.length) {
      initialData = parsedLines.map((line, i) => ({ 
        ...line, 
        pronunciation: selectedSong.syncData[i].pronunciation || pronunciations[i],
        start: selectedSong.syncData[i].start,
        end: selectedSong.syncData[i].end
      })); 
    } 
    else {
      initialData = parsedLines.map((line, i) => ({
        ...line,
        pronunciation: pronunciations[i],
        start: null,
        end: null
      }));
    }
    
    setSyncData(initialData);
    setActiveSyncIndex(0);
    setIsSyncMode(true);
    setIsSyncLoading(false);
  };

  const saveSyncData = () => {
    const updatedSong = { 
      ...selectedSong, 
      syncData: syncData,
      lyrics: customData.lyrics 
    };
    updateSongInLibrary(updatedSong);
    setIsSyncMode(false);
  };

  const toggleSyncPlay = () => {
    if (!syncAudioRef.current) return;
    if (syncAudioRef.current.paused) {
      syncAudioRef.current.play().catch(err => console.log("Playback prevented:", err));
    } else {
      syncAudioRef.current.pause();
    }
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

  const handleSpeedChange = (e) => {
    const speed = parseFloat(e.target.value);
    setPlaybackRate(speed);
  };

  const hasValidSyncData = selectedSong?.syncData?.some(line => line.start !== null);
  let activePreviewIndex = -1;

  if (hasValidSyncData && !isSyncMode && !isEditing && !isImageManagerOpen) {
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
    if (!isSyncMode && !isEditing && !isImageManagerOpen && (lyricsViewMode === 'live' || lyricsViewMode === 'focused') && activePreviewRef.current) {
      const container = activePreviewRef.current.parentElement;
      const offsetTop = activePreviewRef.current.offsetTop;
      const scrollPos = offsetTop - (container.clientHeight / 2) + (activePreviewRef.current.clientHeight / 2);
      
      if (lyricsViewMode === 'live') {
        container.scrollTop = scrollPos;
      } else {
        container.scrollTo({ top: scrollPos, behavior: 'smooth' });
      }
    }
  }, [activePreviewIndex, isSyncMode, isEditing, isImageManagerOpen, lyricsViewMode]);

  useEffect(() => {
    const activeLineObj = liveParsedLyrics[activePreviewIndex];
    if (activeLineObj && activeLineObj.singer) {
      if (activeLineObj.singer !== selectedSong.artistName) {
        setCurrentSingerBg({ 
          name: activeLineObj.singer, 
          color: activeLineObj.isGradient ? '#fff' : activeLineObj.color 
        });
      } else {
        setCurrentSingerBg(null); 
      }
    }
  }, [activePreviewIndex, liveParsedLyrics, selectedSong]);

  const cycleViewMode = () => {
    setLyricsViewMode(prev => {
      if (prev === 'live') return 'focused';
      if (prev === 'focused') return 'plain';
      return 'live';
    });
  };

  if (!selectedSong) return null;

  const isSingle = selectedSong.trackCount === 1 || selectedSong.collectionName === selectedSong.trackName;
  const releaseType = isSingle ? 'Single' : selectedSong.collectionName || 'Single';
  const highResArt = selectedSong.artworkUrl100?.replace('100x100', '600x600');
  const searchQuery = encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName}`);

  const finalLinks = {
    spotify: customData.spotify || `https://open.spotify.com/search/${searchQuery}`,
    yt: customData.yt || `https://music.youtube.com/search?q=${searchQuery}`,
    deezer: customData.deezer || `https://www.deezer.com/search/${searchQuery}`,
  };

  // Compile Master Palette & Extract Potential Singers for the Image Manager
  const masterPalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName);
  const allPotentialSingers = Object.keys(masterPalette); // Includes default and featured

  return (
    <div className="modal-backdrop" onClick={() => setSelectedSong(null)}>
      <div className="modal-window glass-panel" onClick={(e) => e.stopPropagation()}>
        <img src={highResArt} alt="" className="modal-dynamic-bg" aria-hidden="true" />
        
        <div className="modal-content-wrapper">
          <button className="close-btn glass-button" onClick={() => setSelectedSong(null)}>✕</button>
          
          <div className="modal-two-column-layout">
            <div className="modal-left-col">
              
              <div className="modal-top">
                <img src={highResArt} alt="Artwork" className="modal-cover" />
                <div className="modal-header-info">
                  <span className="modal-type">{selectedSong.primaryGenreName}</span>
                  <h2 className="text-glow">{selectedSong.trackName}</h2>
                  <div className="modal-artist-row">
                    <strong>{selectedSong.artistName}</strong>
                    <span>•</span>
                    <span>{formatDate(selectedSong.releaseDate)}</span>
                    <span>•</span>
                    <span>{formatTime(selectedSong.trackTimeMillis)}</span>
                  </div>
                </div>
              </div>

              <div className="modal-details glass-panel-light">
                <div className="detail-item"><label>Album / Release</label><p>{releaseType}</p></div>
                <div className="detail-item"><label>Track Number</label><p>{selectedSong.trackNumber ? `${selectedSong.trackNumber} of ${selectedSong.trackCount || '?'}` : 'N/A'}</p></div>
                <div className="detail-item"><label>Explicit</label><p>{selectedSong.trackExplicitness === 'explicit' ? 'Yes' : 'No'}</p></div>
              </div>

              <div className="modal-links glass-panel-light">
                <div className="links-header"><label>Listen on Platforms</label></div>
                
                {isEditing ? (
                  <div className="platform-inputs-grid">
                    <div className="platform-input-row"><span className="platform-label spotify-color">Spotify</span><input type="text" name="spotify" value={customData.spotify} onChange={handleDataChange} /></div>
                    <div className="platform-input-row"><span className="platform-label yt-color">YT Music</span><input type="text" name="yt" value={customData.yt} onChange={handleDataChange} /></div>
                    <div className="platform-input-row"><span className="platform-label deezer-color">Deezer</span><input type="text" name="deezer" value={customData.deezer} onChange={handleDataChange} /></div>
                    <div className="platform-input-row">
                      <span className="platform-label local-color">Local MP3</span>
                      <input type="file" accept="audio/*" id="localFileInput" style={{ display: 'none' }} onChange={handleLocalFileChange} />
                      <label htmlFor="localFileInput" className={`local-file-btn ${customData.hasLocal ? 'has-file' : ''}`}>
                        {customData.hasLocal ? customData.localName : "Browse Local Files..."}
                      </label>
                      {customData.hasLocal && (<button className="clear-local-btn" onClick={handleClearLocal}>✕</button>)}
                    </div>
                  </div>
                ) : (
                  <div className="platform-links">
                    <a href={finalLinks.spotify} target="_blank" rel="noreferrer" className="platform-btn spotify">Spotify</a>
                    <a href={finalLinks.yt} target="_blank" rel="noreferrer" className="platform-btn yt">YT Music</a>
                    <a href={finalLinks.deezer} target="_blank" rel="noreferrer" className="platform-btn deezer">Deezer</a>
                    {customData.hasLocal && (
                      <button className="platform-btn local" onClick={() => setCurrentTrack({ ...selectedSong, customLinks: customData })}>Play Local Audio</button>
                    )}
                  </div>
                )}
              </div>

              <div className="workspace-controls glass-panel-light">
                <div className="links-header"><label>Workspace Controls</label></div>
                <div className="action-buttons-grid">
                  {isSyncMode ? (
                    <>
                      <button className="edit-links-btn" onClick={() => setIsSyncMode(false)}>✕ Cancel Sync</button>
                      <button className="edit-links-btn save-mode" onClick={saveSyncData}>✓ Save Timings</button>
                    </>
                  ) : isEditing ? (
                    <button className="edit-links-btn save-mode" onClick={saveData}>✓ Save Info & Lyrics</button>
                  ) : isImageManagerOpen ? (
                    <button className="edit-links-btn save-mode" onClick={saveImageManager}>✓ Save Images</button>
                  ) : (
                    <>
                      <button className="edit-links-btn" onClick={() => setIsEditing(true)}>✎ Edit Info</button>
                      
                      {customData.lyrics ? (
                        <>
                          <button 
                            className="edit-links-btn" 
                            onClick={startSyncMode}
                            disabled={isSyncLoading}
                            style={{ opacity: isSyncLoading ? 0.6 : 1, cursor: isSyncLoading ? 'wait' : 'pointer' }}
                          >
                            {isSyncLoading ? '⏳ Parsing Engine...' : hasValidSyncData ? '⏱ Edit Timings' : '⏱ Sync Lyrics'}
                          </button>
                          
                          {/* Image Override Management Panel */}
                          {allPotentialSingers.length > 1 && (
                            <button className="edit-links-btn" onClick={() => setIsImageManagerOpen(true)}>
                              🖼️ Manage Artist Images
                            </button>
                          )}
                          
                          {hasValidSyncData && !isSyncLoading && (
                            <button className="edit-links-btn toggle-view-btn" onClick={cycleViewMode}>
                              {lyricsViewMode === 'live' ? '🎯 Show Focused Sync' 
                                : lyricsViewMode === 'focused' ? '📄 Show Plain Text' 
                                : '✨ Show Live Sync'}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button className="edit-links-btn" onClick={() => setIsEditing(true)}>✎ Add Lyrics</button>
                          <a 
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${selectedSong.trackName} ${selectedSong.artistName} lyrics`)}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="edit-links-btn search-google-btn"
                          >
                            🔍 Search Google
                          </a>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bottom-actions">
                {isSaved ? (
                  <button className="delete-icon-btn" onClick={(e) => toggleLibrary(e, selectedSong)} title="Remove from Vault">🗑</button>
                ) : (
                  <button className="edit-links-btn save-mode" onClick={(e) => toggleLibrary(e, selectedSong)}>+ Add to Vault</button>
                )}
              </div>
            </div>

            <div className="modal-right-col glass-panel-light">
              
              {/* IMAGE MANAGER OVERLAY */}
              {isImageManagerOpen && (
                <div className="image-manager-container">
                  <h3 className="image-manager-title">Artist Image Override</h3>
                  <p className="image-manager-sub">Click a name to search Google Images for studio promotional shots. Copy the image address and paste it below to manually override their background graphic.</p>
                  
                  <div className="image-manager-list">
                    {allPotentialSingers.map(singer => {
                      // Filter out default album artist for simplicity in manual view
                      if (singer === selectedSong.artistName) return null;
                      
                      const searchTarget = encodeURIComponent(`${singer} ${selectedSong.artistName} singer professional studio promo`);
                      const googleUrl = `https://www.google.com/search?tbm=isch&q=${searchTarget}`;
                      
                      return (
                        <div key={singer} className="image-manager-row glass-panel-light">
                          <div className="img-manager-top-row">
                            <a href={googleUrl} target="_blank" rel="noreferrer" className="img-manager-name" style={{ color: masterPalette[singer] }}>
                              🔍 {singer}
                            </a>
                            {(customData.artistImages?.[singer] || singerImages[singer]) && (
                               <img src={customData.artistImages?.[singer] || singerImages[singer]} alt="Preview" className="img-manager-preview" />
                            )}
                          </div>
                          <input 
                            type="text" 
                            className="img-manager-input" 
                            placeholder="Paste Hand-Picked Image URL..." 
                            value={customData.artistImages?.[singer] || ''} 
                            onChange={(e) => handleImageChange(singer, e.target.value)} 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {lyricsViewMode !== 'plain' && !isSyncMode && !isEditing && !isImageManagerOpen && (
                <div className="dynamic-background-contained">
                  
                  {/* UNIFIED CROSSFADE STACK (Fade in/out instead of diagonal splice) */}
                  {allPotentialSingers.map(singerName => {
                    const isDefault = singerName === selectedSong.artistName;
                    
                    // Image source hierarchy: Manual Override -> Scraped -> Default Album Art (for default artist only)
                    const finalImgUrl = customData.artistImages?.[singerName] || 
                                        singerImages[singerName] || 
                                        (isDefault ? highResArt : null);

                    if (!finalImgUrl) return null;

                    // Compute if this specific artist is actively singing in the duet string
                    const isCurrentSingerActive = currentSingerBg?.name.includes(singerName);
                    
                    // FIXED: Simple, uniform crossfade logic. No split classes.
                    const imgClass = isCurrentSingerActive ? 'active-watermark' : 'inactive-watermark';

                    return (
                      <img 
                        key={singerName}
                        src={finalImgUrl} 
                        alt="" 
                        className={`singer-watermark ${imgClass}`} 
                      />
                    );
                  })}
                  
                  {/* Singer Name Corner (Rendered dynamically to support individual colors and white separators) */}
                  <div className={`singer-name-corner ${currentSingerBg ? 'visible' : 'hidden'}`}>
                    {currentSingerBg?.name.split(/(\s&\s|\s,\s|\sand\s)/).map((part, index) => {
                      const trimmedPart = part.trim();
                      
                      // Intercept ampersands/commas to keep them clean white
                      if (trimmedPart === '&' || trimmedPart === ',' || trimmedPart === 'and') {
                        return (
                          <span key={index} className="singer-name-separator">
                            {part}
                          </span>
                        );
                      }
                      
                      // Render actual artist names in their assigned vibrant standalone palette color
                      const masterPalette = getDistinctArtistColors(customData.lyrics, selectedSong.artistName);
                      const individualColor = masterPalette[trimmedPart] || '#fff';
                      
                      return (
                        <span key={index} style={{ color: individualColor }}>
                          {part}
                        </span>
                      );
                    })}
                  </div>

                </div>
              )}

              {isSyncMode && !isImageManagerOpen ? (
                <div className="sync-mode-container">
                  <div className="sync-player glass-panel">
                    <button className="sync-play-btn" onClick={toggleSyncPlay}>{isSyncPlaying ? '⏸' : '▶'}</button>
                    <span className="precise-time">{formatPreciseTime(syncProgress)}</span>
                    <input 
                      type="range" className="custom-slider sync-slider" 
                      min="0" max={syncDuration || 1} step="0.001" 
                      value={syncProgress} onChange={handleSyncSeek} 
                    />
                    <span className="precise-time">{formatPreciseTime(syncDuration)}</span>
                  </div>

                  <div className="sync-speed-deck glass-panel">
                    <div className="speed-label-container">
                      <span>Speed: <strong>{playbackRate.toFixed(2)}x</strong></span>
                      {playbackRate !== 1.0 && (
                        <button className="speed-reset-btn" onClick={() => setPlaybackRate(1.0)}>Reset</button>
                      )}
                    </div>
                    <input 
                      type="range" 
                      className="custom-slider speed-slider" 
                      min="0.5" 
                      max="2.0" 
                      step="0.05" 
                      value={playbackRate} 
                      onChange={handleSpeedChange} 
                    />
                    <div className="speed-ticks">
                      <span>0.5x</span>
                      <span>1.0x</span>
                      <span>1.5x</span>
                      <span>2.0x</span>
                    </div>
                  </div>

                  <div className="sync-lines-container">
                    {syncData.map((line, i) => {
                      const isRecording = line.start !== null && line.end === null;
                      const isSynced = line.start !== null && line.end !== null;
                      
                      return (
                        <div 
                          key={i}
                          ref={i === activeSyncIndex ? activeLineRef : null}
                          className={`sync-line ${i === activeSyncIndex ? 'active' : ''} ${isRecording ? 'recording' : ''} ${isSynced ? 'synced' : ''}`}
                          onClick={() => {
                            setActiveSyncIndex(i);
                            if (line.start !== null && syncAudioRef.current) syncAudioRef.current.currentTime = line.start;
                          }}
                        >
                          <div className="sync-text-wrapper">
                            <span 
                              className="sync-text" 
                              style={line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: line.color }}
                            >
                              {line.text}
                            </span>
                            {line.pronunciation && <span className="sync-pronunciation">{line.pronunciation}</span>}
                          </div>
                          <span className="sync-time">{formatPreciseTime(line.start)} - {formatPreciseTime(line.end)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sync-instructions">
                    <strong>1.</strong> Press ↓ to set Start Time<br/>
                    <strong>2.</strong> Press ↓ again to set End Time <em>(Auto advances)</em><br/>
                    <em>(Press ↑ anytime to rewind & overwrite)</em>
                  </div>
                  
                  <audio 
                    ref={syncAudioRef}
                    src={syncAudioSrc}
                    onTimeUpdate={handleSyncTimeUpdate}
                    onLoadedMetadata={() => setSyncDuration(syncAudioRef.current?.duration || 0)}
                    onEnded={() => setIsSyncPlaying(false)}
                    onPlay={() => setIsSyncPlaying(true)}
                    onPause={() => setIsSyncPlaying(false)}
                  />
                </div>
              ) : !isImageManagerOpen && (
                <>
                  {isEditing ? (
                    <textarea 
                      name="lyrics" 
                      value={customData.lyrics}
                      onChange={handleDataChange} 
                      className="lyrics-textarea"
                      placeholder="Paste your raw lyrics here! Full support for Genius headings and nested formatting tags included." 
                    />
                  ) : hasValidSyncData && lyricsViewMode === 'live' ? (
                    <div className="live-lyrics-preview">
                      {liveParsedLyrics.map((line, i) => {
                        const isActive = i === activePreviewIndex;
                        const savedNode = selectedSong.syncData[i];
                        const seekTarget = savedNode ? savedNode.start : null;
                        
                        return (
                          <div 
                            key={i} 
                            ref={isActive ? activePreviewRef : null}
                            className={`preview-line ${isActive ? 'active' : ''}`}
                            onClick={() => handleLineClick(seekTarget)}
                            style={{ cursor: seekTarget !== null ? 'pointer' : 'default' }}
                          >
                            <span 
                              className="primary-text" 
                              style={isActive ? (line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))' } : { color: line.color, textShadow: `0 0 20px ${line.color}80` }) : {}}
                            >
                              {line.text}
                            </span>
                            {savedNode?.pronunciation && <span className="pronunciation-text">{savedNode.pronunciation}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
                    <div className="focused-lyrics-preview">
                      {liveParsedLyrics.map((line, i) => {
                        const isActive = i === activePreviewIndex;
                        const savedNode = selectedSong.syncData[i];
                        const seekTarget = savedNode ? savedNode.start : null;
                        
                        return (
                          <div 
                            key={i} 
                            ref={isActive ? activePreviewRef : null}
                            className={`focused-line ${isActive ? 'active' : ''}`}
                            onClick={() => handleLineClick(seekTarget)}
                          >
                            <span 
                              className="primary-text" 
                              style={isActive ? (line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.4))' } : { color: line.color, textShadow: `0 0 30px ${line.color}80` }) : {}}
                            >
                              {line.text}
                            </span>
                            {savedNode?.pronunciation && <span className="pronunciation-text">{savedNode.pronunciation}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="lyrics-display">
                      {liveParsedLyrics.length > 0 ? (
                        liveParsedLyrics.map((line, i) => (
                          <div 
                            key={i} 
                            style={line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: line.singer !== selectedSong.artistName ? line.color : '#fff' }}
                          >
                            {line.text}
                          </div>
                        ))
                      ) : (
                        <div className="no-lyrics-empty-state">
                          <p>No lyrics found in your Vault.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongModal;